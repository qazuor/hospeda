import { z } from '@hono/zod-openapi';
import { getDb, sql } from '@repo/db';
import { PermissionEnum, ProductDomainEnum } from '@repo/schemas';
import { createAdminRoute } from '../../../utils/route-factory';

const PartnerAdminPlanSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    monthlyPriceArs: z.number().nullable()
});

export const adminListPartnerPlansRoute = createAdminRoute({
    method: 'get',
    path: '/plans',
    summary: 'List partner billing plans (admin)',
    description: 'Returns active billing plans in the partner product domain.',
    tags: ['Partners', 'Billing'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    responseSchema: z.array(PartnerAdminPlanSchema),
    handler: async () => {
        const db = getDb();
        const result = await db.execute(sql`
            SELECT
                p.id,
                p.name AS slug,
                COALESCE(p.metadata->>'displayName', p.name) AS name,
                p.description,
                (
                    SELECT bp.unit_amount
                    FROM billing_prices bp
                    WHERE bp.plan_id = p.id
                      AND bp.currency = 'ARS'
                      AND bp.billing_interval = 'month'
                      AND bp.interval_count = 1
                      AND bp.active = true
                    ORDER BY bp.created_at DESC
                    LIMIT 1
                ) AS monthly_price_ars
            FROM billing_plans p
            WHERE p.active = true
              AND p.product_domain = ${ProductDomainEnum.PARTNER}
            ORDER BY p.created_at ASC
        `);

        const rows = (Array.isArray(result) ? result : (result.rows ?? [])) as Array<{
            id: string;
            slug: string;
            name: string;
            description: string | null;
            monthly_price_ars: number | null;
        }>;

        return rows.map((row) => ({
            id: row.id,
            slug: row.slug,
            name: row.name,
            description: row.description,
            monthlyPriceArs: row.monthly_price_ars
        }));
    }
});
