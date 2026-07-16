import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Select, Button, Space, Empty, InputNumber, Radio, Divider, List, Popover } from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ClearOutlined,
  LockOutlined,
  UnlockOutlined,
  CloseOutlined,
  PlusOutlined,
  DeleteOutlined,
  SettingOutlined,
  FileOutlined,
  FileTextOutlined,
  BorderOutlined,
  LayoutOutlined,
  ExportOutlined
} from '@ant-design/icons';

interface Marquee {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CustomSize {
  name: string;
  width: number;
  height: number;
  unit: 'cm' | 'in';
}

interface DocxSettings {
  orientation: 'portrait' | 'landscape';
  paperSize: string; // 'Letter' | 'A4' | 'A3' | 'Legal' | 'Custom'
  customWidth: number;
  customHeight: number;
  customUnit: 'cm' | 'in';
  marginType: 'Normal' | 'Narrow' | 'Moderate' | 'Custom';
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  marginUnit: 'cm' | 'in';
  showRulers: boolean;
  guides: { type: 'v' | 'h'; value: number; unit: 'cm' | 'in' }[];
  lockAspectRatio: boolean;
}

interface DocxTemplatePreviewProps {
  bytes: Uint8Array | null;
  name: string;
  timetableImg: string | null;
  timetableAspectRatio: number;
  onClose: () => void;
  onSelectPosition: (pos: {
    pageIndex: number;
    xPct: number;
    yPct: number;
    wPct: number;
    hPct: number;
    targetParagraphIndex: number;
  } | null) => void;
  onLayoutConfigChange: (config: {
    orientation: 'portrait' | 'landscape';
    paperSize: { widthDxa: number; heightDxa: number };
    margins: { topDxa: number; bottomDxa: number; leftDxa: number; rightDxa: number };
  }) => void;
  onExport: () => void;
  canExport: boolean;
}

const PAPER_PRESETS: Record<string, { name: string; widthDxa: number; heightDxa: number; widthCm: number; heightCm: number; widthIn: number; heightIn: number }> = {
  Letter: { name: 'Letter', widthDxa: 12240, heightDxa: 15840, widthCm: 21.59, heightCm: 27.94, widthIn: 8.5, heightIn: 11.0 },
  A4: { name: 'A4', widthDxa: 11906, heightDxa: 16838, widthCm: 21.0, heightCm: 29.7, widthIn: 8.27, heightIn: 11.69 },
  A3: { name: 'A3', widthDxa: 16838, heightDxa: 23811, widthCm: 29.7, heightCm: 42.0, widthIn: 11.69, heightIn: 16.54 },
  Legal: { name: 'Legal', widthDxa: 12240, heightDxa: 20160, widthCm: 21.59, heightCm: 35.56, widthIn: 8.5, heightIn: 14.0 },
};

const MARGIN_PRESETS = {
  Normal: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
  Narrow: { top: 720, bottom: 720, left: 720, right: 720 },
  Moderate: { top: 1440, bottom: 1440, left: 1080, right: 1080 },
};

function getPaperSizePreset(widthDxa: number, heightDxa: number): string {
  const tolerance = 100;
  for (const [key, preset] of Object.entries(PAPER_PRESETS)) {
    if (
      (Math.abs(preset.widthDxa - widthDxa) < tolerance && Math.abs(preset.heightDxa - heightDxa) < tolerance) ||
      (Math.abs(preset.widthDxa - heightDxa) < tolerance && Math.abs(preset.heightDxa - widthDxa) < tolerance)
    ) {
      return key;
    }
  }
  return 'Custom';
}

function getXmlAttribute(node: Element, name: string): string | null {
  const prefix = name.split(':')[1];
  return node.getAttribute(name) || (prefix ? node.getAttribute(prefix) : null);
}

export function DocxTemplatePreview({
  bytes,
  timetableImg,
  timetableAspectRatio,
  onClose,
  onSelectPosition,
  onLayoutConfigChange,
  onExport,
  canExport
}: DocxTemplatePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<Element[]>([]);
  const [zoom, setZoom] = useState<number>(0.85);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [activeMarquee, setActiveMarquee] = useState<Marquee | null>(null);

  // Configuration settings state
  const [settings, setSettings] = useState<DocxSettings>({
    orientation: 'portrait',
    paperSize: 'A4',
    customWidth: 21.0,
    customHeight: 29.7,
    customUnit: 'cm',
    marginType: 'Normal',
    marginTop: 2.54,
    marginBottom: 2.54,
    marginLeft: 2.54,
    marginRight: 2.54,
    marginUnit: 'cm',
    showRulers: true,
    guides: [],
    lockAspectRatio: true
  });

  // History list for custom paper sizes
  const [customHistory, setCustomHistory] = useState<CustomSize[]>([]);
  
  // Custom guide inputs
  const [newGuideValue, setNewGuideValue] = useState<number>(5.0);
  const [newGuideType, setNewGuideType] = useState<'v' | 'h'>('v');
  const [newGuideUnit, setNewGuideUnit] = useState<'cm' | 'in'>('cm');

  // Load configuration and custom size history from localStorage on load
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('docx_custom_size_history');
      if (savedHistory) {
        setCustomHistory(JSON.parse(savedHistory));
      }

      const savedSettings = localStorage.getItem('docx_editor_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (e) {
      console.error('Failed to load history or settings', e);
    }
  }, []);

  // Sync settings back to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('docx_editor_settings', JSON.stringify(settings));
  }, [settings]);

  // Parse template bytes on load to extract native layout properties
  useEffect(() => {
    if (!bytes) return;

    import('jszip').then(async ({ default: JSZip }) => {
      try {
        const zip = await JSZip.loadAsync(bytes);
        const docXmlText = await zip.file('word/document.xml')?.async('text');
        if (docXmlText) {
          const doc = new DOMParser().parseFromString(docXmlText, 'text/xml');
          
          let width = 12240;
          let height = 15840;
          let orient: 'portrait' | 'landscape' = 'portrait';
          
          const pgSzNodes = doc.getElementsByTagName('w:pgSz');
          if (pgSzNodes.length > 0) {
            const wVal = getXmlAttribute(pgSzNodes[0], 'w:w');
            const hVal = getXmlAttribute(pgSzNodes[0], 'w:h');
            const orientVal = getXmlAttribute(pgSzNodes[0], 'w:orient');
            if (wVal) width = parseInt(wVal, 10);
            if (hVal) height = parseInt(hVal, 10);
            if (orientVal === 'landscape') orient = 'landscape';
          }

          let mt = 1440, mr = 1440, mb = 1440, ml = 1440;
          const pgMarNodes = doc.getElementsByTagName('w:pgMar');
          if (pgMarNodes.length > 0) {
            const tVal = getXmlAttribute(pgMarNodes[0], 'w:top');
            const rVal = getXmlAttribute(pgMarNodes[0], 'w:right');
            const bVal = getXmlAttribute(pgMarNodes[0], 'w:bottom');
            const lVal = getXmlAttribute(pgMarNodes[0], 'w:left');
            if (tVal) mt = parseInt(tVal, 10);
            if (rVal) mr = parseInt(rVal, 10);
            if (bVal) mb = parseInt(bVal, 10);
            if (lVal) ml = parseInt(lVal, 10);
          }

          const nativePreset = getPaperSizePreset(width, height);
          
          setSettings((prev) => {
            const savedSettings = localStorage.getItem('docx_editor_settings');
            if (savedSettings) {
              return JSON.parse(savedSettings);
            }
            const isCm = prev.marginUnit === 'cm';
            const scale = isCm ? 567 : 1440;
            return {
              ...prev,
              orientation: orient,
              paperSize: nativePreset,
              customWidth: Math.round((width / (isCm ? 567 : 1440)) * 10) / 10,
              customHeight: Math.round((height / (isCm ? 567 : 1440)) * 10) / 10,
              marginTop: Math.round((mt / scale) * 100) / 100,
              marginBottom: Math.round((mb / scale) * 100) / 100,
              marginLeft: Math.round((ml / scale) * 100) / 100,
              marginRight: Math.round((mr / scale) * 100) / 100,
            };
          });
        }
      } catch (e) {
        console.error('Failed to parse docx template properties', e);
      }
    });
  }, [bytes]);

  // Compute paper size and margin values in DXA
  const getLayoutConfigValues = () => {
    let widthDxa = 12240;
    let heightDxa = 15840;

    if (settings.paperSize === 'Custom') {
      const scale = settings.customUnit === 'cm' ? 567 : 1440;
      widthDxa = Math.round(settings.customWidth * scale);
      heightDxa = Math.round(settings.customHeight * scale);
    } else {
      const preset = PAPER_PRESETS[settings.paperSize] || PAPER_PRESETS.A4;
      widthDxa = preset.widthDxa;
      heightDxa = preset.heightDxa;
    }

    if (settings.orientation === 'landscape' && widthDxa < heightDxa) {
      const temp = widthDxa;
      widthDxa = heightDxa;
      heightDxa = temp;
    } else if (settings.orientation === 'portrait' && widthDxa > heightDxa) {
      const temp = widthDxa;
      widthDxa = heightDxa;
      heightDxa = temp;
    }

    let mt = 1440, mb = 1440, ml = 1440, mr = 1440;
    if (settings.marginType === 'Custom') {
      const scale = settings.marginUnit === 'cm' ? 567 : 1440;
      mt = Math.round(settings.marginTop * scale);
      mb = Math.round(settings.marginBottom * scale);
      ml = Math.round(settings.marginLeft * scale);
      mr = Math.round(settings.marginRight * scale);
    } else {
      const preset = MARGIN_PRESETS[settings.marginType] || MARGIN_PRESETS.Normal;
      mt = preset.top;
      mb = preset.bottom;
      ml = preset.left;
      mr = preset.right;
    }

    return {
      orientation: settings.orientation,
      paperSize: { widthDxa, heightDxa },
      margins: { topDxa: mt, bottomDxa: mb, leftDxa: ml, rightDxa: mr }
    };
  };

  useEffect(() => {
    const config = getLayoutConfigValues();
    onLayoutConfigChange(config);
  }, [settings, onLayoutConfigChange]);

  // 1. Render docx file into container (original bytes — no layout modification for preview accuracy)
  useEffect(() => {
    if (!bytes || !containerRef.current) {
      setPages([]);
      return;
    }

    containerRef.current.innerHTML = '';

    import('docx-preview').then(({ renderAsync }) => {
      renderAsync(bytes, containerRef.current!, undefined, {
        className: 'docx',
        inWrapper: false,
        breakPages: true,
        ignoreWidth: false,
        ignoreHeight: false
      }).then(() => {
        const pageNodes = Array.from(containerRef.current!.querySelectorAll('section'));
        pageNodes.forEach((node) => {
          node.style.position = 'relative';
        });
        setPages(pageNodes);
        setCurrentPage(0);
      }).catch((err) => {
        console.error('Error rendering docx template:', err);
      });
    });
  }, [bytes]);

  // Clamp marquee to new margins when settings or pages change
  useEffect(() => {
    if (!activeMarquee || pages.length === 0) return;
    const pageNode = pages[activeMarquee.pageIndex] as HTMLElement;
    if (!pageNode) return;

    const pageW = pageNode.clientWidth;
    const pageH = pageNode.clientHeight;

    const configVal = getLayoutConfigValues();
    const topDxa = configVal.margins.topDxa;
    const bottomDxa = configVal.margins.bottomDxa;
    const leftDxa = configVal.margins.leftDxa;
    const rightDxa = configVal.margins.rightDxa;

    const totalWDxa = configVal.paperSize.widthDxa;
    const totalHDxa = configVal.paperSize.heightDxa;

    const mtPx = (topDxa / totalHDxa) * pageH;
    const mbPx = (bottomDxa / totalHDxa) * pageH;
    const mlPx = (leftDxa / totalWDxa) * pageW;
    const mrPx = (rightDxa / totalWDxa) * pageW;

    let newX = activeMarquee.x;
    let newY = activeMarquee.y;
    let newW = activeMarquee.width;
    let newH = activeMarquee.height;

    // Check if marquee is out of bounds
    if (newX < mlPx) {
      newW = Math.max(10, newW - (mlPx - newX));
      newX = mlPx;
    }
    if (newY < mtPx) {
      newH = Math.max(10, newH - (mtPx - newY));
      newY = mtPx;
    }
    if (newX + newW > pageW - mrPx) {
      newW = Math.max(10, (pageW - mrPx) - newX);
    }
    if (newY + newH > pageH - mbPx) {
      newH = Math.max(10, (pageH - mbPx) - newY);
    }

    // Maintain aspect ratio if locked
    if (settings.lockAspectRatio && timetableAspectRatio) {
      newH = newW / timetableAspectRatio;
      if (newY + newH > pageH - mbPx) {
        newH = (pageH - mbPx) - newY;
        newW = newH * timetableAspectRatio;
      }
    }

    if (
      newX !== activeMarquee.x ||
      newY !== activeMarquee.y ||
      newW !== activeMarquee.width ||
      newH !== activeMarquee.height
    ) {
      setActiveMarquee({
        ...activeMarquee,
        x: newX,
        y: newY,
        width: newW,
        height: newH
      });
    }
  }, [settings, pages, timetableAspectRatio]);

  // 2. IntersectionObserver
  useEffect(() => {
    if (pages.length === 0 || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = pages.indexOf(entry.target);
            if (idx !== -1) {
              setCurrentPage(idx);
            }
          }
        });
      },
      {
        root: containerRef.current.parentElement,
        threshold: 0.3
      }
    );

    pages.forEach((page) => observer.observe(page));
    return () => {
      pages.forEach((page) => observer.unobserve(page));
    };
  }, [pages]);

  // 3. Callback marquee changes
  useEffect(() => {
    if (!activeMarquee || pages.length === 0 || !containerRef.current) {
      onSelectPosition(null);
      return;
    }

    const pageEl = pages[activeMarquee.pageIndex] as HTMLElement;
    if (!pageEl) return;

    const pageW = pageEl.clientWidth;
    const pageH = pageEl.clientHeight;

    const xPct = activeMarquee.x / pageW;
    const yPct = activeMarquee.y / pageH;
    const wPct = activeMarquee.width / pageW;
    const hPct = activeMarquee.height / pageH;

    const allHtmlPs = Array.from(
      containerRef.current.querySelectorAll('p, [class*="docx-p"], h1, h2, h3, h4, h5, h6')
    );

    const pageRect = pageEl.getBoundingClientRect();
    const absoluteX = pageRect.left + activeMarquee.x * zoom;
    const absoluteY = pageRect.top + activeMarquee.y * zoom;

    let targetEl = document.elementFromPoint(absoluteX, absoluteY);
    if (!targetEl || !pageEl.contains(targetEl)) {
      targetEl = pageEl.querySelector('p, [class*="docx-p"], h1, h2, h3, h4, h5, h6') || pageEl;
    }

    const closestP = targetEl.closest('p, [class*="docx-p"], h1, h2, h3, h4, h5, h6') ||
                    targetEl.querySelector('p, [class*="docx-p"], h1, h2, h3, h4, h5, h6');

    const pIndex = closestP ? allHtmlPs.indexOf(closestP) : 0;

    onSelectPosition({
      pageIndex: activeMarquee.pageIndex,
      xPct,
      yPct,
      wPct,
      hPct,
      targetParagraphIndex: pIndex >= 0 ? pIndex : 0
    });
  }, [activeMarquee, pages, zoom, onSelectPosition]);

  const zoomIn = () => setZoom((z) => Math.min(2.0, z + 0.1));
  const zoomOut = () => setZoom((z) => Math.max(0.4, z - 0.1));

  const handlePageJump = (pageIdx: number) => {
    const pageNode = pages[pageIdx];
    if (pageNode) {
      pageNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(pageIdx);
    }
  };

  const handleAddGuide = () => {
    if (newGuideValue <= 0) return;
    const g = { type: newGuideType, value: newGuideValue, unit: newGuideUnit };
    setSettings({ ...settings, guides: [...settings.guides, g] });
  };

  const handleRemoveGuide = (idx: number) => {
    setSettings({ ...settings, guides: settings.guides.filter((_, i) => i !== idx) });
  };

  const handleSaveCustomSizeToHistory = () => {
    if (settings.paperSize !== 'Custom') return;
    const name = `${settings.customWidth}x${settings.customHeight}${settings.customUnit}`;
    const newSize: CustomSize = {
      name,
      width: settings.customWidth,
      height: settings.customHeight,
      unit: settings.customUnit
    };

    let updated = [newSize, ...customHistory.filter((item) => item.name !== name)];
    updated = updated.slice(0, 5);
    setCustomHistory(updated);
    localStorage.setItem('docx_custom_size_history', JSON.stringify(updated));
  };

  const handleApplyHistorySize = (size: CustomSize) => {
    setSettings({
      ...settings,
      paperSize: 'Custom',
      customWidth: size.width,
      customHeight: size.height,
      customUnit: size.unit
    });
  };

  const config = getLayoutConfigValues();

  // ── Popover Layout Contents ──
  const customPaperPopover = (
    <div style={{ padding: 4, width: 220, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 12 }}>Dimensions</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <InputNumber
          size="small"
          value={settings.customWidth}
          onChange={(val) => setSettings({ ...settings, customWidth: val ?? 21 })}
          min={5}
          max={100}
          style={{ flex: 1 }}
          placeholder="W"
        />
        <span>x</span>
        <InputNumber
          size="small"
          value={settings.customHeight}
          onChange={(val) => setSettings({ ...settings, customHeight: val ?? 29.7 })}
          min={5}
          max={100}
          style={{ flex: 1 }}
          placeholder="H"
        />
        <Select
          size="small"
          value={settings.customUnit}
          onChange={(val) => setSettings({ ...settings, customUnit: val })}
          options={[{ label: 'cm', value: 'cm' }, { label: 'in', value: 'in' }]}
          style={{ width: 65 }}
        />
      </div>
      <Button size="small" type="primary" onClick={handleSaveCustomSizeToHistory} style={{ background: '#3D6B50', borderColor: '#3D6B50' }}>
        Save Size to History
      </Button>

      {customHistory.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>Recent sizes:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {customHistory.map((item, idx) => (
              <Button
                key={idx}
                size="small"
                type="text"
                onClick={() => handleApplyHistorySize(item)}
                style={{ background: '#EEF2F6', fontSize: 10, height: 20, padding: '0 6px' }}
              >
                {item.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const customMarginsPopover = (
    <div style={{ padding: 4, width: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 12 }}>Custom Margins</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: '#8c8c8c' }}>Top</div>
          <InputNumber size="small" value={settings.marginTop} onChange={(val) => setSettings({ ...settings, marginTop: val ?? 2.54 })} min={0} max={10} style={{ width: '100%' }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#8c8c8c' }}>Bottom</div>
          <InputNumber size="small" value={settings.marginBottom} onChange={(val) => setSettings({ ...settings, marginBottom: val ?? 2.54 })} min={0} max={10} style={{ width: '100%' }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#8c8c8c' }}>Left</div>
          <InputNumber size="small" value={settings.marginLeft} onChange={(val) => setSettings({ ...settings, marginLeft: val ?? 2.54 })} min={0} max={10} style={{ width: '100%' }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#8c8c8c' }}>Right</div>
          <InputNumber size="small" value={settings.marginRight} onChange={(val) => setSettings({ ...settings, marginRight: val ?? 2.54 })} min={0} max={10} style={{ width: '100%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <Select
          size="small"
          value={settings.marginUnit}
          onChange={(val) => setSettings({ ...settings, marginUnit: val })}
          options={[{ label: 'cm', value: 'cm' }, { label: 'in', value: 'in' }]}
          style={{ width: 65 }}
        />
      </div>
    </div>
  );

  const guidesPopover = (
    <div style={{ padding: 4, width: 220, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 12 }}>Custom Snapping Guides</div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <Select
          size="small"
          value={newGuideType}
          onChange={(val) => setNewGuideType(val)}
          options={[{ label: 'Vert', value: 'v' }, { label: 'Horiz', value: 'h' }]}
          style={{ width: 70 }}
        />
        <InputNumber
          size="small"
          value={newGuideValue}
          onChange={(val) => setNewGuideValue(val ?? 5.0)}
          min={0}
          max={100}
          style={{ flex: 1 }}
        />
        <Select
          size="small"
          value={newGuideUnit}
          onChange={(val) => setNewGuideUnit(val)}
          options={[{ label: 'cm', value: 'cm' }, { label: 'in', value: 'in' }]}
          style={{ width: 60 }}
        />
        <Button
          size="small"
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddGuide}
          style={{ background: '#3D6B50', borderColor: '#3D6B50' }}
        />
      </div>

      {settings.guides.length > 0 && (
        <List
          size="small"
          bordered
          dataSource={settings.guides}
          renderItem={(g, idx) => (
            <List.Item
              style={{ padding: '2px 6px', fontSize: 11 }}
              actions={[
                <Button
                  size="small"
                  type="text"
                  icon={<DeleteOutlined />}
                  danger
                  onClick={() => handleRemoveGuide(idx)}
                  style={{ padding: 0, height: 'auto' }}
                />
              ]}
            >
              {g.type === 'v' ? 'Vert' : 'Horiz'}: {g.value}{g.unit}
            </List.Item>
          )}
          style={{ maxHeight: 100, overflowY: 'auto', background: '#FFFFFF' }}
        />
      )}
    </div>
  );

  return (
    <div className="docx-preview-container" style={{ flexDirection: 'column' }}>
      
      {/* ── Top Ribbon Toolbar ── */}
      <div
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #D0D7E3',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          overflowX: 'auto',
          overflowY: 'hidden',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
          zIndex: 10,
          height: 84,
          flexShrink: 0
        }}
      >
        
        {/* Group 1: Paper Size */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Space size={4}>
            <Select
              value={settings.paperSize}
              onChange={(val) => setSettings({ ...settings, paperSize: val })}
              options={[
                { label: 'Letter (8.5" x 11")', value: 'Letter' },
                { label: 'A4 (21cm x 29.7cm)', value: 'A4' },
                { label: 'A3 (29.7cm x 42cm)', value: 'A3' },
                { label: 'Legal (8.5" x 14")', value: 'Legal' },
                { label: 'Custom size...', value: 'Custom' },
              ]}
              style={{ width: 140 }}
              size="small"
              suffixIcon={<FileOutlined style={{ color: '#3D6B50' }} />}
            />
            {settings.paperSize === 'Custom' && (
              <Popover content={customPaperPopover} trigger="click" title="Custom Page Dimensions">
                <Button size="small" icon={<SettingOutlined />} style={{ color: '#3D6B50', borderColor: '#3D6B50' }} />
              </Popover>
            )}
          </Space>
          <span style={{ fontSize: 9, color: '#7A8BA8', fontWeight: 600, lineHeight: 1, marginTop: 4 }}>PAPER SIZE</span>
        </div>

        <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

        {/* Group 2: Orientation */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Radio.Group
            value={settings.orientation}
            onChange={(e) => setSettings({ ...settings, orientation: e.target.value })}
            size="small"
            buttonStyle="solid"
          >
            <Radio.Button value="portrait">
              <FileTextOutlined style={{ marginRight: 4 }} />
              Portrait
            </Radio.Button>
            <Radio.Button value="landscape">
              <FileTextOutlined style={{ transform: 'rotate(90deg)', marginRight: 4 }} />
              Landscape
            </Radio.Button>
          </Radio.Group>
          <span style={{ fontSize: 9, color: '#7A8BA8', fontWeight: 600, lineHeight: 1, marginTop: 4 }}>ORIENTATION</span>
        </div>

        <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

        {/* Group 3: Margins */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Space size={4}>
            <Select
              value={settings.marginType}
              onChange={(val) => setSettings({ ...settings, marginType: val })}
              options={[
                { label: 'Normal (1 in)', value: 'Normal' },
                { label: 'Narrow (0.5 in)', value: 'Narrow' },
                { label: 'Moderate (0.75 in)', value: 'Moderate' },
                { label: 'Custom Margins...', value: 'Custom' },
              ]}
              style={{ width: 140 }}
              size="small"
              suffixIcon={<BorderOutlined style={{ color: '#3D6B50' }} />}
            />
            {settings.marginType === 'Custom' && (
              <Popover content={customMarginsPopover} trigger="click" title="Custom Page Margins">
                <Button size="small" icon={<SettingOutlined />} style={{ color: '#3D6B50', borderColor: '#3D6B50' }} />
              </Popover>
            )}
          </Space>
          <span style={{ fontSize: 9, color: '#7A8BA8', fontWeight: 600, lineHeight: 1, marginTop: 4 }}>MARGINS</span>
        </div>

        <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

        {/* Group 4: Rulers & Guides */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Space size={4}>
            <Button
              type={settings.showRulers ? 'primary' : 'default'}
              icon={<LayoutOutlined />}
              onClick={() => setSettings({ ...settings, showRulers: !settings.showRulers })}
              size="small"
              style={settings.showRulers ? { background: '#3D6B50', borderColor: '#3D6B50' } : {}}
            >
              Rulers
            </Button>
            {settings.showRulers && (
              <Popover content={guidesPopover} trigger="click" title="Add Align Snapping Guides">
                <Button size="small" icon={<PlusOutlined />} style={{ color: '#3D6B50', borderColor: '#3D6B50' }} />
              </Popover>
            )}
          </Space>
          <span style={{ fontSize: 9, color: '#7A8BA8', fontWeight: 600, lineHeight: 1, marginTop: 4 }}>RULERS & GUIDES</span>
        </div>

        <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

        {/* Group 5: Aspect Ratio */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Button
            type={settings.lockAspectRatio ? 'primary' : 'default'}
            icon={settings.lockAspectRatio ? <LockOutlined /> : <UnlockOutlined />}
            onClick={() => setSettings({ ...settings, lockAspectRatio: !settings.lockAspectRatio })}
            size="small"
            style={settings.lockAspectRatio ? { background: '#3D6B50', borderColor: '#3D6B50' } : {}}
          >
            {settings.lockAspectRatio ? 'Locked' : 'Free Form'}
          </Button>
          <span style={{ fontSize: 9, color: '#7A8BA8', fontWeight: 600, lineHeight: 1, marginTop: 4 }}>ASPECT RATIO</span>
        </div>

        <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

        {/* Group 6: Zoom & View Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Space size={4}>
            <Select
              value={currentPage}
              onChange={handlePageJump}
              options={pages.map((_, i) => ({ label: `Page ${i + 1}`, value: i }))}
              size="small"
              style={{ width: 80 }}
              disabled={pages.length === 0}
            />
            <Button icon={<ZoomOutOutlined />} onClick={zoomOut} size="small" disabled={pages.length === 0} />
            <span style={{ fontSize: 11, minWidth: 32, textAlign: 'center', fontWeight: 500 }}>
              {Math.round(zoom * 100)}%
            </span>
            <Button icon={<ZoomInOutlined />} onClick={zoomIn} size="small" disabled={pages.length === 0} />
          </Space>
          <span style={{ fontSize: 9, color: '#7A8BA8', fontWeight: 600, lineHeight: 1, marginTop: 4 }}>VIEW ZOOM</span>
        </div>

        <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

        {/* Group 7: Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
          <Space size={6}>
            <Button
              icon={<ClearOutlined />}
              onClick={() => setActiveMarquee(null)}
              size="small"
              danger
              disabled={!activeMarquee}
            >
              Clear
            </Button>
            <Button
              type="primary"
              icon={<ExportOutlined />}
              disabled={!canExport}
              onClick={onExport}
              size="small"
              style={{ background: '#3D6B50', borderColor: '#3D6B50' }}
            >
              Export
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={onClose}
              size="small"
              type="default"
            >
              Close
            </Button>
          </Space>
          <span style={{ fontSize: 9, color: '#7A8BA8', fontWeight: 600, lineHeight: 1, marginTop: 4 }}>ACTIONS</span>
        </div>

      </div>

      {/* ── Document Page Viewer ── */}
      <div className="docx-preview-body" style={{ flex: 1, background: '#F5F7FA', overflowY: 'auto' }}>
        {bytes ? (
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
              paddingLeft: settings.showRulers ? 24 : 0,
              paddingTop: settings.showRulers ? 24 : 0,
              paddingBottom: 40,
              display: 'inline-block',
              margin: '0 auto'
            }}
          >
            <div ref={containerRef} />
            
            {pages.map((pageNode, index) =>
              createPortal(
                <PageOverlay
                  key={index}
                  pageIndex={index}
                  pageNode={pageNode as HTMLElement}
                  activeMarquee={activeMarquee}
                  setActiveMarquee={setActiveMarquee}
                  timetableImg={timetableImg}
                  timetableAspectRatio={timetableAspectRatio}
                  lockAspectRatio={settings.lockAspectRatio}
                  showRulers={settings.showRulers}
                  layoutConfig={config}
                  guides={settings.guides}
                  zoom={zoom}
                />,
                pageNode
              )
            )}
          </div>
        ) : (
          <div style={{ marginTop: 100 }}>
            <Empty description="No template loaded" />
          </div>
        )}
      </div>

    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   PageOverlay & SVG Rulers
   ────────────────────────────────────────────────────────────────────────── */

interface PageOverlayProps {
  pageIndex: number;
  pageNode: HTMLElement;
  activeMarquee: Marquee | null;
  setActiveMarquee: (m: Marquee | null) => void;
  timetableImg: string | null;
  timetableAspectRatio: number;
  lockAspectRatio: boolean;
  showRulers: boolean;
  layoutConfig: {
    orientation: 'portrait' | 'landscape';
    paperSize: { widthDxa: number; heightDxa: number };
    margins: { topDxa: number; bottomDxa: number; leftDxa: number; rightDxa: number };
  };
  guides: { type: 'v' | 'h'; value: number; unit: 'cm' | 'in' }[];
  zoom: number;
}

function PageOverlay({
  pageIndex,
  pageNode,
  activeMarquee,
  setActiveMarquee,
  timetableImg,
  timetableAspectRatio,
  lockAspectRatio,
  showRulers,
  layoutConfig,
  guides,
  zoom
}: PageOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const pageW = pageNode.clientWidth;
  const pageH = pageNode.clientHeight;

  const topDxa = layoutConfig.margins.topDxa;
  const bottomDxa = layoutConfig.margins.bottomDxa;
  const leftDxa = layoutConfig.margins.leftDxa;
  const rightDxa = layoutConfig.margins.rightDxa;

  const totalWDxa = layoutConfig.paperSize.widthDxa;
  const totalHDxa = layoutConfig.paperSize.heightDxa;

  const mtPx = (topDxa / totalHDxa) * pageH;
  const mbPx = (bottomDxa / totalHDxa) * pageH;
  const mlPx = (leftDxa / totalWDxa) * pageW;
  const mrPx = (rightDxa / totalWDxa) * pageW;

  const marqueeOnThisPage = activeMarquee && activeMarquee.pageIndex === pageIndex ? activeMarquee : null;

  const getSnapLines = () => {
    const vLines = [mlPx, pageW - mrPx];
    const hLines = [mtPx, pageH - mbPx];

    guides.forEach((g) => {
      const scale = g.unit === 'cm' ? 567 : 1440;
      const valDxa = g.value * scale;
      if (g.type === 'v') {
        const px = (valDxa / totalWDxa) * pageW;
        if (px >= 0 && px <= pageW) vLines.push(px);
      } else {
        const px = (valDxa / totalHDxa) * pageH;
        if (px >= 0 && px <= pageH) hLines.push(px);
      }
    });

    return { v: vLines, h: hLines };
  };

  const snapValue = (val: number, snapLines: number[], threshold = 10) => {
    for (const snap of snapLines) {
      if (Math.abs(val - snap) < threshold) {
        return snap;
      }
    }
    return val;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.docx-marquee') || target.closest('.docx-marquee-handle')) {
      return;
    }

    if (!overlayRef.current) return;
    const rect = pageNode.getBoundingClientRect();
    const clickX = e.clientX;
    const clickY = e.clientY;
    
    let marqueeCreated = false;

    const snapLines = getSnapLines();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dist = Math.sqrt(Math.pow(moveEvent.clientX - clickX, 2) + Math.pow(moveEvent.clientY - clickY, 2));
      if (!marqueeCreated && dist < 5) {
        return;
      }

      const startX = (clickX - rect.left) / zoom;
      const startY = (clickY - rect.top) / zoom;
      const clampedStartX = Math.max(mlPx, Math.min(pageW - mrPx, startX));
      const clampedStartY = Math.max(mtPx, Math.min(pageH - mbPx, startY));

      let curX = (moveEvent.clientX - rect.left) / zoom;
      let curY = (moveEvent.clientY - rect.top) / zoom;

      // Apply Snapping
      curX = snapValue(curX, snapLines.v);
      curY = snapValue(curY, snapLines.h);

      let width = curX - clampedStartX;
      let height = curY - clampedStartY;

      let x = width < 0 ? clampedStartX + width : clampedStartX;
      let y = height < 0 ? clampedStartY + height : clampedStartY;
      width = Math.abs(width);
      height = Math.abs(height);

      if (lockAspectRatio && timetableAspectRatio) {
        height = width / timetableAspectRatio;
      }

      // Constrain inside page margins
      if (x < mlPx) {
        width -= (mlPx - x);
        x = mlPx;
      }
      if (y < mtPx) {
        height -= (mtPx - y);
        y = mtPx;
      }
      if (x + width > pageW - mrPx) {
        width = (pageW - mrPx) - x;
        if (lockAspectRatio && timetableAspectRatio) {
          height = width / timetableAspectRatio;
        }
      }
      if (y + height > pageH - mbPx) {
        height = (pageH - mbPx) - y;
        if (lockAspectRatio && timetableAspectRatio) {
          width = height * timetableAspectRatio;
        }
      }

      marqueeCreated = true;
      setActiveMarquee({
        pageIndex,
        x,
        y,
        width,
        height
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMarqueeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!marqueeOnThisPage) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = marqueeOnThisPage.x;
    const origY = marqueeOnThisPage.y;

    const snapLines = getSnapLines();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;

      let newX = origX + dx;
      let newY = origY + dy;

      newX = snapValue(newX, snapLines.v);
      newX = snapValue(newX + marqueeOnThisPage.width, snapLines.v) - marqueeOnThisPage.width;
      
      newY = snapValue(newY, snapLines.h);
      newY = snapValue(newY + marqueeOnThisPage.height, snapLines.h) - marqueeOnThisPage.height;

      newX = Math.max(mlPx, Math.min(pageW - mrPx - marqueeOnThisPage.width, newX));
      newY = Math.max(mtPx, Math.min(pageH - mbPx - marqueeOnThisPage.height, newY));

      setActiveMarquee({
        ...marqueeOnThisPage,
        x: newX,
        y: newY
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleHandleMouseDown = (e: React.MouseEvent, handleDir: string) => {
    e.stopPropagation();
    if (!marqueeOnThisPage) return;

    const startX = e.clientX;
    const startY = e.clientY;

    const origX = marqueeOnThisPage.x;
    const origY = marqueeOnThisPage.y;
    const origW = marqueeOnThisPage.width;
    const origH = marqueeOnThisPage.height;

    const snapLines = getSnapLines();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;

      let newX = origX;
      let newY = origY;
      let newW = origW;
      let newH = origH;

      if (handleDir.includes('e')) {
        let rightEdge = origX + origW + dx;
        rightEdge = snapValue(rightEdge, snapLines.v);
        newW = Math.max(10, rightEdge - origX);
      }
      if (handleDir.includes('w')) {
        let leftEdge = origX + dx;
        leftEdge = snapValue(leftEdge, snapLines.v);
        const targetW = origX + origW - leftEdge;
        if (targetW >= 10) {
          newW = targetW;
          newX = leftEdge;
        }
      }
      if (handleDir.includes('s')) {
        let bottomEdge = origY + origH + dy;
        bottomEdge = snapValue(bottomEdge, snapLines.h);
        newH = Math.max(10, bottomEdge - origY);
      }
      if (handleDir.includes('n')) {
        let topEdge = origY + dy;
        topEdge = snapValue(topEdge, snapLines.h);
        const targetH = origY + origH - topEdge;
        if (targetH >= 10) {
          newH = targetH;
          newY = topEdge;
        }
      }

      if (lockAspectRatio && timetableAspectRatio) {
        if (handleDir === 'e' || handleDir === 'w') {
          newH = newW / timetableAspectRatio;
        } else if (handleDir === 'n' || handleDir === 's') {
          newW = newH * timetableAspectRatio;
        } else {
          newH = newW / timetableAspectRatio;
        }
      }

      if (newX < mlPx) {
        newW -= (mlPx - newX);
        newX = mlPx;
      }
      if (newY < mtPx) {
        newH -= (mtPx - newY);
        newY = mtPx;
      }
      if (newX + newW > pageW - mrPx) {
        newW = (pageW - mrPx) - newX;
        if (lockAspectRatio && timetableAspectRatio) {
          newH = newW / timetableAspectRatio;
        }
      }
      if (newY + newH > pageH - mbPx) {
        newH = (pageH - mbPx) - newY;
        if (lockAspectRatio && timetableAspectRatio) {
          newW = newH * timetableAspectRatio;
        }
      }

      setActiveMarquee({
        pageIndex,
        x: newX,
        y: newY,
        width: newW,
        height: newH
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const activeUnit = 'cm';

  return (
    <div
      ref={overlayRef}
      className="docx-marquee-overlay"
      onMouseDown={handleMouseDown}
    >
      {showRulers && (
        <>
          <TopRuler widthPx={pageW} dxaWidth={totalWDxa} unit={activeUnit} />
          <LeftRuler heightPx={pageH} dxaHeight={totalHDxa} unit={activeUnit} />
        </>
      )}

      {showRulers && (
        <>
          <div style={{ position: 'absolute', top: mtPx, left: 0, right: 0, borderTop: '1px dashed rgba(255, 77, 79, 0.45)', pointerEvents: 'none', zIndex: 90 }} />
          <div style={{ position: 'absolute', top: pageH - mbPx, left: 0, right: 0, borderTop: '1px dashed rgba(255, 77, 79, 0.45)', pointerEvents: 'none', zIndex: 90 }} />
          <div style={{ position: 'absolute', left: mlPx, top: 0, bottom: 0, borderLeft: '1px dashed rgba(255, 77, 79, 0.45)', pointerEvents: 'none', zIndex: 90 }} />
          <div style={{ position: 'absolute', left: pageW - mrPx, top: 0, bottom: 0, borderLeft: '1px dashed rgba(255, 77, 79, 0.45)', pointerEvents: 'none', zIndex: 90 }} />
        </>
      )}

      {showRulers && guides.map((g, idx) => {
        const scale = g.unit === 'cm' ? 567 : 1440;
        const valDxa = g.value * scale;
        if (g.type === 'v') {
          const px = (valDxa / totalWDxa) * pageW;
          if (px < 0 || px > pageW) return null;
          return (
            <div
              key={`v-${idx}`}
              style={{
                position: 'absolute',
                left: px,
                top: 0,
                bottom: 0,
                borderLeft: '1px solid #1890ff',
                pointerEvents: 'none',
                zIndex: 95
              }}
            />
          );
        } else {
          const px = (valDxa / totalHDxa) * pageH;
          if (px < 0 || px > pageH) return null;
          return (
            <div
              key={`h-${idx}`}
              style={{
                position: 'absolute',
                top: px,
                left: 0,
                right: 0,
                borderTop: '1px solid #1890ff',
                pointerEvents: 'none',
                zIndex: 95
              }}
            />
          );
        }
      })}

      {marqueeOnThisPage && (
        <div
          className="docx-marquee"
          style={{
            left: marqueeOnThisPage.x,
            top: marqueeOnThisPage.y,
            width: marqueeOnThisPage.width,
            height: marqueeOnThisPage.height
          }}
          onMouseDown={handleMarqueeMouseDown}
        >
          {timetableImg && (
            <img
              src={timetableImg}
              className="docx-marquee-preview"
              alt="Timetable Preview"
            />
          )}

          {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((dir) => (
            <div
              key={dir}
              className={`docx-marquee-handle handle-${dir}`}
              onMouseDown={(e) => handleHandleMouseDown(e, dir)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TopRuler({ widthPx, dxaWidth, unit }: { widthPx: number; dxaWidth: number; unit: 'cm' | 'in' }) {
  const dxaPerUnit = unit === 'cm' ? 567 : 1440;
  const totalUnits = dxaWidth / dxaPerUnit;
  const pxPerUnit = widthPx / totalUnits;

  const ticks = [];
  const step = 1;
  for (let i = 0; i <= totalUnits; i += step) {
    const x = i * pxPerUnit;
    const isMajor = i % 5 === 0 || unit === 'in';
    ticks.push(
      <g key={i}>
        <line x1={x} y1={20} x2={x} y2={isMajor ? 8 : 14} stroke="#7A8BA8" strokeWidth="1" />
        {isMajor && (
          <text x={x + 2} y={9} fill="#7A8BA8" fontSize="8" fontFamily="sans-serif">
            {i}
          </text>
        )}
      </g>
    );
  }

  return (
    <svg style={{ position: 'absolute', top: -20, left: 0, width: '100%', height: 20, background: '#F5F7FA', borderBottom: '1px solid #D0D7E3' }}>
      {ticks}
    </svg>
  );
}

function LeftRuler({ heightPx, dxaHeight, unit }: { heightPx: number; dxaHeight: number; unit: 'cm' | 'in' }) {
  const dxaPerUnit = unit === 'cm' ? 567 : 1440;
  const totalUnits = dxaHeight / dxaPerUnit;
  const pxPerUnit = heightPx / totalUnits;

  const ticks = [];
  const step = 1;
  for (let i = 0; i <= totalUnits; i += step) {
    const y = i * pxPerUnit;
    const isMajor = i % 5 === 0 || unit === 'in';
    ticks.push(
      <g key={i}>
        <line x1={20} y1={y} x2={isMajor ? 8 : 14} y2={y} stroke="#7A8BA8" strokeWidth="1" />
        {isMajor && (
          <text x={2} y={y + 8} fill="#7A8BA8" fontSize="8" fontFamily="sans-serif">
            {i}
          </text>
        )}
      </g>
    );
  }

  return (
    <svg style={{ position: 'absolute', top: 0, left: -20, width: 20, height: '100%', background: '#F5F7FA', borderRight: '1px solid #D0D7E3' }}>
      {ticks}
    </svg>
  );
}
