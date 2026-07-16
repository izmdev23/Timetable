import { useState, useEffect, useCallback } from 'react';
import Database from '@tauri-apps/plugin-sql';
import type { CommitRecord } from '../types';

let dbPromise: Promise<Database> | null = null;

function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:timetable.db');
  }
  return dbPromise;
}

export function useCommitHistory(timetableId: string) {
  const [commits, setCommits] = useState<CommitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from SQLite on mount
  useEffect(() => {
    if (!timetableId) return;
    setIsLoading(true);

    getDb()
      .then((db) =>
        db.select<{
          id: string;
          action_type: string;
          action_json: string;
          author: string;
          author_id: string;
          timestamp: string;
          description: string;
          is_undo: number;
          undone_commit_id: string | null;
        }[]>(
          'SELECT id, action_type, action_json, author, author_id, timestamp, description, is_undo, undone_commit_id FROM commit_history WHERE timetable_id = $1 ORDER BY timestamp DESC',
          [timetableId]
        )
      )
      .then((rows) => {
        const mapped = rows.map((r) => ({
          id: r.id,
          timetableId,
          actionType: r.action_type,
          actionJson: r.action_json,
          author: r.author,
          authorId: r.author_id,
          timestamp: new Date(r.timestamp).getTime(),
          description: r.description,
          isUndo: r.is_undo === 1,
          undoneCommitId: r.undone_commit_id,
        }));
        setCommits(mapped);
      })
      .catch((err) => console.error('Failed to load commit history:', err))
      .finally(() => setIsLoading(false));
  }, [timetableId]);

  // Listen for new commits from the queue
  useEffect(() => {
    if (!timetableId) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CommitRecord>).detail;
      if (detail && detail.timetableId === timetableId) {
        setCommits((prev) => [detail, ...prev]);
      }
    };

    window.addEventListener('commit:applied', handler);
    return () => window.removeEventListener('commit:applied', handler);
  }, [timetableId]);

  const addCommit = useCallback(async (record: CommitRecord) => {
    try {
      const db = await getDb();
      await db.execute(
        'INSERT INTO commit_history (id, timetable_id, action_type, action_json, author, author_id, timestamp, description, is_undo, undone_commit_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [
          record.id,
          record.timetableId,
          record.actionType,
          record.actionJson,
          record.author,
          record.authorId,
          new Date(record.timestamp).toISOString(),
          record.description,
          record.isUndo ? 1 : 0,
          record.undoneCommitId,
        ]
      );
      // Fire event for sidebar to pick up
      window.dispatchEvent(new CustomEvent('commit:applied', { detail: record }));
    } catch (err) {
      console.error('Failed to insert commit record:', err);
    }
  }, []);

  const getCommitsSince = useCallback(async (sinceTimestamp: number): Promise<CommitRecord[]> => {
    try {
      const db = await getDb();
      const rows = await db.select<{
        id: string;
        action_type: string;
        action_json: string;
        author: string;
        author_id: string;
        timestamp: string;
        description: string;
        is_undo: number;
        undone_commit_id: string | null;
      }[]>(
        'SELECT id, action_type, action_json, author, author_id, timestamp, description, is_undo, undone_commit_id FROM commit_history WHERE timetable_id = $1 AND julianday(timestamp) * 86400000 + 62135596800000 > $2 ORDER BY timestamp ASC',
        [timetableId, sinceTimestamp]
      );
      return rows.map((r) => ({
        id: r.id,
        timetableId,
        actionType: r.action_type,
        actionJson: r.action_json,
        author: r.author,
        authorId: r.author_id,
        timestamp: new Date(r.timestamp).getTime(),
        description: r.description,
        isUndo: r.is_undo === 1,
        undoneCommitId: r.undone_commit_id,
      }));
    } catch (err) {
      console.error('Failed to get commits since:', err);
      return [];
    }
  }, [timetableId]);

  return { commits, isLoading, addCommit, getCommitsSince };
}
