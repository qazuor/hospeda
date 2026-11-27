/**
 * HOS-2658 (spec §9, §11.2): the owner translation routes end to end against the
 * migrated database, for venue AND accommodation.
 *
 * Real: the app, mock-actor auth, the listing-access chain with its real
 * `loadFacts` (ownership), the single writer (transaction + FOR UPDATE), the
 * `translation_meta` JSON, the quota gate and the `ai_usage` rows.
 * Replaced: the AI provider (a stub whose answer the test controls), billing
 * coverage (always covered) and the effective set (the keys and the monthly
 * limit the test declares), so each case states the owner's plan explicitly.
 */
import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { computeTranslationSourceHash } from '@repo/service-core';
import { rehydrateEffectiveSet } from '@repo/verticals';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    onTestFinished,
    vi
} from 'vitest';
import { initApp } from '../../../src/app';
import { env, validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createOwner,
    createVerticalDestination,
    createVerticalListing
} from '../listing-publication/publication-routes.helpers';

const { plan, provider } = vi.hoisted(() => ({
    plan: { keys: [] as string[], monthlyLimit: 100 },
    provider: {
        fail: false,
        /** HOS-2658 AC-19: the engine's moderation verdict the stub reproduces. */
        moderation: null as 'input' | 'output' | null,
        calls: [] as { prompt: string; locale: string }[]
    }
}));

vi.mock('../../../src/services/ai-service.factory.js', async () => {
    const { AiModerationBlockedError } = await import('@repo/ai-core');
    return {
        createConfiguredAiService: async () => ({
            generateText: async (args: { prompt: string; locale: string }) => {
                provider.calls.push({ prompt: args.prompt, locale: args.locale });
                if (provider.fail) throw new Error('stub provider down');
                // The engine boundary: an input block happens before generation (no
                // spend); an output block happens after the provider charged.
                if (provider.moderation === 'input') {
                    throw new AiModerationBlockedError({
                        feature: 'translate',
                        direction: 'input',
                        categories: { hate: true }
                    });
                }
                if (provider.moderation === 'output') {
                    throw new AiModerationBlockedError({
                        feature: 'translate',
                        direction: 'output',
                        categories: { hate: true },
                        spend: {
                            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
                            provider: 'stub',
                            model: 'stub-model'
                        }
                    });
                }
                return {
                    text: `AI (${args.locale})`,
                    usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
                    provider: 'stub',
                    model: 'stub-model',
                    finishReason: 'stop'
                };
            }
        })
    };
});

vi.mock('../../../src/utils/listing-access/ports', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/listing-access/ports')>();
    return {
        ...actual,
        getListingAccessPorts: () => {
            const real = actual.getListingAccessPorts();
            return {
                ...real,
                billing: {
                    ...real.billing,
                    coverage: async () => ({ covered: true, sources: [{ type: 'BASE' }] })
                },
                effectiveSet: async ({
                    userId,
                    vertical
                }: {
                    userId: string;
                    vertical: VerticalEnum;
                }) =>
                    rehydrateEffectiveSet({
                        version: 1,
                        userId,
                        vertical,
                        hasLiveNonTrialTitle: true,
                        inheritsTouristVip: false,
                        entries: [
                            ...plan.keys.map((key) => ({
                                key,
                                value: 1,
                                strategy: 'MAX' as const
                            })),
                            {
                                key: 'max_ai_translate_per_month',
                                value: plan.monthlyLimit,
                                strategy: 'MAX' as const
                            }
                        ]
                    })
            };
        }
    };
});

const app = initApp();
const hash = (text: string): string => computeTranslationSourceHash({ text }).hash;
const EDIT_KEYS = ['edit_accommodation_info', 'edit_venue_info', 'edit_experience_info'];
const ENTITLED = [...EDIT_KEYS, 'ai_translate'];

type Vertical = 'venue' | 'accommodation';
const TABLE: Record<Vertical, string> = { venue: 'venues', accommodation: 'accommodations' };
const BASE: Record<Vertical, string> = {
    venue: '/api/v1/protected/venues',
    accommodation: '/api/v1/protected/accommodations'
};

const owners: string[] = [];

