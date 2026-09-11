/**
 * The centre-logo geometric gate (HOS-981 PR 5).
 *
 * ## What this file is defending
 *
 * A centre mark is DAMAGE. The plate blanks every module under it and the
 * symbol survives on Reed-Solomon recovery alone, so "may this code carry a
 * mark" is a question about the error-correction level and nothing else. The
 * gate answers it, and these tests pin both halves of the answer: which pairs
 * are accepted, and — the half that is easy to lose — which are REFUSED.
 *
 * ## Why the PATCH half is longer than the create half
 *
 * Because a partial patch can carry one side of a two-sided comparison. The
 * create path always sees both fields, so its rule is a single conjunction. A
 * PATCH may state the mark and not the level, or the level and not the mark,
 * and the stored document is invisible from inside a schema — so the rule there
 * is "travel together whenever the answer depends on both", and every branch of
 * that needs a test or the whole gate is bypassable through PATCH with a 200.
 *
 * @module test/entities/qr-code/qr-code.center-logo-gate
 */

import { describe, expect, it } from 'vitest';
import {
    QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE,
    QR_CODE_CENTER_LOGO_MAX_COVERAGE,
    QR_CODE_CENTER_LOGO_SIZE_RATIO,
    QR_CODE_ERROR_CORRECTION_DECODE_CEILING,
    QrCodeAdminListResponseSchema,
    QrCodeAdminSchema,
    QrCodeCenterLogoEnum,
    QrCodeCreateHttpSchema,
    QrCodeCreateInputSchema,
    QrCodeErrorCorrectionLevelEnum,
    QrCodeRenderOptionsOverrideSchema,
    QrCodeRenderOptionsPatchSchema,
    QrCodeRenderOptionsSchema,
    QrCodeRenderOptionsStoredSchema,
    QrCodeRenderQuerySchema,
    QrCodeSchema,
    QrCodeSourceEnum,
    QrCodeUpdateHttpSchema,
    QrCodeUpdateInputSchema,
    qrCodeCenterLogoFits
} from '../../../src/index.js';

const ALL_LEVELS = [
    QrCodeErrorCorrectionLevelEnum.L,
    QrCodeErrorCorrectionLevelEnum.M,
    QrCodeErrorCorrectionLevelEnum.Q,
    QrCodeErrorCorrectionLevelEnum.H
] as const;

/**
 * The verdict, spelled out rather than recomputed.
 *
 * Deriving this from `qrCodeCenterLogoFits` would make every assertion below a
 * comparison of the function against itself: the gate could invert entirely and
 * the suite would stay green. These four booleans are the CLAIM — a mark costs
 * more than half of what L and M can tolerate, and less than half of what Q and
 * H can — and the arithmetic test further down is what ties the claim back to
 * the measured ceilings.
 */
const EXPECTED_VERDICT: Readonly<Record<QrCodeErrorCorrectionLevelEnum, boolean>> = {
    [QrCodeErrorCorrectionLevelEnum.L]: false,
    [QrCodeErrorCorrectionLevelEnum.M]: false,
    [QrCodeErrorCorrectionLevelEnum.Q]: true,
    [QrCodeErrorCorrectionLevelEnum.H]: true
};

