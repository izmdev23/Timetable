import { Typography, Switch, Button, Popconfirm, message, Divider, Space } from "antd";
import {
  SettingOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import Database from "@tauri-apps/plugin-sql";
import { usePreferences } from "../context/PreferencesContext";

const { Title, Text, Paragraph } = Typography;

interface PreferencesPageProps {
  /** Called when the user wants to navigate away from preferences */
  onBack: () => void;
}

/** App preferences page: export defaults and data management. */
export function PreferencesPage({ onBack }: PreferencesPageProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const prefs = usePreferences();

  async function handleClearData(): Promise<void> {
    try {
      const db = await Database.load("sqlite:timetable.db");
      await db.execute("DELETE FROM timetables");
      messageApi.success("All timetables have been deleted.");
      onBack();
    } catch (e: unknown) {
      messageApi.error(`Clear failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const sectionStyle: React.CSSProperties = {
    background: "#FFFFFF",
    borderRadius: 6,
    border: "1px solid #D0D7E3",
    padding: "12px 16px",
    marginBottom: 10,
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "8px 0",
  };

  return (
    <div style={{ padding: "12px 20px", maxWidth: 580, margin: "0 auto" }}>
      {contextHolder}

      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SettingOutlined style={{ fontSize: 16, color: "#2B4C7E" }} />
          <Title level={5} style={{ margin: 0, color: "#1A2640" }}>Preferences</Title>
        </div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          type="text"
          size="small"
          style={{ color: "#4A5B78" }}
        >
          Back
        </Button>
      </div>

      {/* Export Defaults */}
      <div style={sectionStyle}>
        <Title level={5} style={{ margin: "0 0 2px 0", fontSize: 13, color: "#1A2640" }}>Export Defaults</Title>
        <Paragraph style={{ color: "#4A5B78", fontSize: 11, marginBottom: 8 }}>
          These settings apply automatically when exporting any timetable.
        </Paragraph>

        <Divider style={{ margin: "0 0 2px 0" }} />

        <div style={rowStyle}>
          <Space direction="vertical" size={0} style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <EyeInvisibleOutlined style={{ color: "#2B4C7E", fontSize: 12 }} />
              <Text strong style={{ fontSize: 12 }}>Exclude hidden days</Text>
            </div>
            <Text style={{ fontSize: 11, color: "#4A5B78" }}>
              Days marked as hidden in the timetable view will be omitted from exported files.
            </Text>
          </Space>
          <Switch
            size="small"
            checked={prefs.excludeHiddenDays}
            onChange={prefs.setExcludeHiddenDays}
            checkedChildren="On"
            unCheckedChildren="Off"
          />
        </div>

        <Divider style={{ margin: "2px 0" }} />

        <div style={rowStyle}>
          <Space direction="vertical" size={0} style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ClockCircleOutlined style={{ color: "#2B4C7E", fontSize: 12 }} />
              <Text strong style={{ fontSize: 12 }}>Exclude time outside time window</Text>
            </div>
            <Text style={{ fontSize: 11, color: "#4A5B78" }}>
              Schedule slots outside the visible time window will be cropped or removed from exports.
            </Text>
          </Space>
          <Switch
            size="small"
            checked={prefs.excludeTimeWindow}
            onChange={prefs.setExcludeTimeWindow}
            checkedChildren="On"
            unCheckedChildren="Off"
          />
        </div>
      </div>

      {/* Data Management */}
      <div style={{ ...sectionStyle, borderColor: "#F5C6CB" }}>
        <Title level={5} style={{ margin: "0 0 2px 0", fontSize: 13, color: "#9B2335" }}>Data Management</Title>
        <Paragraph style={{ color: "#4A5B78", fontSize: 11, marginBottom: 8 }}>
          Permanently delete data stored in the local database. This cannot be undone.
        </Paragraph>

        <Divider style={{ margin: "0 0 8px 0" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 12 }}>Clear All Timetables</Text>
            <Text style={{ fontSize: 11, color: "#4A5B78" }}>
              Removes every timetable and all associated schedule entries from the database.
            </Text>
          </Space>
          <Popconfirm
            title="Delete all timetables?"
            description="This action is permanent and cannot be undone."
            onConfirm={handleClearData}
            okText="Delete All"
            okButtonProps={{ danger: true, size: "small" }}
            cancelText="Cancel"
            cancelButtonProps={{ size: "small" }}
          >
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              style={{ flexShrink: 0 }}
            >
              Clear Data
            </Button>
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}
