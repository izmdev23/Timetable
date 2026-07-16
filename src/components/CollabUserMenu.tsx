import { Dropdown, Badge, Typography, Button, Switch } from 'antd';
import { TeamOutlined, DisconnectOutlined, CheckCircleFilled, ExclamationCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { CollabUser, ConnectionQuality, PermissionSet } from '../types';
import { PermissionCheckboxes } from './PermissionCheckboxes';
import { useState } from 'react';

const { Text } = Typography;

interface CollabUserMenuProps {
  isConnected: boolean;
  isHost: boolean;
  connectionQuality: ConnectionQuality;
  latency: number;
  connectedUsers: CollabUser[];
  myUserName: string;
  myColor: string;
  sessionInfo: { ip: string; port: number } | null;
  shareFullHistory: boolean;
  onShareFullHistoryChange: (v: boolean) => void;
  onLeaveSession: () => void;
  onSetPermission: (clientId: string, perms: PermissionSet) => void;
}

function qualityIcon(quality: ConnectionQuality) {
  switch (quality) {
    case 'good':
      return <CheckCircleFilled style={{ color: '#52c41a', fontSize: 12 }} />;
    case 'degraded':
      return <ExclamationCircleFilled style={{ color: '#faad14', fontSize: 12 }} />;
    case 'disconnected':
      return <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 12 }} />;
  }
}

export function CollabUserMenu({
  isConnected,
  isHost,
  connectionQuality,
  latency,
  connectedUsers,
  myUserName,
  myColor,
  sessionInfo,
  shareFullHistory,
  onShareFullHistoryChange,
  onLeaveSession,
  onSetPermission,
}: CollabUserMenuProps) {
  const [editingUser, setEditingUser] = useState<string | null>(null);

  if (!isConnected) return null;

  const userItems: MenuProps['items'] = [
    {
      key: 'header',
      label: (
        <div style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {qualityIcon(connectionQuality)}
            <Text strong style={{ fontSize: 12 }}>Collaboration Session</Text>
          </div>
          {sessionInfo && (
            <Text style={{ fontSize: 10, color: '#8c8c8c', display: 'block' }}>
              {sessionInfo.ip}:{sessionInfo.port} · {connectedUsers.length} user{connectedUsers.length !== 1 ? 's' : ''}
            </Text>
          )}
          {isConnected && (
            <Text style={{ fontSize: 10, color: '#8c8c8c' }}>
              Latency: {latency}ms
            </Text>
          )}
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'myinfo',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: myColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            {myUserName[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <Text style={{ fontSize: 12 }}>{myUserName}</Text>
            <Text style={{ fontSize: 10, color: '#8c8c8c', marginLeft: 4 }}>(you)</Text>
          </div>
          {isHost && (
            <Text style={{ fontSize: 10, color: '#2B4C7E', fontWeight: 600, marginLeft: 'auto' }}>Host</Text>
          )}
        </div>
      ),
      disabled: true,
    },
    ...connectedUsers
      .filter((u) => u.clientId !== undefined) // exclude self if needed
      .map((user) => ({
        key: `user:${user.clientId}`,
        label: (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', cursor: isHost ? 'pointer' : 'default' }}
            onClick={() => isHost ? setEditingUser(editingUser === user.clientId ? null : user.clientId) : undefined}
          >
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: user.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
              {user.userName[0]?.toUpperCase() || '?'}
            </div>
            <Text style={{ fontSize: 12 }}>{user.userName}</Text>
            {user.isHost && (
              <Text style={{ fontSize: 10, color: '#2B4C7E', fontWeight: 600, marginLeft: 'auto' }}>Host</Text>
            )}
          </div>
        ),
        disabled: true,
      })),
    ...(editingUser && isHost ? [
      { type: 'divider' as const, key: 'permdiv' },
      {
        key: `perms:${editingUser}`,
        label: (
          <div style={{ padding: '4px 0' }}>
            <PermissionCheckboxes
              value={connectedUsers.find((u) => u.clientId === editingUser)?.permissions || { all: true, write: true, delete: true, create: true }}
              onChange={(perms) => onSetPermission(editingUser, perms)}
              label={`Permissions for ${connectedUsers.find((u) => u.clientId === editingUser)?.userName || editingUser}`}
            />
          </div>
        ),
        disabled: false,
      },
    ] : []),
    { type: 'divider' },
    {
      key: 'sharehistory',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
          <Text style={{ fontSize: 11 }}>Share full history</Text>
          <Switch
            size="small"
            checked={shareFullHistory}
            onChange={onShareFullHistoryChange}
            disabled={!isHost}
          />
        </div>
      ),
      disabled: !isHost,
    },
    {
      key: 'leave',
      label: (
        <Button
          danger
          size="small"
          icon={<DisconnectOutlined />}
          block
          onClick={onLeaveSession}
          style={{ marginTop: 4 }}
        >
          Disconnect
        </Button>
      ),
      disabled: true,
    },
  ];

  return (
    <Dropdown menu={{ items: userItems }} trigger={['click']} placement="bottomRight">
      <button
        aria-label="Collaboration users"
        style={{
          width: 38,
          height: 32,
          background: 'transparent',
          border: 'none',
          color: isConnected ? '#2B4C7E' : '#7A8BA8',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          transition: 'background 0.15s, color 0.15s',
          flexShrink: 0,
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        <Badge count={connectedUsers.length} size="small" offset={[-2, 2]}>
          <TeamOutlined style={{ fontSize: 14 }} />
        </Badge>
      </button>
    </Dropdown>
  );
}
