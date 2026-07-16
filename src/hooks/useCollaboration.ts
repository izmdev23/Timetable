import { useState, useRef, useCallback, useEffect } from 'react';
import useWebSocketModule from 'react-use-websocket';
const useWebSocket = (useWebSocketModule as unknown as { default: typeof useWebSocketModule }).default;
import { invoke } from '@tauri-apps/api/core';
import type { CollabUser, CollabAction, CollabState, PermissionSet, ConnectionQuality, CommitRecord } from '../types';
import { hashColor } from '../utils/userColors';

const DEFAULT_PERMISSIONS: PermissionSet = { all: true, write: true, delete: true, create: true };
const PING_INTERVAL = 15000;

export interface UseCollaborationReturn {
  isHost: boolean;
  isConnected: boolean;
  connectedUsers: CollabUser[];
  sessionInfo: { ip: string; port: number } | null;
  connectionQuality: ConnectionQuality;
  latency: number;
  clientId: string;
  myUserName: string;

  hostSession: (port: number, userName: string) => Promise<void>;
  joinSession: (hostIp: string, port: number, userName: string) => Promise<void>;
  leaveSession: () => Promise<void>;

  broadcastAction: (action: CollabAction) => void;
  checkPermission: (required: 'write' | 'delete' | 'create') => boolean;
  setClientPermission: (clientId: string, perms: PermissionSet) => void;

  clientPermissions: Map<string, PermissionSet>;
  shareFullHistory: boolean;
  setShareFullHistory: (v: boolean) => void;

  locks: Map<string, { clientId: string; userName: string }>;
  acquireLock: (itemId: string) => void;
  releaseLock: (itemId: string) => void;
  isLockedByOther: (itemId: string) => string | null;

  onStateRequest: ((requestClientId: string) => void) | null;
  setOnStateRequest: (fn: ((clientId: string) => void) | null) => void;
}

