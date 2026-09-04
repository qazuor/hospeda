import { z } from 'zod';
import { QrCodeCenterLogoEnum } from './qr-code-center-logo.enum.js';

/**
 * QR code centre-logo enum schema for validation
 */
export const QrCodeCenterLogoEnumSchema = z.nativeEnum(QrCodeCenterLogoEnum, {
    error: () => ({ message: 'zodError.enums.qrCodeCenterLogo.invalid' })
});
export type QrCodeCenterLogoSchema = z.infer<typeof QrCodeCenterLogoEnumSchema>;
