/** Confirmation panel for assigning or removing the SUPER_ADMIN role. */

import { DeleteIcon } from '@repo/icons';
import { SUPER_ADMIN_ONLY_ACTION_KEYS } from '@repo/schemas';
import { useEffect, useState } from 'react';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import { useUserQuery } from '../../hooks/useUserQuery';

/** Props for {@link SuperAdminRoleDialog}. RO-RO pattern. */
export interface SuperAdminRoleDialogProps {
    /** Account that receives or loses the role. */
    readonly userId: string;
    /** Whether this confirms assigning or removing the role. */
    readonly change: 'ASSIGN' | 'REMOVE';
    /** Controlled dialog state. */
    readonly open?: boolean;
    /** Called when the dialog requests an open-state change. */
    readonly onOpenChange?: (open: boolean) => void;
    /** Disables confirmation while the role mutation is pending. */
    readonly pending: boolean;
    /** Called with the trimmed audit reason. */
    readonly onConfirm: (params: { readonly reason: string }) => void | Promise<void>;
    /** Disables the REMOVE trigger when the account cannot lose its last role. */
    readonly disabled?: boolean;
}

/** Confirms the account identity, seven capabilities, and mandatory audit reason. */
export function SuperAdminRoleDialog({
    userId,
    change,
    open,
    onOpenChange,
    pending,
    onConfirm,
    disabled = false
}: SuperAdminRoleDialogProps) {
    const { t } = useTranslations();
    const [reason, setReason] = useState('');
    const [internalOpen, setInternalOpen] = useState(false);
    const dialogOpen = open ?? internalOpen;
    const changeOpen = onOpenChange ?? setInternalOpen;
    const user = useUserQuery(userId, { enabled: dialogOpen });
    const account = user.data;
    const email = typeof account?.email === 'string' ? account.email : '';
    const name = typeof account?.displayName === 'string' ? account.displayName : email;
    const action = change === 'ASSIGN' ? 'assign' : 'remove';
    const prefix = 'admin-pages.access.users.roles.superAdmin';

    useEffect(() => {
        if (!dialogOpen) setReason('');
    }, [dialogOpen]);

    return (
        <>
            {change === 'REMOVE' && (
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => changeOpen(true)}
                    aria-label={t('admin-pages.access.users.roles.revokeRole')}
                >
                    <DeleteIcon className="h-4 w-4" />
                </Button>
            )}
            <AlertDialog
                open={dialogOpen}
                onOpenChange={changeOpen}
            >
                <AlertDialogContent data-testid="super-admin-role-dialog">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t(`${prefix}.title.${action}`)}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t(`${prefix}.description.${action}`, { name, email })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <ul
                        className="list-disc space-y-1 pl-5"
                        data-testid="super-admin-role-rows"
                    >
                        {SUPER_ADMIN_ONLY_ACTION_KEYS.map((key) => (
                            <li key={key}>{t(`${prefix}.rows.${key}`)}</li>
                        ))}
                    </ul>
                    <div className="space-y-2">
                        <Label htmlFor="super-admin-role-reason">
                            {t(`${prefix}.reasonLabel`)}
                        </Label>
                        <Textarea
                            id="super-admin-role-reason"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            maxLength={500}
                            required
                            placeholder={t(`${prefix}.reasonPlaceholder`)}
                            data-testid="super-admin-role-reason"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel data-testid="super-admin-role-cancel">
                            {t(`${prefix}.cancel`)}
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            disabled={
                                pending ||
                                user.isLoading ||
                                !name ||
                                !email ||
                                reason.trim().length === 0
                            }
                            onClick={() =>
                                void Promise.resolve(onConfirm({ reason: reason.trim() })).then(
                                    () => changeOpen(false)
                                )
                            }
                            data-testid="super-admin-role-confirm"
                        >
                            {t(`${prefix}.confirm.${action}`)}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
