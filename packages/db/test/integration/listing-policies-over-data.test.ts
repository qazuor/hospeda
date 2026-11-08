// HOS-2060 — apply 0194 (add `policies` + backfill) and 0195 (release N+1:
// drop the legacy fields) over live-style rows in an isolated pre-0194 database.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/migrations');
const dbName = 'hospeda_listing_policies_test';
const baseUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
if (!baseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${dbName}`;
let admin: Pool;
let db: Pool;

interface JournalEntry {
    idx: number;
    tag: string;
}

const OWNER = '11111111-1111-4111-8111-111111111111';
const DESTINATION = '22222222-2222-4222-8222-222222222222';
const ACC = {
    plain: 'a0000000-0000-4000-8000-000000000001',
    rich: 'a0000000-0000-4000-8000-000000000002',
    features: 'a0000000-0000-4000-8000-000000000003',
    invalid: 'a0000000-0000-4000-8000-000000000004',
    retiredPetArea: 'a0000000-0000-4000-8000-000000000005',
    smokeAreaInjected: 'a0000000-0000-4000-8000-000000000006',
    smokeAreaTrue: 'a0000000-0000-4000-8000-000000000007',
    smokeTrue: 'a0000000-0000-4000-8000-000000000008',
    smokeFreeInjected: 'a0000000-0000-4000-8000-000000000009',
    smokeFalseOnly: 'a0000000-0000-4000-8000-00000000000a'
} as const;
const VENUE = {
    night: 'b0000000-0000-4000-8000-000000000001',
    outOfRange: 'b0000000-0000-4000-8000-000000000002',
    smokeBoth: 'b0000000-0000-4000-8000-000000000003'
} as const;
const EXPERIENCE = {
    groups: 'c0000000-0000-4000-8000-000000000001',
    blank: 'c0000000-0000-4000-8000-000000000002'
} as const;

async function apply(tag: string): Promise<void> {
    const content = readFileSync(join(migrationDir, `${tag}.sql`), 'utf8');
    for (const chunk of content.split('--> statement-breakpoint')) {
        if (chunk.trim()) await db.query(chunk.trim());
    }
}

async function amenity(slug: string): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
        `INSERT INTO amenities (slug, type) VALUES ($1, 'SERVICES') RETURNING id`,
        [slug]
    );
    return rows[0]?.id as string;
}

async function feature(slug: string, deleted = false): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
        `INSERT INTO features (slug, category, deleted_at) VALUES ($1, 'AUDIENCE', $2) RETURNING id`,
        [slug, deleted ? new Date() : null]
    );
    return rows[0]?.id as string;
}

const listingColumns = `slug, name, summary, description, type, owner_id, destination_id,
    publication_status, inactive_since, deadlines_version`;
const listingValues = (id: string, type: string) =>
    `'zzz-${id}', 'HOS-2060 ${id}', 'Summary.', 'Description long enough.', '${type}',
    '${OWNER}', '${DESTINATION}', 'PUBLISHED', now(), 1`;

async function policiesOf(table: string, id: string): Promise<unknown> {
    const { rows } = await db.query<{ policies: unknown }>(
        `SELECT policies FROM ${table} WHERE id = $1`,
        [id]
    );
    return rows[0]?.policies;
}

beforeAll(async () => {
    admin = new Pool({ connectionString: adminUrl.toString() });
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.query(`CREATE DATABASE ${dbName}`);
    db = new Pool({ connectionString: testUrl.toString() });
    await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await db.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await db.query('CREATE EXTENSION IF NOT EXISTS "unaccent"');
    const journal = JSON.parse(readFileSync(join(migrationDir, 'meta/_journal.json'), 'utf8')) as {
        entries: JournalEntry[];
    };
    const target = journal.entries.find((entry) => entry.tag.startsWith('0194_'));
    if (!target) throw new Error('0194 migration absent from journal');
    for (const entry of journal.entries
        .filter((entry) => entry.idx < target.idx)
        .sort((a, b) => a.idx - b.idx)) {
        await apply(entry.tag);
    }

    // Arrange: one row per rule, written against the PRE-0194 schema.
    await db.query(`INSERT INTO users (id, slug, email) VALUES ($1, 'hos2060', 'h@example.test')`, [
        OWNER
    ]);
    await db.query(
        `INSERT INTO destinations (id, destination_type, path, slug, name, summary, description, location)
         VALUES ($1, 'CITY', 'zzz-hos2060', 'zzz-hos2060', 'D', 'S', 'Description.', '{"country":"AR"}')`,
        [DESTINATION]
    );
    const cards = await amenity('accepts_cards');
    const pets = await amenity('pet_friendly');
    const smokeFree = await amenity('smoke_free');
    const events = await amenity('private_events');
    const retiredPetArea = await feature('pet_friendly_area', true);
    const petSuitable = await feature('pet_suitable');
    const smokingArea = await feature('smoking_area');

    await db.query(`INSERT INTO accommodations (id, ${listingColumns}, extra_info) VALUES
        ('${ACC.plain}', ${listingValues(ACC.plain, 'CABIN')}, '{"capacity":2}'),
        ('${ACC.rich}', ${listingValues(ACC.rich, 'CABIN')},
            '{"capacity":4,"smokingAllowed":true,"minNights":2,"maxNights":14}'),
        ('${ACC.features}', ${listingValues(ACC.features, 'CABIN')}, '{"minNights":1}'),
        ('${ACC.invalid}', ${listingValues(ACC.invalid, 'CABIN')},
            '{"minNights":"two","maxNights":0,"smokingAllowed":"yes"}'),
        ('${ACC.retiredPetArea}', ${listingValues(ACC.retiredPetArea, 'CABIN')}, NULL),
        ('${ACC.smokeAreaInjected}', ${listingValues(ACC.smokeAreaInjected, 'CABIN')}, '{"smokingAllowed":false}'),
        ('${ACC.smokeAreaTrue}', ${listingValues(ACC.smokeAreaTrue, 'CABIN')}, '{"smokingAllowed":true}'),
        ('${ACC.smokeTrue}', ${listingValues(ACC.smokeTrue, 'CABIN')}, '{"smokingAllowed":true}'),
        ('${ACC.smokeFreeInjected}', ${listingValues(ACC.smokeFreeInjected, 'CABIN')}, '{"smokingAllowed":false}'),
        ('${ACC.smokeFalseOnly}', ${listingValues(ACC.smokeFalseOnly, 'CABIN')}, '{"smokingAllowed":false}')`);
    await db.query(`INSERT INTO r_accommodation_amenity (accommodation_id, amenity_id) VALUES
        ('${ACC.rich}', '${cards}'), ('${ACC.rich}', '${pets}'), ('${ACC.rich}', '${smokeFree}'),
        ('${ACC.rich}', '${events}'), ('${ACC.smokeFreeInjected}', '${smokeFree}')`);
    await db.query(`INSERT INTO r_accommodation_feature (accommodation_id, feature_id) VALUES
        ('${ACC.features}', '${petSuitable}'), ('${ACC.features}', '${smokingArea}'),
        ('${ACC.retiredPetArea}', '${retiredPetArea}'),
        ('${ACC.smokeAreaInjected}', '${smokingArea}'), ('${ACC.smokeAreaTrue}', '${smokingArea}')`);

    await db.query(`INSERT INTO venues (id, ${listingColumns}, business_lines, min_age, dress_code, dress_code_note_i18n) VALUES
        ('${VENUE.night}', ${listingValues(VENUE.night, 'BOLICHE')}, '{nightlife}', 18, 'elegant',
            '{"es":"Elegante","en":"Smart","pt":"Elegante"}'),
        ('${VENUE.outOfRange}', ${listingValues(VENUE.outOfRange, 'BOLICHE')}, '{nightlife}', 40, NULL,
            '{"es":"solo es"}'),
        ('${VENUE.smokeBoth}', ${listingValues(VENUE.smokeBoth, 'BOLICHE')}, '{nightlife}', NULL, NULL, NULL)`);
    await db.query(
        `INSERT INTO r_venue_amenity (venue_id, amenity_id) VALUES ('${VENUE.smokeBoth}', '${smokeFree}')`
    );
    await db.query(
        `INSERT INTO r_venue_feature (venue_id, feature_id) VALUES ('${VENUE.smokeBoth}', '${smokingArea}')`
    );
    await db.query(
        `INSERT INTO r_venue_amenity (venue_id, amenity_id) VALUES ('${VENUE.night}', '${cards}')`
    );

    await db.query(`INSERT INTO experiences (id, ${listingColumns}, accepts_private_groups, cancellation_policy) VALUES
        ('${EXPERIENCE.groups}', ${listingValues(EXPERIENCE.groups, 'KAYAK_RENTAL')}, true,
            'Si crece el río, reprogramamos.'),
        ('${EXPERIENCE.blank}', ${listingValues(EXPERIENCE.blank, 'KAYAK_RENTAL')}, false, '   ')`);
    await db.query(
        `INSERT INTO r_experience_amenity (experience_id, amenity_id) VALUES ('${EXPERIENCE.groups}', '${pets}')`
    );

    // Act
    const next = journal.entries.find((entry) => entry.tag.startsWith('0195_'));
    if (!next) throw new Error('0195 migration absent from journal');
    await apply(target.tag);
    await apply(next.tag);
}, 240_000);

afterAll(async () => {
    await db?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin?.end();
});

describe('HOS-2060 migrations 0194 + 0195 over data', () => {
    it('gives every listing at least cash', async () => {
        for (const table of ['accommodations', 'venues', 'experiences']) {
            const { rows } = await db.query<{ total: number; covered: number }>(
                `SELECT count(*)::int AS total,
                        count(*) FILTER (WHERE policies -> 'paymentMethods' ? 'cash')::int AS covered
                 FROM ${table}`
            );
            expect(rows[0]?.total).toBeGreaterThan(0);
            expect(rows[0]?.covered).toBe(rows[0]?.total);
        }
    });

    it('maps the accommodation catalog links and extra_info, the explicit smoking answer first', async () => {
        expect(await policiesOf('accommodations', ACC.plain)).toEqual({ paymentMethods: ['cash'] });
        expect(await policiesOf('accommodations', ACC.rich)).toEqual({
            paymentMethods: ['cash', 'debit', 'credit'],
            pets: { admission: 'yes' },
            smokingAllowed: 'yes',
            eventsAllowed: true,
            minNights: 2,
            maxNights: 14
        });
    });

    it('folds pet_suitable into pets and smoking_area into outdoor_only', async () => {
        expect(await policiesOf('accommodations', ACC.features)).toEqual({
            paymentMethods: ['cash'],
            pets: { admission: 'yes' },
            smokingAllowed: 'outdoor_only',
            minNights: 1
        });
    });

    it('leaves out every value the schema would reject', async () => {
        expect(await policiesOf('accommodations', ACC.invalid)).toEqual({
            paymentMethods: ['cash']
        });
        expect(await policiesOf('venues', VENUE.outOfRange)).toEqual({ paymentMethods: ['cash'] });
        expect(await policiesOf('experiences', EXPERIENCE.blank)).toEqual({
            paymentMethods: ['cash']
        });
    });

    describe('smoking precedence (injected `false` is not a signal)', () => {
        const smoking = async (table: string, id: string) =>
            ((await policiesOf(table, id)) as Record<string, unknown>).smokingAllowed;

        it('smoking_area plus the injected false gives outdoor_only (the staging case)', async () => {
            expect(await smoking('accommodations', ACC.smokeAreaInjected)).toBe('outdoor_only');
        });

        it('step 1: smoking_area beats an explicit true', async () => {
            expect(await smoking('accommodations', ACC.smokeAreaTrue)).toBe('outdoor_only');
        });

        it('step 2: an explicit true with no smoking_area gives yes', async () => {
            expect(await smoking('accommodations', ACC.smokeTrue)).toBe('yes');
        });

        it('step 3: smoke_free gives no, whatever the injected false says', async () => {
            expect(await smoking('accommodations', ACC.smokeFreeInjected)).toBe('no');
        });

        it('step 4: a bare false with no catalog signal leaves the key absent', async () => {
            expect(await policiesOf('accommodations', ACC.smokeFalseOnly)).toEqual({
                paymentMethods: ['cash']
            });
        });

        it('venues follow the same order: smoking_area beats smoke_free', async () => {
            expect(await smoking('venues', VENUE.smokeBoth)).toBe('outdoor_only');
        });
    });

    it('ignores a soft-deleted catalog row', async () => {
        expect(await policiesOf('accommodations', ACC.retiredPetArea)).toEqual({
            paymentMethods: ['cash']
        });
    });

    it('copies the venue age, dress code and note, and the experience rules', async () => {
        expect(await policiesOf('venues', VENUE.night)).toEqual({
            paymentMethods: ['cash', 'debit', 'credit'],
            minAge: 18,
            dressCode: 'elegant',
            dressCodeNote: { es: 'Elegante', en: 'Smart', pt: 'Elegante' }
        });
        expect(await policiesOf('experiences', EXPERIENCE.groups)).toEqual({
            paymentMethods: ['cash'],
            pets: { admission: 'yes' },
            privateGroups: true,
            cancellation: 'Si crece el río, reprogramamos.'
        });
    });

    it('drops the legacy columns, the enum type and the extra_info keys', async () => {
        const { rows: columns } = await db.query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name IN ('venues', 'experiences') AND column_name = ANY($1)`,
            [
                [
                    'min_age',
                    'dress_code',
                    'dress_code_note_i18n',
                    'accepts_private_groups',
                    'cancellation_policy'
                ]
            ]
        );
        expect(columns).toEqual([]);
        const { rows: types } = await db.query(
            `SELECT 1 FROM pg_type WHERE typname = 'venue_dress_code_enum'`
        );
        expect(types).toEqual([]);
        const { rows: keys } = await db.query<{ total: number }>(
            `SELECT count(*)::int AS total FROM accommodations
             WHERE extra_info ?| array['smokingAllowed', 'minNights', 'maxNights']`
        );
        expect(keys[0]?.total).toBe(0);
        const { rows: kept } = await db.query<{ extra_info: unknown }>(
            `SELECT extra_info FROM accommodations WHERE id = $1`,
            [ACC.rich]
        );
        expect(kept[0]?.extra_info).toEqual({ capacity: 4 });
    });
});
