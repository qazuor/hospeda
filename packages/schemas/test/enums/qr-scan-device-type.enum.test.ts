import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { QrScanDeviceTypeEnum } from '../../src/enums/qr-scan-device-type.enum.js';
import { QrScanDeviceTypeEnumSchema } from '../../src/enums/qr-scan-device-type.schema.js';

// ============================================================================
// QrScanDeviceTypeEnum — HOS-1141
// ============================================================================

describe('QrScanDeviceTypeEnum', () => {
    describe('enum values', () => {
        it('should define MOBILE', () => {
            expect(QrScanDeviceTypeEnum.MOBILE).toBe('MOBILE');
        });

        it('should define TABLET', () => {
            expect(QrScanDeviceTypeEnum.TABLET).toBe('TABLET');
        });

        it('should define DESKTOP', () => {
            expect(QrScanDeviceTypeEnum.DESKTOP).toBe('DESKTOP');
        });

        /**
         * A frozen baseline, not a formality. This enum backs a PostgreSQL enum
         * (`qr_scan_device_type_enum`), so a member appearing or disappearing in
         * TypeScript alone is a schema drift that nothing in the type system
         * reacts to — there is no `Record<QrScanDeviceTypeEnum, …>` and no
         * exhaustive `switch` over it. Adding a value means a migration
         * (`ALTER TYPE … ADD VALUE`); removing one means rewriting rows.
         */
        it('should have exactly 3 values', () => {
            expect(Object.values(QrScanDeviceTypeEnum)).toHaveLength(3);
        });

        /**
         * The absence that is the design. "We could not tell" is `NULL` on the
         * column, never a member here — see `QrScanDeviceTypeEnum`'s own doc.
         * Folding the two together would make "no data" and "data we read"
         * indistinguishable in the `GROUP BY` the column exists for.
         */
        it('should NOT define an UNKNOWN bucket', () => {
            expect(Object.values(QrScanDeviceTypeEnum)).not.toContain('UNKNOWN');
            expect(Object.keys(QrScanDeviceTypeEnum)).not.toContain('UNKNOWN');
        });
    });

    describe('QrScanDeviceTypeEnumSchema', () => {
        it.each(Object.values(QrScanDeviceTypeEnum))('should accept %s', (value) => {
            expect(QrScanDeviceTypeEnumSchema.parse(value)).toBe(value);
        });

        it.each([
            ['lowercase', 'mobile'],
            ['an unknown member', 'WATCH'],
            ['empty', '']
        ])('should reject %s', (_label, value) => {
            expect(() => QrScanDeviceTypeEnumSchema.parse(value)).toThrow(ZodError);
        });

        it('should reject null and undefined', () => {
            expect(() => QrScanDeviceTypeEnumSchema.parse(null)).toThrow(ZodError);
            expect(() => QrScanDeviceTypeEnumSchema.parse(undefined)).toThrow(ZodError);
        });

        it('should carry the i18n error key rather than a raw Zod message', () => {
            const result = QrScanDeviceTypeEnumSchema.safeParse('nope');

            expect(result.success).toBe(false);
            expect(result.error?.issues[0]?.message).toBe(
                'zodError.enums.qrScanDeviceType.invalid'
            );
        });
    });
});
