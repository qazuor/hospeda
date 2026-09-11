/**
 * Tests for the QR code entity schemas (HOS-981).
 *
 * @module test/entities/qr-code/qr-code.schema
 */

import { describe, expect, it } from 'vitest';
import {
    EntityTypeEnum,
    QR_CODE_DEFAULT_BACKGROUND_COLOR,
    QR_CODE_DEFAULT_FOREGROUND_COLOR,
    QR_CODE_DEFAULT_MARGIN,
    QR_SCAN_USER_AGENT_MAX_LENGTH,
    QrCodeAdminSearchSchema,
    QrCodeCenterLogoEnum,
    QrCodeCreateHttpSchema,
    QrCodeCreateInputSchema,
    QrCodeErrorCorrectionLevelEnum,
    QrCodeFormatEnum,
    QrCodeRenderOptionsPatchSchema,
    QrCodeRenderOptionsSchema,
    QrCodeScanSchema,
    QrCodeSlugSchema,
    QrCodeSourceEnum,
    QrCodeUpdateHttpSchema,
    QrCodeUpdateInputSchema,
    QrScanDeviceTypeEnum,
    QrScanOsEnum
} from '../../../src/index.js';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

describe('QrCodeSlugSchema', () => {
    it('accepts a slug from the unambiguous alphabet', () => {
        expect(QrCodeSlugSchema.safeParse('k7Qm2XbT').success).toBe(true);
    });

    it('rejects the ambiguous characters the printed URL cannot afford', () => {
        for (const slug of ['abcdefg0', 'abcdefgO', 'abcdefg1', 'abcdefgl', 'abcdefgI']) {
            expect(QrCodeSlugSchema.safeParse(slug).success).toBe(false);
        }
    });

    it('rejects separators and anything not URL-safe', () => {
        for (const slug of ['abcd-efg', 'abcd_efg', 'abcd efg', 'abcd/efg', 'abcd.efg']) {
            expect(QrCodeSlugSchema.safeParse(slug).success).toBe(false);
        }
    });

    it('rejects a slug that is too short', () => {
        expect(QrCodeSlugSchema.safeParse('abc').success).toBe(false);
    });
});

describe('QrCodeRenderOptionsSchema', () => {
    it('fills every field from an empty object', () => {
        const parsed = QrCodeRenderOptionsSchema.parse({});

        expect(parsed.errorCorrectionLevel).toBe(QrCodeErrorCorrectionLevelEnum.M);
        expect(parsed.format).toBe(QrCodeFormatEnum.SVG);
        expect(parsed.margin).toBe(QR_CODE_DEFAULT_MARGIN);
        expect(parsed.size).toBeNull();
        expect(parsed.foregroundColor).toBe(QR_CODE_DEFAULT_FOREGROUND_COLOR);
        expect(parsed.backgroundColor).toBe(QR_CODE_DEFAULT_BACKGROUND_COLOR);
    });

    it('keeps every explicitly supplied value', () => {
        const parsed = QrCodeRenderOptionsSchema.parse({
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H,
            format: QrCodeFormatEnum.PNG,
            margin: 2,
            size: 512,
            foregroundColor: '#123456',
            backgroundColor: '#abcdef12',
            centerLogo: QrCodeCenterLogoEnum.HOSPEDA
        });

        expect(parsed).toStrictEqual({
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H,
            format: QrCodeFormatEnum.PNG,
            margin: 2,
            size: 512,
            foregroundColor: '#123456',
            backgroundColor: '#abcdef12',
            centerLogo: QrCodeCenterLogoEnum.HOSPEDA
        });
    });

    it('rejects an out-of-range margin', () => {
        expect(QrCodeRenderOptionsSchema.safeParse({ margin: -1 }).success).toBe(false);
        expect(QrCodeRenderOptionsSchema.safeParse({ margin: 21 }).success).toBe(false);
    });

    it('rejects a size below the scannable floor', () => {
        expect(QrCodeRenderOptionsSchema.safeParse({ size: 32 }).success).toBe(false);
    });

    it('rejects a colour that is not hex', () => {
        expect(QrCodeRenderOptionsSchema.safeParse({ foregroundColor: 'black' }).success).toBe(
            false
        );
        expect(QrCodeRenderOptionsSchema.safeParse({ backgroundColor: '#12345' }).success).toBe(
            false
        );
    });

    it('rejects an unknown option rather than silently dropping it', () => {
        expect(
            QrCodeRenderOptionsSchema.safeParse({ logoUrl: 'https://x.test/a.png' }).success
        ).toBe(false);
    });
});