describe('qrCodeCenterLogoFits — the gate itself', () => {
    it('accepts every level when no mark is asked for', () => {
        for (const errorCorrectionLevel of ALL_LEVELS) {
            expect(
                qrCodeCenterLogoFits({
                    centerLogo: QrCodeCenterLogoEnum.NONE,
                    errorCorrectionLevel
                }),
                `NONE must never be refused; ${errorCorrectionLevel} was.`
            ).toBe(true);
        }
    });

    it('refuses L and M and accepts Q and H for the Hospeda mark', () => {
        for (const errorCorrectionLevel of ALL_LEVELS) {
            expect(
                qrCodeCenterLogoFits({
                    centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                    errorCorrectionLevel
                }),
                `The gate changed its mind about ${errorCorrectionLevel}. If that was ` +
                    'deliberate — the mark was resized, or a ceiling was re-measured — update ' +
                    'EXPECTED_VERDICT and say which measurement moved. If it was not, a code is ' +
                    'about to be printed carrying a logo its error correction cannot pay for.'
            ).toBe(EXPECTED_VERDICT[errorCorrectionLevel]);
        }
    });

    /**
     * Ties the verdict back to the numbers it is supposed to come from.
     *
     * Without this, `EXPECTED_VERDICT` is an opinion: somebody could hardcode
     * the four levels inside `qrCodeCenterLogoFits` and every assertion above
     * would still pass while the mark grew to twice its size.
     */
    it('is the coverage-against-half-the-measured-ceiling comparison, not a level list', () => {
        for (const level of ALL_LEVELS) {
            const affordable =
                QR_CODE_ERROR_CORRECTION_DECODE_CEILING[level] *
                QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE;

            expect(
                QR_CODE_CENTER_LOGO_MAX_COVERAGE <= affordable,
                `The gate's answer for ${level} no longer follows from the measured ceiling ` +
                    `(${QR_CODE_ERROR_CORRECTION_DECODE_CEILING[level]}), the budget share ` +
                    `(${QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE}) and the mark's coverage ` +
                    `(${QR_CODE_CENTER_LOGO_MAX_COVERAGE}).`
            ).toBe(EXPECTED_VERDICT[level]);
        }
    });

    /**
     * The margins on both sides of the line, frozen.
     *
     * A gate whose accept and refuse cases sit within a percent of each other is
     * a coin flip dressed as a rule: any re-measurement flips it. These two
     * assertions say the nearest ACCEPT (Q) and the nearest REFUSE (M) are each
     * comfortably clear of the threshold, so the verdict above is a decision and
     * not a rounding artefact.
     */
    it('decides Q and M with real margin, not by a hair', () => {
        const qAllowance =
            QR_CODE_ERROR_CORRECTION_DECODE_CEILING[QrCodeErrorCorrectionLevelEnum.Q] *
            QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE;
        const mAllowance =
            QR_CODE_ERROR_CORRECTION_DECODE_CEILING[QrCodeErrorCorrectionLevelEnum.M] *
            QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE;

        // Q affords the mark with at least a quarter of its allowance to spare.
        expect(QR_CODE_CENTER_LOGO_MAX_COVERAGE / qAllowance).toBeLessThan(0.8);
        // M is short by at least a quarter, not by a rounding error.
        expect(QR_CODE_CENTER_LOGO_MAX_COVERAGE / mAllowance).toBeGreaterThan(1.25);
    });

    /** The coverage bound is the ratio squared, which is what makes it decidable here. */
    it('bounds coverage at the ratio squared, independent of QR version', () => {
        expect(QR_CODE_CENTER_LOGO_MAX_COVERAGE).toBeCloseTo(
            QR_CODE_CENTER_LOGO_SIZE_RATIO ** 2,
            12
        );
    });
});

