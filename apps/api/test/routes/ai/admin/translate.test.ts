/**
 * Tests for the admin AI translate route's `pointOfInterest` support
 * (HOS-143 T-013 / spec §6.5 "AI-translate admin extension" / AC-8).
 *
 * Strategy: hybrid pattern mirroring `test/routes/ai/admin/post-generate.test.ts`
 * (SPEC-223 T-008) adapted for a DB-backed route:
 *
 * - `adminAuthMiddleware` is stubbed to a pass-through that sets a minimal
 *   `Actor` in context, so the route never 401/403s and `getActorFromContext`
 *   resolves.
 * - `createConfiguredAiService` is stubbed with a `generateText` that records
 *   calls and returns a locale-keyed translated string.
 * - `@repo/db` is stubbed with a controllable single-row `getDb()` — the same
 *   canned row answers both the `loadTranslatableFields` read and the
 *   `persistTranslations` merge-read, and the `update().set()` call is
 *   captured so the persisted `nameI18n`/`descriptionI18n`/`translationMeta`
 *   shape can be asserted directly (AC-8: "... persists via the same
 *   persistTranslations path").
 * - `@repo/db/schemas` is stubbed with a `pointsOfInterest` table object (POI
 *   has no plain `name` column — HOS-138 — only `nameI18n`; this exercises the
 *   `loadTranslatableFields` fallback added alongside this test).
 * - `create-app.ts` is stubbed to a minimal `OpenAPIHono`, matching the
 *   `post-generate.test.ts` precedent (avoids pulling in the full middleware
 *   chain not needed for a route-level test).
 *
 * @module apps/api/test/routes/ai/admin/translate
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before importing the route module)
// ---------------------------------------------------------------------------

/** Captured `generateText` invocations from the stub AiService. */
const { generateTextCalls } = vi.hoisted(() => ({
    generateTextCalls: [] as Array<{ feature: string; prompt: string; locale: string }>
}));

/** Mutable single-row DB state shared by every mocked `getDb()` call. */
const { dbState } = vi.hoisted(() => ({
    dbState: {
        row: {
            id: '55555555-5555-4555-8555-555555555555',
            nameI18n: { es: 'Puente Internacional Gral. Artigas', en: '', pt: '' },
            descriptionI18n: { es: 'Une Concepción del Uruguay con Paysandú', en: '', pt: '' },
            description: 'Une Concepción del Uruguay con Paysandú',
            translationMeta: {}
        } as Record<string, unknown> | null,
        updateSetCalls: [] as Array<Record<string, unknown>>
    }
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

/**
 * Admin auth middleware: pass-through that sets a minimal `Actor` in context
 * so the route neither 401/403s nor throws on `getActorFromContext`.
 */
vi.mock('../../../../src/middlewares/authorization', () => ({
    adminAuthMiddleware:
        () =>
        async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
            c.set('actor', { id: 'admin-test-id', roles: ['SUPER_ADMIN'], permissions: [] });
            await next();
        }
}));

/**
 * AI service factory: returns a stub `AiService` with a configurable
 * `generateText` that records calls and returns a locale-keyed translation.
 */
vi.mock('../../../../src/services/ai-service.factory.js', () => ({
    createConfiguredAiService: async () => ({
        generateText: async (args: { feature: string; prompt: string; locale: string }) => {
            generateTextCalls.push(args);
            return {
                text: `Translated (${args.locale})`,
                usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
        }
    })
}));

/** Logger: silence all output in tests. */
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

/**
 * `@repo/db` — a single controllable row answers every `select()...limit(1)`
 * call (both `loadTranslatableFields` and `persistTranslations`'s merge
 * read); `update().set()` is captured for assertion.
 */
vi.mock('@repo/db', () => {
    const rows = () => Promise.resolve(dbState.row ? [dbState.row] : []);
    const db = {
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: vi.fn(rows),
                    // HOS-2658: the single writer reads the row FOR UPDATE.
                    for: vi.fn(rows)
                }))
            }))
        })),
        update: vi.fn(() => ({
            set: vi.fn((setArg: Record<string, unknown>) => {
                dbState.updateSetCalls.push(setArg);
                return { where: vi.fn().mockResolvedValue(undefined) };
            })
        })),
        transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db))
    };
    return { getDb: vi.fn(() => db) };
});

