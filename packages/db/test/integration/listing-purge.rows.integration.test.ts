import type { Accommodation, Experience, Gastronomy } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import { GastronomyModel } from '../../src/models/gastronomy/gastronomy.model.ts';
import { listingPurgeModel } from '../../src/models/listing/listing-purge.model.ts';
import { amenities } from '../../src/schemas/accommodation/amenity.dbschema.ts';
import { features } from '../../src/schemas/accommodation/feature.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { tags } from '../../src/schemas/tag/tag.dbschema.ts';
import { trials } from '../../src/schemas/trial/trial.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

const verticalTables = {
    accommodation: [
        ['r_accommodation_amenity', 'accommodation_id'],
        ['r_accommodation_feature', 'accommodation_id'],
        ['r_entity_tag', 'entity_id'],
        ['qr_codes', 'entity_id'],
        ['owner_promotions', 'accommodation_id'],
        ['accommodation_external_listings', 'accommodation_id'],
        ['accommodation_external_reputation', 'accommodation_id'],
        ['accommodation_occupancy', 'accommodation_id'],
        ['accommodation_ia_data', 'accommodation_id']
    ],
    gastronomy: [
        ['r_gastronomy_amenity', 'gastronomy_id'],
        ['r_gastronomy_feature', 'gastronomy_id'],
        ['r_entity_tag', 'entity_id'],
        ['qr_codes', 'entity_id'],
        ['entity_view_monthly_rollups', 'entity_id'],
        ['gastronomy_menu_sections', 'gastronomy_id'],
        ['gastronomy_menu_items', 'gastronomy_id'],
        ['gastronomy_daily_specials', 'gastronomy_id'],
        ['gastronomy_events', 'gastronomy_id']
    ],
    experience: [
        ['r_experience_amenity', 'experience_id'],
        ['r_experience_feature', 'experience_id'],
        ['r_entity_tag', 'entity_id'],
        ['qr_codes', 'entity_id'],
        ['entity_view_monthly_rollups', 'entity_id'],
        ['experience_certificates', 'experience_id']
    ]
} as const;

async function createListing(
    tx: DrizzleClient,
    vertical: keyof typeof verticalTables,
    ownerId: string,
    destinationId: string
) {
    const base = {
        name: `PB12 ${crypto.randomUUID()}`,
        slug: `pb12-${crypto.randomUUID()}`,
        summary: 'summary',
        description: 'description',
        ownerId,
        destinationId
    };
    if (vertical === 'accommodation')
        return new AccommodationModel().create(
            { ...base, type: 'CABIN' } as Partial<Accommodation>,
            tx
        );
    if (vertical === 'gastronomy')
        return new GastronomyModel().create(
            { ...base, type: 'RESTAURANT' } as Partial<Gastronomy>,
            tx
        );
    return new ExperienceModel().create({ ...base, type: 'EXCURSION' } as Partial<Experience>, tx);
}