describe('QrCodeRenderOptionsSchema — the gate on a complete document', () => {
    const base = {
        format: 'SVG',
        margin: 4,
        size: null,
        foregroundColor: '#000000',
        backgroundColor: '#ffffff'
    };

    it('parses an empty object, because the default mark is NONE', () => {
        expect(QrCodeRenderOptionsSchema.parse({}).centerLogo).toBe(QrCodeCenterLogoEnum.NONE);
    });

    it.each(ALL_LEVELS)('refuses or accepts HOSPEDA at %s per the gate', (level) => {
        const result = QrCodeRenderOptionsSchema.safeParse({
            ...base,
            errorCorrectionLevel: level,
            centerLogo: QrCodeCenterLogoEnum.HOSPEDA
        });

        expect(result.success).toBe(EXPECTED_VERDICT[level]);
    });

    it('reports the refusal on centerLogo, with the translatable key', () => {
        const result = QrCodeRenderOptionsSchema.safeParse({
            ...base,
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.L,
            centerLogo: QrCodeCenterLogoEnum.HOSPEDA
        });

        expect(result.success).toBe(false);
        const issue = result.success ? undefined : result.error.issues[0];
        expect(issue?.path).toEqual(['centerLogo']);
        expect(issue?.message).toBe(
            'zodError.qrCode.renderOptions.centerLogo.requiresErrorCorrection'
        );
    });

    it('still refuses an unknown drawing key — .strict() survived the refine', () => {
        expect(
            QrCodeRenderOptionsSchema.safeParse({ centerLogoUrl: 'https://x.test/l.png' }).success
        ).toBe(false);
    });
});

describe('QrCodeRenderOptionsPatchSchema — the gate on a partial patch', () => {
    it('accepts a patch that mentions neither field', () => {
        expect(QrCodeRenderOptionsPatchSchema.safeParse({ margin: 8 }).success).toBe(true);
    });

    it('accepts turning the mark OFF on its own', () => {
        expect(
            QrCodeRenderOptionsPatchSchema.safeParse({ centerLogo: QrCodeCenterLogoEnum.NONE })
                .success,
            'Removing a mark cannot make any stored symbol harder to read, whatever level it ' +
                'carries, so demanding the level alongside would be friction with no safety in it.'
        ).toBe(true);
    });

    it('REFUSES turning the mark on without stating the level', () => {
        const result = QrCodeRenderOptionsPatchSchema.safeParse({
            centerLogo: QrCodeCenterLogoEnum.HOSPEDA
        });

        expect(
            result.success,
            'A lone {centerLogo: HOSPEDA} is merged into the stored jsonb by ' +
                'QrCodeModel.mergeableJsonbColumns without this schema ever seeing the stored ' +
                'errorCorrectionLevel. Accepting it puts a mark on an L-level code through the ' +
                'gate, with a 200.'
        ).toBe(false);
        const issue = result.success ? undefined : result.error.issues[0];
        expect(issue?.path).toEqual(['errorCorrectionLevel']);
    });

    it('REFUSES lowering the level without stating the mark', () => {
        for (const level of [
            QrCodeErrorCorrectionLevelEnum.L,
            QrCodeErrorCorrectionLevelEnum.M
        ] as const) {
            const result = QrCodeRenderOptionsPatchSchema.safeParse({
                errorCorrectionLevel: level
            });

            expect(
                result.success,
                `A lone {errorCorrectionLevel: ${level}} lands on a row that may already carry a ` +
                    'mark, and lowers it below what that mark costs. The stored centerLogo is ' +
                    'invisible from here, so the only safe answer is to demand it.'
            ).toBe(false);
            const issue = result.success ? undefined : result.error.issues[0];
            expect(issue?.path).toEqual(['centerLogo']);
        }
    });

    it('accepts RAISING the level on its own, because the worst case is safe', () => {
        for (const level of [
            QrCodeErrorCorrectionLevelEnum.Q,
            QrCodeErrorCorrectionLevelEnum.H
        ] as const) {
            expect(
                QrCodeRenderOptionsPatchSchema.safeParse({ errorCorrectionLevel: level }).success,
                `${level} affords a mark, so whatever the row stores it stays readable.`
            ).toBe(true);
        }
    });

    it.each(ALL_LEVELS)('judges the stated pair at %s exactly as the gate does', (level) => {
        expect(
            QrCodeRenderOptionsPatchSchema.safeParse({
                centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                errorCorrectionLevel: level
            }).success
        ).toBe(EXPECTED_VERDICT[level]);
    });

    it('accepts NONE paired with any level', () => {
        for (const level of ALL_LEVELS) {
            expect(
                QrCodeRenderOptionsPatchSchema.safeParse({
                    centerLogo: QrCodeCenterLogoEnum.NONE,
                    errorCorrectionLevel: level
                }).success
            ).toBe(true);
        }
    });
});