describe('QrCodeCreateInputSchema', () => {
    const base = {
        targetUrl: 'https://hospeda.com.ar/alojamientos/foo',
        label: 'Cartelera plaza Ramirez',
        source: QrCodeSourceEnum.MANUAL
    };

    it('accepts a minimal manual code with no slug', () => {
        const parsed = QrCodeCreateInputSchema.parse(base);

        expect(parsed.slug).toBeUndefined();
        expect(parsed.isActive).toBe(true);
        expect(parsed.renderOptions).toBeUndefined();
    });

    it('accepts an explicit slug', () => {
        expect(QrCodeCreateInputSchema.parse({ ...base, slug: 'k7Qm2XbT' }).slug).toBe('k7Qm2XbT');
    });

    it('rejects a target that is not a URL', () => {
        expect(QrCodeCreateInputSchema.safeParse({ ...base, targetUrl: 'not a url' }).success).toBe(
            false
        );
    });

    it('rejects an empty label', () => {
        expect(QrCodeCreateInputSchema.safeParse({ ...base, label: '' }).success).toBe(false);
    });

    /**
     * `source` and the entity reference must agree. Before this invariant
     * existed the JSDoc asserted it and nothing applied it, so a MANUAL code
     * could be saved pointing at an entity that never generated it, and a
     * GENERATED one could be saved naming no entity at all — unreachable
     * forever by the (entity_type, entity_id) lookup that is the whole point
     * of those columns.
     */
    describe('source / entity reference invariant', () => {
        const ENTITY = { entityType: EntityTypeEnum.HOST_TRADE, entityId: VALID_UUID };

        /**
         * `entityType` is the shared enum, not free text (HOS-981). This is the
         * failure the enum exists to stop: the generator writing `'hostTrade'`
         * while an operator types `'host_trade'`, the (entityType, entityId)
         * lookup missing the existing code, and a second permanent slug being
         * minted for the same provider.
         */
        it('rejects an entityType outside EntityTypeEnum', () => {
            for (const bogus of ['hostTrade', 'host_trade', 'HOSTTRADE', 'provider']) {
                expect(
                    QrCodeCreateInputSchema.safeParse({
                        ...base,
                        source: QrCodeSourceEnum.GENERATED,
                        entityType: bogus,
                        entityId: VALID_UUID
                    }).success,
                    `entityType "${bogus}" must be rejected`
                ).toBe(false);
            }
        });

        it('accepts a MANUAL code with no entity reference', () => {
            expect(QrCodeCreateInputSchema.safeParse(base).success).toBe(true);
        });

        it('accepts a MANUAL code with the reference explicitly nulled', () => {
            expect(
                QrCodeCreateInputSchema.safeParse({
                    ...base,
                    entityType: null,
                    entityId: null
                }).success
            ).toBe(true);
        });

        it('rejects a MANUAL code that names an entity', () => {
            expect(QrCodeCreateInputSchema.safeParse({ ...base, ...ENTITY }).success).toBe(false);
        });

        it('accepts a GENERATED code that names its entity', () => {
            expect(
                QrCodeCreateInputSchema.safeParse({
                    ...base,
                    source: QrCodeSourceEnum.GENERATED,
                    ...ENTITY
                }).success
            ).toBe(true);
        });

        it('rejects a GENERATED code with no entity reference', () => {
            expect(
                QrCodeCreateInputSchema.safeParse({
                    ...base,
                    source: QrCodeSourceEnum.GENERATED
                }).success
            ).toBe(false);
        });

        /**
         * Half a reference is not half-identified, it is unidentified: the
         * composite index needs both columns to answer "does this subject
         * already have a code?".
         */
        it('rejects a GENERATED code carrying only entityType', () => {
            const result = QrCodeCreateInputSchema.safeParse({
                ...base,
                source: QrCodeSourceEnum.GENERATED,
                entityType: 'ACCOMMODATION'
            });

            expect(result.success).toBe(false);
            expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('entityId');
        });

        it('rejects a GENERATED code carrying only entityId', () => {
            expect(
                QrCodeCreateInputSchema.safeParse({
                    ...base,
                    source: QrCodeSourceEnum.GENERATED,
                    entityId: VALID_UUID
                }).success
            ).toBe(false);
        });
    });

    it('rejects audit fields supplied by the caller', () => {
        expect(
            QrCodeCreateInputSchema.safeParse({ ...base, createdById: VALID_UUID }).success
        ).toBe(false);
        expect(QrCodeCreateInputSchema.safeParse({ ...base, id: VALID_UUID }).success).toBe(false);
    });
});

