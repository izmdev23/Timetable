import JSZip from 'jszip';

/**
 * Helper to safely extract attributes with or without namespace prefix
 */
function getXmlAttribute(node: Element, name: string): string | null {
  const prefix = name.split(':')[1];
  return node.getAttribute(name) || (prefix ? node.getAttribute(prefix) : null);
}

export interface DocxLayoutConfig {
  orientation?: 'portrait' | 'landscape';
  paperSize?: { widthDxa: number; heightDxa: number };
  margins?: { topDxa: number; bottomDxa: number; leftDxa: number; rightDxa: number };
}

/**
 * Modifies an existing docx template to insert the timetable PNG as a floating image at the specified page coordinates.
 * Supports custom page size, orientation, and margin overrides in OpenXML.
 *
 * @param templateBytes The binary contents of the original docx file
 * @param imageBytes The binary contents of the timetable PNG image
 * @param xPct Horizontal position percentage (0.0 to 1.0)
 * @param yPct Vertical position percentage (0.0 to 1.0)
 * @param wPct Width percentage of the page (0.0 to 1.0)
 * @param hPct Height percentage of the page (0.0 to 1.0)
 * @param targetParagraphIndex The sequenced index of the paragraph (within the target page/section) to anchor the image to
 * @param pageIndex The page index (section) the marquee is on, used for section-aware paragraph anchoring
 * @param layoutConfig Optional layout settings overrides for orientation, size and margins
 */
