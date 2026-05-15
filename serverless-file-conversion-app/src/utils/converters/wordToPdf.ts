import mammoth from 'mammoth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { sanitizeForPdf } from '@/utils/sanitizeText';

/**
 * Convert Word (DOCX) to PDF format
 * 
 * Strategy: Use mammoth.js to extract text/HTML from DOCX,
 * then render it into a PDF using pdf-lib.
 * 
 * All text is sanitized through sanitizeForPdf() to strip
 * emojis and non-WinAnsi characters that StandardFonts can't encode.
 */
export async function convertWordToPdf(
  file: File,
  onProgress: (progress: number) => void
): Promise<Blob> {
  onProgress(10);

  const arrayBuffer = await file.arrayBuffer();
  onProgress(20);

  // Extract text from DOCX using mammoth
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;
  onProgress(40);

  if (!text || text.trim().length === 0) {
    throw new Error(
      'Could not extract any text content from this Word document. ' +
      'The file may be image-based, corrupted, or in an unsupported format.'
    );
  }

  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 11;
  const titleFontSize = 16;
  const lineHeight = fontSize * 1.5;
  const margin = 56;
  const pageWidth = 595.28; // A4 width in points
  const pageHeight = 841.89; // A4 height in points
  const maxLineWidth = pageWidth - margin * 2;

  onProgress(50);

  // Sanitize the title (filename without extension)
  const titleText = sanitizeForPdf(file.name.replace(/\.[^.]+$/, ''));

  // Split text into paragraphs and build wrapped lines
  const paragraphs = text.split('\n');
  const allLines: { text: string; isTitle: boolean; isBullet: boolean }[] = [];

  // Add title
  allLines.push({ text: titleText, isTitle: true, isBullet: false });
  allLines.push({ text: '', isTitle: false, isBullet: false }); // blank line after title

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    if (trimmed === '') {
      allLines.push({ text: '', isTitle: false, isBullet: false });
      continue;
    }

    // Sanitize the paragraph text to remove unsupported Unicode chars
    const safe = sanitizeForPdf(trimmed);
    if (!safe) continue; // paragraph was entirely emojis / unsupported chars

    // Detect bullet-like lines
    const isBullet = /^[-*>+#\[]/.test(safe) || /^\d+[.)]\s/.test(safe);

    // Word-wrap the sanitized text
    const words = safe.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (!word) continue;
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxLineWidth && currentLine) {
        allLines.push({ text: currentLine, isTitle: false, isBullet });
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      allLines.push({ text: currentLine, isTitle: false, isBullet });
    }
  }

  onProgress(60);

  // Render lines onto PDF pages
  let currentY = pageHeight - margin;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  const totalLines = allLines.length;

  // Draw a thin accent line at top of first page
  page.drawLine({
    start: { x: margin, y: pageHeight - margin + 10 },
    end: { x: pageWidth - margin, y: pageHeight - margin + 10 },
    thickness: 2,
    color: rgb(0.55, 0.36, 0.96),
  });

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const chosenFont = line.isTitle ? boldFont : font;
    const chosenSize = line.isTitle ? titleFontSize : fontSize;
    const chosenLineHeight = line.isTitle ? titleFontSize * 1.8 : lineHeight;

    // Need a new page?
    if (currentY - chosenLineHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - margin;
    }

    if (line.text) {
      const xOffset = line.isBullet && !line.isTitle ? margin + 12 : margin;

      page.drawText(line.text, {
        x: xOffset,
        y: currentY,
        size: chosenSize,
        font: chosenFont,
        color: line.isTitle
          ? rgb(0.12, 0.12, 0.18)
          : rgb(0.18, 0.18, 0.22),
      });

      // Underline the title
      if (line.isTitle) {
        const titleWidth = boldFont.widthOfTextAtSize(line.text, titleFontSize);
        page.drawLine({
          start: { x: margin, y: currentY - 4 },
          end: { x: margin + titleWidth, y: currentY - 4 },
          thickness: 0.8,
          color: rgb(0.55, 0.36, 0.96),
        });
      }
    }

    currentY -= chosenLineHeight;

    // Update progress (60-95 range)
    if (i % 20 === 0 || i === totalLines - 1) {
      onProgress(60 + (i / totalLines) * 35);
    }
  }

  // Add page numbers
  const totalPages = pdfDoc.getPageCount();
  const allPages = pdfDoc.getPages();
  for (let p = 0; p < totalPages; p++) {
    const pg = allPages[p];
    const label = `Page ${p + 1} of ${totalPages}`;
    const labelWidth = font.widthOfTextAtSize(label, 8);
    pg.drawText(label, {
      x: pageWidth - margin - labelWidth,
      y: 28,
      size: 8,
      font,
      color: rgb(0.55, 0.55, 0.6),
    });
  }

  onProgress(97);

  // Serialize to bytes
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });

  onProgress(100);
  return blob;
}