async function seedListing(vertical: Vertical): Promise<{ ownerId: string; id: string }> {
    const owner = await createOwner();
    owners.push(owner.id);
    const id =
        vertical === 'venue'
            ? await createVerticalListing({
                  vertical: VerticalEnum.VENUE,
                  ownerId: owner.id,
                  destinationId: await createVerticalDestination(),
                  status: PublicationStatusEnum.DRAFT,
                  complete: false
              })
            : await createListing({
                  ownerId: owner.id,
                  destinationId: await createVerticalDestination(),
                  status: PublicationStatusEnum.DRAFT,
                  complete: false
              });
    return { ownerId: owner.id, id };
}

async function setRow(
    vertical: Vertical,
    id: string,
    args: { description?: string; descriptionI18n?: unknown; translationMeta?: unknown }
): Promise<void> {
    const table = sql.raw(TABLE[vertical]);
    if (args.description !== undefined) {
        await getDb().execute(
            sql`UPDATE ${table} SET description = ${args.description} WHERE id = ${id}::uuid`
        );
    }
    if (args.descriptionI18n !== undefined) {
        await getDb().execute(
            sql`UPDATE ${table} SET description_i18n = ${JSON.stringify(args.descriptionI18n)}::jsonb WHERE id = ${id}::uuid`
        );
    }
    if (args.translationMeta !== undefined) {
        await getDb().execute(
            sql`UPDATE ${table} SET translation_meta = ${JSON.stringify(args.translationMeta)}::jsonb WHERE id = ${id}::uuid`
        );
    }
}

type StoredRow = {
    description: string;
    description_i18n: Record<string, string> | null;
    summary_i18n: Record<string, string> | null;
    translation_meta: Record<string, Record<string, Record<string, unknown>>> | null;
};

async function readRow(vertical: Vertical, id: string): Promise<StoredRow> {
    const result = await getDb().execute(
        sql`SELECT description, description_i18n, summary_i18n, translation_meta FROM ${sql.raw(TABLE[vertical])} WHERE id = ${id}::uuid`
    );
    return result.rows[0] as StoredRow;
}

async function usageRows(userId: string): Promise<{ feature: string; status: string }[]> {
    const result = await getDb().execute(
        sql`SELECT feature, status FROM ai_usage WHERE user_id = ${userId}::uuid ORDER BY created_at, id`
    );
    return result.rows as { feature: string; status: string }[];
}

async function call(
    method: 'GET' | 'PUT' | 'POST',
    path: string,
    ownerId: string | null,
    body?: unknown
): Promise<Response> {
    return await app.request(path, {
        method,
        headers:
            ownerId === null
                ? { 'content-type': 'application/json', 'user-agent': 'vitest' }
                : actorHeaders({ id: ownerId }),
        body: body === undefined ? undefined : JSON.stringify(body)
    });
}

type Payload = {
    data: {
        fields: {
            field: string;
            locales: Record<'en' | 'pt', { value: string; state: string }>;
        }[];
    };
    error?: { code?: string; reason?: string; details?: Record<string, unknown> };
};

async function json(response: Response): Promise<Payload> {
    return (await response.json()) as Payload;
}

function pairOf(payload: Payload, field: string, locale: 'en' | 'pt') {
    return payload.data.fields.find((entry) => entry.field === field)?.locales[locale];
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});

beforeEach(() => {
    plan.keys = [...ENTITLED];
    plan.monthlyLimit = 100;
    provider.fail = false;
    provider.moderation = null;
    provider.calls.length = 0;
});

afterEach(async () => {
    for (const ownerId of owners.splice(0)) {
        await getDb().execute(sql`DELETE FROM ai_usage WHERE user_id = ${ownerId}::uuid`);
        await getDb().execute(sql`DELETE FROM venues WHERE owner_id = ${ownerId}::uuid`);
        await getDb().execute(sql`DELETE FROM accommodations WHERE owner_id = ${ownerId}::uuid`);
    }
});

afterAll(async () => testDb.teardown());

const SPANISH = 'Una descripcion en espanol suficientemente larga.';

