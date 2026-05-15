import { PDFDocument } from 'pdf-lib';

/**
 * Convert Image (JPG, PNG) to PDF format
 * 
 * Strategy: Load image data, embed into a PDF page
 * that matches the image dimensions (scaled to fit A4 max).
 * For formats not natively supported by pdf-lib (webp, gif),
 * convert via Canvas first.
 */
export async function convertImageToPdf(
  file: File,
  onProgress: (progress: number) => void
): Promise<Blob> {
  onProgress(10);

  const pdfDoc = await PDFDocument.create();
  onProgress(20);

  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  let image;

  if (fileType === 'image/png' || fileName.endsWith('.png')) {
    const arrayBuffer = await file.arrayBuffer();
    image = await pdfDoc.embedPng(new Uint8Array(arrayBuffer));
    onProgress(60);
  } else if (
    fileType === 'image/jpeg' ||
    fileType === 'image/jpg' ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg')
  ) {
    const arrayBuffer = await file.arrayBuffer();
    image = await pdfDoc.embedJpg(new Uint8Array(arrayBuffer));
    onProgress(60);
  } else {
    // For other formats (webp, gif), convert to PNG via canvas
    onProgress(30);
    image = await embedViaCanvas(pdfDoc, file);
    onProgress(60);
  }

  // Calculate page size to fit the image within A4
  const maxWidth = 595.28;
  const maxHeight = 841.89;

  let { width, height } = image.scale(1);

  if (width > maxWidth || height > maxHeight) {
    const scaleX = maxWidth / width;
    const scaleY = maxHeight / height;
    const scale = Math.min(scaleX, scaleY);
    width *= scale;
    height *= scale;
  }

  const page = pdfDoc.addPage([width, height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width,
    height,
  });

  onProgress(85);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });

  onProgress(100);
  return blob;
}

/**
 * Convert image to PNG via canvas for formats not natively
 * supported by pdf-lib (webp, gif, etc.)
 */
async function embedViaCanvas(pdfDoc: PDFDocument, file: File) {
  return new Promise<Awaited<ReturnType<typeof pdfDoc.embedPng>>>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(async (blob) => {
          try {
            if (!blob) {
              reject(new Error('Failed to convert image'));
              return;
            }
            const arrBuf = await blob.arrayBuffer();
            const embedded = await pdfDoc.embedPng(new Uint8Array(arrBuf));
            URL.revokeObjectURL(url);
            resolve(embedded);
          } catch (err) {
            URL.revokeObjectURL(url);
            reject(err);
          }
        }, 'image/png');
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