/**
 * The rule has to hold through the schemas an actual PATCH request is parsed
 * by, not only on the nested object in isolation. The two update schemas are
 * declared independently of each other, so a gate that reached one and not the
 * other would be a hole with an extra step — the same failure mode the
 * accept-set guard was written for.
 */
describe('the update schemas carry the gate, both of them', () => {
    for (const [label, schema] of [
        ['domain', QrCodeUpdateInputSchema],
        ['HTTP', QrCodeUpdateHttpSchema]
    ] as const) {
        it(`${label} update refuses a mark the level cannot pay for`, () => {
            expect(
                schema.safeParse({
                    renderOptions: {
                        centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                        errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.M
                    }
                }).success
            ).toBe(false);
        });

        it(`${label} update refuses a lone mark`, () => {
            expect(
                schema.safeParse({
                    renderOptions: { centerLogo: QrCodeCenterLogoEnum.HOSPEDA }
                }).success
            ).toBe(false);
        });

        it(`${label} update accepts the affordable pair and keeps the patch minimal`, () => {
            const parsed = schema.parse({
                renderOptions: {
                    centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                    errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H
                }
            });

            expect(parsed).toStrictEqual({
                renderOptions: {
                    centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                    errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H
                }
            });
        });
    }
});

/**
 * The gate is a WRITE rule, and the read path must stay open (HOS-981 PR 5 review).
 *
 * `QrCodeAdminSchema` IS `QrCodeSchema`, and `stripWithSchema`
 * (`apps/api/src/utils/response-helpers.ts`) parses every response through it
 * and fail-closes to HTTP 500. So a cross-field refine on the entity's
 * `renderOptions` does not merely reject bad writes — it makes an already-stored
 * row UNSERVABLE. Measured before the split, with one row carrying
 * `{centerLogo: 'HOSPEDA', errorCorrectionLevel: 'L'}`:
 *
 * ```
 * getById on a non-affordable row => REJECTED: renderOptions.centerLogo
 * list page with 3 good + 1 bad   => WHOLE PAGE REJECTED (z.array fails on one element)
 * ```
 *
 * No write path can produce that row today. But a seed, a data-migration or a
 * hand-run `UPDATE` can, and the symptom would be a 500 on the entire admin
 * list — the one screen an operator would use to find and fix the bad row.
 *
 * These tests pin BOTH halves, because either alone is a trap: reading must
 * work (or bad data becomes unfixable), and writing must not (or the gate is
 * decorative).
 */
