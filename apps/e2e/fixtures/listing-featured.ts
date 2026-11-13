import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { API_URL } from './arrears-cycle.ts';
import { execSQL, getDbPool } from './db-helpers.ts';

const catalog = {
    recurring: {
        accommodation: {
            productId: '21380000-0000-4000-8000-000000000003',
            addonId: '21380000-0000-4000-8000-000000000001',
            versionId: '21380000-0000-4000-8000-000000000002'
        },
        venue: {
            productId: '21380000-0000-4000-8000-000000000009',
            addonId: '21380000-0000-4000-8000-000000000007',
            versionId: '21380000-0000-4000-8000-000000000008'
        },
        experience: {
            productId: '21380000-0000-4000-8000-000000000015',
            addonId: '21380000-0000-4000-8000-000000000013',
            versionId: '21380000-0000-4000-8000-000000000014'
        }
    },
    'one-time': {
        accommodation: {
            productId: '21380000-0000-4000-8000-000000000006',
            addonId: '21380000-0000-4000-8000-000000000004',
            versionId: '21380000-0000-4000-8000-000000000005'
        },
        venue: {
            productId: '21380000-0000-4000-8000-000000000012',
            addonId: '21380000-0000-4000-8000-000000000010',
            versionId: '21380000-0000-4000-8000-000000000011'
        },
        experience: {
            productId: '21380000-0000-4000-8000-000000000018',
            addonId: '21380000-0000-4000-8000-000000000016',
            versionId: '21380000-0000-4000-8000-000000000017'
        }
    }
} as const;

const catalogProperties = {
    recurring: {
        chargeKind: 'PERIODICO',
        validity: 'WHILE_SUBSCRIPTION_ALIVE',
        days: null,
        cycle: 'monthly',
        price: 300000,
        className: 'recurring'
    },
    'one-time': {
        chargeKind: 'UNA_VEZ',
        validity: 'FIXED_DAYS',
        days: 7,
        cycle: null,
        price: 150000,
        className: 'one-time'
    }
} as const;

