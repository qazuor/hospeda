/**
 * UserRolesCard (HOS-296 §6.5 / §8, AC-10)
 *
 * Replaces the single-`SELECT` "Rol" form field that used to live in the
 * user's Role & Permissions section. That field wrote a scalar `users.role`
 * through the generic user PATCH body; the column is gone and the field with
 * it, so this card is what keeps an admin able to administer roles **in the
 * same release** that removed the scalar.
 *
 * Why a card and not a form field: a role is no longer one value on the user
 * entity. It is a SET, each element carrying provenance (`grantedAt`,
 * `grantedBy`, `grantReason`) that §6.5 and §8 explicitly require the panel to
 * show — that visibility is the stated mitigation for R-1, an account silently
 * accumulating hats nobody can account for. None of the entity-form field
 * types can carry per-option metadata or perform the two dedicated
 * grant/revoke calls, and the generic user PATCH no longer accepts `role` at
 * all, so a field would have had nowhere to write.
 *
 * Mutations are NOT optimistic: a role change is the same class of
 * security-sensitive write as a permission override, so the UI waits for the
 * server's post-mutation set.
 *
 * @module features/users/components/roles/UserRolesCard
 */

import type { TranslationKey } from '@repo/i18n';
import { AddIcon, DeleteIcon, UserSwitchIcon } from '@repo/icons';
import { RoleEnum } from '@repo/schemas';
import { useMemo, useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useToast } from '@/components/ui/ToastProvider';
import {
    useGrantUserRole,
    useRevokeUserRole,
    useUserRoles
} from '@/features/users/hooks/useUserRoles';
import { useTranslations } from '@/hooks/use-translations';
import { formatDateWithTime } from '@/lib/format-helpers';

/**
 * Roles an operator may never hand out or take away from the panel.
 *
 * `SYSTEM` belongs to the permanent seeded system account and `GUEST` is
 * synthesised for unauthenticated requests — neither is granted or revoked at
 * runtime by anything (spec §7). Offering them would let an operator create
 * states the rest of the platform assumes cannot exist.
 */
const NON_ASSIGNABLE_ROLES: readonly RoleEnum[] = [RoleEnum.SYSTEM, RoleEnum.GUEST];

export interface UserRolesCardProps {
    /** User whose hats are being administered. */
    readonly userId: string;
}

/**
 * Multi-role management card: shows every hat with its provenance and lets an
 * operator grant or revoke one.
 *
 * @param props.userId - User whose hats are being administered.
 */
