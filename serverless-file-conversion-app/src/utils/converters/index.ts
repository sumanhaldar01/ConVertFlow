import { ConversionType } from '@/types';
import { convertPdfToWord } from './pdfToWord';
import { convertWordToPdf } from './wordToPdf';
import { convertExcelToPdf } from './excelToPdf';
import { convertPptToPdf } from './pptToPdf';
import { convertImageToPdf } from './imageToPdf';
import { mergePdfs } from './pdfMerge';

/**
 * Main conversion dispatcher
 * Routes to the appropriate converter based on conversion type
 */
export async function convertFile(
  type: ConversionType,
  files: File[],
  onProgress: (progress: number) => void
): Promise<Blob> {
  switch (type) {
    case 'pdf-to-word':
      return convertPdfToWord(files[0], onProgress);

    case 'word-to-pdf':
      return convertWordToPdf(files[0], onProgress);

    case 'excel-to-pdf':
      return convertExcelToPdf(files[0], onProgress);

    case 'ppt-to-pdf':
      return convertPptToPdf(files[0], onProgress);

    case 'image-to-pdf':
      return convertImageToPdf(files[0], onProgress);

    case 'pdf-merge':
      return mergePdfs(files, onProgress);

    default:
      throw new Error(`Unsupported conversion type: ${type}`);
  }
}