export async function exportToDocxTemplate(
  templateBytes: Uint8Array,
  imageBytes: Uint8Array,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  targetParagraphIndex: number,
  pageIndex: number,
  layoutConfig?: DocxLayoutConfig
): Promise<Uint8Array> {
  // Load docx zip archive
  const zip = await JSZip.loadAsync(templateBytes);

  // Parse document XML
  const docXmlText = await zip.file('word/document.xml')?.async('text');
  if (!docXmlText) {
    throw new Error('Invalid Word document: word/document.xml not found.');
  }

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const doc = parser.parseFromString(docXmlText, 'text/xml');

  // 1. Get/Set Page Size properties to calculate absolute EMUs
  let pageWidthDxa = 12240; // Default Letter width (8.5 in * 1440 dxa/in)
  let pageHeightDxa = 15840; // Default Letter height (11 in * 1440 dxa/in)

  const pgSzNodes = doc.getElementsByTagName('w:pgSz');
  if (pgSzNodes.length > 0) {
    const wVal = getXmlAttribute(pgSzNodes[0], 'w:w');
    const hVal = getXmlAttribute(pgSzNodes[0], 'w:h');
    if (wVal) pageWidthDxa = parseInt(wVal, 10);
    if (hVal) pageHeightDxa = parseInt(hVal, 10);
  }

  // Override properties if configuration layout is provided
  if (layoutConfig) {
    const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const sectPrNodes = doc.getElementsByTagName('w:sectPr');
    for (let s = 0; s < sectPrNodes.length; s++) {
      const sectPr = sectPrNodes[s];

      let pgSz = sectPr.getElementsByTagName('w:pgSz')[0];
      if (!pgSz) {
        pgSz = doc.createElementNS(NS, 'w:pgSz');
        sectPr.appendChild(pgSz);
      }

      let wDxa = pageWidthDxa;
      let hDxa = pageHeightDxa;
      if (layoutConfig.paperSize) {
        wDxa = layoutConfig.paperSize.widthDxa;
        hDxa = layoutConfig.paperSize.heightDxa;
      }
      pgSz.setAttribute('w:w', String(wDxa));
      pgSz.setAttribute('w:h', String(hDxa));

      if (layoutConfig.orientation) {
        const isLandscape = layoutConfig.orientation === 'landscape';
        pgSz.setAttribute('w:orient', layoutConfig.orientation);
        if (isLandscape && wDxa < hDxa) {
          const temp = wDxa;
          wDxa = hDxa;
          hDxa = temp;
          pgSz.setAttribute('w:w', String(wDxa));
          pgSz.setAttribute('w:h', String(hDxa));
        } else if (!isLandscape && wDxa > hDxa) {
          const temp = wDxa;
          wDxa = hDxa;
          hDxa = temp;
          pgSz.setAttribute('w:w', String(wDxa));
          pgSz.setAttribute('w:h', String(hDxa));
        }
      }

      if (layoutConfig.margins) {
        let pgMar = sectPr.getElementsByTagName('w:pgMar')[0];
        if (!pgMar) {
          pgMar = doc.createElementNS(NS, 'w:pgMar');
          sectPr.appendChild(pgMar);
        }
        pgMar.setAttribute('w:top', String(layoutConfig.margins.topDxa));
        pgMar.setAttribute('w:bottom', String(layoutConfig.margins.bottomDxa));
        pgMar.setAttribute('w:left', String(layoutConfig.margins.leftDxa));
        pgMar.setAttribute('w:right', String(layoutConfig.margins.rightDxa));
      }
    }
  }

  // 1 dxa = 635 EMUs (English Metric Units)
  const pageWidthEmu = pageWidthDxa * 635;
  const pageHeightEmu = pageHeightDxa * 635;

  const xEmu = xPct * pageWidthEmu;
  const yEmu = yPct * pageHeightEmu;
  const wEmu = wPct * pageWidthEmu;
  const hEmu = hPct * pageHeightEmu;

  // 2. Load and update Relationships file
  const relsXmlText = await zip.file('word/_rels/document.xml.rels')?.async('text');
  if (!relsXmlText) {
    throw new Error('Invalid Word document: relationships file not found.');
  }
  const relsDoc = parser.parseFromString(relsXmlText, 'text/xml');
  const relationshipsNode = relsDoc.getElementsByTagName('Relationships')[0] || relsDoc.documentElement;

  // Find max relationship ID to create a unique one
  const relNodes = relsDoc.getElementsByTagName('Relationship');
  let maxRelIdNum = 0;
  for (let i = 0; i < relNodes.length; i++) {
    const id = relNodes[i].getAttribute('Id') || '';
    const match = id.match(/^rId(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxRelIdNum) maxRelIdNum = num;
    }
  }

  const nextRelIdNum = maxRelIdNum + 1;
  const newRId = `rIdTimetableImg${nextRelIdNum}`;

  // Add relationship to XML relationships
  const newRel = relsDoc.createElementNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship');
  newRel.setAttribute('Id', newRId);
  newRel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');
  newRel.setAttribute('Target', 'media/image_timetable.png');
  relationshipsNode.appendChild(newRel);

  // Write updated relationships back to Zip
  zip.file('word/_rels/document.xml.rels', serializer.serializeToString(relsDoc));

  // 3. Write image bytes to Zip
  zip.file('word/media/image_timetable.png', imageBytes);

  // 4. Construct floating drawing node with absolute page anchoring (wp:anchor)
  const drawingXmlStr = `
<w:drawing xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
           xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
           xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
           xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">
    <wp:simplePos x="0" y="0"/>
    <wp:positionH relativeFrom="page">
      <wp:posOffset>${Math.round(xEmu)}</wp:posOffset>
    </wp:positionH>
    <wp:positionV relativeFrom="page">
      <wp:posOffset>${Math.round(yEmu)}</wp:posOffset>
    </wp:positionV>
    <wp:extent cx="${Math.round(wEmu)}" cy="${Math.round(hEmu)}"/>
    <wp:effectExtent l="0" t="0" r="0" b="0"/>
    <wp:wrapNone/>
    <wp:docPr id="${nextRelIdNum + 1000}" name="Timetable Grid Image"/>
    <wp:cNvGraphicFramePr>
      <a:graphicFrameLocks noChangeAspect="1"/>
    </wp:cNvGraphicFramePr>
    <a:graphic>
      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <pic:pic>
          <pic:nvPicPr>
            <pic:cNvPr id="${nextRelIdNum + 1001}" name="image_timetable.png"/>
            <pic:cNvPicPr/>
          </pic:nvPicPr>
          <pic:blipFill>
            <a:blip r:embed="${newRId}"/>
            <a:stretch>
              <a:fillRect/>
            </a:stretch>
          </pic:blipFill>
          <pic:spPr>
            <a:xfrm>
              <a:off x="0" y="0"/>
              <a:ext cx="${Math.round(wEmu)}" cy="${Math.round(hEmu)}"/>
            </a:xfrm>
            <a:prstGeom prst="rect">
              <a:avLst/>
            </a:prstGeom>
          </pic:spPr>
        </pic:pic>
      </a:graphicData>
    </a:graphic>
  </wp:anchor>
</w:drawing>
`;

  const drawingDoc = parser.parseFromString(drawingXmlStr.trim(), 'text/xml');
  const drawingNode = doc.importNode(drawingDoc.documentElement, true);

  // 5. Inject drawing node into target paragraph XML (section-aware body-only lookup)
  const body = doc.getElementsByTagName('w:body')[0] || doc.documentElement;
  const childNodes = Array.from(body.childNodes);

  let targetParagraph: Element | null = null;
  let seenSections = 0;
  let paraCount = 0;

  for (const child of childNodes) {
    const el = child as Element;
    if (el.tagName === 'w:sectPr') {
      seenSections++;
    } else if (el.tagName === 'w:p') {
      if (seenSections === pageIndex) {
        if (paraCount === targetParagraphIndex) {
          targetParagraph = el;
          break;
        }
        paraCount++;
      }
    }
  }

  // Fallback: try body paragraphs by global index
  if (!targetParagraph) {
    const bodyParagraphs = body.getElementsByTagName('w:p');
    targetParagraph = bodyParagraphs[targetParagraphIndex];
  }

  if (!targetParagraph && body.getElementsByTagName('w:p').length > 0) {
    targetParagraph = body.getElementsByTagName('w:p')[0];
  }

  if (!targetParagraph) {
    // If no paragraphs exist, create one inside w:body
    targetParagraph = doc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:p');
    body.appendChild(targetParagraph);
  }

  // Create a run (w:r) if it doesn't exist, and append drawing element
  let targetRun = targetParagraph.getElementsByTagName('w:r')[0];
  if (!targetRun) {
    targetRun = doc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:r');
    targetParagraph.appendChild(targetRun);
  }

  targetRun.appendChild(drawingNode);

  // Write updated document XML back to Zip
  zip.file('word/document.xml', serializer.serializeToString(doc));

  // 6. Generate output byte array
  return await zip.generateAsync({ type: 'uint8array' });
}