export function UserRolesCard({ userId }: UserRolesCardProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();

    const { data, isLoading, isError } = useUserRoles(userId);
    const grant = useGrantUserRole(userId);
    const revoke = useRevokeUserRole(userId);

    const [roleToGrant, setRoleToGrant] = useState<RoleEnum | ''>('');
    const [reason, setReason] = useState('');

    const heldRoles = useMemo(() => data?.roles ?? [], [data]);

    /** Roles the user does not already wear, minus the never-assignable ones. */
    const grantableRoles = useMemo(() => {
        const held = new Set(heldRoles.map((entry) => entry.role));
        return Object.values(RoleEnum).filter(
            (role) => !held.has(role) && !NON_ASSIGNABLE_ROLES.includes(role)
        );
    }, [heldRoles]);

    /** Human label for a role, reusing the existing role-catalog i18n keys. */
    const roleLabel = (role: RoleEnum): string =>
        t(`admin-pages.access.roles.catalog.${role}.name` as TranslationKey);

    /**
     * Surfaces the API's message verbatim when there is one.
     *
     * The last-role refusal (AC-5) arrives as a 400 with an explanatory
     * message; collapsing it into a generic "something went wrong" would hide
     * a deliberate rule behind what reads like an outage.
     */
    const errorMessage = (error: unknown): string =>
        error instanceof Error && error.message
            ? error.message
            : t('admin-pages.access.users.roles.error');

    const handleGrant = async (): Promise<void> => {
        if (!roleToGrant) return;
        try {
            await grant.mutateAsync({
                role: roleToGrant,
                ...(reason.trim() ? { reason: reason.trim() } : {})
            });
            setRoleToGrant('');
            setReason('');
            addToast({
                title: t('admin-pages.access.users.roles.granted'),
                message: t('admin-pages.access.users.roles.changesTakeEffectNextRequest'),
                variant: 'success'
            });
        } catch (error) {
            addToast({
                title: t('admin-pages.access.users.roles.error'),
                message: errorMessage(error),
                variant: 'error'
            });
        }
    };

    const handleRevoke = async (role: RoleEnum): Promise<void> => {
        try {
            await revoke.mutateAsync({ role });
            addToast({
                title: t('admin-pages.access.users.roles.revoked'),
                message: t('admin-pages.access.users.roles.changesTakeEffectNextRequest'),
                variant: 'success'
            });
        } catch (error) {
            addToast({
                title: t('admin-pages.access.users.roles.error'),
                message: errorMessage(error),
                variant: 'error'
            });
        }
    };

    // The last hat cannot be revoked (AC-5) — disable rather than let the
    // operator discover the rule through a failed request.
    const isLastRole = heldRoles.length <= 1;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <UserSwitchIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">
                            {t('admin-pages.access.users.roles.title')}
                        </CardTitle>
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.access.users.roles.description')}
                        </p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                {isLoading && (
                    <p className="py-6 text-center text-muted-foreground text-sm">
                        {t('admin-pages.access.users.roles.loading')}
                    </p>
                )}

                {isError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
                        {t('admin-pages.access.users.roles.error')}
                    </div>
                )}

                {data && (
                    <>
                        <div className="space-y-2">
                            {heldRoles.map((entry) => (
                                <div
                                    key={entry.role}
                                    className="flex items-start justify-between gap-3 rounded-md border bg-card px-3 py-2"
                                >
                                    <div className="min-w-0 space-y-1">
                                        <Badge variant="default">{roleLabel(entry.role)}</Badge>
                                        {/* §6.5 / §8: WHEN it was granted and BY WHOM. */}
                                        <p className="text-muted-foreground text-xs">
                                            {t('admin-pages.access.users.roles.grantedAt')}{' '}
                                            {formatDateWithTime({
                                                date:
                                                    entry.grantedAt instanceof Date
                                                        ? entry.grantedAt.toISOString()
                                                        : entry.grantedAt
                                            })}{' '}
                                            ·{' '}
                                            {entry.grantedByName ??
                                                t('admin-pages.access.users.roles.grantedBySystem')}
                                        </p>
                                        {entry.grantReason && (
                                            <p className="truncate text-muted-foreground text-xs italic">
                                                {entry.grantReason}
                                            </p>
                                        )}
                                    </div>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={revoke.isPending || isLastRole}
                                                title={
                                                    isLastRole
                                                        ? t(
                                                              'admin-pages.access.users.roles.cannotRevokeLast'
                                                          )
                                                        : t(
                                                              'admin-pages.access.users.roles.revokeRole'
                                                          )
                                                }
                                                aria-label={t(
                                                    'admin-pages.access.users.roles.revokeRole'
                                                )}
                                            >
                                                <DeleteIcon className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                    {t(
                                                        'admin-pages.access.users.roles.confirmRevoke'
                                                    )}
                                                </AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    {t(
                                                        'admin-pages.access.users.roles.confirmRevokeDesc'
                                                    )}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>
                                                    {t('admin-pages.access.users.roles.cancel')}
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => void handleRevoke(entry.role)}
                                                >
                                                    {t('admin-pages.access.users.roles.revokeRole')}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ))}
                        </div>

                        {isLastRole && (
                            <p className="text-muted-foreground text-xs">
                                {t('admin-pages.access.users.roles.cannotRevokeLast')}
                            </p>
                        )}

                        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
                            <Select
                                value={roleToGrant}
                                onValueChange={(value) => setRoleToGrant(value as RoleEnum)}
                                disabled={grantableRoles.length === 0 || grant.isPending}
                            >
                                <SelectTrigger className="sm:w-56">
                                    <SelectValue
                                        placeholder={t(
                                            'admin-pages.access.users.roles.selectRolePlaceholder'
                                        )}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {grantableRoles.map((role) => (
                                        <SelectItem
                                            key={role}
                                            value={role}
                                        >
                                            {roleLabel(role)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Input
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                maxLength={500}
                                placeholder={t('admin-pages.access.users.roles.reasonPlaceholder')}
                                aria-label={t('admin-pages.access.users.roles.reasonPlaceholder')}
                                className="sm:flex-1"
                            />

                            <Button
                                type="button"
                                onClick={() => void handleGrant()}
                                disabled={!roleToGrant || grant.isPending}
                            >
                                <AddIcon className="mr-2 h-4 w-4" />
                                {t('admin-pages.access.users.roles.grantRole')}
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
