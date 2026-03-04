/**
 * Permissions Page Route
 *
 * Displays all permission categories in the system.
 * Read-only reference page showing the permission catalog organized by category.
 */

import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { ChevronDownIcon, ChevronRightIcon } from '@repo/icons';
import { PermissionCategoryEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/access/permissions')({
    component: PermissionsPage
});

/**
 * Format category name from enum value
 * ACCOMMODATION_REVIEW -> Accommodation Review
 */
function formatCategoryName(category: string): string {
    return category
        .split('_')
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
}

// Internal group keys (not displayed directly, translated in render)
const GROUP_KEYS = {
    CONTENT_MANAGEMENT: 'Content Management',
    USER_ACCESS: 'User & Access',
    COMMERCE_BILLING: 'Commerce & Billing',
    MARKETING_ADVERTISING: 'Marketing & Advertising',
    SERVICES_LISTINGS: 'Services & Listings',
    SYSTEM_CONFIGURATION: 'System & Configuration'
} as const;

type GroupKey = (typeof GROUP_KEYS)[keyof typeof GROUP_KEYS];

const GROUP_TRANSLATION_KEYS: Record<GroupKey, TranslationKey> = {
    'Content Management': 'admin-pages.access.permissions.groupContentManagement',
    'User & Access': 'admin-pages.access.permissions.groupUserAccess',
    'Commerce & Billing': 'admin-pages.access.permissions.groupCommerceBilling',
    'Marketing & Advertising': 'admin-pages.access.permissions.groupMarketingAdvertising',
    'Services & Listings': 'admin-pages.access.permissions.groupServicesListings',
    'System & Configuration': 'admin-pages.access.permissions.groupSystemConfiguration'
};

/**
 * Group categories by domain for better organization
 */
