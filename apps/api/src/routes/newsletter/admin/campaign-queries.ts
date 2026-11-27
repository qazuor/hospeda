import type { SelectNewsletterCampaign } from '@repo/db';
import { getDb, newsletterCampaigns, safeIlike } from '@repo/db';
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';

/** Injectable read-only campaign list query. */
export interface ListCampaignsDeps {
    queryCampaigns: (opts: {
        campaignStatus?: string;
        localeFilter?: string;
        titleSearch?: string;
        sort?: string;
        page: number;
        pageSize: number;
    }) => Promise<{ items: SelectNewsletterCampaign[]; total: number }>;
}

/** Injectable single-campaign lookup, excluding soft-deleted rows. */
export interface GetCampaignByIdDeps {
    queryCampaignById: (id: string) => Promise<SelectNewsletterCampaign | null>;
}

/** Query campaigns directly because the campaign service exposes no list method. */
export async function defaultQueryCampaigns(
    opts: Parameters<ListCampaignsDeps['queryCampaigns']>[0]
) {
    const db = getDb();
    const conditions = [isNull(newsletterCampaigns.deletedAt)];
    if (opts.campaignStatus) {
        conditions.push(
            eq(
                newsletterCampaigns.status,
                opts.campaignStatus as 'draft' | 'sending' | 'sent' | 'cancelled'
            )
        );
    }
    if (opts.localeFilter) {
        conditions.push(
            eq(newsletterCampaigns.localeFilter, opts.localeFilter as 'all' | 'es' | 'en' | 'pt')
        );
    }
    if (typeof opts.titleSearch === 'string' && opts.titleSearch.length > 0) {
        conditions.push(safeIlike(newsletterCampaigns.title, opts.titleSearch));
    }
    const whereClause = and(...conditions);
    const orderBy =
        opts.sort === 'asc'
            ? asc(newsletterCampaigns.createdAt)
            : desc(newsletterCampaigns.createdAt);
    const [items, totalResult] = await Promise.all([
        db
            .select()
            .from(newsletterCampaigns)
            .where(whereClause)
            .orderBy(orderBy)
            .limit(opts.pageSize)
            .offset((opts.page - 1) * opts.pageSize),
        db.select({ total: count() }).from(newsletterCampaigns).where(whereClause)
    ]);
    return { items, total: totalResult[0]?.total ?? 0 };
}

/** Fetch a non-deleted campaign by UUID. */
export async function defaultQueryCampaignById(
    id: string
): Promise<SelectNewsletterCampaign | null> {
    const [campaign] = await getDb()
        .select()
        .from(newsletterCampaigns)
        .where(and(eq(newsletterCampaigns.id, id), isNull(newsletterCampaigns.deletedAt)))
        .limit(1);
    return campaign ?? null;
}