/**
 * `@repo/db/schemas` — POI (HOS-138) has no plain `name` column, only
 * `nameI18n`; `description` is a plain column alongside `descriptionI18n`.
 * The mocked `select`/`update` chain above ignores column identities, so
 * placeholder values are sufficient here.
 */
vi.mock('@repo/db/schemas', () => ({
    accommodations: { id: 'id', deletedAt: 'deleted_at', translationMeta: 'translation_meta' },
    destinations: { id: 'id', deletedAt: 'deleted_at', translationMeta: 'translation_meta' },
    events: { id: 'id', deletedAt: 'deleted_at', translationMeta: 'translation_meta' },
    posts: { id: 'id', deletedAt: 'deleted_at', translationMeta: 'translation_meta' },
    pointsOfInterest: {
        id: 'id',
        deletedAt: 'deleted_at',
        translationMeta: 'translation_meta',
        nameI18n: 'name_i18n',
        descriptionI18n: 'description_i18n'
    },
    // HOS-2658: venue and experience are admin-translatable (AC-30, AC-31).
    venues: { id: 'id', deletedAt: 'deleted_at', translationMeta: 'translation_meta' },
    experiences: { id: 'id', deletedAt: 'deleted_at', translationMeta: 'translation_meta' }
}));

/**
 * HOS-2658 AC-31: the admin route is unmetered. The quota gate is spied so a
 * test can prove it is never reached from here.
 */
const { quotaSpies } = vi.hoisted(() => ({
    quotaSpies: { enforceAiQuota: vi.fn(), evaluateAiQuota: vi.fn() }
}));
vi.mock('../../../../src/utils/listing-access/ai-quota-gate', () => quotaSpies);

/**
 * `create-app.ts` transitively imports a large middleware chain. The route
 * only needs `createRouter` — stub it with a minimal `OpenAPIHono` instance
 * (same pattern as `post-generate.test.ts`).
 */
vi.mock('../../../../src/utils/create-app', () => {
    const { OpenAPIHono } = require('@hono/zod-openapi');
    return {
        createRouter: () => new OpenAPIHono()
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks are hoisted)
// ---------------------------------------------------------------------------

import { computeTranslationSourceHash } from '@repo/service-core';
import { adminAiTranslateRoute } from '../../../../src/routes/ai/admin/translate.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const POI_ENTITY_ID = '55555555-5555-4555-8555-555555555555';

const POST = (body: unknown) =>
    adminAiTranslateRoute.request('/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body)
    });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin AI translate route — pointOfInterest (HOS-143 T-013 / AC-8)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        generateTextCalls.length = 0;
        dbState.updateSetCalls.length = 0;
        dbState.row = {
            id: POI_ENTITY_ID,
            nameI18n: { es: 'Puente Internacional Gral. Artigas', en: '', pt: '' },
            descriptionI18n: { es: 'Une Concepción del Uruguay con Paysandú', en: '', pt: '' },
            description: 'Une Concepción del Uruguay con Paysandú',
            translationMeta: {}
        };
    });

    it('returns 200 and translates nameI18n/descriptionI18n into the missing locales', async () => {
        const res = await POST({
            entityType: 'pointOfInterest',
            entityId: POI_ENTITY_ID,
            sourceLocale: 'es'
        });

        expect(res.status).toBe(200);

        const body = (await res.json()) as {
            success: boolean;
            data: {
                entityId: string;
                translations: Array<{ fieldType: string; locale: string; success: boolean }>;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.entityId).toBe(POI_ENTITY_ID);

        // 2 translatable fields (name, description) × 2 missing locales (en, pt).
        expect(body.data.translations).toHaveLength(4);
        expect(body.data.translations.every((t) => t.success)).toBe(true);

        const fieldTypes = new Set(body.data.translations.map((t) => t.fieldType));
        expect(fieldTypes).toEqual(new Set(['name', 'description']));

        const locales = new Set(body.data.translations.map((t) => t.locale));
        expect(locales).toEqual(new Set(['en', 'pt']));
    });

    it('resolves `name` from nameI18n.es (POI has no plain name column) before calling the AI engine', async () => {
        await POST({
            entityType: 'pointOfInterest',
            entityId: POI_ENTITY_ID,
            sourceLocale: 'es'
        });

        // Every recorded prompt is built from the source field values; the
        // Spanish POI name (resolved via the nameI18n fallback, not a plain
        // column) must reach the engine call.
        const namePrompts = generateTextCalls.filter((call) =>
            call.prompt.includes('Puente Internacional Gral. Artigas')
        );
        expect(namePrompts.length).toBeGreaterThan(0);
    });

    it('persists the translated values via persistTranslations (same path as the other 4 entities)', async () => {
        await POST({
            entityType: 'pointOfInterest',
            entityId: POI_ENTITY_ID,
            sourceLocale: 'es'
        });

        expect(dbState.updateSetCalls).toHaveLength(1);
        const setArg = dbState.updateSetCalls[0] as Record<string, unknown>;

        const nameI18n = setArg.nameI18n as { es: string; en: string; pt: string };
        expect(nameI18n.es).toBe('Puente Internacional Gral. Artigas');
        expect(nameI18n.en).toBe('Translated (en)');
        expect(nameI18n.pt).toBe('Translated (pt)');

        const descriptionI18n = setArg.descriptionI18n as { es: string; en: string; pt: string };
        expect(descriptionI18n.es).toBe('Une Concepción del Uruguay con Paysandú');
        expect(descriptionI18n.en).toBe('Translated (en)');
        expect(descriptionI18n.pt).toBe('Translated (pt)');

        const meta = setArg.translationMeta as Record<
            string,
            Record<string, { autoTranslated: boolean }>
        >;
        expect(meta.name?.en?.autoTranslated).toBe(true);
        expect(meta.name?.pt?.autoTranslated).toBe(true);
        expect(meta.description?.en?.autoTranslated).toBe(true);
        expect(meta.description?.pt?.autoTranslated).toBe(true);
    });

    it('returns 404 NOT_FOUND when the POI does not exist', async () => {
        dbState.row = null;

        const res = await POST({
            entityType: 'pointOfInterest',
            entityId: '99999999-9999-4999-8999-999999999999',
            sourceLocale: 'es'
        });

        expect(res.status).toBe(404);
        const body = (await res.json()) as { success: boolean; error: { code: string } };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 VALIDATION_ERROR when entityType is not a recognized value', async () => {
        const res = await POST({
            entityType: 'not_a_real_entity',
            entityId: POI_ENTITY_ID
        });

        expect(res.status).toBe(400);
        const body = (await res.json()) as { success: boolean; error: { code: string } };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });
});

