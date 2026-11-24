/**
 * E2E-only experience and venue fixtures for the mobile contact bar (HOS-2532,
 * spec HOS-2520 section 10: AC-2.8, AC-2.9, AC-2.10).
 *
 * The base seed has no experience with public channels, no venue without a menu
 * and without socials, and no venue with a WhatsApp number. Those rows must NOT
 * live in `@repo/seed`: that package feeds staging and production through the
 * dual-write rule, and these are fake listings. They are inserted here, after
 * the base seed, by cloning a published seeded listing (same owner, destination
 * and publication state) and overriding only the columns each case needs.
 *
 * Idempotent: a slug that already exists is left untouched.
 */

import type { Pool } from 'pg';

/** Published seeded experience used as the clone template. */
const BASE_EXPERIENCE_SLUG = 'excursion-rio-uruguay-concepcion';
/** Published seeded venue used as the clone template. */
const BASE_VENUE_SLUG = 'cafe-del-palacio-colon';

/** A WhatsApp number the fixtures publish. Never a real line. */
export const FIXTURE_VENUE_WHATSAPP_NUMBER = '+54 9 3442 555000';

/** Public channels of the experience fixtures. */
export const FIXTURE_EXPERIENCE_CONTACT = {
    mobilePhone: '+54 9 3442 555111',
    workEmail: 'contacto@e2e-experiencia.test',
    website: 'https://e2e-experiencia.example.com'
} as const;

/** Slugs of every fixture row, so the specs and the seed share one source. */
export const LISTING_CONTACT_FIXTURE_SLUGS = {
    /** Experience with phone, email and web; price 8500 ARS per person. */
    experienceWithChannels: 'e2e-experiencia-con-canales',
    /** Experience with the same channels, flagged «Consultar precio». */
    experiencePriceOnRequest: 'e2e-experiencia-a-consultar',
    /** Venue with no menuUrl, no socials and no WhatsApp: no bar at all. */
    venueWithoutContact: 'e2e-venue-sin-contacto',
    /** Venue whose owner shares the WhatsApp number with everybody. */
    venueWhatsappPublic: 'e2e-venue-whatsapp-publico',
    /** Venue whose owner shares the WhatsApp number with signed-in visitors only. */
    venueWhatsappLoggedIn: 'e2e-venue-whatsapp-logueados',
    /** Venue that stores a number but whose owner never chose a visibility. */
    venueWhatsappUndecided: 'e2e-venue-whatsapp-sin-decidir',
    /**
     * HOS-2579 AC-2b / AC-6 (spec §11 `venueWithHoursAndMenu`): venue with opening
     * hours, a carta and its own agenda, so the agenda must render inside
     * «Lo que ofrece» and the «Horarios» tab has a section to point at.
     */
    venueWithHoursAndMenu: 'e2e-venue-con-horarios-y-carta'
} as const;

interface FixtureRow {
    readonly table: 'experiences' | 'venues';
    readonly baseSlug: string;
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    /** Column overrides, keyed by snake_case column name. */
    readonly overrides: Readonly<Record<string, unknown>>;
}

