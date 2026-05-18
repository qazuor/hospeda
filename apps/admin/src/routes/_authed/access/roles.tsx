/**
 * Roles Management Page Route
 *
 * Displays all system roles with their descriptions and access levels.
 * Read-only reference page showing role hierarchy and capabilities.
 */

import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import {
    EditIcon,
    GlobeIcon,
    HomeIcon,
    ShieldAlertIcon,
    ShieldIcon,
    UserIcon,
    UsersIcon
} from '@repo/icons';
import { RoleEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/access/roles')({
    component: RolesPage
});

type RoleLevel = 'critical' | 'high' | 'medium' | 'low';

interface RoleVisual {
    level: RoleLevel;
    icon: typeof ShieldIcon;
}

/**
 * Per-role visual tokens (level + icon). Display labels, descriptions and
 * capabilities come from `admin-pages.access.roles.catalog.<ROLE>.*` i18n keys.
 */
const ROLE_VISUALS: Record<RoleEnum, RoleVisual> = {
    [RoleEnum.SUPER_ADMIN]: { level: 'critical', icon: ShieldAlertIcon },
    [RoleEnum.ADMIN]: { level: 'high', icon: ShieldIcon },
    [RoleEnum.CLIENT_MANAGER]: { level: 'high', icon: UsersIcon },
    [RoleEnum.EDITOR]: { level: 'medium', icon: EditIcon },
    [RoleEnum.HOST]: { level: 'medium', icon: HomeIcon },
    [RoleEnum.USER]: { level: 'low', icon: UserIcon },
    [RoleEnum.SPONSOR]: { level: 'low', icon: UserIcon },
    [RoleEnum.GUEST]: { level: 'low', icon: GlobeIcon },
    [RoleEnum.SYSTEM]: { level: 'low', icon: ShieldIcon }
};

// Badge variant mapping for role levels
const LEVEL_VARIANTS: Record<RoleLevel, 'destructive' | 'default' | 'secondary' | 'outline'> = {
    critical: 'destructive',
    high: 'default',
    medium: 'secondary',
    low: 'outline'
};

/** Max capabilities slots reserved per role in the i18n catalog (cap1..cap5). */
const MAX_CAPABILITIES = 5;

function RolesPage() {
    const { t } = useTranslations();
    // Get roles in hierarchical order
    const roles = Object.values(RoleEnum);

    const resolveCapabilities = (role: RoleEnum): string[] => {
        const result: string[] = [];
        for (let i = 1; i <= MAX_CAPABILITIES; i++) {
            const key =
                `admin-pages.access.roles.catalog.${role}.capabilities.cap${i}` as TranslationKey;
            const value = t(key);
            if (value.startsWith('[MISSING:')) break;
            result.push(value);
        }
        return result;
    };

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.accessRoles">
            <div className="space-y-6">
                {/* Page description */}
                <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-muted-foreground text-sm">
                        {t('admin-pages.access.roles.pageDescription')}
                    </p>
                </div>

                {/* Roles grid */}
                <div className="grid gap-6 md:grid-cols-2">
                    {roles.map((role) => {
                        const visual = ROLE_VISUALS[role];
                        const Icon = visual.icon;
                        const name = t(
                            `admin-pages.access.roles.catalog.${role}.name` as TranslationKey
                        );
                        const description = t(
                            `admin-pages.access.roles.catalog.${role}.description` as TranslationKey
                        );
                        const levelLabel = t(
                            `admin-pages.access.roles.levels.${visual.level}` as TranslationKey
                        );
                        const capabilities = resolveCapabilities(role);

                        return (
                            <Card
                                key={role}
                                className="flex flex-col"
                            >
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                                <Icon className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">{name}</CardTitle>
                                                <Badge
                                                    variant={LEVEL_VARIANTS[visual.level]}
                                                    className="mt-1"
                                                >
                                                    {levelLabel}{' '}
                                                    {t('admin-pages.access.roles.accessSuffix')}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <p className="mb-4 text-muted-foreground text-sm">
                                        {description}
                                    </p>

                                    <div>
                                        <h3 className="mb-2 font-medium text-sm">
                                            {t('admin-pages.access.roles.keyCapabilities')}
                                        </h3>
                                        <ul className="space-y-1">
                                            {capabilities.map((capability) => (
                                                <li
                                                    key={capability}
                                                    className="flex items-start gap-2 text-muted-foreground text-sm"
                                                >
                                                    <span className="mt-1 text-primary">•</span>
                                                    <span>{capability}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Info note */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                    <p className="text-blue-900 text-sm dark:text-blue-100">
                        <strong>{t('admin-pages.access.roles.infoNote')}:</strong>{' '}
                        {t('admin-pages.access.roles.infoNoteDesc')}
                    </p>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
