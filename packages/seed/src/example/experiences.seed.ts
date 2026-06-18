/**
 * experiences.seed.ts — Experience commerce listing seeder (SPEC-240 T-014).
 *
 * Inserts 5 experience listings covering different types, price units, and
 * visibility states.  Mirrors the gastronomy seeder pattern from SPEC-239
 * but uses direct Drizzle-level insertion (bypassing ExperienceService.create)
 * for two reasons:
 *
 *  1. `hasActiveSubscription` is a server-managed field that the
 *     ExperienceUpdateInputSchema explicitly omits; it cannot be set via the
 *     service CRUD path.
 *  2. The seed must create the COMMERCE_OWNER user who will own the listings
 *     (no COMMERCE_OWNER users exist in the required-seed pipeline).
 *
 * Idempotent: each INSERT uses ON CONFLICT (slug) DO NOTHING so re-running
 * the seed is safe.
 *
 * Seeded listings:
 *  1. EXCURSION       — Concepción del Uruguay, per_person, ACTIVE+PUBLIC+hasActiveSub=true
 *  2. KAYAK_RENTAL    — Colón, per_hour, ACTIVE+PUBLIC+hasActiveSub=true
 *  3. TOUR_GUIDE      — Gualeguaychú, isPriceOnRequest, ACTIVE+PUBLIC+hasActiveSub=true
 *  4. BOAT_TRIP       — Concordia, per_group, DRAFT+PRIVATE+hasActiveSub=false (non-visible)
 *  5. CULTURAL_TOUR   — Concepción del Uruguay, per_person, DRAFT+PUBLIC+hasActiveSub=false (non-visible)
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface DbRow {
    id: string;
    slug?: string;
    email?: string;
}

interface ExperienceInsertInput {
    slug: string;
    name: string;
    summary: string;
    description: string;
    type: string;
    priceFrom: number;
    priceUnit: string;
    isPriceOnRequest: boolean;
    hasActiveSubscription: boolean;
    visibility: string;
    lifecycleState: string;
    moderationState: string;
    isFeatured: boolean;
    ownerId: string;
    destinationId: string;
    createdById: string;
}

// ---------------------------------------------------------------------------
// Experience seed definitions
// ---------------------------------------------------------------------------

/**
 * Builds the list of experience insert inputs once owner/destination IDs are
 * resolved from the live database.
 */
