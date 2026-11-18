/**
 * LeadCategoriesBlock
 *
 * Shows, inside the handle dialog, the categories a `service_provider`
 * applicant chose, resolved against the admin catalog with an inactive /
 * deleted / missing marker (HOS-2339). Renders nothing for other kinds or for
 * a lead with no category slugs.
 */

import type { AllianceLead } from '@repo/schemas';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';
import { useLeadCategories } from '../hooks/useLeadCategories';

/** Props for `LeadCategoriesBlock`. */
export type LeadCategoriesBlockProps = {
    readonly lead: Pick<AllianceLead, 'kind' | 'categorySlugs'>;
};

/**
 * Categories the applicant chose, with catalog state markers.
 *
 * @param props - `{ lead }`.
 */
export function LeadCategoriesBlock({ lead }: LeadCategoriesBlockProps) {
    const { t } = useTranslations();
    const slugs = lead.kind === 'service_provider' ? (lead.categorySlugs ?? []) : [];
    const { items, status } = useLeadCategories({ slugs });

    if (slugs.length === 0) return null;

    const hasInactive = status === 'ready' && items.some((item) => item.state !== 'active');

    return (
        <div
            className="space-y-1"
            data-testid="lead-categories-block"
        >
            <p className="font-medium text-sm">
                {t('admin-entities.allianceLeads.handle.categoriesLabel')}
            </p>
            {status === 'loading' ? (
                <div
                    className="h-5 w-40 animate-pulse rounded bg-muted"
                    data-testid="lead-categories-skeleton"
                />
            ) : (
                <ul className="flex flex-wrap gap-2">
                    {items.map((item) => (
                        <li
                            key={item.slug}
                            className="flex items-center gap-1 text-sm"
                        >
                            <span>{item.label}</span>
                            {item.state !== 'active' && (
                                <Badge variant="outline">
                                    {t(
                                        `admin-entities.allianceLeads.handle.categoryState.${item.state}` as Parameters<
                                            typeof t
                                        >[0]
                                    )}
                                </Badge>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {status === 'error' && (
                <p className="text-muted-foreground text-xs">
                    {t('admin-entities.allianceLeads.handle.catalogUnavailable')}
                </p>
            )}
            {hasInactive && (
                <p className="text-muted-foreground text-xs">
                    {t('admin-entities.allianceLeads.handle.categoriesNote')}
                </p>
            )}
        </div>
    );
}