export function useCollaboration(
  storeApplyRemoteAction: (action: CollabAction) => void,
  storeGetFullState: () => CollabState,
  storeApplyFullState: (state: CollabState) => void,
  addCommitRecord: (record: CommitRecord) => Promise<void>,
  getCommitsSince: (since: number) => Promise<CommitRecord[]>,
): UseCollaborationReturn {
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<CollabUser[]>([]);
  const [sessionInfo, setSessionInfo] = useState<{ ip: string; port: number } | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('disconnected');
  const [latency, setLatency] = useState(0);
  const [clientId, setClientId] = useState<string>('');
  const [myUserName, setMyUserName] = useState('');
  const [clientPermissions, setClientPermissions] = useState<Map<string, PermissionSet>>(new Map());
  const [shareFullHistory, setShareFullHistory] = useState(false);
  const [locks, setLocks] = useState<Map<string, { clientId: string; userName: string }>>(new Map());
  const [onStateRequest, setOnStateRequest] = useState<((clientId: string) => void) | null>(null);

  const wsUrlRef = useRef<string | null>(null);
  const isHostRef = useRef(false);
  const myClientIdRef = useRef<string>('');
  const userNameRef = useRef<string>('');
  const userColorRef = useRef<string>('#61AFEF');
  const pingTimeRef = useRef<number>(0);
  const broadcastThrottleRef = useRef<Map<string, number>>(new Map());
  const offlineBufferRef = useRef<{ action: CollabAction; timestamp: number }[]>([]);
  const locksRef = useRef<Map<string, { clientId: string; userName: string }>>(new Map());
  const connectedUsersRef = useRef<CollabUser[]>([]);
  const clientPermissionsRef = useRef<Map<string, PermissionSet>>(new Map());
  const shareFullHistoryRef = useRef(false);
  const addCommitRecordRef = useRef(addCommitRecord);
  const getCommitsSinceRef = useRef(getCommitsSince);
  const storeApplyRemoteActionRef = useRef(storeApplyRemoteAction);
  const storeGetFullStateRef = useRef(storeGetFullState);
  const storeApplyFullStateRef = useRef(storeApplyFullState);
  const onStateRequestRef = useRef(onStateRequest);

  addCommitRecordRef.current = addCommitRecord;
  getCommitsSinceRef.current = getCommitsSince;
  storeApplyRemoteActionRef.current = storeApplyRemoteAction;
  storeGetFullStateRef.current = storeGetFullState;
  storeApplyFullStateRef.current = storeApplyFullState;
  onStateRequestRef.current = onStateRequest;

  // Calculate WS URL
  const wsUrl = wsUrlRef.current;

  const { sendMessage, lastMessage, readyState } = useWebSocket(wsUrl, {
    shouldReconnect: () => isHostRef.current || !!wsUrlRef.current,
    reconnectInterval: 3000,
    reconnectAttempts: 20,
    share: true,
    onOpen: () => {
      setIsConnected(true);
      setConnectionQuality('good');
    },
    onClose: () => {
      setIsConnected(false);
      setConnectionQuality('disconnected');
    },
    onError: () => {
      setConnectionQuality('disconnected');
    },
  });

  // Process incoming messages
  useEffect(() => {
    if (!lastMessage?.data) return;

    try {
      const msg = JSON.parse(lastMessage.data as string);

      switch (msg.type) {
        case 'welcome': {
          setClientId(String(msg.clientId));
          myClientIdRef.current = String(msg.clientId);
          // Announce ourselves to others
          const announce = JSON.stringify({
            type: 'user:announce',
            clientId: String(msg.clientId),
            userName: userNameRef.current,
            color: userColorRef.current,
            isHost: isHostRef.current,
            permissions: DEFAULT_PERMISSIONS,
          });
          sendMessage(announce);
          break;
        }

        case 'user:announce': {
          const cid = String(msg.clientId);
          const existing = connectedUsersRef.current.find((u) => u.clientId === cid);
          if (!existing) {
            const newUser: CollabUser = {
              clientId: cid,
              userName: msg.userName || 'Unknown',
              color: msg.color || hashColor(cid),
              permissions: msg.permissions || DEFAULT_PERMISSIONS,
              joinedAt: Date.now(),
              isHost: msg.isHost === true,
            };
            const updated = [...connectedUsersRef.current, newUser];
            connectedUsersRef.current = updated;
            setConnectedUsers(updated);
          }
          break;
        }

        case 'peer:left': {
          const cid = String(msg.clientId);
          const updated = connectedUsersRef.current.filter((u) => u.clientId !== cid);
          connectedUsersRef.current = updated;
          setConnectedUsers(updated);
          // Release locks held by this peer
          const newLocks = new Map(locksRef.current);
          for (const [itemId, lock] of newLocks) {
            if (lock.clientId === cid) {
              newLocks.delete(itemId);
            }
          }
          locksRef.current = newLocks;
          setLocks(newLocks);
          break;
        }

        case 'action': {
          const action = msg.action as CollabAction;
          if (action) {
            storeApplyRemoteActionRef.current(action);
          }
          break;
        }

        case 'state:request': {
          const requestCid = String(msg.clientId);
          if (isHostRef.current && onStateRequestRef.current) {
            onStateRequestRef.current(requestCid);
          }
          break;
        }

        case 'state:full': {
          if (msg.targetClientId === myClientIdRef.current || !msg.targetClientId) {
            const state = msg.state as CollabState;
            if (state) {
              storeApplyFullStateRef.current(state);
            }
            // Load commit history
            if (msg.commits) {
              for (const commit of msg.commits as CommitRecord[]) {
                window.dispatchEvent(new CustomEvent('commit:applied', { detail: commit }));
              }
            }
          }
          break;
        }

        case 'permissions:update': {
          if (msg.targetClientId === myClientIdRef.current) {
            const newPerms = new Map(clientPermissionsRef.current);
            newPerms.set(myClientIdRef.current, msg.permissions as PermissionSet);
            clientPermissionsRef.current = newPerms;
            setClientPermissions(newPerms);
          }
          break;
        }

        case 'lock:acquire': {
          const newLocks = new Map(locksRef.current);
          newLocks.set(msg.itemId as string, {
            clientId: msg.clientId as string,
            userName: msg.userName as string,
          });
          locksRef.current = newLocks;
          setLocks(newLocks);
          break;
        }

        case 'lock:release': {
          const newLocks = new Map(locksRef.current);
          newLocks.delete(msg.itemId as string);
          locksRef.current = newLocks;
          setLocks(newLocks);
          break;
        }

        case 'pong': {
          if (pingTimeRef.current > 0) {
            const newLatency = Date.now() - pingTimeRef.current;
            setLatency(newLatency);
            setConnectionQuality(newLatency < 50 ? 'good' : newLatency < 200 ? 'degraded' : 'disconnected');
          }
          break;
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [lastMessage, sendMessage]);

  // Periodic ping
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      pingTimeRef.current = Date.now();
      sendMessage(JSON.stringify({ type: 'ping' }));
    }, PING_INTERVAL);

    return () => clearInterval(interval);
  }, [isConnected, sendMessage]);

  // Offline buffer replay on reconnect
  useEffect(() => {
    if (readyState === 1 && offlineBufferRef.current.length > 0) {
      const buffer = [...offlineBufferRef.current];
      offlineBufferRef.current = [];
      for (const entry of buffer) {
        sendMessage(JSON.stringify({
          type: 'action',
          clientId: myClientIdRef.current,
          action: entry.action,
          timestamp: entry.timestamp,
        }));
      }
    }
  }, [readyState, sendMessage]);

  const hostSession = useCallback(async (port: number, userName: string) => {
    try {
      await invoke('start_collab_server', { port, hostname: userName });
      const ips = await invoke<string[]>('get_local_ips');
      const ip = ips[0]?.split(' ')[0] || '127.0.0.1';

      isHostRef.current = true;
      setIsHost(true);
      userNameRef.current = userName;
      setMyUserName(userName);
      userColorRef.current = hashColor('host');
      setSessionInfo({ ip, port });

      wsUrlRef.current = `ws://localhost:${port}`;
    } catch (err) {
      console.error('Failed to host session:', err);
      throw err;
    }
  }, []);

  const joinSession = useCallback(async (hostIp: string, port: number, userName: string) => {
    isHostRef.current = false;
    setIsHost(false);
    userNameRef.current = userName;
    setMyUserName(userName);
    userColorRef.current = hashColor(userName);
    setSessionInfo({ ip: hostIp, port });

    wsUrlRef.current = `ws://${hostIp}:${port}`;
  }, []);

  const leaveSession = useCallback(async () => {
    try {
      if (isHostRef.current) {
        await invoke('stop_collab_server');
      }
    } catch {
      // ignore
    }

    isHostRef.current = false;
    setIsHost(false);
    wsUrlRef.current = null;
    setSessionInfo(null);
    setConnectedUsers([]);
    connectedUsersRef.current = [];
    setConnectionQuality('disconnected');
    setLocks(new Map());
    locksRef.current = new Map();
  }, []);

  const broadcastAction = useCallback((action: CollabAction) => {
    const now = Date.now();
    const last = broadcastThrottleRef.current.get(action.op) || 0;
    if (now - last < 150) return;
    broadcastThrottleRef.current.set(action.op, now);

    if (readyState === 1) {
      sendMessage(JSON.stringify({
        type: 'action',
        clientId: myClientIdRef.current,
        action,
        timestamp: now,
      }));
    } else {
      // Buffer for offline replay
      offlineBufferRef.current.push({ action, timestamp: now });
    }
  }, [readyState, sendMessage]);

  const checkPermission = useCallback((required: 'write' | 'delete' | 'create'): boolean => {
    const myPerms = clientPermissionsRef.current.get(myClientIdRef.current) || DEFAULT_PERMISSIONS;
    if (myPerms.all) return true;
    return myPerms[required] === true;
  }, []);

  const setClientPermission = useCallback((targetClientId: string, perms: PermissionSet) => {
    if (!isHostRef.current) return;

    const newPerms = new Map(clientPermissionsRef.current);
    newPerms.set(targetClientId, perms);
    clientPermissionsRef.current = newPerms;
    setClientPermissions(newPerms);

    sendMessage(JSON.stringify({
      type: 'permissions:update',
      targetClientId,
      permissions: perms,
    }));
  }, [sendMessage]);

  const acquireLock = useCallback((itemId: string) => {
    sendMessage(JSON.stringify({
      type: 'lock:acquire',
      clientId: myClientIdRef.current,
      userName: userNameRef.current,
      itemId,
    }));
  }, [sendMessage]);

  const releaseLock = useCallback((itemId: string) => {
    sendMessage(JSON.stringify({
      type: 'lock:release',
      clientId: myClientIdRef.current,
      itemId,
    }));
  }, [sendMessage]);

  const isLockedByOther = useCallback((itemId: string): string | null => {
    const lock = locksRef.current.get(itemId);
    if (lock && lock.clientId !== myClientIdRef.current) {
      return lock.userName;
    }
    return null;
  }, []);

  // Send full state to a requesting client
  const sendFullState = useCallback(async (targetClientId: string) => {
    const state = storeGetFullStateRef.current();
    const commits = shareFullHistoryRef.current
      ? await getCommitsSinceRef.current(0)
      : [];

    sendMessage(JSON.stringify({
      type: 'state:full',
      targetClientId,
      state,
      commits,
    }));
  }, [sendMessage]);

  // Wire up state request handler
  useEffect(() => {
    setOnStateRequest(() => sendFullState);
  }, [sendFullState]);

  return {
    isHost,
    isConnected,
    connectedUsers,
    sessionInfo,
    connectionQuality,
    latency,
    clientId,
    myUserName,

    hostSession,
    joinSession,
    leaveSession,

    broadcastAction,
    checkPermission,
    setClientPermission,

    clientPermissions,
    shareFullHistory,
    setShareFullHistory,

    locks,
    acquireLock,
    releaseLock,
    isLockedByOther,

    onStateRequest,
    setOnStateRequest,
  };
}