/** Ensure a fixed, immutable featured-listing product for one billing kind and vertical. */
export async function ensureFeaturedBoostCatalog(args: {
    readonly kind: 'recurring' | 'one-time';
    readonly vertical: 'accommodation' | 'venue' | 'experience';
}): Promise<{ readonly productId: string; readonly addonVersionId: string }> {
    const ids = catalog[args.kind][args.vertical];
    const properties = catalogProperties[args.kind];
    const slug = `e2e-hos2138-featured-${properties.className}-${args.vertical}`;
    const name = `E2E HOS-2138 boost ${properties.className} ${args.vertical}`;
    const client = await getDbPool().connect();
    try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('HOS-2138 featured catalog'))");
        await client.query(
            `INSERT INTO addon (id, slug, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [ids.addonId, slug, name]
        );
        const existingVersion = await client.query('SELECT id FROM addon_version WHERE id = $1', [
            ids.versionId
        ]);
        if (existingVersion.rowCount === 0) {
            await client.query(
                `INSERT INTO addon_version (id, addon_id, validity, validity_days, scope_type)
                 VALUES ($1, $2, $3, $4, 'LISTING')`,
                [ids.versionId, ids.addonId, properties.validity, properties.days]
            );
            await client.query(
                `INSERT INTO addon_version_entitlement (addon_version_id, key)
                 VALUES ($1, 'featured_listing')`,
                [ids.versionId]
            );
        }
        await client.query(
            `INSERT INTO addon_product
             (id, addon_id, version_id, price, currency, charge_kind, cycle, compatible_verticals)
             VALUES ($1, $2, $3, $4, 'ARS', $5, $6, ARRAY[$7]::varchar[])
             ON CONFLICT DO NOTHING`,
            [
                ids.productId,
                ids.addonId,
                ids.versionId,
                properties.price,
                properties.chargeKind,
                properties.cycle,
                args.vertical
            ]
        );
        const check = await client.query(
            `SELECT ap.id FROM addon_product ap JOIN addon_version av ON av.id = ap.version_id
             JOIN addon a ON a.id = ap.addon_id
             JOIN addon_version_entitlement ave ON ave.addon_version_id = av.id
             WHERE ap.id = $1 AND a.id = $2 AND a.slug = $3 AND av.id = $4
               AND av.validity = $5 AND av.validity_days IS NOT DISTINCT FROM $6::integer
               AND av.scope_type = 'LISTING' AND ave.key = 'featured_listing'
               AND ap.charge_kind = $7 AND ap.cycle IS NOT DISTINCT FROM $8::text
               AND ap.price = $9 AND ap.currency = 'ARS'
               AND $10 = ANY(ap.compatible_verticals)`,
            [
                ids.productId,
                ids.addonId,
                slug,
                ids.versionId,
                properties.validity,
                properties.days,
                properties.chargeKind,
                properties.cycle,
                properties.price,
                args.vertical
            ]
        );
        if (check.rowCount !== 1) throw new Error(`Invalid HOS-2138 catalog row ${ids.productId}.`);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
    } finally {
        client.release();
    }
    return { productId: ids.productId, addonVersionId: ids.versionId };
}

/** Insert a private city destination owned by the case's fixtures. */
export async function createFeaturedDestination(): Promise<{ readonly id: string }> {
    const id = randomUUID();
    await execSQL(
        `INSERT INTO destinations (id, destination_type, level, path, path_ids, slug, name,
         summary, description, location, visibility, lifecycle_state, moderation_state)
         VALUES ($1, 'CITY', 0, $2, '', $3, $4, 'E2E destination', 'E2E destination',
         '{"city":"Featured test"}'::jsonb, 'PUBLIC', 'ACTIVE', 'APPROVED')`,
        [id, `/hos2138-${id}`, `hos2138-${id}`, `HOS-2138 ${id.slice(0, 8)}`]
    );
    return { id };
}

/** Delete a destination created by {@link createFeaturedDestination}. */
export async function deleteFeaturedDestination(args: { readonly id: string }): Promise<void> {
    await execSQL('DELETE FROM destinations WHERE id = $1', [args.id]);
}

/** Read the entitlement-backed featured column for one listing. */
export async function readFeaturedFlag(args: {
    readonly table: 'accommodations' | 'venues' | 'experiences';
    readonly id: string;
}): Promise<boolean> {
    const [row] = await execSQL<{ featured_by_entitlement: boolean }>(
        `SELECT featured_by_entitlement FROM ${args.table} WHERE id = $1`,
        [args.id]
    );
    if (!row) throw new Error(`Missing featured listing ${args.id}.`);
    return row.featured_by_entitlement;
}

const PublicListSchema = z.object({
    data: z.object({ items: z.array(z.object({ id: z.string().uuid(), isFeatured: z.boolean() })) })
});

/** Read and validate the public listing order for one destination. */
export async function readPublicList(args: {
    readonly vertical: 'accommodation' | 'venue' | 'experience';
    readonly destinationId: string;
}): Promise<ReadonlyArray<{ readonly id: string; readonly isFeatured: boolean }>> {
    const path = args.vertical === 'accommodation' ? 'accommodations' : `${args.vertical}s`;
    const params = new URLSearchParams({
        sortBy: 'name',
        sortOrder: 'asc',
        pageSize: '10',
        [args.vertical === 'accommodation' ? 'destinationIds' : 'destinationId']: args.destinationId
    });
    const response = await fetch(`${API_URL}/api/v1/public/${path}?${params}`);
    if (response.status !== 200)
        throw new Error(`Public ${path} returned HTTP ${response.status}.`);
    return PublicListSchema.parse(await response.json()).data.items;
}

/** Find or seed a monthly billing option for any current plan slug. */
export async function monthlyOptionForAnySlug(args: { readonly slug: string }): Promise<string> {
    const rows = await execSQL<{ id: string }>(
        `WITH current_version AS (
             SELECT pv.id FROM plan p JOIN plan_version pv ON pv.plan_id = p.id
             WHERE p.slug = $1 AND pv.current = true LIMIT 1
         ), inserted_option AS (
             INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
             SELECT id, 'monthly', 250000, 'ARS' FROM current_version
             ON CONFLICT (plan_version_id, cycle) DO NOTHING RETURNING id
         )
         SELECT id FROM inserted_option UNION ALL
         SELECT bo.id FROM billing_option bo JOIN current_version cv ON bo.plan_version_id = cv.id
         WHERE bo.cycle = 'monthly' LIMIT 1`,
        [args.slug]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error(`No current monthly option for ${args.slug}.`);
    return id;
}

/** Insert a published venue for a case-local featured-listing scenario. */
export async function insertVenue(args: {
    readonly ownerId: string;
    readonly destinationId: string;
    readonly name: string;
}): Promise<{ readonly id: string }> {
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO venues (
             slug, name, summary, description, type, owner_id, destination_id,
             business_lines, publication_status, inactive_since, deadlines_version
         ) VALUES ($1, $2, 'E2E summary', 'E2E description', 'RESTAURANT', $3, $4,
                   ARRAY['food']::text[], 'PUBLISHED', NOW(), 1)
         RETURNING id`,
        [`hos2138-${randomUUID()}`, args.name, args.ownerId, args.destinationId]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('insertVenue: insert returned no id.');
    return { id };
}

/** Insert a published excursion for a case-local featured-listing scenario. */
export async function insertExperience(args: {
    readonly ownerId: string;
    readonly destinationId: string;
    readonly name: string;
}): Promise<{ readonly id: string }> {
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO experiences (
             slug, name, summary, description, type, owner_id, destination_id,
             publication_status, inactive_since, deadlines_version
         ) VALUES ($1, $2, 'E2E summary', 'E2E description', 'EXCURSION', $3, $4,
                   'PUBLISHED', NOW(), 1)
         RETURNING id`,
        [`hos2138-${randomUUID()}`, args.name, args.ownerId, args.destinationId]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('insertExperience: insert returned no id.');
    return { id };
}

/** Delete only venue and experience rows created by a case. */
export async function deleteVerticalListings(args: {
    readonly venueIds: readonly string[];
    readonly experienceIds: readonly string[];
}): Promise<void> {
    if (args.venueIds.length > 0)
        await execSQL('DELETE FROM venues WHERE id = ANY($1::uuid[])', [args.venueIds]);
    if (args.experienceIds.length > 0)
        await execSQL('DELETE FROM experiences WHERE id = ANY($1::uuid[])', [args.experienceIds]);
}

/** Read the current plan and version ids for a catalog slug and vertical. */
export async function currentPlanVersion(args: {
    readonly slug: string;
}): Promise<{ readonly planId: string; readonly versionId: string }> {
    const rows = await execSQL<{ plan_id: string; version_id: string }>(
        `SELECT p.id AS plan_id, pv.id AS version_id
           FROM plan p JOIN plan_version pv ON pv.plan_id = p.id
          WHERE p.slug = $1 AND pv.current = true`,
        [args.slug]
    );
    const row = rows[0];
    if (!row) throw new Error(`No current plan version for ${args.slug}.`);
    return { planId: row.plan_id, versionId: row.version_id };
}
