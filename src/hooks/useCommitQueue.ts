import { useRef, useCallback, useState } from 'react';
import Queue from 'queue';
import type { QueueWorkerCallback } from 'queue';
import type { CollabAction } from '../types';

interface QueuedCommit {
  id: string;
  action: CollabAction;
  description: string;
  timestamp: number;
}

interface UseCommitQueueOptions {
  onProcessed?: (commit: QueuedCommit) => void;
  onError?: (error: Error, commit: QueuedCommit) => void;
}

export function useCommitQueue({ onProcessed, onError }: UseCommitQueueOptions = {}) {
  const queueRef = useRef<Queue | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const actionCounterRef = useRef(0);

  if (!queueRef.current) {
    queueRef.current = new Queue({ concurrency: 1, autostart: true, timeout: 30000 });
  }

  const enqueueCommit = useCallback((action: CollabAction, description: string): Promise<void> => {
    const q = queueRef.current;
    if (!q) return Promise.resolve();

    actionCounterRef.current += 1;
    const commitId = `commit_${Date.now()}_${actionCounterRef.current}`;
    const commit: QueuedCommit = { id: commitId, action, description, timestamp: Date.now() };

    setPendingCount((prev) => prev + 1);

    return new Promise((resolve, reject) => {
      q.push(async (cb?: QueueWorkerCallback) => {
        setIsProcessing(true);
        try {
          onProcessed?.(commit);
          cb?.(undefined, commit);
          resolve();
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          onError?.(error, commit);
          cb?.(error);
          reject(error);
        } finally {
          setIsProcessing(false);
          setPendingCount((prev) => Math.max(0, prev - 1));
        }
      });
    });
  }, [onProcessed, onError]);

  return {
    enqueueCommit,
    isProcessing,
    pendingCount,
  };
}
