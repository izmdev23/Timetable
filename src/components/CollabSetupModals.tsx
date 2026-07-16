import { useState, useEffect } from 'react';
import { Modal, Input, Button, Space, Typography, message, Divider, List, Tag, Spin } from 'antd';
import { CopyOutlined, TeamOutlined, LinkOutlined, WifiOutlined, DesktopOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';

const { Text } = Typography;

interface DiscoveredHost {
  hostname: string;
  ip: string;
  port: number;
}

interface CollabSetupModalsProps {
  hostModalOpen: boolean;
  joinModalOpen: boolean;
  onClose: () => void;
  onHost: (port: number, userName: string) => Promise<void>;
  onJoin: (hostIp: string, port: number, userName: string) => Promise<void>;
}

export function CollabSetupModals({ hostModalOpen, joinModalOpen, onClose, onHost, onJoin }: CollabSetupModalsProps) {
  const [hostName, setHostName] = useState('');
  const [hostPort, setHostPort] = useState('9182');
  const [hostLoading, setHostLoading] = useState(false);
  const [hostResult, setHostResult] = useState<{ ip: string; port: number } | null>(null);

  const [joinName, setJoinName] = useState('');
  const [joinIp, setJoinIp] = useState('');
  const [joinPort, setJoinPort] = useState('9182');
  const [joinLoading, setJoinLoading] = useState(false);

  // LAN discovery state
  const [discoveredHosts, setDiscoveredHosts] = useState<DiscoveredHost[]>([]);
  const [scanning, setScanning] = useState(false);

  // Start / stop LAN discovery when join modal opens / closes
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    async function startDiscovery() {
      setDiscoveredHosts([]);
      setScanning(true);
      try {
        unlisten = await listen<DiscoveredHost>('collab:discovered-host', (event) => {
          setDiscoveredHosts((prev) => {
            const exists = prev.some(
              (h) => h.ip === event.payload.ip && h.port === event.payload.port
            );
            if (exists) return prev;
            return [...prev, event.payload];
          });
        });
        await invoke('start_collab_discovery');
      } catch {
        // mDNS might not be available — silently ignore
        setScanning(false);
      }
    }

    if (joinModalOpen) {
      startDiscovery();
    }

    return () => {
      if (unlisten) unlisten();
      invoke('stop_collab_discovery').catch(() => {});
      setScanning(false);
    };
  }, [joinModalOpen]);

  // Stop scanning once we have results after a reasonable wait
  useEffect(() => {
    if (scanning) {
      const timer = setTimeout(() => setScanning(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [scanning]);

  // Load hostname on mount
  useEffect(() => {
    async function loadHostname() {
      try {
        const name = await invoke<string>('get_hostname');
        setHostName(name);
        setJoinName(name);
      } catch {
        // fallback
      }
    }
    if (hostModalOpen || joinModalOpen) {
      loadHostname();
    }
  }, [hostModalOpen, joinModalOpen]);

  async function handleHost() {
    if (!hostName.trim()) { message.warning('Please enter your name'); return; }
    const port = parseInt(hostPort, 10);
    if (isNaN(port) || port < 1024 || port > 65535) { message.warning('Port must be between 1024 and 65535'); return; }

    setHostLoading(true);
    try {
      await onHost(port, hostName.trim());
      const ips = await invoke<string[]>('get_local_ips');
      const ip = ips[0]?.split(' ')[0] || '127.0.0.1';
      setHostResult({ ip, port });
    } catch (err) {
      message.error(`Failed to host: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setHostLoading(false);
    }
  }

  function handleSelectHost(host: DiscoveredHost) {
    setJoinIp(host.ip);
    setJoinPort(String(host.port));
  }

  async function handleJoin() {
    if (!joinName.trim()) { message.warning('Please enter your name'); return; }
    if (!joinIp.trim()) { message.warning('Please enter the host IP'); return; }
    const port = parseInt(joinPort, 10);
    if (isNaN(port) || port < 1024 || port > 65535) { message.warning('Port must be between 1024 and 65535'); return; }

    setJoinLoading(true);
    try {
      await onJoin(joinIp.trim(), port, joinName.trim());
    } catch (err) {
      message.error(`Failed to join: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setJoinLoading(false);
    }
  }

  function handleClose() {
    setHostResult(null);
    setDiscoveredHosts([]);
    onClose();
  }

  async function copyIp() {
    if (hostResult) {
      try {
        await navigator.clipboard.writeText(`${hostResult.ip}:${hostResult.port}`);
        message.success('Copied!');
      } catch {
        message.error('Failed to copy');
      }
    }
  }

  return (
    <>
      {/* Host Modal */}
      <Modal
        title={
          <span><TeamOutlined style={{ marginRight: 8 }} />Host Collaboration Session</span>
        }
        open={hostModalOpen}
        onCancel={handleClose}
        footer={null}
        width={440}
        destroyOnClose
      >
        {!hostResult ? (
          <Space direction="vertical" size={12} style={{ width: '100%', paddingTop: 8 }}>
            <div>
              <Text style={{ fontSize: 12, color: '#595959', display: 'block', marginBottom: 4 }}>Your Name</Text>
              <Input
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Your display name"
                maxLength={40}
                onPressEnter={handleHost}
              />
            </div>
            <div>
              <Text style={{ fontSize: 12, color: '#595959', display: 'block', marginBottom: 4 }}>Port</Text>
              <Input
                value={hostPort}
                onChange={(e) => setHostPort(e.target.value)}
                placeholder="9182"
                maxLength={5}
                onPressEnter={handleHost}
              />
            </div>
            <Button
              type="primary"
              onClick={handleHost}
              loading={hostLoading}
              block
              style={{ marginTop: 4, background: '#2B4C7E', borderColor: '#2B4C7E' }}
            >
              Start Session
            </Button>
          </Space>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%', paddingTop: 8 }}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Text style={{ fontSize: 13, color: '#52c41a', fontWeight: 600 }}>
                Session Started
              </Text>
            </div>
            <div style={{ background: '#f5f5f5', borderRadius: 6, padding: '12px 16px', textAlign: 'center' }}>
              <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>Share this address</Text>
              <Text style={{ fontSize: 18, fontWeight: 700, color: '#1A2640', fontFamily: 'monospace', letterSpacing: 1 }}>
                {hostResult.ip}:{hostResult.port}
              </Text>
              <Button
                type="text"
                icon={<CopyOutlined />}
                onClick={copyIp}
                style={{ marginTop: 6 }}
                size="small"
              >
                Copy
              </Button>
            </div>
            <Divider style={{ margin: '4px 0' }} />
            <Text style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'center', display: 'block' }}>
              Your session is now discoverable on the local network via mDNS.
            </Text>
            <Button onClick={handleClose} block size="small">
              Close
            </Button>
          </Space>
        )}
      </Modal>

      {/* Join Modal */}
      <Modal
        title={
          <span><LinkOutlined style={{ marginRight: 8 }} />Join Collaboration Session</span>
        }
        open={joinModalOpen}
        onCancel={handleClose}
        footer={null}
        width={460}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%', paddingTop: 8 }}>
          {/* Your Name */}
          <div>
            <Text style={{ fontSize: 12, color: '#595959', display: 'block', marginBottom: 4 }}>Your Name</Text>
            <Input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Your display name"
              maxLength={40}
              onPressEnter={handleJoin}
            />
          </div>

          {/* Discovered Hosts */}
          <div>
            <Text style={{ fontSize: 12, color: '#595959', display: 'block', marginBottom: 8 }}>
              <WifiOutlined style={{ marginRight: 4 }} />Hosts on Local Network
            </Text>
            <div
              style={{
                background: '#fafafa',
                borderRadius: 6,
                border: '1px solid #e8e8e8',
                minHeight: 80,
                maxHeight: 180,
                overflow: 'auto',
              }}
            >
              {scanning && discoveredHosts.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, gap: 8 }}>
                  <Spin size="small" />
                  <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Scanning for hosts...</Text>
                </div>
              ) : discoveredHosts.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
                  <Text style={{ fontSize: 12, color: '#bfbfbf' }}>
                    No hosts found — enter the address manually below
                  </Text>
                </div>
              ) : (
                <List
                  size="small"
                  dataSource={discoveredHosts}
                  renderItem={(host) => (
                    <List.Item
                      onClick={() => handleSelectHost(host)}
                      style={{
                        cursor: 'pointer',
                        padding: '8px 12px',
                        background: joinIp === host.ip && joinPort === String(host.port) ? '#e6f7ff' : 'transparent',
                        borderBottom: '1px solid #f0f0f0',
                      }}
                      onMouseEnter={(e) => {
                        if (joinIp !== host.ip || joinPort !== String(host.port)) {
                          e.currentTarget.style.background = '#f5f5f5';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (joinIp !== host.ip || joinPort !== String(host.port)) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <DesktopOutlined style={{ color: '#595959', fontSize: 14 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 12, fontWeight: 600, display: 'block' }}>
                            {host.hostname.replace(`.${host.hostname.includes('.') ? host.hostname.split('.')[1] + '.' + host.hostname.split('.')[2] : 'local.'}`, '')}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
                            {host.ip}:{host.port}
                          </Text>
                        </div>
                        <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>mDNS</Tag>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </div>
          </div>

          <Divider style={{ margin: '4px 0' }} />

          {/* Manual Host IP */}
          <div>
            <Text style={{ fontSize: 12, color: '#595959', display: 'block', marginBottom: 4 }}>Host IP Address</Text>
            <Input
              value={joinIp}
              onChange={(e) => setJoinIp(e.target.value)}
              placeholder="e.g. 192.168.1.42"
              onPressEnter={handleJoin}
            />
          </div>
          <div>
            <Text style={{ fontSize: 12, color: '#595959', display: 'block', marginBottom: 4 }}>Port</Text>
            <Input
              value={joinPort}
              onChange={(e) => setJoinPort(e.target.value)}
              placeholder="9182"
              maxLength={5}
              onPressEnter={handleJoin}
            />
          </div>
          <Button
            type="primary"
            onClick={handleJoin}
            loading={joinLoading}
            block
            style={{ marginTop: 4, background: '#2B4C7E', borderColor: '#2B4C7E' }}
          >
            Join Session
          </Button>
        </Space>
      </Modal>
    </>
  );
}
