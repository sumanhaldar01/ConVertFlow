import JSZip from 'jszip';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { sanitizeForPdf } from '@/utils/sanitizeText';

/**
 * Convert PowerPoint (PPTX) to PDF format
 * 
 * Strategy: PPTX files are ZIP archives containing XML.
 * We parse the XML to extract slide text content,
 * then render each slide as a page in PDF.
 * All text is sanitized for WinAnsi encoding compatibility.
 */
export async function convertPptToPdf(
  file: File,
  onProgress: (progress: number) => void
): Promise<Blob> {
  onProgress(10);

  const arrayBuffer = await file.arrayBuffer();
  onProgress(20);

  // PPTX is a ZIP file - extract it
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch {
    throw new Error(
      'Could not parse the PowerPoint file. It may be corrupted or in the older .ppt format. ' +
      'Please save it as .pptx and try again.'
    );
  }
  onProgress(30);

  // Find all slide XML files
  const slideFiles: string[] = [];
  zip.forEach((relativePath) => {
    if (relativePath.match(/^ppt\/slides\/slide\d+\.xml$/)) {
      slideFiles.push(relativePath);
    }
  });

  // Sort slides by number
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
    return numA - numB;
  });

  if (slideFiles.length === 0) {
    throw new Error(
      'No slides found in the PowerPoint file. ' +
      'The file may be empty, corrupted, or in the legacy .ppt format.'
    );
  }

  onProgress(40);

  // Extract text from each slide
  const slideContents: { texts: string[] }[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const slideXml = await zip.file(slideFiles[i])?.async('text');
    if (!slideXml) continue;

    const texts = extractTextsFromXml(slideXml);
    slideContents.push({ texts });
    onProgress(40 + (i / slideFiles.length) * 30);
  }

  onProgress(70);

  // Create PDF document with slide-like pages (16:9 aspect ratio)
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const slideWidth = 960;
  const slideHeight = 540;
  const margin = 50;
  const titleFontSize = 24;
  const bodyFontSize = 14;
  const lineHeight = bodyFontSize * 1.6;

  for (let i = 0; i < slideContents.length; i++) {
    const slide = slideContents[i];
    const page = pdfDoc.addPage([slideWidth, slideHeight]);

    // Draw slide background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: slideWidth,
      height: slideHeight,
      color: rgb(1, 1, 1),
    });

    // Draw subtle border
    page.drawRectangle({
      x: 2,
      y: 2,
      width: slideWidth - 4,
      height: slideHeight - 4,
      borderColor: rgb(0.85, 0.85, 0.9),
      borderWidth: 1,
      color: rgb(0.99, 0.99, 1),
    });

    // Draw slide number
    const slideNum = `${i + 1} / ${slideContents.length}`;
    page.drawText(slideNum, {
      x: slideWidth - margin - 40,
      y: 20,
      size: 10,
      font: font,
      color: rgb(0.6, 0.6, 0.65),
    });

    // Draw title (first text element)
    let currentY = slideHeight - margin - titleFontSize;

    if (slide.texts.length > 0) {
      // Sanitize title for WinAnsi
      const titleText = sanitizeForPdf(slide.texts[0]);
      const truncTitle = truncateText(titleText, boldFont, titleFontSize, slideWidth - margin * 2);

      if (truncTitle) {
        page.drawText(truncTitle, {
          x: margin,
          y: currentY,
          size: titleFontSize,
          font: boldFont,
          color: rgb(0.1, 0.1, 0.2),
        });
      }
      currentY -= titleFontSize + 20;

      // Draw separator line
      page.drawLine({
        start: { x: margin, y: currentY + 8 },
        end: { x: slideWidth - margin, y: currentY + 8 },
        thickness: 1.5,
        color: rgb(0.55, 0.36, 0.96), // Purple accent
      });
      currentY -= 15;
    }

    // Draw body text
    for (let ti = 1; ti < slide.texts.length; ti++) {
      if (currentY < margin + 30) break;

      // Sanitize body text for WinAnsi
      const rawText = slide.texts[ti];
      const text = sanitizeForPdf(rawText);
      if (!text || !text.trim()) continue;

      // Word wrap
      const words = text.split(' ');
      let line = '';
      const maxWidth = slideWidth - margin * 2;

      for (const word of words) {
        if (!word) continue;
        const testLine = line ? `${line} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, bodyFontSize);

        if (testWidth > maxWidth && line) {
          if (currentY < margin + 30) break;
          page.drawText(line, {
            x: margin + 10,
            y: currentY,
            size: bodyFontSize,
            font: font,
            color: rgb(0.25, 0.25, 0.3),
          });
          currentY -= lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      }

      if (line && currentY >= margin + 30) {
        page.drawText(line, {
          x: margin + 10,
          y: currentY,
          size: bodyFontSize,
          font: font,
          color: rgb(0.25, 0.25, 0.3),
        });
        currentY -= lineHeight + 4;
      }
    }

    onProgress(70 + (i / slideContents.length) * 25);
  }

  onProgress(95);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });

  onProgress(100);
  return blob;
}

/**
 * Extract text content from PPTX slide XML.
 * Parses <a:p> paragraphs and <a:t> text runs.
 */
function extractTextsFromXml(xml: string): string[] {
  const texts: string[] = [];

  // Split by <a:p> paragraph elements
  const paragraphs = xml.split(/<a:p[\s>]/);

  for (const para of paragraphs) {
    const textMatches = para.match(/<a:t>([\s\S]*?)<\/a:t>/g);
    if (textMatches) {
      const paraText = textMatches
        .map((match) => match.replace(/<\/?a:t>/g, ''))
        .join('')
        .trim();
      if (paraText) {
        texts.push(decodeXmlEntities(paraText));
      }
    }
  }

  return texts;
}

/**
 * Decode standard XML entities
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Truncate text to fit within a given width
 */
function truncateText(
  text: string,
  pdfFont: { widthOfTextAtSize: (text: string, size: number) => number },
  fontSize: number,
  maxWidth: number
): string {
  if (!text) return text;
  if (pdfFont.widthOfTextAtSize(text, fontSize) <= maxWidth) return text;

  let truncated = text;
  while (truncated.length > 0 && pdfFont.widthOfTextAtSize(truncated + '...', fontSize) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}
