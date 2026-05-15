import mammoth from 'mammoth';
import { renderHtmlToPdfBlob } from './htmlToPdfRenderer';

/**
 * Convert Word (DOCX) to PDF format
 *
 * Strategy:
 *   1. mammoth.convertToHtml() → rich HTML with headings, lists,
 *      tables, bold, italic, images, links, etc.
 *   2. Wrap the HTML in a styled template with proper CSS.
 *   3. Render via html2canvas → jsPDF (multi-page, pixel-perfect).
 */
export async function convertWordToPdf(
  file: File,
  onProgress: (progress: number) => void,
): Promise<Blob> {
  onProgress(5);

  const arrayBuffer = await file.arrayBuffer();
  onProgress(10);

  // ---- 1. Convert DOCX → HTML with full formatting ----
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      // Make sure images are embedded inline as base64
      convertImage: mammoth.images.imgElement(function (image) {
        return image.read('base64').then(function (imageBuffer) {
          return { src: `data:${image.contentType};base64,${imageBuffer}` };
        });
      }),
    },
  );

  const rawHtml = result.value;
  onProgress(30);

  if (!rawHtml || rawHtml.trim().length === 0 || rawHtml.trim() === '<p></p>') {
    throw new Error(
      'Could not extract any content from this Word document. ' +
      'The file may be image-only, password-protected, or corrupted.',
    );
  }

  // Log any mammoth warnings for debugging
  if (result.messages.length > 0) {
    console.warn('Mammoth warnings:', result.messages);
  }

  // ---- 2. Wrap in a beautiful styled template ----
  const styledHtml = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }

      body, html {
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.7;
        color: #1a1a2e;
      }

      h1 { font-size: 26px; font-weight: 700; color: #0f0f23; margin: 24px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #e0e0e0; }
      h2 { font-size: 21px; font-weight: 700; color: #1a1a3e; margin: 20px 0 10px 0; }
      h3 { font-size: 18px; font-weight: 600; color: #2a2a4e; margin: 16px 0 8px 0; }
      h4 { font-size: 16px; font-weight: 600; color: #333; margin: 14px 0 6px 0; }
      h5, h6 { font-size: 14px; font-weight: 600; color: #444; margin: 12px 0 4px 0; }

      p { margin: 0 0 10px 0; text-align: justify; }

      strong, b { font-weight: 700; }
      em, i { font-style: italic; }
      u { text-decoration: underline; }
      s, strike { text-decoration: line-through; }

      ul, ol { margin: 8px 0 12px 28px; padding: 0; }
      li { margin-bottom: 4px; }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 14px 0;
        font-size: 13px;
      }
      th, td {
        border: 1px solid #ccc;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
      }
      th { background: #f0f0f5; font-weight: 600; }
      tr:nth-child(even) td { background: #fafafe; }

      a { color: #2563eb; text-decoration: underline; }

      img { max-width: 100%; height: auto; margin: 8px 0; }

      blockquote {
        border-left: 4px solid #8b5cf6;
        padding: 8px 16px;
        margin: 12px 0;
        background: #f8f7ff;
        color: #333;
        font-style: italic;
      }

      code, pre {
        font-family: 'Consolas', 'Courier New', monospace;
        background: #f4f4f8;
        border-radius: 3px;
        font-size: 13px;
      }
      code { padding: 1px 4px; }
      pre { padding: 12px; margin: 10px 0; overflow-x: auto; border: 1px solid #e0e0e0; }

      sup { font-size: 0.75em; vertical-align: super; }
      sub { font-size: 0.75em; vertical-align: sub; }
    </style>

    <div style="max-width: 714px;">
      ${rawHtml}
    </div>
  `;

  onProgress(35);

  // ---- 3. Render HTML → PDF ----
  const blob = await renderHtmlToPdfBlob(styledHtml, {
    containerWidth: 794,
    scale: 2,
    onProgress: (pct) => {
      // Map renderer's 0-100 to our 35-100 range
      onProgress(35 + pct * 0.65);
    },
  });

  return blob;
}
