import { z } from 'zod';
import { QrCodePurposeEnum } from './qr-code-purpose.enum.js';

/**
 * QR code purpose enum schema for validation
 */
export const QrCodePurposeEnumSchema = z.nativeEnum(QrCodePurposeEnum, {
    error: () => ({ message: 'zodError.enums.qrCodePurpose.invalid' })
});
export type QrCodePurposeSchema = z.infer<typeof QrCodePurposeEnumSchema>;