describe('the gate applies to writes, never to reads', () => {
    const storedRow = {
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'Live2345',
        targetUrl: 'https://hospeda.com.ar/es/destinos/colon/',
        label: 'Cartelera plaza Ramirez',
        description: null,
        source: QrCodeSourceEnum.MANUAL,
        entityType: null,
        entityId: null,
        purpose: null,
        renderOptions: {
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.L,
            format: 'SVG',
            margin: 4,
            size: null,
            foregroundColor: '#000000',
            backgroundColor: '#ffffff',
            // The combination the gate refuses. Reachable in the database only
            // by a path that bypasses the write schemas.
            centerLogo: QrCodeCenterLogoEnum.HOSPEDA
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: null,
        updatedById: null
    };

    /**
     * Both names, on purpose. `QrCodeAdminSchema` is what the route declares as
     * its `responseSchema` and therefore what `stripWithSchema` actually parses;
     * `QrCodeSchema` is where the field lives. They are the same object today —
     * asserted below — and if that ever stops being true, this test must follow
     * the one the ROUTE uses, not the one that is convenient to import.
     */
    it('reads a non-affordable stored row back without complaint', () => {
        expect(QrCodeAdminSchema, 'the admin response schema is no longer the entity schema').toBe(
            QrCodeSchema
        );

        const result = QrCodeAdminSchema.safeParse(storedRow);

        expect(
            result.success,
            'The admin RESPONSE schema rejected a stored row. `stripWithSchema` turns that into a ' +
                '500, so this code can no longer be fetched — and the row can no longer be ' +
                'corrected through the panel that would fix it.'
        ).toBe(true);
    });

    it('serves a LIST page that contains one, instead of 500ing the whole page', () => {
        const good = {
            ...storedRow,
            id: '22222222-2222-4222-8222-222222222222',
            // No `o`, no `l`, no `I`, no `O`, no `U`: the slug alphabet drops
            // every ambiguous character, because these get typed off a sticker
            // by hand. `Good2345` is NOT a valid slug, and using it here made
            // this test fail for a reason that had nothing to do with the gate.
            slug: 'Zx9Wp2Qm',
            renderOptions: {
                ...storedRow.renderOptions,
                centerLogo: QrCodeCenterLogoEnum.NONE
            }
        };

        const result = QrCodeAdminListResponseSchema.safeParse({
            items: [good, good, storedRow, good],
            total: 4
        });

        expect(
            result.success,
            'The page was rejected. If the failing path is `items.2.renderOptions.centerLogo`, ' +
                'the gate has crept back onto the entity schema and one bad row now 500s a page ' +
                'of four via `z.array`. Any OTHER path is a broken fixture in this test. Issues: ' +
                JSON.stringify(
                    result.success ? [] : result.error.issues.map((i) => i.path.join('.'))
                )
        ).toBe(true);
    });

    it('still refuses to WRITE the same combination, through every input schema', () => {
        const renderOptions = storedRow.renderOptions;
        const base = {
            targetUrl: 'https://hospeda.com.ar/es/destinos/colon/',
            label: 'Cartelera plaza Ramirez',
            source: QrCodeSourceEnum.MANUAL
        };

        expect(
            QrCodeCreateInputSchema.safeParse({ ...base, renderOptions }).success,
            'the domain create schema let the gate through'
        ).toBe(false);
        expect(
            QrCodeCreateHttpSchema.safeParse({ ...base, renderOptions }).success,
            'the HTTP create schema let the gate through'
        ).toBe(false);
        expect(
            QrCodeRenderOptionsSchema.safeParse(renderOptions).success,
            'the write schema — which `_beforeCreate` parses through — let the gate through'
        ).toBe(false);
    });

    /**
     * The two schemas differ by the refine and by NOTHING else. Without this a
     * field could be added to one and forgotten in the other, and the read
     * shape would start silently dropping (or refusing) a stored key.
     */
    it('keeps the stored and write shapes identical apart from the gate', () => {
        expect(Object.keys(QrCodeRenderOptionsStoredSchema.shape).sort()).toEqual(
            Object.keys(QrCodeRenderOptionsSchema.shape).sort()
        );

        const affordable = {
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H,
            format: 'PNG',
            margin: 2,
            size: 512,
            foregroundColor: '#123456',
            backgroundColor: '#abcdef',
            centerLogo: QrCodeCenterLogoEnum.HOSPEDA
        };

        expect(QrCodeRenderOptionsStoredSchema.parse(affordable)).toStrictEqual(
            QrCodeRenderOptionsSchema.parse(affordable)
        );
        expect(QrCodeRenderOptionsStoredSchema.parse({})).toStrictEqual(
            QrCodeRenderOptionsSchema.parse({})
        );
    });

    /** The stored shape is still strict — it is permissive about the PAIR, not about keys. */
    it('does not become a dumping ground: unknown keys are still refused on read', () => {
        expect(
            QrCodeRenderOptionsStoredSchema.safeParse({ centerLogoUrl: 'https://x.test/l.png' })
                .success
        ).toBe(false);
    });
});

/**
 * A one-request override is not a stored patch (HOS-981 PR 5 review).
 *
 * `QrCodeRenderQuerySchema` briefly WAS the patch schema, and inherited its
 * pairing rule. That rule is paid for by one fact: a patch is merged into the
 * stored `jsonb`, so a lone `{centerLogo: 'HOSPEDA'}` becomes permanent. An
 * override is merged with nothing and discarded after one response, so it gets
 * the cost with none of the motive — `?errorCorrectionLevel=L` against a code
 * stored with no mark is harmless, and was answering 400.
 */
describe('QrCodeRenderOptionsOverrideSchema — the gate without the pairing rule', () => {
    it('is what the render query resolves to', () => {
        expect(QrCodeRenderQuerySchema).toBe(QrCodeRenderOptionsOverrideSchema);
    });

    /**
     * The same claim, asserted through the EXPORTED NAME a route would import
     * and by BEHAVIOUR rather than by identity.
     *
     * Measured: with `QrCodeRenderQuerySchema` re-aliased to the patch schema,
     * the identity test above was the only thing that went red — one test, and
     * one that a different mistake (copying the pairing rule INTO the override
     * schema) would not trip at all. An alias is not the property; the property
     * is that a lone level override is accepted here.
     */
    it.each(
        ALL_LEVELS
    )('QrCodeRenderQuerySchema accepts a lone %s override, by behaviour', (level) => {
        const result = QrCodeRenderQuerySchema.safeParse({ errorCorrectionLevel: level });

        expect(
            result.success,
            `?errorCorrectionLevel=${level} was refused. A render override is discarded after ` +
                'one response — it is merged into nothing and outlives nothing — so the ' +
                "pairing rule's justification does not reach it. Against a code stored with " +
                'no mark this is a 400 for a completely harmless request.'
        ).toBe(true);
    });

    it.each(ALL_LEVELS)('accepts a lone %s override, including the refused levels', (level) => {
        expect(
            QrCodeRenderOptionsOverrideSchema.safeParse({ errorCorrectionLevel: level }).success,
            `A one-request ?errorCorrectionLevel=${level} override is discarded after the ` +
                'response. Refusing it charges the pairing rule with none of its motive.'
        ).toBe(true);
    });

    it('accepts a lone centerLogo override', () => {
        expect(
            QrCodeRenderOptionsOverrideSchema.safeParse({
                centerLogo: QrCodeCenterLogoEnum.HOSPEDA
            }).success
        ).toBe(true);
    });

    /**
     * The half it DOES keep. Both fields stated is fully decidable without the
     * stored document, so an override that asks for an unscannable image on its
     * own terms is still refused.
     */
    it.each(ALL_LEVELS)('still judges a STATED pair at %s exactly as the gate does', (level) => {
        expect(
            QrCodeRenderOptionsOverrideSchema.safeParse({
                centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                errorCorrectionLevel: level
            }).success
        ).toBe(EXPECTED_VERDICT[level]);
    });

    /**
     * And the PATCH schema keeps the pairing rule the override dropped. Stated
     * as a contrast, in one place, so the split cannot silently collapse back
     * into one schema in either direction.
     */
    it('is NOT the patch schema: the patch still demands the pair', () => {
        const loneLevel = { errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.L };

        expect(QrCodeRenderOptionsOverrideSchema.safeParse(loneLevel).success).toBe(true);
        expect(QrCodeRenderOptionsPatchSchema.safeParse(loneLevel).success).toBe(false);
    });

    it('strips defaults like the patch does, so an override overrides only what it names', () => {
        expect(QrCodeRenderOptionsOverrideSchema.parse({ margin: 8 })).toStrictEqual({ margin: 8 });
    });

    it('is still strict about unknown keys', () => {
        expect(QrCodeRenderOptionsOverrideSchema.safeParse({ nope: 1 }).success).toBe(false);
    });
});
