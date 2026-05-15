import JSZip from 'jszip';

/**
 * Convert PDF to Word (DOCX) format
 *
 * Strategy:
 *   1. Use pdf.js (pdfjs-dist) to extract text content from every
 *      page — including text positions, font sizes, and styles.
 *   2. Group text items into logical paragraphs based on Y position.
 *   3. Detect headings by font size, bold lines by content patterns.
 *   4. Build a valid DOCX (OOXML) with proper styling using JSZip.
 *
 * This produces a Word document with real, editable, selectable text.
 */
export async function convertPdfToWord(
  file: File,
  onProgress: (progress: number) => void,
): Promise<Blob> {
  onProgress(5);

  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // Validate PDF header
  if (uint8.length < 5) throw new Error('File is too small to be a valid PDF.');
  const hdr = String.fromCharCode(uint8[0], uint8[1], uint8[2], uint8[3]);
  if (hdr !== '%PDF') throw new Error('This does not appear to be a valid PDF file.');

  onProgress(10);

  // ---- 1. Load PDF with pdf.js ----
  const pdfjsLib = await import('pdfjs-dist');

  // Use the bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  // Load document (using fake worker mode for simplicity in the browser)
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  onProgress(20);

  if (numPages === 0) throw new Error('The PDF contains no pages.');

  // ---- 2. Extract text from each page ----
  interface ParagraphInfo {
    text: string;
    fontSize: number;
    isBold: boolean;
  }

  const allParagraphs: ParagraphInfo[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group text items into lines based on Y position
    const lineGroups = new Map<number, { text: string; fontSize: number; fontName: string }[]>();

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;

      // item.transform[5] = Y position, item.transform[4] = X position
      const y = Math.round(item.transform[5]);
      const fontSize = Math.abs(item.transform[0]) || 12;
      const fontName = item.fontName || '';

      if (!lineGroups.has(y)) lineGroups.set(y, []);
      lineGroups.get(y)!.push({
        text: item.str,
        fontSize,
        fontName,
      });
    }

    // Sort lines by Y position (top to bottom = descending Y in PDF coords)
    const sortedYs = [...lineGroups.keys()].sort((a, b) => b - a);

    // Merge close Y positions (within 2px) into single lines
    const mergedLines: { text: string; fontSize: number; fontName: string }[] = [];
    let lastY = -999;
    for (const y of sortedYs) {
      const items = lineGroups.get(y)!;
      const lineText = items.map((i) => i.text).join(' ');
      const avgFontSize = items.reduce((s, i) => s + i.fontSize, 0) / items.length;
      const mainFont = items[0].fontName;

      if (Math.abs(y - lastY) < 3 && mergedLines.length > 0) {
        // Same visual line — append
        mergedLines[mergedLines.length - 1].text += ' ' + lineText;
      } else {
        mergedLines.push({ text: lineText, fontSize: avgFontSize, fontName: mainFont });
      }
      lastY = y;
    }

    // Convert lines to paragraphs
    for (const line of mergedLines) {
      const trimmed = line.text.trim();
      if (!trimmed) continue;

      const isBold = /bold/i.test(line.fontName) || /,B$/i.test(line.fontName);

      allParagraphs.push({
        text: trimmed,
        fontSize: line.fontSize,
        isBold,
      });
    }

    // Add page separator
    if (pageNum < numPages) {
      allParagraphs.push({ text: '___PAGE_BREAK___', fontSize: 12, isBold: false });
    }

    onProgress(20 + (pageNum / numPages) * 45);
    page.cleanup();
  }

  pdfDoc.destroy();
  onProgress(70);

  if (allParagraphs.length === 0) {
    throw new Error(
      'Could not extract any text from this PDF. ' +
      'The file may be image-based (scanned). ' +
      'OCR is required for scanned PDFs.',
    );
  }

  // ---- 3. Determine heading thresholds ----
  const fontSizes = allParagraphs
    .filter((p) => p.text !== '___PAGE_BREAK___')
    .map((p) => p.fontSize);
  const bodySize = median(fontSizes);

  // ---- 4. Build DOCX ----
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);

  // _rels/.rels
  zip.folder('_rels')!.file('.rels', ROOT_RELS_XML);

  // word/_rels/document.xml.rels
  zip.folder('word')!.folder('_rels')!.file('document.xml.rels', WORD_RELS_XML);

  // word/styles.xml
  zip.folder('word')!.file('styles.xml', STYLES_XML);

  onProgress(75);

  // word/document.xml — the main content
  const bodyParagraphs: string[] = [];

  // Title: filename
  const docTitle = escXml(file.name.replace(/\.[^.]+$/, ''));
  bodyParagraphs.push(makeDocxParagraph(docTitle, 'Heading1'));

  for (const para of allParagraphs) {
    if (para.text === '___PAGE_BREAK___') {
      bodyParagraphs.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      continue;
    }

    // Classify: heading vs body
    let style = 'Normal';
    if (para.fontSize > bodySize * 1.45) {
      style = 'Heading1';
    } else if (para.fontSize > bodySize * 1.2 || (para.isBold && para.fontSize > bodySize * 1.05)) {
      style = 'Heading2';
    } else if (para.isBold) {
      style = 'BoldBody';
    }

    bodyParagraphs.push(makeDocxParagraph(escXml(para.text), style));
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyParagraphs.join('\n    ')}
  </w:body>
</w:document>`;

  zip.folder('word')!.file('document.xml', documentXml);

  onProgress(90);

  // Generate DOCX blob
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  onProgress(100);
  return blob;
}

/* ===== DOCX template helpers ===== */

function makeDocxParagraph(text: string, style: string): string {
  let runProps = '';
  if (style === 'BoldBody') {
    runProps = '<w:rPr><w:b/></w:rPr>';
    style = 'Normal';
  }

  return `<w:p>
  <w:pPr><w:pStyle w:val="${style}"/></w:pPr>
  <w:r>${runProps}<w:t xml:space="preserve">${text}</w:t></w:r>
</w:p>`;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 12;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* ---- Boilerplate OOXML ---- */

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const WORD_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri"/>
        <w:sz w:val="22"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="360" w:after="120"/></w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="36"/>
      <w:color w:val="1a1a3e"/>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
      <w:color w:val="2a2a5e"/>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
    </w:rPr>
  </w:style>
</w:styles>`;
