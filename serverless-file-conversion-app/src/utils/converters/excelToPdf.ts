import ExcelJS from 'exceljs';
import { renderHtmlToPdfBlob } from './htmlToPdfRenderer';

/**
 * Convert Excel (XLSX) to PDF format
 *
 * Strategy:
 *   1. Parse the workbook with ExcelJS.
 *   2. Build a rich HTML table for each worksheet, preserving:
 *      - Cell values (text, numbers, dates, formulas, hyperlinks)
 *      - Basic cell styling (bold, italic, font color, background color, alignment)
 *      - Column widths
 *      - Merged cells
 *   3. Render the HTML to PDF via html2canvas → jsPDF (landscape A4).
 */
export async function convertExcelToPdf(
  file: File,
  onProgress: (progress: number) => void,
): Promise<Blob> {
  onProgress(5);

  const arrayBuffer = await file.arrayBuffer();
  onProgress(10);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  onProgress(25);

  const sheets = workbook.worksheets;
  if (sheets.length === 0) {
    throw new Error('The Excel file contains no worksheets.');
  }

  // ---- Build HTML for each sheet ----
  const sheetHtmlParts: string[] = [];

  for (let si = 0; si < sheets.length; si++) {
    const ws = sheets[si];

    // Gather merged-cell ranges for colspan/rowspan handling
    const mergedMap = new Map<string, { startRow: number; startCol: number; rows: number; cols: number }>();
    const skipCells = new Set<string>();

    // ExcelJS stores merges as "A1:C3" style strings
    for (const mergeRange of (ws as unknown as { _merges: Record<string, { model: { top: number; left: number; bottom: number; right: number } }> })._merges
      ? Object.values((ws as unknown as { _merges: Record<string, { model: { top: number; left: number; bottom: number; right: number } }> })._merges)
      : []) {
      const m = mergeRange.model;
      const rows = m.bottom - m.top + 1;
      const cols = m.right - m.left + 1;
      mergedMap.set(`${m.top}-${m.left}`, { startRow: m.top, startCol: m.left, rows, cols });
      for (let r = m.top; r <= m.bottom; r++) {
        for (let c = m.left; c <= m.right; c++) {
          if (r !== m.top || c !== m.left) {
            skipCells.add(`${r}-${c}`);
          }
        }
      }
    }

    // Determine actual used range
    let maxCol = 0;
    let maxRow = 0;
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      maxRow = Math.max(maxRow, rowNumber);
      row.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
        maxCol = Math.max(maxCol, colNumber);
      });
    });

    if (maxRow === 0) continue; // empty sheet

    // Build table rows
    const tableRows: string[] = [];

    for (let r = 1; r <= maxRow; r++) {
      const row = ws.getRow(r);
      const cells: string[] = [];

      for (let c = 1; c <= maxCol; c++) {
        const key = `${r}-${c}`;
        if (skipCells.has(key)) continue;

        const cell = row.getCell(c);
        const value = getCellDisplayValue(cell);

        // Styling
        const styles: string[] = [];
        const font = cell.font;
        if (font?.bold) styles.push('font-weight:700');
        if (font?.italic) styles.push('font-style:italic');
        if (font?.underline) styles.push('text-decoration:underline');
        if (font?.color?.argb) {
          const hex = argbToHex(font.color.argb);
          if (hex !== '#000000') styles.push(`color:${hex}`);
        }
        if (font?.size) styles.push(`font-size:${Math.max(11, Math.min(font.size, 18))}px`);

        const fill = cell.fill;
        if (fill && fill.type === 'pattern' && fill.fgColor?.argb) {
          const bg = argbToHex(fill.fgColor.argb);
          if (bg !== '#000000' && bg !== '#ffffff') styles.push(`background:${bg}`);
        }

        const align = cell.alignment;
        if (align?.horizontal) styles.push(`text-align:${align.horizontal}`);
        if (align?.vertical) styles.push(`vertical-align:${align.vertical === 'middle' ? 'middle' : align.vertical === 'top' ? 'top' : 'bottom'}`);

        // Merge attributes
        const merge = mergedMap.get(key);
        let attrs = '';
        if (merge) {
          if (merge.cols > 1) attrs += ` colspan="${merge.cols}"`;
          if (merge.rows > 1) attrs += ` rowspan="${merge.rows}"`;
        }

        const tag = r === 1 ? 'th' : 'td';
        cells.push(`<${tag}${attrs} style="${styles.join(';')}">${escapeHtml(value)}</${tag}>`);
      }

      tableRows.push(`<tr>${cells.join('')}</tr>`);
    }

    sheetHtmlParts.push(`
      <div style="margin-bottom:32px;">
        <h2 style="font-size:18px;color:#1a1a3e;margin-bottom:10px;padding-bottom:4px;border-bottom:2px solid #8b5cf6;">
          📊 ${escapeHtml(ws.name)}
        </h2>
        <table>${tableRows.join('\n')}</table>
      </div>
    `);

    onProgress(25 + ((si + 1) / sheets.length) * 25);
  }

  if (sheetHtmlParts.length === 0) {
    throw new Error('No data found in any worksheet.');
  }

  onProgress(50);

  // ---- Wrap in styled template ----
  const fullHtml = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 13px;
        color: #1a1a2e;
        line-height: 1.5;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        table-layout: auto;
      }
      th, td {
        border: 1px solid #c0c0c8;
        padding: 6px 10px;
        text-align: left;
        vertical-align: middle;
        word-break: break-word;
        max-width: 250px;
      }
      th {
        background: #2d2b55;
        color: #fff;
        font-weight: 600;
        font-size: 12px;
      }
      tr:nth-child(even) td { background: #f5f5fa; }
      tr:hover td { background: #eeeef6; }

      h2 { font-size: 18px; }
    </style>
    ${sheetHtmlParts.join('\n')}
  `;

  // Render landscape since spreadsheets are wide
  const blob = await renderHtmlToPdfBlob(fullHtml, {
    containerWidth: 1100,
    scale: 2,
    landscape: true,
    onProgress: (pct) => onProgress(50 + pct * 0.5),
  });

  return blob;
}

/* ---- Helpers ---- */

function getCellDisplayValue(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';

  // Formula result
  if (typeof v === 'object' && 'result' in v) {
    const res = (v as { result: unknown }).result;
    if (res instanceof Date) return res.toLocaleDateString();
    return String(res ?? '');
  }
  // Rich text
  if (typeof v === 'object' && 'richText' in v) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
  }
  // Hyperlink
  if (typeof v === 'object' && 'text' in v) {
    return String((v as { text: string }).text);
  }
  // Date
  if (v instanceof Date) return v.toLocaleDateString();
  // Boolean
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';

  return String(v);
}

function argbToHex(argb: string): string {
  // ExcelJS stores colors as ARGB (e.g. "FF2A2A4E")
  if (!argb || argb.length < 6) return '#000000';
  const hex = argb.length === 8 ? argb.substring(2) : argb;
  return `#${hex}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