// ---------------------------------------------------------------------------
// HOS-2658 — venue and experience (AC-30, AC-31)
// ---------------------------------------------------------------------------

const VENUE_ID = '66666666-6666-4666-8666-666666666666';
const EXPERIENCE_ID = '77777777-7777-4777-8777-777777777777';
const MANUAL_META = { autoTranslated: false, translatedAt: '2026-01-01T00:00:00.000Z' } as const;

const PUT_OVERRIDE = (body: unknown) =>
    adminAiTranslateRoute.request('/override', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });

const hashOf = (text: string) => computeTranslationSourceHash({ text }).hash;

describe('admin AI translate route — venue and experience (HOS-2658)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        generateTextCalls.length = 0;
        dbState.updateSetCalls.length = 0;
        dbState.row = {
            id: VENUE_ID,
            ownerId: 'owner-1',
            name: 'La Parrilla del Puerto',
            summary: null,
            description: null,
            richDescription: null,
            nameI18n: { es: 'La Parrilla del Puerto', en: '', pt: '' },
            summaryI18n: null,
            descriptionI18n: null,
            richDescriptionI18n: null,
            entryNoteI18n: { es: 'Gratis hasta la 1', en: '', pt: '' },
            translationMeta: { name: { en: MANUAL_META } }
        };
    });

    it('override on a venue entryNote writes a MANUAL pair with the source hash (AC-30)', async () => {
        // Act
        const res = await PUT_OVERRIDE({
            entityType: 'venue',
            entityId: VENUE_ID,
            locale: 'en',
            fieldType: 'entryNote',
            value: 'Free until 1am'
        });

        // Assert
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            success: true,
            data: { entityType: 'venue', entityId: VENUE_ID, fieldType: 'entryNote', locale: 'en' }
        });
        expect(dbState.updateSetCalls).toHaveLength(1);
        const setArg = dbState.updateSetCalls[0] as Record<string, unknown>;
        expect(setArg.entryNoteI18n).toEqual({
            es: 'Gratis hasta la 1',
            en: 'Free until 1am',
            pt: ''
        });
        expect(setArg.translationMeta).toEqual({
            name: { en: MANUAL_META },
            entryNote: {
                en: {
                    autoTranslated: false,
                    translatedAt: expect.any(String),
                    sourceHash: hashOf('Gratis hasta la 1')
                }
            }
        });
        expect(quotaSpies.enforceAiQuota).not.toHaveBeenCalled();
    });

    it('override on an experience name writes a MANUAL pair with the source hash (AC-30)', async () => {
        // Arrange
        dbState.row = {
            id: EXPERIENCE_ID,
            name: 'Paseo en kayak',
            nameI18n: { es: 'Paseo en kayak', en: '', pt: '' },
            translationMeta: {}
        };

        // Act
        const res = await PUT_OVERRIDE({
            entityType: 'experience',
            entityId: EXPERIENCE_ID,
            locale: 'pt',
            fieldType: 'name',
            value: 'Passeio de caiaque'
        });

        // Assert
        expect(res.status).toBe(200);
        const setArg = dbState.updateSetCalls[0] as Record<string, unknown>;
        expect(setArg.nameI18n).toEqual({ es: 'Paseo en kayak', en: '', pt: 'Passeio de caiaque' });
        expect(setArg.translationMeta).toEqual({
            name: {
                pt: {
                    autoTranslated: false,
                    translatedAt: expect.any(String),
                    sourceHash: hashOf('Paseo en kayak')
                }
            }
        });
    });

    it('translate on a venue persists AUTOMATIC pairs with sourceHash, skips the MANUAL pair and never touches the quota (AC-31)', async () => {
        // Act
        const res = await POST({ entityType: 'venue', entityId: VENUE_ID, sourceLocale: 'es' });

        // Assert
        expect(res.status).toBe(200);
        expect(dbState.updateSetCalls).toHaveLength(1);
        const setArg = dbState.updateSetCalls[0] as Record<string, unknown>;
        // name.en is MANUAL (empty on purpose): kept empty, meta byte-for-byte.
        expect(setArg.nameI18n).toEqual({
            es: 'La Parrilla del Puerto',
            en: '',
            pt: 'Translated (pt)'
        });
        expect(setArg.entryNoteI18n).toEqual({
            es: 'Gratis hasta la 1',
            en: 'Translated (en)',
            pt: 'Translated (pt)'
        });
        const auto = (source: string) => ({
            autoTranslated: true,
            translatedAt: expect.any(String),
            provider: 'stub',
            model: 'stub-model',
            sourceHash: hashOf(source)
        });
        expect(setArg.translationMeta).toEqual({
            name: { en: MANUAL_META, pt: auto('La Parrilla del Puerto') },
            entryNote: { en: auto('Gratis hasta la 1'), pt: auto('Gratis hasta la 1') }
        });
        expect(quotaSpies.enforceAiQuota).not.toHaveBeenCalled();
        expect(quotaSpies.evaluateAiQuota).not.toHaveBeenCalled();
        // The empty MANUAL name.en is skipped BEFORE the provider: no paid call for it.
        expect(
            generateTextCalls.map((call) => ({
                locale: call.locale,
                name: call.prompt.includes('La Parrilla del Puerto')
            }))
        ).toEqual([
            { locale: 'pt', name: true },
            { locale: 'en', name: false },
            { locale: 'pt', name: false }
        ]);
    });

    it('translate on an experience never sends an empty MANUAL pair to the provider (AC-31)', async () => {
        // Arrange
        dbState.row = {
            id: EXPERIENCE_ID,
            name: 'Paseo en kayak',
            nameI18n: { es: 'Paseo en kayak', en: '', pt: '' },
            translationMeta: { name: { en: MANUAL_META, pt: MANUAL_META } }
        };

        // Act
        const res = await POST({
            entityType: 'experience',
            entityId: EXPERIENCE_ID,
            sourceLocale: 'es'
        });

        // Assert
        expect(res.status).toBe(200);
        expect(generateTextCalls).toEqual([]);
        expect(dbState.updateSetCalls).toEqual([]);
        expect(quotaSpies.enforceAiQuota).not.toHaveBeenCalled();
    });

    it('rejects venue on the batch route (batch enum unchanged) with 400', async () => {
        // Act
        const res = await adminAiTranslateRoute.request('/batch', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ entityType: 'venue' })
        });

        // Assert
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' }
        });
    });
});
