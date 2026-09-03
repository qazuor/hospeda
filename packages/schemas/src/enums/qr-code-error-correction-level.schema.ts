import { z } from 'zod';
import { QrCodeErrorCorrectionLevelEnum } from './qr-code-error-correction-level.enum.js';

/**
 * QR code error-correction level enum schema for validation
 */
export const QrCodeErrorCorrectionLevelEnumSchema = z.nativeEnum(QrCodeErrorCorrectionLevelEnum, {
    error: () => ({ message: 'zodError.enums.qrCodeErrorCorrectionLevel.invalid' })
});
export type QrCodeErrorCorrectionLevelSchema = z.infer<typeof QrCodeErrorCorrectionLevelEnumSchema>;
