import { z } from 'zod';
import { QrCodeSourceEnum } from './qr-code-source.enum.js';

/**
 * QR code source enum schema for validation
 */
export const QrCodeSourceEnumSchema = z.nativeEnum(QrCodeSourceEnum, {
    error: () => ({ message: 'zodError.enums.qrCodeSource.invalid' })
});
export type QrCodeSourceSchema = z.infer<typeof QrCodeSourceEnumSchema>;