/**
 * Modifies layout properties (margins, size, orientation) of a docx file in-memory and returns the updated bytes.
 */
export async function updateDocxLayout(
  templateBytes: Uint8Array,
  layoutConfig: DocxLayoutConfig
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(templateBytes);
  const docXmlText = await zip.file('word/document.xml')?.async('text');
  if (!docXmlText) return templateBytes;

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const doc = parser.parseFromString(docXmlText, 'text/xml');

  const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const sectPrNodes = doc.getElementsByTagName('w:sectPr');
  for (let s = 0; s < sectPrNodes.length; s++) {
    const sectPr = sectPrNodes[s];

    let pgSz = sectPr.getElementsByTagName('w:pgSz')[0];
    if (!pgSz) {
      pgSz = doc.createElementNS(NS, 'w:pgSz');
      sectPr.appendChild(pgSz);
    }

    let pageWidthDxa = 12240;
    let pageHeightDxa = 15840;

    const wVal = getXmlAttribute(pgSz, 'w:w');
    const hVal = getXmlAttribute(pgSz, 'w:h');
    if (wVal) pageWidthDxa = parseInt(wVal, 10);
    if (hVal) pageHeightDxa = parseInt(hVal, 10);

    if (layoutConfig.paperSize) {
      pageWidthDxa = layoutConfig.paperSize.widthDxa;
      pageHeightDxa = layoutConfig.paperSize.heightDxa;
    }
    pgSz.setAttribute('w:w', String(pageWidthDxa));
    pgSz.setAttribute('w:h', String(pageHeightDxa));

    if (layoutConfig.orientation) {
      const isLandscape = layoutConfig.orientation === 'landscape';
      pgSz.setAttribute('w:orient', layoutConfig.orientation);
      if (isLandscape && pageWidthDxa < pageHeightDxa) {
        const temp = pageWidthDxa;
        pageWidthDxa = pageHeightDxa;
        pageHeightDxa = temp;
        pgSz.setAttribute('w:w', String(pageWidthDxa));
        pgSz.setAttribute('w:h', String(pageHeightDxa));
      } else if (!isLandscape && pageWidthDxa > pageHeightDxa) {
        const temp = pageWidthDxa;
        pageWidthDxa = pageHeightDxa;
        pageHeightDxa = temp;
        pgSz.setAttribute('w:w', String(pageWidthDxa));
        pgSz.setAttribute('w:h', String(pageHeightDxa));
      }
    }

    if (layoutConfig.margins) {
      let pgMar = sectPr.getElementsByTagName('w:pgMar')[0];
      if (!pgMar) {
        pgMar = doc.createElementNS(NS, 'w:pgMar');
        sectPr.appendChild(pgMar);
      }
      pgMar.setAttribute('w:top', String(layoutConfig.margins.topDxa));
      pgMar.setAttribute('w:bottom', String(layoutConfig.margins.bottomDxa));
      pgMar.setAttribute('w:left', String(layoutConfig.margins.leftDxa));
      pgMar.setAttribute('w:right', String(layoutConfig.margins.rightDxa));
    }
  }

  zip.file('word/document.xml', serializer.serializeToString(doc));
  return await zip.generateAsync({ type: 'uint8array' });
}

