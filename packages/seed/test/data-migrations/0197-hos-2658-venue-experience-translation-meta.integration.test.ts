/**
 * @fileoverview
 * Integration tests for `0197-hos-2658-venue-experience-translation-meta` (HOS-2658 AC-26).
 *
 * Runs against the REAL integration database with the rollback-isolation idiom:
 * non-empty pairs over a non-empty Spanish become AUTOMATIC with the runtime hash,
 * empty pairs and empty sources get nothing, an existing entry is never changed,
 * accommodations are never touched, and a second run changes zero rows.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import {
    destinations,
    eq,
    experiences,
    getDb,
    initializeDb,
    resetDb,
    sql,
    users,
    venues
} from '@repo/db';
import {
    DestinationTypeEnum,
    ExperienceTypeEnum,
    PublicationStatusEnum,
    RoleEnum,
    type TranslationMeta,
    VenueTypeEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { computeTranslationSourceHash } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0197-hos-2658-venue-experience-translation-meta.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const PREFIX = 'zzz-test-hos2658-';

/** Sentinel thrown at the end of every isolated test to force a rollback. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

let pool: Pool;

/** Runs `fn` inside a transaction that ALWAYS rolls back. */
async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await getDb().transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) return;
        throw error;
    }
}

function buildCtx(tx: DrizzleClient, actorId: string): SeedMigrationCtx {
    const actor: Actor = { id: actorId, roles: [RoleEnum.SUPER_ADMIN], permissions: [] };
    return { db: tx, actor, models: {}, services: {}, helpers: {} } as unknown as SeedMigrationCtx;
}

const hash = (text: string): string => computeTranslationSourceHash({ text }).hash;

const PRE_EXISTING: TranslationMeta = {
    name: {
        en: {
            autoTranslated: false,
            translatedAt: '2026-01-01T00:00:00.000Z',
            sourceHash: 'b'.repeat(64)
        }
    }
};

type Fixture = {
    readonly ownerId: string;
    readonly venueId: string;
    readonly experienceId: string;
};

/** Inserts an owner, a destination, one venue and one experience with i18n values. */
async function insertListings(tx: DrizzleClient): Promise<Fixture> {
    const suffix = crypto.randomUUID().slice(0, 8);
    const [owner] = await tx
        .insert(users)
        .values({ email: `${PREFIX}owner-${suffix}@example.test` })
        .returning({ id: users.id });
    const [destination] = await tx
        .insert(destinations)
        .values({
            destinationType: DestinationTypeEnum.CITY,
            path: `${PREFIX}${suffix}`,
            slug: `${PREFIX}destination-${suffix}`,
            name: 'HOS-2658 destination',
            summary: 'HOS-2658 fixture destination.',
            description: 'HOS-2658 fixture destination, rolled back after the test.',
            location: { country: 'AR', state: 'Entre Rios', city: 'Concepcion del Uruguay' }
        } as typeof destinations.$inferInsert)
        .returning({ id: destinations.id });
    if (!owner || !destination) throw new Error('Failed to insert owner/destination');
    const common = {
        ownerId: owner.id,
        destinationId: destination.id,
        publicationStatus: PublicationStatusEnum.PUBLISHED,
        inactiveSince: new Date(),
        deadlinesVersion: 1
    };
    const [venue] = await tx
        .insert(venues)
        .values({
            ...common,
            slug: `${PREFIX}venue-${suffix}`,
            name: 'La Parrilla',
            summary: 'Parrilla de barrio.',
            description: 'Una parrilla de barrio con mesas afuera, rolled back.',
            richDescription: null,
            type: VenueTypeEnum.RESTAURANT,
            businessLines: ['food'],
            nameI18n: { es: 'La Parrilla', en: 'The Grill', pt: 'A Churrascaria' },
            summaryI18n: { es: 'Parrilla de barrio.', en: '', pt: 'Churrasco de bairro.' },
            // Source empty: a stray translation without Spanish gets no entry.
            richDescriptionI18n: { es: '', en: 'Orphan rich text', pt: '' },
            entryNoteI18n: { es: 'Gratis hasta la 1', en: 'Free until 1am', pt: '' },
            translationMeta: PRE_EXISTING
        } as typeof venues.$inferInsert)
        .returning({ id: venues.id });
    const [experience] = await tx
        .insert(experiences)
        .values({
            ...common,
            slug: `${PREFIX}experience-${suffix}`,
            name: 'Kayak al atardecer',
            summary: 'Paseo en kayak.',
            description: 'Paseo en kayak por el río al atardecer, rolled back.',
            type: ExperienceTypeEnum.KAYAK_RENTAL,
            descriptionI18n: {
                es: 'Paseo en kayak por el río al atardecer, rolled back.',
                en: 'Sunset kayak tour',
                pt: ''
            },
            translationMeta: null
        } as typeof experiences.$inferInsert)
        .returning({ id: experiences.id });
    if (!venue || !experience) throw new Error('Failed to insert listings');
    return { ownerId: owner.id, venueId: venue.id, experienceId: experience.id };
}