function groupCategories(categories: string[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {
        'Content Management': [],
        'User & Access': [],
        'Commerce & Billing': [],
        'Marketing & Advertising': [],
        'Services & Listings': [],
        'System & Configuration': []
    };

    for (const category of categories) {
        const cat = category as PermissionCategoryEnum;

        // Content entities
        if (
            [
                PermissionCategoryEnum.ACCOMMODATION,
                PermissionCategoryEnum.ACCOMMODATION_REVIEW,
                PermissionCategoryEnum.DESTINATION,
                PermissionCategoryEnum.DESTINATION_REVIEW,
                PermissionCategoryEnum.EVENT,
                PermissionCategoryEnum.POST,
                PermissionCategoryEnum.ATTRACTION
            ].includes(cat)
        ) {
            groups['Content Management'].push(category);
        }
        // User and access
        else if (
            [
                PermissionCategoryEnum.USER,
                PermissionCategoryEnum.USER_BOOKMARK,
                PermissionCategoryEnum.PERMISSION,
                PermissionCategoryEnum.CLIENT_ACCESS_RIGHT
            ].includes(cat)
        ) {
            groups['User & Access'].push(category);
        }
        // Commerce
        else if (
            [
                PermissionCategoryEnum.INVOICE,
                PermissionCategoryEnum.INVOICE_LINE,
                PermissionCategoryEnum.PAYMENT,
                PermissionCategoryEnum.PAYMENT_METHOD,
                PermissionCategoryEnum.PURCHASE,
                PermissionCategoryEnum.REFUND,
                PermissionCategoryEnum.CREDIT_NOTE,
                PermissionCategoryEnum.SUBSCRIPTION,
                PermissionCategoryEnum.SUBSCRIPTION_ITEM,
                PermissionCategoryEnum.PRODUCT,
                PermissionCategoryEnum.CLIENT
            ].includes(cat)
        ) {
            groups['Commerce & Billing'].push(category);
        }
        // Marketing
        else if (
            [
                PermissionCategoryEnum.CAMPAIGN,
                PermissionCategoryEnum.PROMOTION,
                PermissionCategoryEnum.DISCOUNT_CODE,
                PermissionCategoryEnum.DISCOUNT_CODE_USAGE,
                PermissionCategoryEnum.AD_PRICING_CATALOG,
                PermissionCategoryEnum.POST_SPONSOR,
                PermissionCategoryEnum.POST_SPONSORSHIP
            ].includes(cat)
        ) {
            groups['Marketing & Advertising'].push(category);
        }
        // Services and listings
        else if (
            [
                PermissionCategoryEnum.ACCOMMODATION_LISTING,
                PermissionCategoryEnum.ACCOMMODATION_LISTING_PLAN,
                PermissionCategoryEnum.SERVICE_LISTING,
                PermissionCategoryEnum.SERVICE_LISTING_PLAN,
                PermissionCategoryEnum.SERVICE_ORDER,
                PermissionCategoryEnum.BENEFIT_LISTING,
                PermissionCategoryEnum.BENEFIT_LISTING_PLAN,
                PermissionCategoryEnum.BENEFIT_PARTNER,
                PermissionCategoryEnum.TOURIST_SERVICE,
                PermissionCategoryEnum.PROFESSIONAL_SERVICE,
                PermissionCategoryEnum.PROFESSIONAL_SERVICE_ORDER
            ].includes(cat)
        ) {
            groups['Services & Listings'].push(category);
        }
        // System
        else if (
            [
                PermissionCategoryEnum.NOTIFICATION,
                PermissionCategoryEnum.EVENT_LOCATION,
                PermissionCategoryEnum.EVENT_ORGANIZER,
                PermissionCategoryEnum.PUBLIC,
                PermissionCategoryEnum.SYSTEM,
                PermissionCategoryEnum.ACCESS
            ].includes(cat)
        ) {
            groups['System & Configuration'].push(category);
        }
    }

    // Remove empty groups
    return Object.fromEntries(Object.entries(groups).filter(([_, items]) => items.length > 0));
}

function PermissionsPage() {
    const { t } = useTranslations();
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const categories = Object.values(PermissionCategoryEnum);
    const groupedCategories = groupCategories(categories);

    const toggleGroup = (groupName: string) => {
        setExpandedGroups((prev) => ({
            ...prev,
            [groupName]: !prev[groupName]
        }));
    };

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.accessPermissions">
            <div className="space-y-6">
                {/* Page description */}
                <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-muted-foreground text-sm">
                        {t('admin-pages.access.permissions.pageDescription')}
                    </p>
                </div>

                {/* Summary stats */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="font-medium text-sm">
                                {t('admin-pages.access.permissions.totalCategories')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="font-bold text-2xl">{categories.length}</div>
                            <p className="text-muted-foreground text-xs">
                                {t('admin-pages.access.permissions.permissionCategories')}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="font-medium text-sm">
                                {t('admin-pages.access.permissions.domainGroups')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="font-bold text-2xl">
                                {Object.keys(groupedCategories).length}
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {t('admin-pages.access.permissions.functionalDomains')}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="font-medium text-sm">
                                {t('admin-pages.access.permissions.accessControl')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="font-bold text-2xl">
                                {t('admin-pages.access.permissions.fineGrained')}
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {t('admin-pages.access.permissions.permissionModel')}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Permission categories by group */}
                <div className="space-y-4">
                    {Object.entries(groupedCategories).map(([groupName, groupCategories]) => {
                        const isExpanded = expandedGroups[groupName] ?? true;
                        const translationKey = (GROUP_TRANSLATION_KEYS[groupName as GroupKey] ??
                            groupName) as TranslationKey;
                        const translatedGroupName = t(translationKey);

                        return (
                            <Card key={groupName}>
                                <CardHeader
                                    className="cursor-pointer transition-colors hover:bg-muted/50"
                                    onClick={() => toggleGroup(groupName)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {isExpanded ? (
                                                <ChevronDownIcon className="h-5 w-5 text-muted-foreground" />
                                            ) : (
                                                <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
                                            )}
                                            <CardTitle className="text-lg">
                                                {translatedGroupName}
                                            </CardTitle>
                                        </div>
                                        <Badge variant="secondary">{groupCategories.length}</Badge>
                                    </div>
                                </CardHeader>

                                {isExpanded && (
                                    <CardContent>
                                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {groupCategories.map((category) => (
                                                <div
                                                    key={category}
                                                    className="flex items-center gap-2 rounded-md border bg-card p-3 text-sm transition-colors hover:bg-muted/50"
                                                >
                                                    <span className="text-primary">•</span>
                                                    <span className="font-medium">
                                                        {formatCategoryName(category)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>

                {/* Info note */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                    <p className="text-blue-900 text-sm dark:text-blue-100">
                        <strong>{t('admin-pages.access.permissions.infoNote')}:</strong>{' '}
                        {t('admin-pages.access.permissions.infoNoteDesc')}
                    </p>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