describe('QrCodeUpdateInputSchema', () => {
    it('accepts a lone targetUrl — the whole reason the table exists', () => {
        const parsed = QrCodeUpdateInputSchema.parse({
            targetUrl: 'https://hospeda.com.ar/otra-cosa'
        });

        expect(parsed).toStrictEqual({ targetUrl: 'https://hospeda.com.ar/otra-cosa' });
    });

    /**
     * The slug is already printed on a sticker somewhere. Accepting it here
     * would let an update strand every code in the field.
     */
    it('refuses a slug', () => {
        expect(QrCodeUpdateInputSchema.safeParse({ slug: 'k7Qm2XbT' }).success).toBe(false);
    });

    /**
     * A PATCH that omits `isActive` must not resurrect a retired code. This is
     * what `stripShapeDefaults` buys, and an empty patch is the way to see it.
     */
    it('materialises nothing from an empty patch', () => {
        expect(QrCodeUpdateInputSchema.parse({})).toStrictEqual({});
    });
});

describe('QrCodeAdminSearchSchema', () => {
    /**
     * Regression for the `z.coerce.boolean()` trap: a query param always arrives
     * as a string and `Boolean('false') === true`, so coercion hands the filter
     * the exact complement of what was asked. An operator filtering for retired
     * codes would be shown the live ones under an "inactive" heading.
     *
     * This test fails if anyone puts `z.coerce.boolean()` back.
     */
    it('parses ?isActive=false to false, not true', () => {
        const parsed = QrCodeAdminSearchSchema.parse({ isActive: 'false' });

        expect(parsed.isActive).toBe(false);
    });

    it('parses ?isActive=true to true', () => {
        expect(QrCodeAdminSearchSchema.parse({ isActive: 'true' }).isActive).toBe(true);
    });

    it('leaves isActive undefined when the param is absent', () => {
        expect(QrCodeAdminSearchSchema.parse({}).isActive).toBeUndefined();
    });
});

