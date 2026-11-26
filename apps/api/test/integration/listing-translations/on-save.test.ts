/**
 * HOS-2658 (spec §11.2): on-save translation through the REAL owner PATCH routes of
 * the three verticals, against the migrated database.
 *
 * The production adapter (`createTranslationServiceAdapter`) is registered wrapped
 * in a recorder that keeps each fire-and-forget promise, so a test awaits the run
 * the PATCH started instead of sleeping. Replaced, as in the routes suite: the AI
 * provider (stub), billing coverage (covered) and the effective set (declared per
 * test).
 */
import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import {
    _resetTranslationService,
    computeTranslationSourceHash,
    initializeTranslationService
} from '@repo/service-core';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as backfill from '../../../../../packages/seed/src/data-migrations/0197-hos-2658-venue-experience-translation-meta';
import type { SeedMigrationCtx } from '../../../../../packages/seed/src/data-migrations/types';
import { initApp } from '../../../src/app';
import { createTranslationServiceAdapter } from '../../../src/services/translation-service.adapter';
import { validateApiEnv } from '../../../src/utils/env';
import { apiLogger } from '../../../src/utils/logger';
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
    provider: { fail: false, calls: [] as { prompt: string; locale: string }[] }
}));

vi.mock('../../../src/services/ai-service.factory.js', () => ({
    createConfiguredAiService: async () => ({
        generateText: async (args: { prompt: string; locale: string }) => {
            provider.calls.push({ prompt: args.prompt, locale: args.locale });
            if (provider.fail) throw new Error('stub provider down');
            return {
                text: `AI (${args.locale})`,
                usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
        }
    })
}));

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
const pending: Promise<void>[] = [];
const hash = (text: string): string => computeTranslationSourceHash({ text }).hash;
const BASE_KEYS = ['edit_accommodation_info', 'edit_venue_info', 'edit_experience_info'];
const ENTITLED = [...BASE_KEYS, 'ai_translate'];

type Vertical = 'venue' | 'accommodation' | 'experience';
const TABLE: Record<Vertical, string> = {
    venue: 'venues',
    accommodation: 'accommodations',
    experience: 'experiences'
};
const BASE: Record<Vertical, string> = {
    venue: '/api/v1/protected/venues',
    accommodation: '/api/v1/protected/accommodations',
    experience: '/api/v1/protected/experiences'
};

const owners: string[] = [];

/** Owner headers carrying the edit-own permission of every listing vertical. */
const ownerHeaders = (id: string): Record<string, string> =>
    actorHeaders({
        id,
        permissions: [
            PermissionEnum.ACCOMMODATION_UPDATE_OWN,
            PermissionEnum.VENUE_EDIT_OWN,
            PermissionEnum.EXPERIENCE_EDIT_OWN
        ]
    });

async function seedListing(vertical: Vertical): Promise<{ ownerId: string; id: string }> {
    const owner = await createOwner();
    owners.push(owner.id);
    const destinationId = await createVerticalDestination();
    const id =
        vertical === 'accommodation'
            ? await createListing({
                  ownerId: owner.id,
                  destinationId,
                  status: PublicationStatusEnum.DRAFT,
                  complete: false
              })
            : await createVerticalListing({
                  vertical: vertical === 'venue' ? VerticalEnum.VENUE : VerticalEnum.EXPERIENCE,
                  ownerId: owner.id,
                  destinationId,
                  status: PublicationStatusEnum.DRAFT,
                  complete: false
              });
    return { ownerId: owner.id, id };
}

async function setColumns(
    vertical: Vertical,
    id: string,
    columns: Readonly<Record<string, unknown>>
): Promise<void> {
    for (const [column, value] of Object.entries(columns)) {
        const encoded = typeof value === 'string' ? value : JSON.stringify(value);
        const cast = typeof value === 'string' ? sql`` : sql`::jsonb`;
        await getDb().execute(
            sql`UPDATE ${sql.raw(TABLE[vertical])} SET ${sql.raw(column)} = ${encoded}${cast} WHERE id = ${id}::uuid`
        );
    }
}

type Row = Record<string, unknown> & {
    translation_meta: Record<string, Record<string, Record<string, unknown>>> | null;
};

async function readRow(vertical: Vertical, id: string, columns: readonly string[]): Promise<Row> {
    const result = await getDb().execute(
        sql`SELECT ${sql.raw([...columns, 'translation_meta'].join(', '))} FROM ${sql.raw(TABLE[vertical])} WHERE id = ${id}::uuid`
    );
    return result.rows[0] as Row;
}

async function usageRows(userId: string): Promise<{ feature: string; status: string }[]> {
    const result = await getDb().execute(
        sql`SELECT feature, status FROM ai_usage WHERE user_id = ${userId}::uuid ORDER BY created_at, id`
    );
    return result.rows as { feature: string; status: string }[];
}

/** PATCHes the listing and waits for the on-save run it started. */
async function patchAndSettle(
    vertical: Vertical,
    id: string,
    ownerId: string,
    body: Readonly<Record<string, unknown>>
): Promise<number> {
    const res = await app.request(`${BASE[vertical]}/${id}`, {
        method: 'PATCH',
        headers: ownerHeaders(ownerId),
        body: JSON.stringify(body)
    });
    const status = res.status;
    if (status !== 200) {
        throw new Error(`PATCH ${vertical} answered ${status}: ${await res.text()}`);
    }
    await Promise.all(pending.splice(0));
    return status;
}

async function pairState(
    vertical: Vertical,
    id: string,
    ownerId: string,
    field: string
): Promise<Record<'en' | 'pt', string | undefined>> {
    const res = await app.request(`${BASE[vertical]}/${id}/translations`, {
        headers: ownerHeaders(ownerId)
    });
    const body = (await res.json()) as {
        data: { fields: { field: string; locales: Record<'en' | 'pt', { state: string }> }[] };
    };
    const entry = body.data.fields.find((candidate) => candidate.field === field);
    return { en: entry?.locales.en.state, pt: entry?.locales.pt.state };
}

const autoMeta = (source: string, translatedAt: unknown) => ({
    autoTranslated: true,
    translatedAt,
    provider: 'stub',
    model: 'stub-model',
    sourceHash: hash(source)
});

const MANUAL = (source: string) => ({
    autoTranslated: false,
    translatedAt: '2026-01-01T00:00:00.000Z',
    sourceHash: hash(source)
});

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    const adapter = createTranslationServiceAdapter();
    _resetTranslationService();
    initializeTranslationService({
        translate: (input) => {
            const run = adapter.translate(input);
            pending.push(run);
            return run;
        }
    });
});

