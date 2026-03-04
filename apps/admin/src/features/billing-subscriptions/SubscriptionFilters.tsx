import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import { ALL_PLANS } from '@repo/billing';
import type { SubscriptionStatus } from './types';

/**
 * Props for SubscriptionFilters
 */
export interface SubscriptionFiltersProps {
    readonly searchQuery: string;
    readonly onSearchChange: (value: string) => void;
    readonly statusFilter: SubscriptionStatus | 'all';
    readonly onStatusChange: (value: SubscriptionStatus | 'all') => void;
    readonly planFilter: string;
    readonly onPlanChange: (value: string) => void;
}

/**
 * Subscription filters component.
 * Renders search input, status filter, and plan category filter.
 */
export function SubscriptionFilters({
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusChange,
    planFilter,
    onPlanChange
}: SubscriptionFiltersProps) {
    const { t } = useTranslations();
    const planCategories = Array.from(new Set(ALL_PLANS.map((plan) => plan.category)));

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
                            <option value="cancelled">
                                {t('admin-billing.subscriptions.statuses.cancelled')}
                            </option>
                            <option value="expired">
                                {t('admin-billing.subscriptions.statuses.expired')}
                            </option>
                        </select>
                    </div>
                    <div>
                        <Label htmlFor="plan">
                            {t('admin-billing.subscriptions.planCategoryFilter')}
                        </Label>
                        <select
                            id="plan"
                            className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={planFilter}
                            onChange={(e) => onPlanChange(e.target.value)}
                        >
                            <option value="all">
                                {t('admin-billing.subscriptions.allCategories')}
                            </option>
                            {planCategories.map((category) => (
                                <option
                                    key={category}
                                    value={category}
                                >
                                    {category === 'owner'
                                        ? t('admin-billing.subscriptions.categoryOwner')
                                        : category === 'complex'
                                          ? t('admin-billing.subscriptions.categoryComplex')
                                          : t('admin-billing.subscriptions.categoryTourist')}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
