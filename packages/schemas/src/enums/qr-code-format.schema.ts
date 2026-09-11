import { z } from 'zod';
import { QrCodeFormatEnum } from './qr-code-format.enum.js';

/**
 * QR code output format enum schema for validation
 */
export const QrCodeFormatEnumSchema = z.nativeEnum(QrCodeFormatEnum, {
    error: () => ({ message: 'zodError.enums.qrCodeFormat.invalid' })
});
export type QrCodeFormatSchema = z.infer<typeof QrCodeFormatEnumSchema>;
