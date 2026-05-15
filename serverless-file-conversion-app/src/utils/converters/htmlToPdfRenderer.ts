import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Shared utility: Render an HTML string into a multi-page PDF Blob.
 *
 * Strategy
 * --------
 * 1. Mount the HTML inside a hidden container in the real DOM
 *    (html2canvas needs a live element).
 * 2. Capture the container with html2canvas at 2x scale for clarity.
 * 3. Slice the single tall canvas into A4-sized pages and add each
 *    slice as an image to a jsPDF document.
 * 4. Clean up the container and return the Blob.
 *
 * This gives us pixel-perfect rendering of any CSS: tables, bold,
 * colors, lists, headings, etc.
 */

// A4 dimensions in mm
const A4_W = 210;
const A4_H = 297;
const MARGIN = 10; // mm on each side
// (content dimensions are calculated dynamically in the function
//  based on orientation — cW and cH)

export interface RenderOptions {
  /** Width of the rendering container in CSS px (default 794 = A4 at 96 dpi) */
  containerWidth?: number;
  /** html2canvas scale (default 2 for retina-quality output) */
  scale?: number;
  /** Whether to use landscape orientation */
  landscape?: boolean;
  /** Called with 0-100 progress */
  onProgress?: (pct: number) => void;
}

export async function renderHtmlToPdfBlob(
  html: string,
  opts: RenderOptions = {},
): Promise<Blob> {
  const {
    containerWidth = 794,
    scale = 2,
    landscape = false,
    onProgress,
  } = opts;

  const pageW = landscape ? A4_H : A4_W;
  const pageH = landscape ? A4_W : A4_H;
  const cW = pageW - MARGIN * 2;
  const cH = pageH - MARGIN * 2;

  onProgress?.(5);

  /* ---- 1. Create a hidden container ---- */
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position: fixed;
    left: -99999px;
    top: 0;
    width: ${containerWidth}px;
    background: white;
    color: #1a1a1a;
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 14px;
    line-height: 1.65;
    padding: 40px;
    box-sizing: border-box;
    z-index: -9999;
  `;
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  onProgress?.(15);

  /* ---- 2. Capture with html2canvas ---- */
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(wrapper, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
  } finally {
    document.body.removeChild(wrapper);
  }

  onProgress?.(55);

  /* ---- 3. Slice into pages ---- */
  const pdf = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // How many CSS-px of the canvas correspond to 1 mm of PDF content?
  const pxPerMm = (containerWidth * scale) / cW;
  const pageHeightPx = cH * pxPerMm; // canvas-px that fit one page

  const totalPages = Math.max(1, Math.ceil(imgHeight / pageHeightPx));

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    // Source rectangle in the original canvas
    const sy = page * pageHeightPx;
    const sh = Math.min(pageHeightPx, imgHeight - sy);

    // Create a sub-canvas for this page slice
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = imgWidth;
    pageCanvas.height = sh;
    const ctx = pageCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, imgWidth, sh);
    ctx.drawImage(canvas, 0, sy, imgWidth, sh, 0, 0, imgWidth, sh);

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);

    // Destination height in mm (proportional)
    const destH = (sh / pxPerMm);

    pdf.addImage(imgData, 'JPEG', MARGIN, MARGIN, cW, destH);

    onProgress?.(55 + ((page + 1) / totalPages) * 40);
  }

  onProgress?.(97);

  const blob = pdf.output('blob');

  onProgress?.(100);
  return blob;
}
