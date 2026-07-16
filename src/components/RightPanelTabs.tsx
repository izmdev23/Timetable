import { Tabs } from 'antd';
import type { ReactNode } from 'react';

interface TabConfig {
  key: string;
  label: string;
  component: ReactNode;
  badge?: number;
}

interface RightPanelTabsProps {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (key: string) => void;
  width?: number;
}

export function RightPanelTabs({ tabs, activeTab, onTabChange, width = 260 }: RightPanelTabsProps) {
  return (
    <div
      style={{
        width,
        background: '#FFFFFF',
        borderLeft: '1px solid #D0D7E3',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={onTabChange}
        size="small"
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        tabBarStyle={{ margin: 0, paddingLeft: 8, paddingRight: 8 }}
        items={tabs.map((tab) => ({
          key: tab.key,
          label: (
            <span style={{ fontSize: 11, fontWeight: 500 }}>
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span style={{ marginLeft: 4, background: '#1890ff', color: '#fff', borderRadius: 8, padding: '0 5px', fontSize: 10 }}>
                  {tab.badge}
                </span>
              )}
            </span>
          ),
          children: (
            <div style={{ height: '100%', overflow: 'hidden' }}>
              {tab.component}
            </div>
          ),
        }))}
      />
    </div>
  );
}
