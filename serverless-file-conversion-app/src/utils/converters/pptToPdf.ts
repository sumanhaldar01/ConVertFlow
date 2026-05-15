import JSZip from 'jszip';
import { renderHtmlToPdfBlob } from './htmlToPdfRenderer';

/**
 * Convert PowerPoint (PPTX) to PDF format
 *
 * Strategy:
 *   1. PPTX is a ZIP of XML files. We parse the XML to extract:
 *      - Text content from each slide (paragraphs in <a:p>, runs in <a:r>)
 *      - Basic formatting: bold, italic, font size, color, alignment
 *      - Bullet/numbered lists
 *      - Images (embedded in the PPTX)
 *      - Slide layout/master text as fallback
 *   2. Render each slide as a styled HTML "card" with proper CSS.
 *   3. Convert to PDF via html2canvas → jsPDF.
 */
export async function convertPptToPdf(
  file: File,
  onProgress: (progress: number) => void,
): Promise<Blob> {
  onProgress(5);

  const arrayBuffer = await file.arrayBuffer();
  onProgress(10);

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch {
    throw new Error(
      'Could not parse the PowerPoint file. It may be corrupted or in ' +
      'the legacy .ppt format. Please save as .pptx and try again.',
    );
  }
  onProgress(20);

  // ---- Find all slide XML files ----
  const slideFiles: string[] = [];
  zip.forEach((path) => {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) {
      slideFiles.push(path);
    }
  });
  slideFiles.sort((a, b) => {
    const na = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
    const nb = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
    return na - nb;
  });

  if (slideFiles.length === 0) {
    throw new Error(
      'No slides found. The file may be empty or in legacy .ppt format.',
    );
  }

  // ---- Extract images into a map (rId → dataURL) ----
  const imageMap = new Map<string, string>();
  const mediaFiles = Object.keys(zip.files).filter((p) => p.startsWith('ppt/media/'));
  for (const mf of mediaFiles) {
    try {
      const data = await zip.file(mf)!.async('base64');
      const ext = mf.split('.').pop()?.toLowerCase() || 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                   ext === 'gif' ? 'image/gif' :
                   ext === 'svg' ? 'image/svg+xml' : 'image/png';
      imageMap.set(mf.split('/').pop()!, `data:${mime};base64,${data}`);
    } catch { /* skip unreadable media */ }
  }

  onProgress(30);

  // ---- Parse each slide ----
  const slideHtmlParts: string[] = [];

  for (let si = 0; si < slideFiles.length; si++) {
    const slideXml = await zip.file(slideFiles[si])?.async('text');
    if (!slideXml) continue;

    // Load corresponding relationship file for image references
    const relsPath = slideFiles[si].replace('slides/', 'slides/_rels/') + '.rels';
    const relsXml = await zip.file(relsPath)?.async('text').catch(() => '');
    const rIdToMedia = parseRels(relsXml || '');

    // Parse the slide XML into structured content
    const content = parseSlideXml(slideXml, rIdToMedia, imageMap);
    const slideNum = si + 1;

    slideHtmlParts.push(`
      <div class="slide">
        <div class="slide-number">${slideNum} / ${slideFiles.length}</div>
        <div class="slide-content">
          ${content || `<p class="empty-slide">Slide ${slideNum}</p>`}
        </div>
      </div>
    `);

    onProgress(30 + ((si + 1) / slideFiles.length) * 25);
  }

  onProgress(55);

  // ---- Build full HTML ----
  const fullHtml = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }

      .slide {
        width: 960px;
        min-height: 540px;
        background: #ffffff;
        border: 1px solid #e0e0e8;
        border-radius: 8px;
        padding: 48px 56px;
        margin-bottom: 24px;
        position: relative;
        page-break-after: always;
        box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      }

      .slide-number {
        position: absolute;
        bottom: 16px;
        right: 24px;
        font-size: 12px;
        color: #999;
      }

      .slide-content h1, .slide-content .title {
        font-size: 30px;
        font-weight: 700;
        color: #1a1a3e;
        margin-bottom: 12px;
        line-height: 1.3;
      }
      .slide-content h2, .slide-content .subtitle {
        font-size: 22px;
        font-weight: 600;
        color: #2a2a5e;
        margin-bottom: 10px;
        line-height: 1.35;
      }

      .slide-content p {
        font-size: 16px;
        color: #2c2c2c;
        margin-bottom: 8px;
        line-height: 1.65;
        font-family: 'Segoe UI', Arial, sans-serif;
      }

      .slide-content ul, .slide-content ol {
        margin: 8px 0 12px 32px;
        font-size: 16px;
        color: #2c2c2c;
      }
      .slide-content li {
        margin-bottom: 6px;
        line-height: 1.55;
      }

      .slide-content img {
        max-width: 80%;
        max-height: 320px;
        margin: 12px auto;
        display: block;
      }

      .empty-slide {
        color: #aaa;
        font-size: 18px;
        text-align: center;
        padding-top: 200px;
      }

      .slide-divider {
        width: 100%;
        height: 3px;
        background: linear-gradient(90deg, #8b5cf6, #06b6d4);
        margin: 12px 0 16px 0;
        border-radius: 2px;
      }

      .bold { font-weight: 700; }
      .italic { font-style: italic; }
      .underline { text-decoration: underline; }
    </style>
    ${slideHtmlParts.join('\n')}
  `;

  // ---- Render to PDF (landscape) ----
  const blob = await renderHtmlToPdfBlob(fullHtml, {
    containerWidth: 1060,
    scale: 2,
    landscape: true,
    onProgress: (pct) => onProgress(55 + pct * 0.45),
  });

  return blob;
}

/* ===== XML Parsing Helpers ===== */

/**
 * Parse a .rels XML to build rId → media filename mapping
 */
function parseRels(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const regex = /Relationship\s+Id="(rId\d+)"[^>]*Target="([^"]*)"/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const target = match[2];
    if (target.includes('media/')) {
      map.set(match[1], target.split('/').pop()!);
    }
  }
  return map;
}

/**
 * Parse slide XML into HTML string.
 * Extracts text runs with formatting, paragraphs, bullets, and images.
 */
function parseSlideXml(
  xml: string,
  rIdToMedia: Map<string, string>,
  imageMap: Map<string, string>,
): string {
  const parts: string[] = [];

  // Find all shape trees - text can be in <p:sp>, <p:graphicFrame>, etc.
  // We look for all <p:txBody> (text body) elements which contain paragraphs

  const textBodies = xml.split(/<p:txBody>|<p:txBody\s[^>]*>/);

  let isFirstTextBody = true;

  for (let tbi = 1; tbi < textBodies.length; tbi++) {
    const tbContent = textBodies[tbi].split('</p:txBody>')[0];
    if (!tbContent) continue;

    const paragraphs = extractParagraphs(tbContent);
    if (paragraphs.length === 0) continue;

    // First text body with content is usually the title
    if (isFirstTextBody && paragraphs.length > 0) {
      const titleHtml = paragraphs[0];
      parts.push(`<h1>${titleHtml}</h1>`);
      parts.push('<div class="slide-divider"></div>');

      // Remaining paragraphs in first textBody go as subtitle
      for (let pi = 1; pi < paragraphs.length; pi++) {
        if (paragraphs[pi].trim()) {
          parts.push(`<h2>${paragraphs[pi]}</h2>`);
        }
      }
      isFirstTextBody = false;
    } else {
      // Subsequent text bodies are content
      // Check if it looks like a bullet list
      const isList = paragraphs.length > 1 &&
        paragraphs.filter((p) => p.trim()).length > 1;

      if (isList) {
        parts.push('<ul>');
        for (const para of paragraphs) {
          if (para.trim()) parts.push(`<li>${para}</li>`);
        }
        parts.push('</ul>');
      } else {
        for (const para of paragraphs) {
          if (para.trim()) parts.push(`<p>${para}</p>`);
        }
      }
    }
  }

  // ---- Extract images (blipFill references) ----
  const blipMatches = xml.matchAll(/<a:blip\s+r:embed="(rId\d+)"/g);
  for (const m of blipMatches) {
    const rId = m[1];
    const mediaFile = rIdToMedia.get(rId);
    if (mediaFile && imageMap.has(mediaFile)) {
      parts.push(`<img src="${imageMap.get(mediaFile)}" alt="slide image" />`);
    }
  }

  return parts.join('\n');
}

/**
 * Extract paragraphs from a <p:txBody> content block.
 * Each <a:p> is a paragraph containing <a:r> text runs.
 */
function extractParagraphs(tbContent: string): string[] {
  const paragraphs: string[] = [];

  // Split by <a:p> elements
  const pParts = tbContent.split(/<a:p>|<a:p\s[^>]*>/);

  for (let i = 1; i < pParts.length; i++) {
    const pContent = pParts[i].split('</a:p>')[0];
    if (!pContent) continue;

    // Extract each <a:r> run within this paragraph
    const runs = pContent.split(/<a:r>|<a:r\s[^>]*>/);
    const runTexts: string[] = [];

    for (let ri = 1; ri < runs.length; ri++) {
      const runContent = runs[ri].split('</a:r>')[0];
      if (!runContent) continue;

      // Get run properties for formatting
      const isBold = /<a:rPr[^>]*\bb="1"/.test(runContent);
      const isItalic = /<a:rPr[^>]*\bi="1"/.test(runContent);
      const isUnderline = /<a:rPr[^>]*\bu="sng"/.test(runContent);

      // Extract text
      const textMatch = runContent.match(/<a:t>([\s\S]*?)<\/a:t>/);
      if (!textMatch) continue;

      let text = decodeXmlEntities(textMatch[1]);
      if (!text) continue;

      text = escapeHtml(text);

      // Apply formatting
      if (isBold) text = `<strong>${text}</strong>`;
      if (isItalic) text = `<em>${text}</em>`;
      if (isUnderline) text = `<u>${text}</u>`;

      runTexts.push(text);
    }

    // Also check for <a:fld> (field) text like slide numbers
    const fieldMatches = pContent.matchAll(/<a:fld[^>]*>[\s\S]*?<a:t>([\s\S]*?)<\/a:t>[\s\S]*?<\/a:fld>/g);
    for (const fm of fieldMatches) {
      const fieldText = decodeXmlEntities(fm[1]).trim();
      if (fieldText) runTexts.push(escapeHtml(fieldText));
    }

    paragraphs.push(runTexts.join(''));
  }

  return paragraphs;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
