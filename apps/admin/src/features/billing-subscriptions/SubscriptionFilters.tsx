import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import type { SubscriptionStatus } from './types';

/**
 * Every product line a subscription can belong to (SPEC-239 / HOS-278).
 * Not sourced from `ALL_PLANS.category` — that's an accommodation-only
 * static catalog and carries no `productDomain` field at all. `productDomain`
 * comes straight from the admin billing view contract's
 * `AdminSubscriptionViewSearchSchema`.
 */
const PRODUCT_DOMAINS = ['accommodation', 'commerce', 'partner'] as const;

/**
 * Props for SubscriptionFilters
 */
export interface SubscriptionFiltersProps {
    readonly searchQuery: string;
    readonly onSearchChange: (value: string) => void;
    readonly statusFilter: SubscriptionStatus | 'all';
    readonly onStatusChange: (value: SubscriptionStatus | 'all') => void;
    readonly productDomainFilter: string;
    readonly onProductDomainChange: (value: string) => void;
}

/**
 * Subscription filters component.
 * Renders search input, status filter, and product-domain filter.
 *
 * The previous "plan category" filter compared an `ALL_PLANS`-derived
 * category (`owner`/`complex`/`tourist`) against `sub.planSlug` — a plan
 * SLUG, never a category — so it silently matched nothing. `productDomain`
 * is a real, first-class field on the subscription's plan ref and is what
 * the search endpoint actually accepts.
 */
export function SubscriptionFilters({
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusChange,
    productDomainFilter,
    onProductDomainChange
}: SubscriptionFiltersProps) {
    const { t } = useTranslations();

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin-billing.subscriptions.filtersTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                    <div>
                        <Label htmlFor="search">
                            {t('admin-billing.subscriptions.searchLabel')}
                        </Label>
                        <Input
                            id="search"
                            placeholder={t('admin-billing.subscriptions.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                    <div>
                        <Label htmlFor="status">
                            {t('admin-billing.subscriptions.statusFilter')}
                        </Label>
                        <select
                            id="status"
                            className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={statusFilter}
                            onChange={(e) =>
                                onStatusChange(e.target.value as SubscriptionStatus | 'all')
                            }
                        >
                            <option value="all">
                                {t('admin-billing.subscriptions.allFilter')}
                            </option>
                            <option value="active">
                                {t('admin-billing.subscriptions.statuses.active')}
                            </option>
                            <option value="trialing">
                                {t('admin-billing.subscriptions.statuses.trialing')}
                            </option>
                            <option value="past_due">
                                {t('admin-billing.subscriptions.statuses.pastDue')}
                            </option>
                            <option value="paused">
                                {t('admin-billing.subscriptions.statuses.paused')}
                            </option>
                            <option value="cancelled">
                                {t('admin-billing.subscriptions.statuses.cancelled')}
                            </option>
                            <option value="expired">
                                {t('admin-billing.subscriptions.statuses.expired')}
                            </option>
                            <option value="pending_provider">
                                {t('admin-billing.subscriptions.statuses.pendingProvider')}
                            </option>
                            <option value="abandoned">
                                {t('admin-billing.subscriptions.statuses.abandoned')}
                            </option>
                            <option value="comp">
                                {t('admin-billing.subscriptions.statuses.comp')}
                            </option>
                        </select>
                    </div>
                    <div>
                        <Label htmlFor="product-domain">
                            {t('admin-billing.subscriptions.planDomainFilter')}
                        </Label>
                        <select
                            id="product-domain"
                            className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={productDomainFilter}
                            onChange={(e) => onProductDomainChange(e.target.value)}
                        >
                            <option value="all">
                                {t('admin-billing.subscriptions.allDomains')}
                            </option>
                            {PRODUCT_DOMAINS.map((domain) => (
                                <option
                                    key={domain}
                                    value={domain}
                                >
                                    {t(`admin-billing.subscriptions.productDomainLabels.${domain}`)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