const rowId = (n: number): string => `e2e00000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const FIXTURE_ROWS: readonly FixtureRow[] = [
    {
        table: 'experiences',
        baseSlug: BASE_EXPERIENCE_SLUG,
        id: rowId(1),
        slug: LISTING_CONTACT_FIXTURE_SLUGS.experienceWithChannels,
        name: 'E2E Experiencia con canales',
        overrides: {
            price_from: 850000,
            price_unit: 'per_person',
            is_price_on_request: false,
            contact_info: FIXTURE_EXPERIENCE_CONTACT
        }
    },
    {
        table: 'experiences',
        baseSlug: BASE_EXPERIENCE_SLUG,
        id: rowId(2),
        slug: LISTING_CONTACT_FIXTURE_SLUGS.experiencePriceOnRequest,
        name: 'E2E Experiencia a consultar',
        overrides: {
            price_from: null,
            price_unit: null,
            is_price_on_request: true,
            contact_info: FIXTURE_EXPERIENCE_CONTACT
        }
    },
    {
        table: 'venues',
        baseSlug: BASE_VENUE_SLUG,
        id: rowId(3),
        slug: LISTING_CONTACT_FIXTURE_SLUGS.venueWithoutContact,
        name: 'E2E Venue sin contacto',
        overrides: {
            menu_url: null,
            menu_file_url: null,
            menu_file_public_id: null,
            menu_file_kind: null,
            social_networks: null,
            contact_info: null,
            whatsapp_visibility: null
        }
    },
    {
        table: 'venues',
        baseSlug: BASE_VENUE_SLUG,
        id: rowId(4),
        slug: LISTING_CONTACT_FIXTURE_SLUGS.venueWhatsappPublic,
        name: 'E2E Venue WhatsApp publico',
        overrides: {
            menu_url: null,
            social_networks: null,
            contact_info: { whatsapp: FIXTURE_VENUE_WHATSAPP_NUMBER },
            whatsapp_visibility: 'PUBLIC'
        }
    },
    {
        table: 'venues',
        baseSlug: BASE_VENUE_SLUG,
        id: rowId(5),
        slug: LISTING_CONTACT_FIXTURE_SLUGS.venueWhatsappLoggedIn,
        name: 'E2E Venue WhatsApp solo logueados',
        overrides: {
            menu_url: null,
            social_networks: null,
            contact_info: { whatsapp: FIXTURE_VENUE_WHATSAPP_NUMBER },
            whatsapp_visibility: 'LOGGED_IN_ONLY'
        }
    },
    {
        table: 'venues',
        baseSlug: BASE_VENUE_SLUG,
        id: rowId(6),
        slug: LISTING_CONTACT_FIXTURE_SLUGS.venueWhatsappUndecided,
        name: 'E2E Venue WhatsApp sin decidir',
        overrides: {
            menu_url: null,
            social_networks: null,
            contact_info: { whatsapp: FIXTURE_VENUE_WHATSAPP_NUMBER },
            whatsapp_visibility: null
        }
    },
    {
        table: 'venues',
        baseSlug: BASE_VENUE_SLUG,
        // rowId(7) is taken by the HOS-2579 action-bar accommodation fixture (PR 4).
        id: rowId(8),
        slug: LISTING_CONTACT_FIXTURE_SLUGS.venueWithHoursAndMenu,
        name: 'E2E Venue con horarios y carta',
        overrides: {}
    }
];

/** Child-row ids of the `venueWithHoursAndMenu` fixture (a distinct prefix from rowId). */
const childId = (n: number): string => `e2e10000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/**
 * Gives the `venueWithHoursAndMenu` fixture one carta course with a dish and one
 * weekly agenda event. The opening hours come from the cloned template.
 * Deterministic ids plus `ON CONFLICT DO NOTHING` keep it idempotent.
 */
async function ensureVenueHoursAndMenuChildren(pool: Pool): Promise<void> {
    const venueId = rowId(8);
    await pool.query(
        `INSERT INTO venue_menu_sections (id, venue_id, name, display_order)
         VALUES ($1, $2, 'Entradas', 0)
         ON CONFLICT (id) DO NOTHING`,
        [childId(1), venueId]
    );
    await pool.query(
        `INSERT INTO venue_menu_items
             (id, section_id, venue_id, name, description, price_cents, is_available, display_order)
         VALUES ($1, $2, $3, 'Empanadas', 'De carne cortada a cuchillo', 250000, true, 0)
         ON CONFLICT (id) DO NOTHING`,
        [childId(2), childId(1), venueId]
    );
    await pool.query(
        `INSERT INTO venue_events
             (id, venue_id, title, description, recurrence, weekday, start_time, is_active, display_order)
         VALUES ($1, $2, 'Noche de jazz', 'Música en vivo todos los viernes.', 'weekly', 5, '21:00', true, 0)
         ON CONFLICT (id) DO NOTHING`,
        [childId(3), venueId]
    );
}

/**
 * Inserts the contact-bar fixture listings by cloning a published seeded one.
 * `location_key` is cleared so the one-address unique index never fires.
 *
 * @param pool - Pool on the E2E database (the seed runner refuses any other).
 */
export async function ensureListingContactFixtures(pool: Pool): Promise<void> {
    for (const row of FIXTURE_ROWS) {
        const existing = await pool.query(`SELECT 1 FROM ${row.table} WHERE slug = $1`, [row.slug]);
        if (existing.rowCount) continue;

        const overrides = {
            ...row.overrides,
            id: row.id,
            slug: row.slug,
            name: row.name,
            name_i18n: null,
            ...(row.table === 'venues' ? { location_key: null } : {})
        };
        const inserted = await pool.query(
            `INSERT INTO ${row.table}
             SELECT (jsonb_populate_record(NULL::${row.table}, to_jsonb(base) || $2::jsonb)).*
             FROM ${row.table} base
             WHERE base.slug = $1`,
            [row.baseSlug, JSON.stringify(overrides)]
        );
        if (!inserted.rowCount) {
            throw new Error(`Missing seeded ${row.table} template '${row.baseSlug}'`);
        }
    }
    await ensureVenueHoursAndMenuChildren(pool);
}
