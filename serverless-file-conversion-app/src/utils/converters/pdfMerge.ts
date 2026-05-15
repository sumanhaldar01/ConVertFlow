import { PDFDocument } from 'pdf-lib';

/**
 * Merge multiple PDF files into one
 * 
 * Strategy: Load each PDF with pdf-lib, copy all pages
 * into a new merged document.
 * 
 * Key fix: Uses file.arrayBuffer() directly (modern API)
 * instead of FileReader, and passes Uint8Array to pdf-lib
 * for reliable byte handling. Also tolerates encrypted /
 * slightly malformed PDFs where possible.
 */
export async function mergePdfs(
  files: File[],
  onProgress: (progress: number) => void
): Promise<Blob> {
  if (files.length < 2) {
    throw new Error('Please select at least 2 PDF files to merge.');
  }

  onProgress(5);

  const mergedPdf = await PDFDocument.create();
  const totalFiles = files.length;
  const errors: string[] = [];

  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];

    try {
      // Use the modern File.arrayBuffer() API for clean byte access
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Quick sanity check: PDF files must start with %PDF
      if (uint8Array.length < 5) {
        errors.push(`"${file.name}" is too small to be a valid PDF.`);
        continue;
      }

      const header = String.fromCharCode(uint8Array[0], uint8Array[1], uint8Array[2], uint8Array[3]);
      if (header !== '%PDF') {
        errors.push(
          `"${file.name}" does not appear to be a valid PDF file (missing %PDF header).`
        );
        continue;
      }

      // Load with ignoreEncryption to handle more PDFs gracefully
      const pdfDoc = await PDFDocument.load(uint8Array, {
        ignoreEncryption: true,
      });

      const pageIndices = pdfDoc.getPageIndices();
      if (pageIndices.length === 0) {
        errors.push(`"${file.name}" contains no pages.`);
        continue;
      }

      const pages = await mergedPdf.copyPages(pdfDoc, pageIndices);
      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to process "${file.name}": ${msg}`);
    }

    onProgress(5 + ((i + 1) / totalFiles) * 85);
  }

  // If no pages were added at all, throw with details
  if (mergedPdf.getPageCount() === 0) {
    throw new Error(
      'Could not merge any pages.\n\n' +
      errors.join('\n')
    );
  }

  onProgress(92);

  const pdfBytes = await mergedPdf.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });

  onProgress(100);

  // If some files failed but we still produced output, log warnings
  if (errors.length > 0) {
    console.warn('PDF merge completed with warnings:', errors);
  }

  return blob;
}