describe('QrCodeCreateHttpSchema', () => {
    it('defaults isActive to true when the body omits it', () => {
        expect(
            QrCodeCreateHttpSchema.parse({
                targetUrl: 'https://hospeda.com.ar/alojamientos/foo',
                label: 'Cartelera plaza Ramirez',
                source: QrCodeSourceEnum.MANUAL
            }).isActive
        ).toBe(true);
    });

    /**
     * Fails closed rather than inverting. With `z.coerce.boolean()` this parsed
     * successfully and produced `true` — a code the operator asked to be retired
     * would have been created live.
     */
    it('rejects the string "false" instead of reading it as true', () => {
        const result = QrCodeCreateHttpSchema.safeParse({
            targetUrl: 'https://hospeda.com.ar/alojamientos/foo',
            label: 'Cartelera plaza Ramirez',
            source: QrCodeSourceEnum.MANUAL,
            isActive: 'false'
        });

        expect(result.success).toBe(false);
    });

    it('honours an explicit false', () => {
        expect(
            QrCodeCreateHttpSchema.parse({
                targetUrl: 'https://hospeda.com.ar/alojamientos/foo',
                label: 'Cartelera plaza Ramirez',
                source: QrCodeSourceEnum.MANUAL,
                isActive: false
            }).isActive
        ).toBe(false);
    });

    /**
     * The `isActive` default must stay the outermost wrapper so
     * `stripShapeDefaults` can see it. Wrapping it in a `z.preprocess()` would
     * hide it behind a `ZodPipe`, and an empty PATCH would revive a retired code.
     */
    it('strips the isActive default from the update schema', () => {
        expect(QrCodeUpdateHttpSchema.parse({})).toStrictEqual({});
    });
});

describe('QrCodeScanSchema', () => {
    it('accepts a scan row', () => {
        const parsed = QrCodeScanSchema.parse({
            id: VALID_UUID,
            qrCodeId: VALID_UUID,
            scannedAt: '2026-09-02T12:00:00.000Z'
        });

        expect(parsed.scannedAt).toBeInstanceOf(Date);
    });

    /**
     * Pins what the row is allowed to carry. HOS-1141 replaced HOS-981's
     * three-field version, so the list grew — but it is still asserted WHOLE,
     * which is what makes adding `ipAddress` or `referrer` (the two the table's
     * own comment rejects by name) fail here rather than ship.
     */
    it('carries exactly the nine HOS-1141 fields and nothing else', () => {
        expect(Object.keys(QrCodeScanSchema.shape).sort()).toStrictEqual([
            'browserLanguage',
            'deviceType',
            'id',
            'os',
            'qrCodeId',
            'scannedAt',
            'targetUrlAtScan',
            'userAgent',
            'userId'
        ]);
    });

    it('accepts a fully annotated scan', () => {
        const parsed = QrCodeScanSchema.parse({
            id: VALID_UUID,
            qrCodeId: VALID_UUID,
            scannedAt: '2026-09-02T12:00:00.000Z',
            userAgent: 'Mozilla/5.0 (iPhone)',
            deviceType: QrScanDeviceTypeEnum.MOBILE,
            os: QrScanOsEnum.IOS,
            browserLanguage: 'pt',
            targetUrlAtScan: 'https://hospeda.com.ar/es/gastronomia/foo/',
            userId: VALID_UUID
        });

        expect(parsed.deviceType).toBe(QrScanDeviceTypeEnum.MOBILE);
        expect(parsed.browserLanguage).toBe('pt');
    });

    it('accepts every context field as null', () => {
        // The safety property the whole write path rests on: a scan with
        // nothing known about it is still a valid scan. If any of these became
        // required, a client could make the insert fail by omitting a header.
        expect(
            QrCodeScanSchema.safeParse({
                id: VALID_UUID,
                qrCodeId: VALID_UUID,
                scannedAt: '2026-09-02T12:00:00.000Z',
                userAgent: null,
                deviceType: null,
                os: null,
                browserLanguage: null,
                targetUrlAtScan: null,
                userId: null
            }).success
        ).toBe(true);
    });

    it('refuses a locale it does not serve, and a user agent past the bound', () => {
        // Non-vacuity for the two bounded fields. Without this the block above
        // would stay green on a schema that accepted absolutely anything.
        const base = {
            id: VALID_UUID,
            qrCodeId: VALID_UUID,
            scannedAt: '2026-09-02T12:00:00.000Z'
        };

        expect(QrCodeScanSchema.safeParse({ ...base, browserLanguage: 'fr' }).success).toBe(false);
        expect(
            QrCodeScanSchema.safeParse({
                ...base,
                userAgent: 'A'.repeat(QR_SCAN_USER_AGENT_MAX_LENGTH + 1)
            }).success
        ).toBe(false);
        expect(
            QrCodeScanSchema.safeParse({
                ...base,
                userAgent: 'A'.repeat(QR_SCAN_USER_AGENT_MAX_LENGTH)
            }).success
        ).toBe(true);
    });
});

