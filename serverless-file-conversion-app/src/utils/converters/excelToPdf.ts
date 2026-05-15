import ExcelJS from 'exceljs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { sanitizeForPdf } from '@/utils/sanitizeText';

/**
 * Convert Excel (XLSX) to PDF format
 * 
 * Strategy: Parse XLSX with ExcelJS, then render each worksheet
 * as a table in PDF using pdf-lib. All text is sanitized for
 * WinAnsi encoding compatibility.
 */
export async function convertExcelToPdf(
  file: File,
  onProgress: (progress: number) => void
): Promise<Blob> {
  onProgress(10);

  const arrayBuffer = await file.arrayBuffer();
  onProgress(20);

  // Load the workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  onProgress(35);

  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 9;
  const headerFontSize = 11;
  const sheetTitleSize = 14;
  const cellPadding = 4;
  const rowHeight = fontSize + cellPadding * 2 + 2;
  const margin = 40;
  const pageWidth = 841.89; // A4 landscape width
  const pageHeight = 595.28; // A4 landscape height

  const worksheets = workbook.worksheets;
  const totalSheets = worksheets.length;

  if (totalSheets === 0) {
    throw new Error('The Excel file contains no worksheets.');
  }

  onProgress(40);

  for (let si = 0; si < totalSheets; si++) {
    const worksheet = worksheets[si];

    // Collect all row data
    const rows: string[][] = [];
    let maxCols = 0;

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const rowData: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const value = cell.value;
        let displayValue = '';
        if (value === null || value === undefined) {
          displayValue = '';
        } else if (typeof value === 'object' && 'result' in value) {
          displayValue = String(value.result ?? '');
        } else if (typeof value === 'object' && 'text' in value) {
          displayValue = String(value.text ?? '');
        } else if (value instanceof Date) {
          displayValue = value.toLocaleDateString();
        } else {
          displayValue = String(value);
        }
        // Sanitize for WinAnsi
        displayValue = sanitizeForPdf(displayValue);
        // Pad array to fill gaps
        while (rowData.length < colNumber - 1) rowData.push('');
        rowData.push(displayValue);
      });
      maxCols = Math.max(maxCols, rowData.length);
      rows.push(rowData);
    });

    if (rows.length === 0) continue;

    // Ensure all rows have same number of columns
    for (const row of rows) {
      while (row.length < maxCols) row.push('');
    }

    // Calculate column widths (distribute evenly with max constraint)
    const availableWidth = pageWidth - margin * 2;
    const colWidth = Math.min(availableWidth / maxCols, 150);
    const tableWidth = colWidth * maxCols;

    // Render rows onto pages
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;

    // Sheet title (sanitized)
    const sheetTitle = sanitizeForPdf(`Sheet: ${worksheet.name}`);
    page.drawText(sheetTitle, {
      x: margin,
      y: currentY,
      size: sheetTitleSize,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.3),
    });
    currentY -= sheetTitleSize + 12;

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const isHeader = ri === 0;
      const currentFont = isHeader ? boldFont : font;
      const currentFontSize = isHeader ? headerFontSize : fontSize;

      // Check if we need a new page
      if (currentY - rowHeight < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = pageHeight - margin;
      }

      // Draw row background for header
      if (isHeader) {
        page.drawRectangle({
          x: margin,
          y: currentY - rowHeight + cellPadding,
          width: Math.min(tableWidth, availableWidth),
          height: rowHeight,
          color: rgb(0.15, 0.15, 0.25),
        });
      } else if (ri % 2 === 0) {
        page.drawRectangle({
          x: margin,
          y: currentY - rowHeight + cellPadding,
          width: Math.min(tableWidth, availableWidth),
          height: rowHeight,
          color: rgb(0.95, 0.95, 0.97),
        });
      }

      // Draw cells
      const maxVisibleCols = Math.floor(availableWidth / colWidth);
      for (let ci = 0; ci < row.length && ci < maxVisibleCols; ci++) {
        let cellText = row[ci];
        // Truncate long text
        const maxChars = Math.floor(colWidth / (currentFontSize * 0.5));
        if (cellText.length > maxChars) {
          cellText = cellText.substring(0, maxChars - 2) + '..';
        }

        const textColor = isHeader ? rgb(1, 1, 1) : rgb(0.2, 0.2, 0.2);

        if (cellText) {
          page.drawText(cellText, {
            x: margin + ci * colWidth + cellPadding,
            y: currentY - cellPadding,
            size: currentFontSize,
            font: currentFont,
            color: textColor,
          });
        }

        // Draw cell border (vertical line)
        page.drawLine({
          start: { x: margin + ci * colWidth, y: currentY + cellPadding },
          end: { x: margin + ci * colWidth, y: currentY - rowHeight + cellPadding },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
      }

      // Draw horizontal line
      page.drawLine({
        start: { x: margin, y: currentY - rowHeight + cellPadding },
        end: { x: margin + Math.min(tableWidth, availableWidth), y: currentY - rowHeight + cellPadding },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });

      currentY -= rowHeight;

      // Update progress
      const sheetProgress = (si / totalSheets) * 55;
      const rowProgress = ((ri / rows.length) * 55) / totalSheets;
      onProgress(40 + sheetProgress + rowProgress);
    }
  }

  // If no data was rendered, add an info page
  if (pdfDoc.getPageCount() === 0) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawText('No data found in the Excel file.', {
      x: margin,
      y: pageHeight / 2,
      size: 14,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  onProgress(95);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });

  onProgress(100);
  return blob;
}
