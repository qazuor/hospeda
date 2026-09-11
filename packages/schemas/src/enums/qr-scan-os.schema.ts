import { z } from 'zod';
import { QrScanOsEnum } from './qr-scan-os.enum.js';

/**
 * Validation schema for {@link QrScanOsEnum} (HOS-1141).
 */
export const QrScanOsEnumSchema = z.nativeEnum(QrScanOsEnum, {
    error: () => ({ message: 'zodError.enums.qrScanOs.invalid' })
});
export type QrScanOsSchema = z.infer<typeof QrScanOsEnumSchema>;