async function metaOfVenue(tx: DrizzleClient, id: string): Promise<unknown> {
    const [row] = await tx
        .select({ meta: venues.translationMeta })
        .from(venues)
        .where(eq(venues.id, id));
    return row?.meta;
}

async function metaOfExperience(tx: DrizzleClient, id: string): Promise<unknown> {
    const [row] = await tx
        .select({ meta: experiences.translationMeta })
        .from(experiences)
        .where(eq(experiences.id, id));
    return row?.meta;
}

async function accommodationFingerprint(tx: DrizzleClient): Promise<unknown> {
    const result = (await tx.execute(
        sql`select count(*)::int as n, md5(coalesce(string_agg(id::text || coalesce(translation_meta::text, '') || updated_at::text, ',' order by id), '')) as digest from accommodations`
    )) as unknown as { rows: unknown[] };
    return result.rows[0];
}

describe('HOS-2658: 0197-hos-2658-venue-experience-translation-meta (integration)', () => {
    beforeAll(() => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error('HOSPEDA_DATABASE_URL is not set in this worktree');
        }
        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('declares contentOnly and both requiresColumns', () => {
        expect(migration.meta).toEqual({
            name: '0197-hos-2658-venue-experience-translation-meta',
            group: 'required',
            destructive: false,
            contentOnly: true,
            requiresColumns: [
                { table: 'venues', column: 'translation_meta' },
                { table: 'experiences', column: 'translation_meta' }
            ]
        });
    });

    it('marks only non-empty pairs AUTOMATIC with the runtime hash and keeps existing entries (AC-26)', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const f = await insertListings(tx);
            const accommodationsBefore = await accommodationFingerprint(tx);

            // Act
            const result = await migration.up(buildCtx(tx, f.ownerId));

            // Assert
            const venueMeta = (await metaOfVenue(tx, f.venueId)) as TranslationMeta;
            const translatedAt = venueMeta.name?.pt?.translatedAt ?? '';
            expect(Number.isNaN(Date.parse(translatedAt))).toBe(false);
            const auto = (source: string) => ({
                autoTranslated: true,
                translatedAt,
                sourceHash: hash(source)
            });
            expect(venueMeta).toEqual({
                name: { en: PRE_EXISTING.name?.en, pt: auto('La Parrilla') },
                summary: { pt: auto('Parrilla de barrio.') },
                entryNote: { en: auto('Gratis hasta la 1') }
            });
            expect(await metaOfExperience(tx, f.experienceId)).toEqual({
                description: {
                    en: auto('Paseo en kayak por el río al atardecer, rolled back.')
                }
            });
            expect(result.counts?.venuesUpdated).toBeGreaterThanOrEqual(1);
            expect(result.counts?.experiencesUpdated).toBeGreaterThanOrEqual(1);
            expect(result.counts?.pairsWritten).toBeGreaterThanOrEqual(4);
            expect(await accommodationFingerprint(tx)).toEqual(accommodationsBefore);
        });
    });

    it('is idempotent: a second run changes zero rows', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const f = await insertListings(tx);
            await migration.up(buildCtx(tx, f.ownerId));
            const venueAfterFirst = await metaOfVenue(tx, f.venueId);

            // Act
            const second = await migration.up(buildCtx(tx, f.ownerId));

            // Assert
            expect(second.counts).toEqual({
                venuesUpdated: 0,
                experiencesUpdated: 0,
                pairsWritten: 0
            });
            expect(await metaOfVenue(tx, f.venueId)).toEqual(venueAfterFirst);
        });
    });
});
