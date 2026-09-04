import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { QrScanOsEnum } from '../../src/enums/qr-scan-os.enum.js';
import { QrScanOsEnumSchema } from '../../src/enums/qr-scan-os.schema.js';

// ============================================================================
// QrScanOsEnum — HOS-1141
// ============================================================================

describe('QrScanOsEnum', () => {
    describe('enum values', () => {
        it('should define IOS', () => {
            expect(QrScanOsEnum.IOS).toBe('IOS');
        });

        it('should define ANDROID', () => {
            expect(QrScanOsEnum.ANDROID).toBe('ANDROID');
        });

        it('should define OTHER', () => {
            expect(QrScanOsEnum.OTHER).toBe('OTHER');
        });

        /**
         * Frozen baseline. This enum backs a PostgreSQL enum
         * (`qr_scan_os_enum`), so drift between TypeScript and the column is
         * invisible to the type system — nothing switches exhaustively over it.
         */
        it('should have exactly 3 values', () => {
            expect(Object.values(QrScanOsEnum)).toHaveLength(3);
        });

        /**
         * `OTHER` is a real observation — a user agent WAS presented and named
         * neither platform — and it must stay distinct from `NULL`, which means
         * there was nothing to read. An `UNKNOWN` member would collapse that
         * distinction, and with it the only signal that would show a broken
         * derivation as anything other than a plausible long tail.
         */
        it('should NOT define an UNKNOWN bucket distinct from OTHER', () => {
            expect(Object.values(QrScanOsEnum)).not.toContain('UNKNOWN');
            expect(Object.keys(QrScanOsEnum)).not.toContain('UNKNOWN');
        });
    });

    describe('QrScanOsEnumSchema', () => {
        it.each(Object.values(QrScanOsEnum))('should accept %s', (value) => {
            expect(QrScanOsEnumSchema.parse(value)).toBe(value);
        });

        it.each([
            ['lowercase', 'ios'],
            ['a plausible non-member', 'WINDOWS'],
            ['empty', '']
        ])('should reject %s', (_label, value) => {
            expect(() => QrScanOsEnumSchema.parse(value)).toThrow(ZodError);
        });

        it('should reject null and undefined', () => {
            expect(() => QrScanOsEnumSchema.parse(null)).toThrow(ZodError);
            expect(() => QrScanOsEnumSchema.parse(undefined)).toThrow(ZodError);
        });

        it('should carry the i18n error key rather than a raw Zod message', () => {
            const result = QrScanOsEnumSchema.safeParse('nope');

            expect(result.success).toBe(false);
            expect(result.error?.issues[0]?.message).toBe('zodError.enums.qrScanOs.invalid');
        });
    });
});