describe.each(['venue', 'accommodation'] as const)('%s translation routes', (vertical) => {
    it('PUT writes one MANUAL pair with the current hash and no ai_usage row (AC-6)', async () => {
        // Arrange
        plan.keys = [...EDIT_KEYS];
        const { ownerId, id } = await seedListing(vertical);
        await setRow(vertical, id, {
            description: SPANISH,
            descriptionI18n: { es: SPANISH, en: 'Old', pt: 'Antigo' }
        });

        // Act
        const res = await call('PUT', `${BASE[vertical]}/${id}/translations`, ownerId, {
            field: 'description',
            locale: 'en',
            value: 'Fixed'
        });

        // Assert
        expect(res.status).toBe(200);
        const row = await readRow(vertical, id);
        expect(row.description_i18n).toEqual({ es: SPANISH, en: 'Fixed', pt: 'Antigo' });
        const meta = row.translation_meta?.description?.en;
        expect(meta).toEqual({
            autoTranslated: false,
            translatedAt: meta?.translatedAt,
            sourceHash: hash(SPANISH)
        });
        expect(typeof meta?.translatedAt).toBe('string');
        expect(await usageRows(ownerId)).toEqual([]);
        expect(provider.calls).toEqual([]);
    });

    it('PUT with an empty value is a manual pair the GET reports as manual (AC-9)', async () => {
        // Arrange
        const { ownerId, id } = await seedListing(vertical);

        // Act
        const res = await call('PUT', `${BASE[vertical]}/${id}/translations`, ownerId, {
            field: 'summary',
            locale: 'pt',
            value: ''
        });
        const state = await json(
            await call('GET', `${BASE[vertical]}/${id}/translations`, ownerId)
        );

        // Assert
        expect(res.status).toBe(200);
        const row = await readRow(vertical, id);
        expect(row.summary_i18n?.pt).toBe('');
        expect(row.translation_meta?.summary?.pt?.autoTranslated).toBe(false);
        expect(pairOf(state, 'summary', 'pt')).toEqual({
            value: '',
            state: 'manual',
            translatedAt: row.translation_meta?.summary?.pt?.translatedAt
        });
    });

    it('PUT answers 400 for locale es, an unknown field and an over-long value, writing nothing (AC-10)', async () => {
        // Arrange
        const { ownerId, id } = await seedListing(vertical);
        const before = await readRow(vertical, id);
        const path = `${BASE[vertical]}/${id}/translations`;

        // Act
        const responses = await Promise.all([
            call('PUT', path, ownerId, { field: 'name', locale: 'es', value: 'x' }),
            call('PUT', path, ownerId, { field: 'nope', locale: 'en', value: 'x' }),
            call('PUT', path, ownerId, { field: 'name', locale: 'en', value: 'x'.repeat(5000) })
        ]);

        // Assert
        for (const res of responses) {
            expect(res.status).toBe(400);
            expect((await json(res)).error?.code).toBe('VALIDATION_ERROR');
        }
        expect(await readRow(vertical, id)).toEqual(before);
    });

    it('a stale manual pair saved again gets the current hash and reads manual (AC-12)', async () => {
        // Arrange
        const { ownerId, id } = await seedListing(vertical);
        await setRow(vertical, id, {
            description: SPANISH,
            descriptionI18n: { es: SPANISH, en: 'Mine', pt: '' },
            translationMeta: {
                description: {
                    en: {
                        autoTranslated: false,
                        translatedAt: '2026-01-01T00:00:00.000Z',
                        sourceHash: hash('old spanish')
                    }
                }
            }
        });
        const path = `${BASE[vertical]}/${id}/translations`;
        const before = await json(await call('GET', path, ownerId));

        // Act
        await call('PUT', path, ownerId, { field: 'description', locale: 'en', value: 'Mine' });
        const after = await json(await call('GET', path, ownerId));

        // Assert
        expect(pairOf(before, 'description', 'en')?.state).toBe('stale');
        expect(pairOf(after, 'description', 'en')?.state).toBe('manual');
        expect((await readRow(vertical, id)).translation_meta?.description?.en?.sourceHash).toBe(
            hash(SPANISH)
        );
    });

    it('POST ai regenerates only the requested MANUAL pair and meters one success row (AC-16)', async () => {
        // Arrange
        const { ownerId, id } = await seedListing(vertical);
        const manualPt = {
            autoTranslated: false,
            translatedAt: '2026-01-01T00:00:00.000Z',
            sourceHash: hash(SPANISH)
        };
        await setRow(vertical, id, {
            description: SPANISH,
            descriptionI18n: { es: SPANISH, en: 'Mine', pt: 'Meu' },
            translationMeta: {
                description: { en: { ...manualPt }, pt: manualPt }
            }
        });

        // Act
        const res = await call('POST', `${BASE[vertical]}/${id}/translations/ai`, ownerId, {
            field: 'description',
            locales: ['en']
        });

        // Assert
        expect(res.status).toBe(200);
        expect(pairOf(await json(res), 'description', 'en')?.state).toBe('auto');
        const row = await readRow(vertical, id);
        expect(row.description_i18n).toEqual({ es: SPANISH, en: 'AI (en)', pt: 'Meu' });
        const en = row.translation_meta?.description?.en;
        expect(en).toEqual({
            autoTranslated: true,
            translatedAt: en?.translatedAt,
            provider: 'stub',
            model: 'stub-model',
            sourceHash: hash(SPANISH)
        });
        expect(row.translation_meta?.description?.pt).toEqual(manualPt);
        expect(provider.calls.map((entry) => entry.locale)).toEqual(['en']);
        expect(await usageRows(ownerId)).toEqual([{ feature: 'translate', status: 'success' }]);
    });

    it('POST ai without ai_translate answers 403 ENTITLEMENT_REQUIRED and writes nothing (AC-17)', async () => {
        // Arrange
        plan.keys = [...EDIT_KEYS];
        const { ownerId, id } = await seedListing(vertical);
        await setRow(vertical, id, { description: SPANISH });
        const before = await readRow(vertical, id);

        // Act
        const res = await call('POST', `${BASE[vertical]}/${id}/translations/ai`, ownerId, {
            field: 'description'
        });

        // Assert
        expect(res.status).toBe(403);
        const body = await json(res);
        expect(body.error?.code).toBe('ENTITLEMENT_REQUIRED');
        expect(body.error?.details).toEqual({ entitlementKey: 'ai_translate' });
        expect(await readRow(vertical, id)).toEqual(before);
        expect(provider.calls).toEqual([]);
        expect(await usageRows(ownerId)).toEqual([]);
    });

    it('POST ai at the monthly limit answers 403 LIMIT_REACHED with one quota_exceeded row (AC-18)', async () => {
        // Arrange
        plan.monthlyLimit = 1;
        const { ownerId, id } = await seedListing(vertical);
        await setRow(vertical, id, { description: SPANISH });
        await getDb().execute(
            sql`INSERT INTO ai_usage (id, user_id, feature, provider, model, tokens_in, tokens_out, cost_estimate_micro_usd, latency_ms, status)
                VALUES (${randomUUID()}::uuid, ${ownerId}::uuid, 'translate', 'stub', 'stub-model', 1, 1, 0, 1, 'success')`
        );
        const before = await readRow(vertical, id);

        // Act
        const res = await call('POST', `${BASE[vertical]}/${id}/translations/ai`, ownerId, {
            field: 'description'
        });

        // Assert
        expect(res.status).toBe(403);
        const body = await json(res);
        expect(body.error?.code).toBe('LIMIT_REACHED');
        expect(body.error?.details).toEqual({
            limitKey: 'max_ai_translate_per_month',
            currentCount: 1,
            maxAllowed: 1
        });
        expect(await usageRows(ownerId)).toEqual([
            { feature: 'translate', status: 'success' },
            { feature: 'translate', status: 'quota_exceeded' }
        ]);
        expect(await readRow(vertical, id)).toEqual(before);
        expect(provider.calls).toEqual([]);
    });

    it('POST ai with every provider call failing answers 502 and keeps a MANUAL pair (AC-19)', async () => {
        // Arrange
        provider.fail = true;
        const { ownerId, id } = await seedListing(vertical);
        await setRow(vertical, id, {
            description: SPANISH,
            descriptionI18n: { es: SPANISH, en: 'Mine', pt: '' },
            translationMeta: {
                description: {
                    en: {
                        autoTranslated: false,
                        translatedAt: '2026-01-01T00:00:00.000Z',
                        sourceHash: hash(SPANISH)
                    }
                }
            }
        });
        const before = await readRow(vertical, id);

        // Act
        const res = await call('POST', `${BASE[vertical]}/${id}/translations/ai`, ownerId, {
            field: 'description',
            locales: ['en']
        });

        // Assert
        expect(res.status).toBe(502);
        expect((await json(res)).error?.code).toBe('PROVIDER_ERROR');
        expect(await readRow(vertical, id)).toEqual(before);
        expect(provider.calls.length).toBeGreaterThan(0);
        expect((await usageRows(ownerId)).filter((usage) => usage.status === 'success')).toEqual(
            []
        );
    });

    it('POST ai whose paid provider answer is rejected answers 502, keeps the MANUAL pair and meters one error row (AC-19)', async () => {
        // Arrange: the stub answer drops the URL placeholder, so the provider call is
        // billed but its output is refused before anything is written.
        const withUrl = 'Mira la carta en https://hospeda.example/carta antes de venir.';
        const { ownerId, id } = await seedListing(vertical);
        await setRow(vertical, id, {
            description: withUrl,
            descriptionI18n: { es: withUrl, en: 'Mine', pt: '' },
            translationMeta: {
                description: {
                    en: {
                        autoTranslated: false,
                        translatedAt: '2026-01-01T00:00:00.000Z',
                        sourceHash: hash(withUrl)
                    }
                }
            }
        });
        const before = await readRow(vertical, id);

        // Act
        const res = await call('POST', `${BASE[vertical]}/${id}/translations/ai`, ownerId, {
            field: 'description',
            locales: ['en']
        });

        // Assert
        expect(res.status).toBe(502);
        expect((await json(res)).error?.code).toBe('PROVIDER_ERROR');
        expect(await readRow(vertical, id)).toEqual(before);
        expect(provider.calls.map((callArgs) => callArgs.locale)).toEqual(['en']);
        const usage = await getDb().execute(
            sql`SELECT feature, status, provider, model, tokens_in, tokens_out FROM ai_usage WHERE user_id = ${ownerId}::uuid`
        );
        expect(usage.rows).toEqual([
            {
                feature: 'translate',
                status: 'error',
                provider: 'stub',
                model: 'stub-model',
                tokens_in: 20,
                tokens_out: 10
            }
        ]);
    });

    it('POST ai whose OUTPUT moderation blocked a paid generation answers 502, keeps the MANUAL pair and meters one error row (AC-19)', async () => {
        // Arrange
        provider.moderation = 'output';
        const { ownerId, id } = await seedListing(vertical);
        await setRow(vertical, id, {
            description: SPANISH,
            descriptionI18n: { es: SPANISH, en: 'Mine', pt: '' },
            translationMeta: {
                description: {
                    en: {
                        autoTranslated: false,
                        translatedAt: '2026-01-01T00:00:00.000Z',
                        sourceHash: hash(SPANISH)
                    }
                }
            }
        });
        const before = await readRow(vertical, id);

        // Act
        const res = await call('POST', `${BASE[vertical]}/${id}/translations/ai`, ownerId, {
            field: 'description',
            locales: ['en']
        });

        // Assert
        expect(res.status).toBe(502);
        expect((await json(res)).error?.code).toBe('PROVIDER_ERROR');
        expect(await readRow(vertical, id)).toEqual(before);
        expect(provider.calls.map((callArgs) => callArgs.locale)).toEqual(['en']);
        const usage = await getDb().execute(
            sql`SELECT feature, status, provider, model, tokens_in, tokens_out FROM ai_usage WHERE user_id = ${ownerId}::uuid`
        );
        expect(usage.rows).toEqual([
            {
                feature: 'translate',
                status: 'error',
                provider: 'stub',
                model: 'stub-model',
                tokens_in: 20,
                tokens_out: 10
            }
        ]);
    });

    it('POST ai whose INPUT moderation blocked before the provider answers 502 and meters nothing (AC-19)', async () => {
        // Arrange
        provider.moderation = 'input';
        const { ownerId, id } = await seedListing(vertical);
        await setRow(vertical, id, {
            description: SPANISH,
            descriptionI18n: { es: SPANISH, en: 'Mine', pt: '' }
        });
        const before = await readRow(vertical, id);

        // Act
        const res = await call('POST', `${BASE[vertical]}/${id}/translations/ai`, ownerId, {
            field: 'description',
            locales: ['en']
        });

        // Assert
        expect(res.status).toBe(502);
        expect((await json(res)).error?.code).toBe('PROVIDER_ERROR');
        expect(await readRow(vertical, id)).toEqual(before);
        expect(await usageRows(ownerId)).toEqual([]);
    });

    it('POST ai on an empty Spanish source answers 400 with details.reason NO_SOURCE_TEXT, debug off (AC-20)', async () => {
        // Arrange: production shape — debug errors off, so `details` is public only
        // through the narrow NO_SOURCE_TEXT exception of handleRouteError.
        const debugBefore = env.HOSPEDA_API_DEBUG_ERRORS;
        env.HOSPEDA_API_DEBUG_ERRORS = false;
        onTestFinished(() => {
            env.HOSPEDA_API_DEBUG_ERRORS = debugBefore;
        });
        const { ownerId, id } = await seedListing(vertical);
        await getDb().execute(
            sql`UPDATE ${sql.raw(TABLE[vertical])} SET rich_description = '' WHERE id = ${id}::uuid`
        );
        plan.keys = [...ENTITLED, 'can_use_rich_description'];

        // Act
        const res = await call('POST', `${BASE[vertical]}/${id}/translations/ai`, ownerId, {
            field: 'richDescription'
        });

        // Assert
        expect(res.status).toBe(400);
        const body = await json(res);
        expect(body.error?.code).toBe('VALIDATION_ERROR');
        expect(body.error?.details).toEqual({ reason: 'NO_SOURCE_TEXT' });
        expect(body.error?.reason).toBe('NO_SOURCE_TEXT');
        expect(provider.calls).toEqual([]);
    });

    it('richDescription is omitted and its writes answer 403 without can_use_rich_description (AC-23)', async () => {
        // Arrange
        const { ownerId, id } = await seedListing(vertical);
        const path = `${BASE[vertical]}/${id}/translations`;

        // Act
        const state = await json(await call('GET', path, ownerId));
        const put = await call('PUT', path, ownerId, {
            field: 'richDescription',
            locale: 'en',
            value: 'Rich'
        });
        plan.keys = [...ENTITLED, 'can_use_rich_description'];
        const allowedState = await json(await call('GET', path, ownerId));
        const allowedPut = await call('PUT', path, ownerId, {
            field: 'richDescription',
            locale: 'en',
            value: 'Rich'
        });

        // Assert
        expect(state.data.fields.map((entry) => entry.field)).not.toContain('richDescription');
        expect(put.status).toBe(403);
        expect((await json(put)).error?.code).toBe('ENTITLEMENT_REQUIRED');
        expect(allowedState.data.fields.map((entry) => entry.field)).toContain('richDescription');
        expect(allowedPut.status).toBe(200);
    });

    it('a foreign listing answers 404 on the three endpoints, a bad id 400, no session 401 (AC-24)', async () => {
        // Arrange
        const { id } = await seedListing(vertical);
        const stranger = await createOwner();
        owners.push(stranger.id);
        const path = `${BASE[vertical]}/${id}/translations`;

        // Act
        const statuses = [
            (await call('GET', path, stranger.id)).status,
            (
                await call('PUT', path, stranger.id, {
                    field: 'name',
                    locale: 'en',
                    value: 'x'
                })
            ).status,
            (await call('POST', `${path}/ai`, stranger.id, { field: 'name' })).status,
            (await call('GET', `${BASE[vertical]}/not-a-uuid/translations`, stranger.id)).status,
            (await call('GET', path, null)).status
        ];

        // Assert
        expect(statuses).toEqual([404, 404, 404, 400, 401]);
        expect(provider.calls).toEqual([]);
    });
});
