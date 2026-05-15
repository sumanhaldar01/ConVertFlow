import { MAX_FILE_SIZE, ConversionOption } from '@/types';

/**
 * Generate a unique ID for each conversion job
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Validate file size (max 10MB)
 */
export function validateFileSize(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the 10MB limit.`,
    };
  }
  if (file.size === 0) {
    return {
      valid: false,
      error: 'The file is empty (0 bytes).',
    };
  }
  return { valid: true };
}

/**
 * Validate file type against accepted types
 */
export function validateFileType(
  file: File,
  option: ConversionOption
): { valid: boolean; error?: string } {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  const isAccepted = option.acceptedTypes.some(
    (type) => fileName.endsWith(type) || fileType === type
  );

  if (!isAccepted) {
    return {
      valid: false,
      error: `Invalid file type. Expected ${option.fromFormat} file.`,
    };
  }
  return { valid: true };
}

/**
 * Read file as ArrayBuffer.
 * Prefers the modern File.arrayBuffer() API which returns
 * a clean ArrayBuffer. Falls back to FileReader for older browsers.
 */
export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  // Modern API — available in all modern browsers
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }

  // Legacy fallback
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader did not return an ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Read file as Data URL
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Get the output filename based on conversion type
 */
export function getOutputFileName(inputName: string, toFormat: string): string {
  const baseName = inputName.replace(/\.[^.]+$/, '');
  const ext = toFormat.toLowerCase();
  return `${baseName}.${ext}`;
}

/**
 * Download a blob as a file.
 * Creates a temporary download link, clicks it, then cleans up.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke the object URL after a short delay to allow download to start
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Delay utility for simulating progress
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