/**
 * HOS-981 PR 3 — a render patch must stay as small as the caller wrote it.
 *
 * The failure this whole block exists for is silent: the schema completes an
 * omitted field with its default, the completed object is written over the one
 * `jsonb` column, and a code somebody configured red comes back black with no
 * error raised anywhere. Every assertion here is therefore about the ABSENCE of
 * keys, using `toStrictEqual` — `objectContaining` is blind to a field being
 * present that should not be, and it is exactly the extra fields that do the
 * damage.
 */
describe('QrCodeRenderOptionsPatchSchema', () => {
    it('returns exactly the keys it was given', () => {
        expect(QrCodeRenderOptionsPatchSchema.parse({ margin: 8 })).toStrictEqual({ margin: 8 });
    });

    /**
     * The one field whose loss is invisible and permanent, named on its own so
     * a failure says what broke rather than "objects differ".
     */
    it('does not invent a foreground colour', () => {
        expect(QrCodeRenderOptionsPatchSchema.parse({ margin: 8 })).not.toHaveProperty(
            'foregroundColor'
        );
    });

    it('parses an empty patch to an empty object, not to six defaults', () => {
        expect(QrCodeRenderOptionsPatchSchema.parse({})).toStrictEqual({});
    });

    /**
     * Non-vacuity: stripping the defaults must not have stripped the
     * validation with them. A margin past the printable range is still refused.
     */
    it('still enforces the field constraints it kept', () => {
        expect(QrCodeRenderOptionsPatchSchema.safeParse({ margin: 999 }).success).toBe(false);
        expect(QrCodeRenderOptionsPatchSchema.safeParse({ foregroundColor: 'red' }).success).toBe(
            false
        );
    });

    /** `.strict()` survives the rebuild: an unknown drawing key is refused. */
    it('refuses an unknown render option', () => {
        expect(
            QrCodeRenderOptionsPatchSchema.safeParse({ logoUrl: 'https://example.com/l.png' })
                .success
        ).toBe(false);
    });

    /**
     * The create path is the counterpart and must NOT change: a code is stored
     * with a complete render document, so an absent option there really does
     * mean "use the default".
     */
    it('leaves the create schema completing its defaults', () => {
        expect(QrCodeRenderOptionsSchema.parse({})).toStrictEqual({
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.M,
            format: QrCodeFormatEnum.SVG,
            margin: QR_CODE_DEFAULT_MARGIN,
            size: null,
            foregroundColor: QR_CODE_DEFAULT_FOREGROUND_COLOR,
            backgroundColor: QR_CODE_DEFAULT_BACKGROUND_COLOR,
            centerLogo: QrCodeCenterLogoEnum.NONE
        });
    });
});

describe('the update schemas carry the render patch, not the full document', () => {
    it.each([
        ['domain', QrCodeUpdateInputSchema],
        ['HTTP', QrCodeUpdateHttpSchema]
    ])('%s update: a margin-only patch leaves the colours untouched', (_label, schema) => {
        const parsed = schema.parse({ renderOptions: { margin: 8 } });

        expect(parsed).toStrictEqual({ renderOptions: { margin: 8 } });
    });

    it.each([
        ['domain', QrCodeUpdateInputSchema],
        ['HTTP', QrCodeUpdateHttpSchema]
    ])('%s update: the slug is refused, not ignored', (_label, schema) => {
        expect(schema.safeParse({ slug: 'Rena2ed4' }).success).toBe(false);
    });
});