async function insertRow(
    tx: DrizzleClient,
    table: string,
    vertical: keyof typeof verticalTables,
    listingId: string,
    ownerId: string,
    amenityId: string,
    featureId: string,
    tagId: string
) {
    const entityType = vertical.toUpperCase();
    const sqlByTable: Record<string, ReturnType<typeof sql>> = {
        r_accommodation_amenity: sql`INSERT INTO r_accommodation_amenity (accommodation_id, amenity_id) VALUES (${listingId}, ${amenityId}) RETURNING accommodation_id AS id`,
        r_gastronomy_amenity: sql`INSERT INTO r_gastronomy_amenity (gastronomy_id, amenity_id) VALUES (${listingId}, ${amenityId}) RETURNING gastronomy_id AS id`,
        r_experience_amenity: sql`INSERT INTO r_experience_amenity (experience_id, amenity_id) VALUES (${listingId}, ${amenityId}) RETURNING experience_id AS id`,
        r_accommodation_feature: sql`INSERT INTO r_accommodation_feature (accommodation_id, feature_id) VALUES (${listingId}, ${featureId}) RETURNING accommodation_id AS id`,
        r_gastronomy_feature: sql`INSERT INTO r_gastronomy_feature (gastronomy_id, feature_id) VALUES (${listingId}, ${featureId}) RETURNING gastronomy_id AS id`,
        r_experience_feature: sql`INSERT INTO r_experience_feature (experience_id, feature_id) VALUES (${listingId}, ${featureId}) RETURNING experience_id AS id`,
        r_entity_tag: sql`INSERT INTO r_entity_tag (tag_id, entity_id, entity_type, assigned_by_id) VALUES (${tagId}, ${listingId}, ${entityType}, ${ownerId}) RETURNING entity_id AS id`,
        qr_codes: sql`INSERT INTO qr_codes (slug, target_url, label, source, entity_type, entity_id, render_options) VALUES (${`pb12-${crypto.randomUUID()}`}, 'https://example.test', 'fixture', 'GENERATED', ${entityType}, ${listingId}, '{}'::jsonb) RETURNING id`,
        entity_view_monthly_rollups: sql`INSERT INTO entity_view_monthly_rollups (entity_type, entity_id, month, total, unique_visitors) VALUES (${entityType}, ${listingId}, '2026-10-01', 1, 1) RETURNING id`,
        owner_promotions: sql`INSERT INTO owner_promotions (slug, owner_id, accommodation_id, title, discount_type, discount_value, valid_from) VALUES (${`pb12-${crypto.randomUUID()}`}, ${ownerId}, ${listingId}, 'fixture', 'percentage', 10, now()) RETURNING id`,
        accommodation_external_listings: sql`INSERT INTO accommodation_external_listings (accommodation_id, platform, url) VALUES (${listingId}, 'GOOGLE', 'https://example.test') RETURNING id`,
        accommodation_external_reputation: sql`WITH source AS (INSERT INTO accommodation_external_listings (accommodation_id, platform, url) VALUES (${listingId}, 'GOOGLE', 'https://example.test/reputation') ON CONFLICT (accommodation_id, platform) DO UPDATE SET url = EXCLUDED.url RETURNING id) INSERT INTO accommodation_external_reputation (accommodation_id, platform, listing_id) SELECT ${listingId}, 'GOOGLE', id FROM source RETURNING id`,
        accommodation_occupancy: sql`INSERT INTO accommodation_occupancy (accommodation_id, date, source, created_by_id) VALUES (${listingId}, '2026-10-13', 'MANUAL', ${ownerId}) RETURNING id`,
        accommodation_ia_data: sql`INSERT INTO accommodation_ia_data (accommodation_id, title, content) VALUES (${listingId}, 'fixture', 'fixture') RETURNING id`,
        gastronomy_menu_sections: sql`INSERT INTO gastronomy_menu_sections (gastronomy_id, name, display_order) VALUES (${listingId}, 'fixture', 0) RETURNING id`,
        gastronomy_menu_items: sql`WITH section AS (INSERT INTO gastronomy_menu_sections (gastronomy_id, name, display_order) VALUES (${listingId}, 'fixture item section', 0) RETURNING id) INSERT INTO gastronomy_menu_items (section_id, gastronomy_id, name, display_order) SELECT id, ${listingId}, 'fixture', 0 FROM section RETURNING id`,
        gastronomy_daily_specials: sql`INSERT INTO gastronomy_daily_specials (gastronomy_id, title, valid_from, valid_until, display_order) VALUES (${listingId}, 'fixture', '2026-10-13', '2026-10-13', 0) RETURNING id`,
        gastronomy_events: sql`INSERT INTO gastronomy_events (gastronomy_id, title, recurrence, date, start_time, display_order) VALUES (${listingId}, 'fixture', 'once', '2026-10-13', '12:00', 0) RETURNING id`,
        experience_certificates: sql`INSERT INTO experience_certificates (experience_id, recipient_name, completed_at) VALUES (${listingId}, 'fixture', '2026-10-12') RETURNING id`
    };
    const result = await tx.execute(sqlByTable[table]!);
    return String(result.rows[0]?.id);
}

