import { z } from 'zod';
import { QrScanDeviceTypeEnum } from './qr-scan-device-type.enum.js';

/**
 * Validation schema for {@link QrScanDeviceTypeEnum} (HOS-1141).
 */
export const QrScanDeviceTypeEnumSchema = z.nativeEnum(QrScanDeviceTypeEnum, {
    error: () => ({ message: 'zodError.enums.qrScanDeviceType.invalid' })
});
export type QrScanDeviceTypeSchema = z.infer<typeof QrScanDeviceTypeEnumSchema>;
