import { useToast } from '@/components/ui/ToastProvider';
/**
 * PermissionOverridesCard (SPEC-170)
 *
 * Replaces the read-only "Direct Permission Overrides" stub. Lists the user's
 * grant and deny overrides (each removable with confirmation) and exposes the
 * categorized {@link PermissionPicker} to add new ones. Server state comes from
 * the per-user overrides query; mutations invalidate it and surface a toast.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    useAssignUserPermission,
    useRevokeUserPermission,
    useUserPermissionOverrides
} from '@/features/users/hooks/useUserPermissionOverrides';
import { useTranslations } from '@/hooks/use-translations';
import { ShieldIcon } from '@repo/icons';
import { type PermissionEffect, PermissionEffectEnum, type PermissionEnum } from '@repo/schemas';
import { OverrideRow } from './OverrideRow';
import { PermissionPicker } from './PermissionPicker';

export interface PermissionOverridesCardProps {
    readonly userId: string;
}

export function PermissionOverridesCard({ userId }: PermissionOverridesCardProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();

    const { data, isLoading, isError } = useUserPermissionOverrides(userId);
    const assign = useAssignUserPermission(userId);
    const revoke = useRevokeUserPermission(userId);

    const errorMessage = (error: unknown): string =>
        error instanceof Error ? error.message : t('admin-pages.access.users.permissions.error');

    const handleAssign = async (input: {
        permission: PermissionEnum;
        effect: PermissionEffect;
    }): Promise<void> => {
        try {
            await assign.mutateAsync(input);
            addToast({
                title:
                    input.effect === 'deny'
                        ? t('admin-pages.access.users.permissions.effectDeny')
                        : t('admin-pages.access.users.permissions.effectGrant'),
                message: t('admin-pages.access.users.permissions.changesTakeEffectNextRequest'),
                variant: 'success'
            });
        } catch (error) {
            addToast({
                title: t('admin-pages.access.users.permissions.error'),
                message: errorMessage(error),
                variant: 'error'
            });
        }
    };

    const handleRevoke = async (permission: PermissionEnum): Promise<void> => {
        try {
            await revoke.mutateAsync(permission);
            addToast({
                title: t('admin-pages.access.users.permissions.removeOverride'),
                message: t('admin-pages.access.users.permissions.changesTakeEffectNextRequest'),
                variant: 'success'
            });
        } catch (error) {
            addToast({
                title: t('admin-pages.access.users.permissions.error'),
                message: errorMessage(error),
                variant: 'error'
            });
        }
    };

    const grantOverrides = data?.grantOverrides ?? [];
    const denyOverrides = data?.denyOverrides ?? [];
    const hasOverrides = grantOverrides.length > 0 || denyOverrides.length > 0;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                            <ShieldIcon className="h-5 w-5 text-warning" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">
                                {t('admin-pages.access.users.permissions.directOverrides')}
                            </CardTitle>
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.access.users.permissions.directOverridesDesc')}
                            </p>
                        </div>
                    </div>
                    {data && (
                        <PermissionPicker
                            fromRole={data.fromRole}
                            grantOverrides={data.grantOverrides}
                            denyOverrides={data.denyOverrides}
                            onAssign={handleAssign}
                            isAssigning={assign.isPending}
                        />
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isLoading && <p className="py-6 text-center text-muted-foreground text-sm">…</p>}

                {isError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
                        {t('admin-pages.access.users.permissions.error')}
                    </div>
                )}

                {data && !hasOverrides && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <ShieldIcon className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                        <p className="mb-1 text-muted-foreground text-sm">
                            {t('admin-pages.access.users.permissions.noDirectOverrides')}
                        </p>
                        <p className="text-muted-foreground text-xs">
                            {t('admin-pages.access.users.permissions.noDirectOverridesDesc')}
                        </p>
                    </div>
                )}

                {data && hasOverrides && (
                    <div className="space-y-6">
                        {grantOverrides.length > 0 && (
                            <section className="space-y-2">
                                <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                                    {t('admin-pages.access.users.permissions.grantOverrides')}
                                </h4>
                                {grantOverrides.map((permission) => (
                                    <OverrideRow
                                        key={permission}
                                        permission={permission}
                                        effect={PermissionEffectEnum.GRANT}
                                        isRemoving={revoke.isPending}
                                        onRemove={() => handleRevoke(permission)}
                                    />
                                ))}
                            </section>
                        )}

                        {denyOverrides.length > 0 && (
                            <section className="space-y-2">
                                <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                                    {t('admin-pages.access.users.permissions.denyOverrides')}
                                </h4>
                                {denyOverrides.map((permission) => (
                                    <OverrideRow
                                        key={permission}
                                        permission={permission}
                                        effect={PermissionEffectEnum.DENY}
                                        isRemoving={revoke.isPending}
                                        onRemove={() => handleRevoke(permission)}
                                    />
                                ))}
                            </section>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
