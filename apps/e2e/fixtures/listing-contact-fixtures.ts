/**
 * E2E-only accommodation, experience and venue fixtures for the mobile contact bar
 * (HOS-2532, spec HOS-2520 section 10: AC-2.8, AC-2.9, AC-2.10) and the icon-only
 * action bar (HOS-2579 §6.10: AC-33, AC-34).
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
/** Published seeded accommodation used as the clone template (nightly ARS price). */
const BASE_ACCOMMODATION_SLUG = 'paraiso-calido-country-house-colon';

/** Public phone and WhatsApp of the all-actions accommodation fixture. Never real lines. */
export const FIXTURE_ACCOMMODATION_CONTACT = {
    mobilePhone: '+54 9 3442 555222',
    whatsapp: '+54 9 3442 555333',
    personalEmail: 'reservas@e2e-alojamiento.test',
    preferredEmail: 'HOME',
    preferredPhone: 'MOBILE'
} as const;

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
     * HOS-2579 AC-33: accommodation with a price, WhatsApp and a public phone, so
     * the bar renders all six actions (Consultar, WhatsApp, Llamar, Favorito,
     * Compartir, Comparar).
     */
    accommodationAllActions: 'e2e-alojamiento-todas-las-acciones'
} as const;

interface FixtureRow {
    readonly table: 'accommodations' | 'experiences' | 'venues';
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
        table: 'accommodations',
        baseSlug: BASE_ACCOMMODATION_SLUG,
        id: rowId(7),
        slug: LISTING_CONTACT_FIXTURE_SLUGS.accommodationAllActions,
        name: 'E2E Alojamiento todas las acciones',
        overrides: {
            contact_info: FIXTURE_ACCOMMODATION_CONTACT
        }
    }
];

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
            ...(row.table === 'experiences' ? {} : { location_key: null })
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
}