function buildExperienceInputs(
    superAdminId: string,
    commerceOwnerId: string,
    destinations: Record<string, string>
): ExperienceInsertInput[] {
    const concepcion = destinations['concepcion-del-uruguay'];
    const colon = destinations.colon;
    const gualeguaychu = destinations.gualeguaychu;
    const concordia = destinations.concordia;

    if (!concepcion || !colon || !gualeguaychu || !concordia) {
        throw new Error(
            `Missing destination IDs: concepcion=${concepcion}, colon=${colon}, ` +
                `gualeguaychu=${gualeguaychu}, concordia=${concordia}`
        );
    }

    return [
        {
            slug: 'excursion-rio-uruguay-concepcion',
            name: 'Excursión al Río Uruguay',
            summary: 'Navegá el majestuoso Río Uruguay con guías especializados.',
            description:
                'Una excursión de medio día por las aguas del Río Uruguay, explorando islas, flora autóctona y fauna ribereña. Incluye equipo de seguridad y snacks. Apta para toda la familia.',
            type: 'EXCURSION',
            priceFrom: 850000,
            priceUnit: 'per_person',
            isPriceOnRequest: false,
            hasActiveSubscription: true,
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE',
            moderationState: 'APPROVED',
            isFeatured: true,
            ownerId: commerceOwnerId,
            destinationId: concepcion,
            createdById: superAdminId
        },
        {
            slug: 'alquiler-kayak-colon-termas',
            name: 'Alquiler de Kayaks — Termas de Colón',
            summary: 'Explorá el río en kayak al lado del complejo termal de Colón.',
            description:
                'Alquilá un kayak individual o doble y recorrés el río frente a las Termas de Colón. No requiere experiencia previa. Incluye chaleco salvavidas, remo y brief de seguridad. Duración mínima 1 hora.',
            type: 'KAYAK_RENTAL',
            priceFrom: 350000,
            priceUnit: 'per_hour',
            isPriceOnRequest: false,
            hasActiveSubscription: true,
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE',
            moderationState: 'APPROVED',
            isFeatured: false,
            ownerId: commerceOwnerId,
            destinationId: colon,
            createdById: superAdminId
        },
        {
            slug: 'guia-turistica-gualeguaychu-carnaval',
            name: 'Guía Turística: Gualeguaychú Carnavalera',
            summary: 'Conocé los secretos del carnaval de Gualeguaychú con una guía local.',
            description:
                'Un tour privado por la ciudad que da vida al Carnaval del País. Recorrés el Corsódromo, talleres de trajes, museos y los barrios típicos con una guía local especializada. El precio varía según el grupo y el recorrido, consultanos.',
            type: 'TOUR_GUIDE',
            priceFrom: 0,
            priceUnit: 'per_group',
            isPriceOnRequest: true,
            hasActiveSubscription: true,
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE',
            moderationState: 'APPROVED',
            isFeatured: false,
            ownerId: commerceOwnerId,
            destinationId: gualeguaychu,
            createdById: superAdminId
        },
        {
            slug: 'paseo-en-lancha-concordia-lago',
            name: 'Paseo en Lancha por el Lago de Salto Grande',
            summary: 'Recorrido privado en lancha por el lago artificial de Salto Grande.',
            description:
                'Paseo exclusivo en lancha por el lago del Embalse de Salto Grande, con vistas a la represa y la costa uruguaya. Solo grupos privados. Pendiente de aprobación operativa.',
            type: 'BOAT_TRIP',
            priceFrom: 1200000,
            priceUnit: 'per_group',
            isPriceOnRequest: false,
            hasActiveSubscription: false,
            visibility: 'PRIVATE',
            lifecycleState: 'DRAFT',
            moderationState: 'PENDING',
            isFeatured: false,
            ownerId: commerceOwnerId,
            destinationId: concordia,
            createdById: superAdminId
        },
        {
            slug: 'tour-cultural-casas-historicas-concepcion',
            name: 'Tour Cultural: Casas Históricas de Concepción del Uruguay',
            summary:
                'Recorrido patrimonial por los edificios históricos de Concepción del Uruguay.',
            description:
                'Explorá el patrimonio arquitectónico de Concepción del Uruguay: Colegio del Uruguay, la Basílica Inmaculada Concepción, la Casa de Urquiza y el Teatro 1° de Mayo. Guía bilingüe (español/inglés). Este listado está en proceso de activación.',
            type: 'CULTURAL_TOUR',
            priceFrom: 650000,
            priceUnit: 'per_person',
            isPriceOnRequest: false,
            hasActiveSubscription: false,
            visibility: 'PUBLIC',
            lifecycleState: 'DRAFT',
            moderationState: 'PENDING',
            isFeatured: false,
            ownerId: commerceOwnerId,
            destinationId: concepcion,
            createdById: superAdminId
        }
    ];
}

// ---------------------------------------------------------------------------
// Core seeder
// ---------------------------------------------------------------------------

/**
 * Seeds experience commerce listings using a raw pg.Pool connection.
 *
 * `hasActiveSubscription` is a server-managed field excluded from the
 * service-level ExperienceUpdateInputSchema, so direct SQL insertion is
 * intentional and correct here (same tradeoff as billing plan seeding which
 * also bypasses service validation for admin-only fields).
 *
 * @param context - Seed context (actor used to resolve super admin ID).
 * @returns Promise resolving when all experience rows are created or skipped.
 *
 * @example
 * ```typescript
 * await seedExperiences(seedContext);
 * // Creates/skips 5 experience rows in the experiences table.
 * ```
 */
