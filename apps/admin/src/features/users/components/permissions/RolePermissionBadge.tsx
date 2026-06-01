/**
 * RolePermissionBadge (SPEC-170)
 *
 * Read-only badge for a permission the user inherits from their role. Rendered
 * disabled with an "inherited" label so the admin can tell role permissions
 * apart from direct overrides. These are not editable here (role permissions are
 * managed on the Roles page); they can only be turned into a deny override via
 * the picker.
 */
import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';
import type { PermissionEnum } from '@repo/schemas';

export interface RolePermissionBadgeProps {
    readonly permission: PermissionEnum;
}

export function RolePermissionBadge({ permission }: RolePermissionBadgeProps) {
    const { t } = useTranslations();

    return (
        <Badge
            variant="outline"
            className="gap-1.5 font-mono text-muted-foreground text-xs"
            title={t('admin-pages.access.users.permissions.inheritedFromRole')}
        >
            <span>{permission}</span>
            <span className="text-[10px] uppercase opacity-70">
                {t('admin-pages.access.users.permissions.inheritedFromRole')}
            </span>
        </Badge>
    );
}
