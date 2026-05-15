import { PDFDocument } from 'pdf-lib';

/**
 * Convert PDF to Word (DOCX) format
 * 
 * Strategy: Parse the PDF structure, extract page metadata,
 * and create a valid DOCX file using JSZip.
 * 
 * Note: pdf-lib doesn't support full text extraction from PDFs.
 * For production use, a server-side solution with LibreOffice or
 * pdftotext would provide full text extraction. This implementation
 * extracts structural information and creates a properly-formatted DOCX.
 * 
 * Uses Uint8Array for reliable byte handling and ignoreEncryption
 * for broader PDF compatibility.
 */
export async function convertPdfToWord(
  file: File,
  onProgress: (progress: number) => void
): Promise<Blob> {
  onProgress(10);

  // Read file bytes
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  onProgress(20);

  // Validate PDF header
  if (uint8Array.length < 5) {
    throw new Error('File is too small to be a valid PDF.');
  }
  const header = String.fromCharCode(uint8Array[0], uint8Array[1], uint8Array[2], uint8Array[3]);
  if (header !== '%PDF') {
    throw new Error('This does not appear to be a valid PDF file.');
  }

  // Load the PDF document with ignoreEncryption for broader compatibility
  const pdfDoc = await PDFDocument.load(uint8Array, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  onProgress(30);

  if (pages.length === 0) {
    throw new Error('The PDF file contains no pages.');
  }

  onProgress(50);

  // Build DOCX using JSZip
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  onProgress(60);

  // _rels/.rels
  const relsFolder = zip.folder('_rels')!;
  relsFolder.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  // word/_rels/document.xml.rels
  const wordFolder = zip.folder('word')!;
  const wordRelsFolder = wordFolder.folder('_rels')!;
  wordRelsFolder.file(
    'document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // word/styles.xml
  wordFolder.file(
    'styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="24"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="2E2E5D"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="444466"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
  </w:style>
</w:styles>`
  );

  onProgress(70);

  // Build document.xml content
  const safeFileName = escapeXml(file.name);
  const pdfInfo = pdfDoc.getTitle() || pdfDoc.getSubject() || '';
  const pdfAuthor = pdfDoc.getAuthor() || '';

  const pageParagraphs = pages
    .map((page, i) => {
      const { width, height } = page.getSize();
      const w = Math.round(width);
      const h = Math.round(height);
      const orientation = width > height ? 'Landscape' : 'Portrait';

      const heading = `<w:p>
        <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
        <w:r><w:t>Page ${i + 1}</w:t></w:r>
      </w:p>`;

      const details = `<w:p>
        <w:r>
          <w:rPr><w:color w:val="666666"/><w:sz w:val="20"/></w:rPr>
          <w:t xml:space="preserve">Dimensions: ${w} x ${h} points | Orientation: ${orientation}</w:t>
        </w:r>
      </w:p>`;

      const pageBreak =
        i < pages.length - 1
          ? `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`
          : '';

      return heading + details + pageBreak;
    })
    .join('\n');

  // Optional metadata paragraph
  let metaPara = '';
  if (pdfInfo || pdfAuthor) {
    const parts: string[] = [];
    if (pdfInfo) parts.push(`Title: ${escapeXml(pdfInfo)}`);
    if (pdfAuthor) parts.push(`Author: ${escapeXml(pdfAuthor)}`);
    metaPara = `<w:p>
      <w:r>
        <w:rPr><w:i/><w:color w:val="888888"/><w:sz w:val="20"/></w:rPr>
        <w:t xml:space="preserve">${parts.join(' | ')}</w:t>
      </w:r>
    </w:p>`;
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Converted from: ${safeFileName}</w:t></w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:i/><w:color w:val="666666"/></w:rPr>
        <w:t xml:space="preserve">This document was converted from PDF format. Total pages: ${pages.length}.</w:t>
      </w:r>
    </w:p>
    ${metaPara}
    <w:p/>
    ${pageParagraphs}
  </w:body>
</w:document>`;

  wordFolder.file('document.xml', documentXml);

  onProgress(85);

  // Generate the DOCX blob
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  onProgress(100);
  return blob;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
