/** Supported conversion types */
export type ConversionType =
  | 'pdf-to-word'
  | 'word-to-pdf'
  | 'excel-to-pdf'
  | 'ppt-to-pdf'
  | 'image-to-pdf'
  | 'pdf-merge';

/** Conversion status */
export type ConversionStatus =
  | 'idle'
  | 'uploading'
  | 'validating'
  | 'converting'
  | 'completed'
  | 'error';

/** File conversion job */
export interface ConversionJob {
  id: string;
  file: File;
  type: ConversionType;
  status: ConversionStatus;
  progress: number;
  error?: string;
  result?: Blob;
  resultFileName?: string;
}

/** Conversion option card */
export interface ConversionOption {
  id: ConversionType;
  title: string;
  description: string;
  fromFormat: string;
  toFormat: string;
  acceptedTypes: string[];
  icon: string;
  color: string;
  bgColor: string;
}

/** Max file size in bytes (10MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Conversion options configuration */
export const CONVERSION_OPTIONS: ConversionOption[] = [
  {
    id: 'pdf-to-word',
    title: 'PDF to Word',
    description: 'Convert PDF documents to editable Word files',
    fromFormat: 'PDF',
    toFormat: 'DOCX',
    acceptedTypes: ['.pdf', 'application/pdf'],
    icon: '📄',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
  {
    id: 'word-to-pdf',
    title: 'Word to PDF',
    description: 'Convert Word documents to PDF format',
    fromFormat: 'DOCX',
    toFormat: 'PDF',
    acceptedTypes: ['.docx', '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    icon: '📝',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  {
    id: 'excel-to-pdf',
    title: 'Excel to PDF',
    description: 'Convert Excel spreadsheets to PDF format',
    fromFormat: 'XLSX',
    toFormat: 'PDF',
    acceptedTypes: ['.xlsx', '.xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    icon: '📊',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
  },
  {
    id: 'ppt-to-pdf',
    title: 'PowerPoint to PDF',
    description: 'Convert presentations to PDF format',
    fromFormat: 'PPTX',
    toFormat: 'PDF',
    acceptedTypes: ['.pptx', '.ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    icon: '📽️',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
  },
  {
    id: 'image-to-pdf',
    title: 'Image to PDF',
    description: 'Convert images to PDF format',
    fromFormat: 'IMG',
    toFormat: 'PDF',
    acceptedTypes: ['.jpg', '.jpeg', '.png', '.webp', '.gif', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    icon: '🖼️',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
  },
  {
    id: 'pdf-merge',
    title: 'Merge PDFs',
    description: 'Combine multiple PDF files into one',
    fromFormat: 'PDFs',
    toFormat: 'PDF',
    acceptedTypes: ['.pdf', 'application/pdf'],
    icon: '📑',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
  },
];