describe('TEST:V6:13 PB12 purge rows by vertical', () => {
    it('deletes every pending row for the purged listing, preserves same-owner witnesses and trial', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(owner);
            await tx.insert(destinations).values(destination);
            const [amenity] = await tx
                .insert(amenities)
                .values({ slug: `pb12-${crypto.randomUUID()}`, type: 'GENERAL_APPLIANCES' })
                .returning({ id: amenities.id });
            const [feature] = await tx
                .insert(features)
                .values({ slug: `pb12-${crypto.randomUUID()}` })
                .returning({ id: features.id });
            const [tag] = await tx
                .insert(tags)
                .values({ name: `pb12-${crypto.randomUUID()}`, type: 'SYSTEM', color: 'BLUE' })
                .returning({ id: tags.id });
            const trialPseudonym = crypto
                .randomUUID()
                .replaceAll('-', '')
                .padEnd(64, '0')
                .slice(0, 64);
            const trialResult = await tx.execute(
                sql<{
                    id: string;
                    status: string;
                    started_at: Date | null;
                    ends_at: Date | null;
                }>`INSERT INTO trial (user_id, vertical, status, email_pseudonym) VALUES (${owner.id}, 'accommodation', 'TRIAL_CONVERTED', ${trialPseudonym}) RETURNING id, status, started_at, ends_at`
            );
            const trial = trialResult.rows[0]!;
            const trialCountBefore = await tx.execute(
                sql<{
                    count: number;
                }>`SELECT count(*)::int AS count FROM trial WHERE user_id = ${owner.id}`
            );
            expect(trialCountBefore.rows[0]?.count).toBe(1);
            for (const vertical of Object.keys(verticalTables) as (keyof typeof verticalTables)[]) {
                const listing = await createListing(tx, vertical, owner.id, destination.id);
                const witness = await createListing(tx, vertical, owner.id, destination.id);
                const rows = verticalTables[vertical];
                for (const [table] of rows) {
                    const ownId = await insertRow(
                        tx,
                        table,
                        vertical,
                        listing.id,
                        owner.id,
                        amenity!.id,
                        feature!.id,
                        tag!.id
                    );
                    const witnessId = await insertRow(
                        tx,
                        table,
                        vertical,
                        witness.id,
                        owner.id,
                        amenity!.id,
                        feature!.id,
                        tag!.id
                    );
                    await listingPurgeModel.purgeListingContent({
                        tx,
                        vertical,
                        listingId: listing.id,
                        at: new Date('2026-10-12T12:00:00.000Z')
                    });
                    const keyColumn = table.startsWith('r_')
                        ? rows.find(([name]) => name === table)?.[1]
                        : 'id';
                    const own = await tx.execute(
                        sql`SELECT 1 FROM ${sql.identifier(table)} WHERE ${sql.identifier(keyColumn!)} = ${ownId}`
                    );
                    const other = await tx.execute(
                        sql`SELECT 1 FROM ${sql.identifier(table)} WHERE ${sql.identifier(keyColumn!)} = ${witnessId}`
                    );
                    expect(own.rows, `${vertical}.${table} own row`).toHaveLength(0);
                    expect(other.rows, `${vertical}.${table} witness row`).toHaveLength(1);
                }
            }
            const after = await tx.execute(
                sql`SELECT id, status, started_at, ends_at FROM trial WHERE id = ${trial.id}`
            );
            expect(after.rows).toEqual([
                {
                    id: trial.id,
                    status: trial.status,
                    started_at: trial.started_at,
                    ends_at: trial.ends_at
                }
            ]);
            const trialCountAfter = await tx.execute(
                sql<{
                    count: number;
                }>`SELECT count(*)::int AS count FROM trial WHERE user_id = ${owner.id}`
            );
            expect(trialCountAfter.rows[0]?.count).toBe(trialCountBefore.rows[0]?.count);
            expect(await tx.select().from(trials).where(eq(trials.id, trial.id))).toHaveLength(1);
        });
    });
});