beforeEach(() => {
    plan.keys = [...ENTITLED];
    plan.monthlyLimit = 100;
    provider.fail = false;
    provider.calls.length = 0;
    pending.length = 0;
});

afterEach(async () => {
    vi.restoreAllMocks();
    for (const ownerId of owners.splice(0)) {
        await getDb().execute(sql`DELETE FROM ai_usage WHERE user_id = ${ownerId}::uuid`);
        for (const table of Object.values(TABLE)) {
            await getDb().execute(
                sql`DELETE FROM ${sql.raw(table)} WHERE owner_id = ${ownerId}::uuid`
            );
        }
    }
});

afterAll(async () => {
    _resetTranslationService();
    await testDb.teardown();
});

const NEW_DESCRIPTION = 'Una descripcion nueva del lugar, bien larga y en espanol.';

describe('on-save translation (HOS-2658)', () => {
    it('a venue description save writes en/pt AUTOMATIC and one success row (AC-1)', async () => {
        // Arrange
        const { ownerId, id } = await seedListing('venue');

        // Act
        await patchAndSettle('venue', id, ownerId, { description: NEW_DESCRIPTION });

        // Assert
        const row = await readRow('venue', id, ['description_i18n']);
        expect(row.description_i18n).toEqual({
            es: NEW_DESCRIPTION,
            en: 'AI (en)',
            pt: 'AI (pt)'
        });
        const meta = row.translation_meta?.description;
        expect(meta).toEqual({
            en: autoMeta(NEW_DESCRIPTION, meta?.en?.translatedAt),
            pt: autoMeta(NEW_DESCRIPTION, meta?.pt?.translatedAt)
        });
        expect(await usageRows(ownerId)).toEqual([{ feature: 'translate', status: 'success' }]);
    });

    it('an accommodation name change regenerates its AUTO pairs; unchanged fields are not sent (AC-2)', async () => {
        // Arrange
        const { ownerId, id } = await seedListing('accommodation');
        await setColumns('accommodation', id, {
            name: 'Casa Sol',
            name_i18n: { es: 'Casa Sol', en: 'Sun House', pt: '' },
            translation_meta: {
                name: {
                    en: {
                        autoTranslated: true,
                        translatedAt: '2026-01-01T00:00:00.000Z',
                        sourceHash: hash('Casa Sol')
                    }
                }
            }
        });

        // Act
        await patchAndSettle('accommodation', id, ownerId, { name: 'Casa del Sol' });

        // Assert
        const row = await readRow('accommodation', id, ['name_i18n']);
        expect(row.name_i18n).toEqual({ es: 'Casa del Sol', en: 'AI (en)', pt: 'AI (pt)' });
        expect(row.translation_meta?.name?.en?.sourceHash).toBe(hash('Casa del Sol'));
        expect(row.translation_meta?.name?.pt?.sourceHash).toBe(hash('Casa del Sol'));
        expect(provider.calls).toHaveLength(2);
        for (const callArgs of provider.calls) {
            expect(callArgs.prompt).toContain('Casa del Sol');
        }
    });

    it('at the monthly limit the save persists, nothing is translated and GET reads noQuota (AC-3)', async () => {
        // Arrange
        plan.monthlyLimit = 1;
        const { ownerId, id } = await seedListing('venue');
        const oldAuto = {
            autoTranslated: true,
            translatedAt: '2026-01-01T00:00:00.000Z',
            sourceHash: hash('Viejo')
        };
        await setColumns('venue', id, {
            summary_i18n: { es: 'Viejo', en: 'Old', pt: 'Velho' },
            translation_meta: { summary: { en: oldAuto, pt: oldAuto } }
        });
        await getDb().execute(
            sql`INSERT INTO ai_usage (id, user_id, feature, provider, model, tokens_in, tokens_out, cost_estimate_micro_usd, latency_ms, status)
                VALUES (${randomUUID()}::uuid, ${ownerId}::uuid, 'translate', 'stub', 'stub-model', 1, 1, 0, 1, 'success')`
        );

        // Act
        await patchAndSettle('venue', id, ownerId, { summary: 'Un resumen nuevo del lugar' });

        // Assert
        const row = await readRow('venue', id, ['summary', 'summary_i18n']);
        expect(row.summary).toBe('Un resumen nuevo del lugar');
        // Untouched as a whole: the `es` mirror is written only by a run that
        // persists translations; the Spanish lives in the plain `summary` column.
        expect(row.summary_i18n).toEqual({ es: 'Viejo', en: 'Old', pt: 'Velho' });
        expect(provider.calls).toEqual([]);
        expect(await usageRows(ownerId)).toEqual([
            { feature: 'translate', status: 'success' },
            { feature: 'translate', status: 'quota_exceeded' }
        ]);
        expect(await pairState('venue', id, ownerId, 'summary')).toEqual({
            en: 'noQuota',
            pt: 'noQuota'
        });
    });

    it('without ai_translate: no provider call, no ai_usage row, GET reads noEntitlement (AC-4)', async () => {
        // Arrange
        plan.keys = [...BASE_KEYS];
        const { ownerId, id } = await seedListing('venue');

        // Act
        await patchAndSettle('venue', id, ownerId, { name: 'Nombre nuevo del bar' });

        // Assert
        expect(provider.calls).toEqual([]);
        expect(await usageRows(ownerId)).toEqual([]);
        expect(await pairState('venue', id, ownerId, 'name')).toEqual({
            en: 'noEntitlement',
            pt: 'noEntitlement'
        });
    });

    it('when every provider call fails nothing is written, a warn is logged and GET reads pending (AC-5)', async () => {
        // Arrange
        provider.fail = true;
        const warn = vi.spyOn(apiLogger, 'warn');
        const { ownerId, id } = await seedListing('experience');
        const before = await readRow('experience', id, ['description_i18n']);

        // Act
        await patchAndSettle('experience', id, ownerId, { description: NEW_DESCRIPTION });

        // Assert
        const after = await readRow('experience', id, ['description_i18n']);
        expect(after.translation_meta).toEqual(before.translation_meta);
        expect(after.description_i18n).toEqual(before.description_i18n);
        expect((await usageRows(ownerId)).filter((usage) => usage.status === 'success')).toEqual(
            []
        );
        expect(warn).toHaveBeenCalledWith(
            { entityType: 'experience', entityId: id, outcome: 'all-failed' },
            'listing-translation: on-save run failed'
        );
        expect(await pairState('experience', id, ownerId, 'description')).toEqual({
            en: 'pending',
            pt: 'pending'
        });
    });

    it('a MANUAL en is skipped before the provider: only pt is sent and metered (AC-7)', async () => {
        // Arrange
        const { ownerId, id } = await seedListing('venue');
        const manual = MANUAL('Descripcion anterior del lugar en espanol.');
        await setColumns('venue', id, {
            description_i18n: { es: 'x', en: 'My own text', pt: '' },
            translation_meta: { description: { en: manual } }
        });

        // Act
        await patchAndSettle('venue', id, ownerId, { description: NEW_DESCRIPTION });

        // Assert
        expect(provider.calls.map((callArgs) => callArgs.locale)).toEqual(['pt']);
        const row = await readRow('venue', id, ['description_i18n']);
        expect(row.description_i18n).toEqual({
            es: NEW_DESCRIPTION,
            en: 'My own text',
            pt: 'AI (pt)'
        });
        expect(row.translation_meta?.description?.en).toEqual(manual);
        expect(await usageRows(ownerId)).toEqual([{ feature: 'translate', status: 'success' }]);
    });

    it('both pairs MANUAL: zero provider calls and zero ai_usage rows (AC-8)', async () => {
        // Arrange
        const { ownerId, id } = await seedListing('accommodation');
        const manual = MANUAL('Descripcion anterior.');
        await setColumns('accommodation', id, {
            translation_meta: { description: { en: manual, pt: manual } }
        });

        // Act
        await patchAndSettle('accommodation', id, ownerId, { description: NEW_DESCRIPTION });

        // Assert
        expect(provider.calls).toEqual([]);
        expect(await usageRows(ownerId)).toEqual([]);
    });

    it('a venue entryNote save keeps the STORED en/pt and regenerates only the AUTO pt (AC-25)', async () => {
        // Arrange
        const { ownerId, id } = await seedListing('venue');
        const manual = MANUAL('Entrada libre');
        await getDb().execute(
            sql`UPDATE venues SET business_lines = ARRAY['food','nightlife'] WHERE id = ${id}::uuid`
        );
        await setColumns('venue', id, {
            entry_note_i18n: { es: 'Entrada libre', en: 'Mine', pt: 'Auto antigo' },
            translation_meta: {
                entryNote: {
                    en: manual,
                    pt: {
                        autoTranslated: true,
                        translatedAt: '2026-01-01T00:00:00.000Z',
                        sourceHash: hash('Entrada libre')
                    }
                }
            }
        });

        // Act
        await patchAndSettle('venue', id, ownerId, {
            entryNoteI18n: { es: 'Gratis hasta la 1', en: 'stale', pt: 'stale' }
        });

        // Assert
        const row = await readRow('venue', id, ['entry_note_i18n']);
        expect(row.entry_note_i18n).toEqual({ es: 'Gratis hasta la 1', en: 'Mine', pt: 'AI (pt)' });
        expect(row.translation_meta?.entryNote?.en).toEqual(manual);
        expect(row.translation_meta?.entryNote?.pt?.sourceHash).toBe(hash('Gratis hasta la 1'));
        expect(provider.calls.map((callArgs) => callArgs.locale)).toEqual(['pt']);
    });

    it('a Spanish entryNote save never puts back an en committed while it waited on the row (AC-7/AC-25, DL-9)', async () => {
        // Arrange: the PATCH reads its snapshot (en = 'Mine') and then blocks on the
        // row lock a concurrent manual correction holds, exactly like the pair writer.
        const { ownerId, id } = await seedListing('venue');
        await getDb().execute(
            sql`UPDATE venues SET business_lines = ARRAY['food','nightlife'] WHERE id = ${id}::uuid`
        );
        await setColumns('venue', id, {
            entry_note_i18n: { es: 'Entrada libre', en: 'Mine', pt: 'Auto antigo' }
        });
        const corrected = MANUAL('Entrada libre');
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let locked: () => void = () => undefined;
        const lockHeld = new Promise<void>((resolve) => {
            locked = resolve;
        });
        const manualCorrection = getDb().transaction(async (tx) => {
            await tx.execute(sql`SELECT id FROM venues WHERE id = ${id}::uuid FOR UPDATE`);
            await tx.execute(
                sql`UPDATE venues SET entry_note_i18n = ${JSON.stringify({ es: 'Entrada libre', en: 'Corrected by hand', pt: 'Auto antigo' })}::jsonb,
                    translation_meta = ${JSON.stringify({ entryNote: { en: corrected } })}::jsonb
                    WHERE id = ${id}::uuid`
            );
            locked();
            await gate;
        });
        await lockHeld;

        // Act: start the PATCH, wait until its UPDATE is queued on the lock, then commit.
        const patch = app.request(`${BASE.venue}/${id}`, {
            method: 'PATCH',
            headers: ownerHeaders(ownerId),
            body: JSON.stringify({
                entryNoteI18n: { es: 'Gratis hasta la 1', en: 'stale', pt: 'stale' }
            })
        });
        let waiting = 0;
        for (let attempt = 0; attempt < 200 && waiting === 0; attempt += 1) {
            const probe = await getDb().execute(
                sql`SELECT count(*)::int AS n FROM pg_stat_activity
                    WHERE datname = current_database() AND wait_event_type = 'Lock'
                    AND query ILIKE 'update "venues"%'`
            );
            waiting = (probe.rows[0] as { n: number }).n;
            if (waiting === 0) await new Promise((resolve) => setTimeout(resolve, 25));
        }
        release();
        await manualCorrection;
        const res = await patch;
        await Promise.all(pending.splice(0));

        // Assert
        expect(waiting).toBe(1);
        expect(res.status).toBe(200);
        const row = await readRow('venue', id, ['entry_note_i18n']);
        expect(row.entry_note_i18n).toEqual({
            es: 'Gratis hasta la 1',
            en: 'Corrected by hand',
            pt: 'AI (pt)'
        });
        expect(row.translation_meta?.entryNote?.en).toEqual(corrected);
        expect(provider.calls.map((callArgs) => callArgs.locale)).toEqual(['pt']);
    });

    it('a venue pair migrated by the real 0197 backfill is regenerated on the next changed save (AC-27)', async () => {
        // Arrange: a pre-migration venue (translations, no meta) run through 0197 itself.
        const { ownerId, id } = await seedListing('venue');
        await setColumns('venue', id, {
            name: 'Bar del Puerto',
            name_i18n: { es: 'Bar del Puerto', en: 'Harbour Bar', pt: 'Bar do Porto' },
            translation_meta: {}
        });
        await getDb().transaction(async (tx) => {
            await backfill.up({ db: tx } as unknown as SeedMigrationCtx);
        });

        // Act
        await patchAndSettle('venue', id, ownerId, { name: 'Bar del Puerto Viejo' });

        // Assert
        const row = await readRow('venue', id, ['name_i18n']);
        expect(row.name_i18n).toEqual({
            es: 'Bar del Puerto Viejo',
            en: 'AI (en)',
            pt: 'AI (pt)'
        });
        const meta = row.translation_meta?.name;
        expect(meta).toEqual({
            en: autoMeta('Bar del Puerto Viejo', meta?.en?.translatedAt),
            pt: autoMeta('Bar del Puerto Viejo', meta?.pt?.translatedAt)
        });
        expect(provider.calls.map((callArgs) => callArgs.locale)).toEqual(['en', 'pt']);
        expect(await usageRows(ownerId)).toEqual([{ feature: 'translate', status: 'success' }]);
    });
});
