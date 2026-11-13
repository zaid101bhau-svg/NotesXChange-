import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PDFDocument } from 'pdf-lib';

const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
export const PRIVATE_PDF_DIR = path.join(STORAGE_ROOT, 'private_pdfs');
export const PREVIEW_PDF_DIR = path.join(STORAGE_ROOT, 'previews');
export const PUBLIC_UPLOAD_DIR = path.join(STORAGE_ROOT, 'uploads');

export function ensureStorageDirs() {
  for (const dir of [STORAGE_ROOT, PRIVATE_PDF_DIR, PREVIEW_PDF_DIR, PUBLIC_UPLOAD_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function isValidPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

export function detectImageExtension(buffer: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (buffer.length < 12) return null;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'png';
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export async function savePdfAndPreview(
  pdfBuffer: Buffer
): Promise<{ fileId: string; pageCount: number; fileSizeBytes: number }> {
  ensureStorageDirs();
  if (!isValidPdfBuffer(pdfBuffer)) {
    throw new Error('Invalid PDF file. Only genuine PDF documents are accepted.');
  }

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: false });
  const pageCount = pdfDoc.getPageCount();
  if (pageCount < 1) {
    throw new Error('Uploaded PDF contains zero pages.');
  }

  const fileId = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const privatePath = path.join(PRIVATE_PDF_DIR, `${fileId}.pdf`);
  fs.writeFileSync(privatePath, pdfBuffer);

  // Extract first 2 pages as sample preview
  const previewDoc = await PDFDocument.create();
  const sampleCount = Math.min(2, pageCount);
  const pageIndices = Array.from({ length: sampleCount }, (_, i) => i);
  const copiedPages = await previewDoc.copyPages(pdfDoc, pageIndices);
  for (const page of copiedPages) {
    previewDoc.addPage(page);
  }
  const previewBytes = await previewDoc.save();
  fs.writeFileSync(path.join(PREVIEW_PDF_DIR, `${fileId}.pdf`), Buffer.from(previewBytes));

  return {
    fileId,
    pageCount,
    fileSizeBytes: pdfBuffer.length,
  };
}

export function saveValidatedImage(imageBuffer: Buffer, prefix: string): string {
  ensureStorageDirs();
  const ext = detectImageExtension(imageBuffer);
  if (!ext) {
    throw new Error('Invalid image format. Only PNG, JPG, and WebP images are supported.');
  }
  const filename = `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(PUBLIC_UPLOAD_DIR, filename), imageBuffer);
  return `/api/uploads/${filename}`;
}

export function deleteStoredPdf(fileId: string) {
  if (!fileId || !/^[a-zA-Z0-9_\-]+$/.test(fileId)) return;
  const fullPath = path.join(PRIVATE_PDF_DIR, `${fileId}.pdf`);
  const previewPath = path.join(PREVIEW_PDF_DIR, `${fileId}.pdf`);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  if (fs.existsSync(previewPath)) fs.unlinkSync(previewPath);
}

export function getPrivatePdfPath(fileId: string): string | null {
  if (!fileId || !/^[a-zA-Z0-9_\-]+$/.test(fileId)) return null;
  const target = path.join(PRIVATE_PDF_DIR, `${fileId}.pdf`);
  return fs.existsSync(target) ? target : null;
}

export function getPreviewPdfPath(fileId: string): string | null {
  if (!fileId || !/^[a-zA-Z0-9_\-]+$/.test(fileId)) return null;
  const target = path.join(PREVIEW_PDF_DIR, `${fileId}.pdf`);
  return fs.existsSync(target) ? target : null;
}

const VERIFIED_PAYMENTS_FILE = path.join(STORAGE_ROOT, 'verified_payments.json');

export interface VerifiedPaidEntitlement {
  buyerId: string;
  noteId: string;
  transactionId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount: number;
  verifiedAt: string;
}

function readVerifiedPaymentsMap(): Record<string, VerifiedPaidEntitlement> {
  ensureStorageDirs();
  if (!fs.existsSync(VERIFIED_PAYMENTS_FILE)) return {};
  try {
    const raw = fs.readFileSync(VERIFIED_PAYMENTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, VerifiedPaidEntitlement>) : {};
  } catch {
    return {};
  }
}

function writeVerifiedPaymentsMap(map: Record<string, VerifiedPaidEntitlement>) {
  ensureStorageDirs();
  fs.writeFileSync(VERIFIED_PAYMENTS_FILE, JSON.stringify(map, null, 2), 'utf8');
}

export function recordVerifiedPaidEntitlement(entry: Omit<VerifiedPaidEntitlement, 'verifiedAt'>) {
  const key = `${entry.buyerId}_${entry.noteId}`;
  const map = readVerifiedPaymentsMap();
  map[key] = { ...entry, verifiedAt: new Date().toISOString() };
  writeVerifiedPaymentsMap(map);
}

export function revokeVerifiedPaidEntitlement(buyerId: string, noteId: string) {
  const key = `${buyerId}_${noteId}`;
  const map = readVerifiedPaymentsMap();
  if (key in map) {
    delete map[key];
    writeVerifiedPaymentsMap(map);
  }
}

export function hasVerifiedPaidEntitlement(buyerId: string, noteId: string): boolean {
  const key = `${buyerId}_${noteId}`;
  const map = readVerifiedPaymentsMap();
  const entry = map[key];
  return Boolean(entry && entry.razorpayPaymentId && entry.razorpayOrderId);
}
