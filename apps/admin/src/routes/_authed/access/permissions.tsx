/**
 * Permissions Page Route
 *
 * Displays all permission categories in the system.
 * Read-only reference page showing the permission catalog organized by category.
 */

import { ChevronDownIcon, ChevronRightIcon } from '@repo/icons';
import { PermissionCategoryEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import {
    categoryTranslationKey,
    GROUP_TRANSLATION_KEYS,
    groupPermissionCategories
} from '@/lib/permission-category-groups';

export const Route = createFileRoute('/_authed/access/permissions')({
    component: PermissionsPage
});

function PermissionsPage() {
    const { t } = useTranslations();
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    // `Object.values` builds a fresh array every render, so memoising on it as
    // a dependency would never hit. The enum is a module constant: compute both
    // once and depend on nothing.
    const groupedCategories = useMemo(
        () => groupPermissionCategories(Object.values(PermissionCategoryEnum)),
        []
    );
    const categoryCount = Object.keys(PermissionCategoryEnum).length;

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
                            <div className="font-bold text-2xl">{categoryCount}</div>
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
                            <div className="font-bold text-2xl">{groupedCategories.length}</div>
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
                    {groupedCategories.map(([groupName, groupCategories]) => {
                        const isExpanded = expandedGroups[groupName] ?? true;
                        const translatedGroupName = t(GROUP_TRANSLATION_KEYS[groupName]);

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
                                                        {t(categoryTranslationKey(category))}
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
                <div className="rounded-lg border border-info/30 bg-info/10 p-4">
                    <p className="text-foreground text-sm">
                        <strong>{t('admin-pages.access.permissions.infoNote')}:</strong>{' '}
                        {t('admin-pages.access.permissions.infoNoteDesc')}
                    </p>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