export async function seedExperiences(context: SeedContext): Promise<void> {
    if (!process.env.HOSPEDA_DATABASE_URL) {
        throw new Error('HOSPEDA_DATABASE_URL is not set — cannot seed experiences.');
    }

    const pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });

    try {
        // ------------------------------------------------------------------
        // 1. Resolve actor (super admin)
        // ------------------------------------------------------------------
        const { rows: adminRows } = await pool.query<DbRow>(
            "SELECT id, email FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1"
        );
        const superAdminId = adminRows[0]?.id;
        if (!superAdminId) {
            throw new Error('No SUPER_ADMIN user found — run required seeds first.');
        }

        // ------------------------------------------------------------------
        // 2. Resolve destinations
        // ------------------------------------------------------------------
        const { rows: destRows } = await pool.query<DbRow>(
            `SELECT id, slug FROM destinations
             WHERE slug IN ('concepcion-del-uruguay', 'colon', 'gualeguaychu', 'concordia')`
        );
        const destinations: Record<string, string> = {};
        for (const row of destRows) {
            if (row.slug) destinations[row.slug] = row.id;
        }

        // ------------------------------------------------------------------
        // 3. Ensure COMMERCE_OWNER seed user exists
        // ------------------------------------------------------------------
        const ownerEmail = 'commerce-owner-seed@hospeda.test';
        const { rows: ownerRows } = await pool.query<DbRow>(
            'SELECT id FROM users WHERE email = $1 LIMIT 1',
            [ownerEmail]
        );
        let commerceOwnerId: string;
        if (ownerRows[0]) {
            commerceOwnerId = ownerRows[0].id;
            logger.info(`[experiences] Reusing COMMERCE_OWNER: ${ownerEmail} (${commerceOwnerId})`);
        } else {
            const { rows: created } = await pool.query<DbRow>(
                `INSERT INTO users
                   (slug, email, email_verified, display_name, first_name, last_name,
                    role, visibility, lifecycle_state, created_by_id, updated_by_id)
                 VALUES
                   ('commerce-owner-seed', $1, true, 'Seed Commerce Owner', 'Seed', 'Owner',
                    'COMMERCE_OWNER', 'PUBLIC', 'ACTIVE', $2, $2)
                 RETURNING id`,
                [ownerEmail, superAdminId]
            );
            if (!created[0]) throw new Error('Failed to insert COMMERCE_OWNER user');
            commerceOwnerId = created[0].id;
            logger.info(`[experiences] Created COMMERCE_OWNER: ${ownerEmail} (${commerceOwnerId})`);
        }

        // ------------------------------------------------------------------
        // 4. Insert experiences (idempotent — ON CONFLICT DO NOTHING)
        // ------------------------------------------------------------------
        const inputs = buildExperienceInputs(superAdminId, commerceOwnerId, destinations);
        let inserted = 0;
        let skipped = 0;

        for (const input of inputs) {
            const result = await pool.query<{ id: string }>(
                `INSERT INTO experiences
                   (slug, name, summary, description, type,
                    price_from, price_unit, is_price_on_request, has_active_subscription,
                    visibility, lifecycle_state, moderation_state, is_featured,
                    owner_id, destination_id, created_by_id, updated_by_id)
                 VALUES
                   ($1, $2, $3, $4, $5,
                    $6, $7, $8, $9,
                    $10, $11, $12, $13,
                    $14, $15, $16, $16)
                 ON CONFLICT (slug) DO NOTHING
                 RETURNING id`,
                [
                    input.slug,
                    input.name,
                    input.summary,
                    input.description,
                    input.type,
                    input.priceFrom,
                    input.priceUnit,
                    input.isPriceOnRequest,
                    input.hasActiveSubscription,
                    input.visibility,
                    input.lifecycleState,
                    input.moderationState,
                    input.isFeatured,
                    input.ownerId,
                    input.destinationId,
                    input.createdById
                ]
            );

            if (result.rows[0]) {
                inserted++;
                logger.success({
                    msg: `[experiences] Inserted: "${input.name}" → ${result.rows[0].id}`
                });
            } else {
                skipped++;
                logger.info(`[experiences] Skipped (already exists): "${input.name}"`);
            }
        }

        logger.success({
            msg: `[experiences] Done — inserted=${inserted} skipped=${skipped} total=${inputs.length}`
        });

        // Keep actor unchanged (we used super admin implicitly; context.actor not mutated)
        void context;
    } finally {
        await pool.end();
    }
}
