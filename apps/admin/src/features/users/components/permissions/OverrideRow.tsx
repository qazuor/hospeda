/**
 * OverrideRow (SPEC-170)
 *
 * A single per-user permission override: the permission name, a grant/deny
 * effect badge, and a remove button guarded by a confirmation dialog. Removing
 * reverts the user to their role's behavior for that permission.
 */
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { DeleteIcon } from '@repo/icons';
import type { PermissionEffect, PermissionEnum } from '@repo/schemas';

export interface OverrideRowProps {
    readonly permission: PermissionEnum;
    readonly effect: PermissionEffect;
    readonly onRemove: () => void;
    readonly isRemoving?: boolean;
}

export function OverrideRow({
    permission,
    effect,
    onRemove,
    isRemoving = false
}: OverrideRowProps) {
    const { t } = useTranslations();
    const isDeny = effect === 'deny';

    return (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
                <Badge
                    variant={isDeny ? 'destructive' : 'outline'}
                    className={
                        isDeny ? '' : 'border-emerald-600/30 text-emerald-700 dark:text-emerald-400'
                    }
                >
                    {isDeny
                        ? t('admin-pages.access.users.permissions.effectDeny')
                        : t('admin-pages.access.users.permissions.effectGrant')}
                </Badge>
                <span className="truncate font-mono text-sm">{permission}</span>
            </div>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={isRemoving}
                        aria-label={t('admin-pages.access.users.permissions.removeOverride')}
                    >
                        <DeleteIcon className="h-4 w-4" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('admin-pages.access.users.permissions.confirmRemove')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('admin-pages.access.users.permissions.confirmRemoveDesc')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {t('admin-pages.access.users.permissions.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={onRemove}>
                            {t('admin-pages.access.users.permissions.removeOverride')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
