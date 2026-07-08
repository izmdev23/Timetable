import type { ThemeConfig } from 'antd';

/** Helper to convert HSL to Hex color */
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Generates a unique, readable, and premium color for any subject code using HSL-to-Hex conversion, or returns customColor if defined */
export function colorForSubject(code: string, customColor?: string): string {
  if (customColor) return customColor;
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) & 0xffffffff;
  }
  // Distribute hue across the 360 degree color space
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 65, 42);
}

/**
 * Returns the theme config for a given theme name.
 */
export function getThemeConfig(themeName: string): ThemeConfig {
  let primary = '#2B4C7E';
  let headerBg = '#1E3560';
  
  if (themeName === 'green') {
    primary = '#3D6B50';
    headerBg = '#2A4B37';
  } else if (themeName === 'purple') {
    primary = '#6B3D7E';
    headerBg = '#4A2758';
  } else if (themeName === 'orange') {
    primary = '#C17817';
    headerBg = '#8A520A';
  } else if (themeName === 'charcoal') {
    primary = '#3D4F6B';
    headerBg = '#27354B';
  }
  
  return {
    token: {
      colorPrimary: primary,
      colorSuccess: '#3D6B50',
      colorWarning: '#C17817',
      colorError: '#9B2335',
      colorInfo: primary,
      colorBgBase: '#F5F7FA',
      colorBgContainer: '#FFFFFF',
      colorBgLayout: '#EEF1F6',
      colorBorder: '#D0D7E3',
      colorBorderSecondary: '#E4E9F0',
      colorText: '#1A2640',
      colorTextSecondary: '#4A5B78',
      colorTextTertiary: '#7A8BA8',
      borderRadius: 4,
      borderRadiusSM: 3,
      fontSize: 13,
      fontSizeSM: 12,
      lineHeight: 1.5,
      controlHeight: 30,
      controlHeightSM: 24,
      paddingXS: 6,
      paddingSM: 10,
      padding: 14,
    },
    components: {
      Table: {
        cellPaddingBlock: 5,
        cellPaddingInline: 10,
      },
      Form: {
        itemMarginBottom: 10,
      },
      Layout: {
        headerBg: headerBg,
        headerHeight: 48,
        headerColor: '#FFFFFF',
        siderBg: '#FFFFFF',
      },
      Button: {
        controlHeight: 30,
      },
    },
  };
}

/** Fallback/Default academic theme */
export const academicTheme: ThemeConfig = getThemeConfig('blue');
