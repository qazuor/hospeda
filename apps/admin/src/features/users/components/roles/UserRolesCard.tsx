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

import { AddIcon, DeleteIcon, UserSwitchIcon } from '@repo/icons';
import { LAST_ROLE_REVOKE_REASON, NON_ASSIGNABLE_ROLES, RoleEnum } from '@repo/schemas';
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
import { buildRoleLabelKey } from '@/features/users/utils/role-label';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors';
import { formatDateWithTime } from '@/lib/format-helpers';

export interface UserRolesCardProps {
    /** User whose hats are being administered. */
    readonly userId: string;
}

interface RevokeRoleDialogProps {
    /** Hat this dialog revokes. */
    readonly role: RoleEnum;
    /** Disables the trigger (a pending mutation, or the last remaining hat). */
    readonly disabled: boolean;
    /** `true` when the hat is the account's last one (AC-5) — changes the tooltip. */
    readonly isLastRole: boolean;
    /** Called with the role and the justification the operator typed HERE. */
    readonly onConfirm: (params: { role: RoleEnum; reason: string }) => void;
}

/**
 * Revoke trigger plus its confirmation dialog, owning the justification the
 * revoke writes to `user_role_audit`.
 *
 * The reason input lives INSIDE the dialog, and the state is local to this
 * component, for two reasons that are the same reason:
 *
 * 1. The operator must SEE the text they are about to record at the moment
 *    they confirm. The grant row's input is elsewhere on the card, so a reason
 *    typed there is invisible from the confirmation dialog — a grant
 *    justification silently became the REVOKE's audit reason. Wrong
 *    attribution in an append-only table is worse than none: AC-6 exists so an
 *    admin-initiated change is explicable, not merely non-null.
 * 2. Local state gives per-row isolation and a free reset — Radix closes the
 *    dialog after the action, and `onOpenChange` clears the field, so a reason
 *    can never leak from one role's dialog into another's.
 *
 * @param props - See {@link RevokeRoleDialogProps}.
 */
function RevokeRoleDialog({ role, disabled, isLastRole, onConfirm }: RevokeRoleDialogProps) {
    const { t } = useTranslations();
    const [reason, setReason] = useState('');

    return (
        <AlertDialog
            onOpenChange={(open) => {
                if (!open) setReason('');
            }}
        >
            <AlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    title={
                        isLastRole
                            ? t('admin-pages.access.users.roles.cannotRevokeLast')
                            : t('admin-pages.access.users.roles.revokeRole')
                    }
                    aria-label={t('admin-pages.access.users.roles.revokeRole')}
                >
                    <DeleteIcon className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {t('admin-pages.access.users.roles.confirmRevoke')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('admin-pages.access.users.roles.confirmRevokeDesc')}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <Input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    placeholder={t('admin-pages.access.users.roles.revokeReasonPlaceholder')}
                    aria-label={t('admin-pages.access.users.roles.revokeReasonPlaceholder')}
                />

                <AlertDialogFooter>
                    <AlertDialogCancel>
                        {t('admin-pages.access.users.roles.cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={() => onConfirm({ role, reason })}>
                        {t('admin-pages.access.users.roles.revokeRole')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
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
    /**
     * Justification for the GRANT only.
     *
     * Grant and revoke hold SEPARATE reason state on purpose. A single shared
     * input sat in the grant row, so an operator who typed a grant
     * justification and then revoked a hat instead wrote that grant-intent text
     * into the REVOKE's append-only audit row — confidently wrong attribution,
     * which is worse than the `null` it replaced. The revoke's own reason is
     * typed inside its confirmation dialog (see {@link RevokeRoleDialog}), where
     * the operator can SEE what they are about to record.
     */
    const [grantReason, setGrantReason] = useState('');

    const heldRoles = useMemo(() => data?.roles ?? [], [data]);

    /**
     * Roles the user does not already wear, minus the never-assignable ones.
     *
     * `NON_ASSIGNABLE_ROLES` comes from `@repo/schemas`, where
     * `GrantUserRoleBodySchema` enforces the same list server-side — this
     * dropdown only hides what the API already rejects.
     */
    const grantableRoles = useMemo(() => {
        const held = new Set(heldRoles.map((entry) => entry.role));
        return Object.values(RoleEnum).filter(
            (role) => !held.has(role) && !NON_ASSIGNABLE_ROLES.includes(role)
        );
    }, [heldRoles]);

    /**
     * Human label for a role.
     *
     * The key comes from the shared `buildRoleLabelKey` helper so this card and
     * the page header cannot drift apart — they used to read two different
     * catalogues for the same roles on the same screen.
     */
    const roleLabel = (role: RoleEnum): string => t(buildRoleLabelKey({ role }));

    /**
     * Turns a failed mutation into a message an operator can read.
     *
     * The last-role refusal (AC-5) is recognised by its machine-readable
     * `reason` and rendered from the translation catalogue. Its raw message is
     * deliberately NOT shown: it is English in a Spanish panel AND it embeds
     * the subject's internal UUID (`... last role held by user '<uuid>'`).
     * `useUserRoles` already logs the raw error, which is where that text
     * belongs.
     *
     * Any other failure still surfaces the API's own message — collapsing a
     * deliberate rule into a generic "something went wrong" would make a rule
     * read like an outage.
     */
    const errorMessage = (error: unknown): string => {
        const reason = isApiError(error)
            ? (error.body as { error?: { reason?: string } } | undefined)?.error?.reason
            : undefined;

        if (reason === LAST_ROLE_REVOKE_REASON) {
            return t('admin-pages.access.users.roles.cannotRevokeLast');
        }

        return error instanceof Error && error.message
            ? error.message
            : t('admin-pages.access.users.roles.error');
    };

    const handleGrant = async (): Promise<void> => {
        if (!roleToGrant) return;
        const trimmed = grantReason.trim();
        try {
            await grant.mutateAsync({
                role: roleToGrant,
                ...(trimmed ? { reason: trimmed } : {})
            });
            setRoleToGrant('');
            setGrantReason('');
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

    const handleRevoke = async (params: { role: RoleEnum; reason: string }): Promise<void> => {
        const { role } = params;
        const trimmed = params.reason.trim();
        try {
            // AC-6 requires `action`, `by` AND `reason`. The reason comes from
            // the revoke dialog's own input — never from the grant row's —
            // so what lands in the audit row is exactly what the operator saw
            // while confirming THIS revoke.
            await revoke.mutateAsync({
                role,
                ...(trimmed ? { reason: trimmed } : {})
            });
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

                                    <RevokeRoleDialog
                                        role={entry.role}
                                        disabled={revoke.isPending || isLastRole}
                                        isLastRole={isLastRole}
                                        onConfirm={(confirmed) => void handleRevoke(confirmed)}
                                    />
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
                                value={grantReason}
                                onChange={(event) => setGrantReason(event.target.value)}
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
