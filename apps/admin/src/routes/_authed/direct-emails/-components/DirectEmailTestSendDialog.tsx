/**
 * @file DirectEmailTestSendDialog.tsx
 * @description Dialog that asks where to send the `[PRUEBA]` copy of a direct
 * email (HOS-2685). Prefilled with the logged-in admin's address and validated
 * with the shared address schema before the parent calls the API.
 */

import { LoaderIcon } from '@repo/icons';
import { DirectEmailAddressSchema } from '@repo/schemas';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';

/** Props for DirectEmailTestSendDialog. */
export interface DirectEmailTestSendDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    /** Prefilled address (the logged-in admin's). */
    readonly defaultEmail: string;
    readonly isPending: boolean;
    /** Called with the validated, lowercased address. */
    readonly onSubmit: (input: { readonly email: string }) => void | Promise<void>;
}

/**
 * Test-send recipient dialog.
 *
 * @param props - DirectEmailTestSendDialogProps
 */
export function DirectEmailTestSendDialog({
    open,
    onOpenChange,
    defaultEmail,
    isPending,
    onSubmit
}: DirectEmailTestSendDialogProps) {
    const { t } = useTranslations();
    const [email, setEmail] = useState(defaultEmail);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setEmail(defaultEmail);
            setError(null);
        }
    }, [open, defaultEmail]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const parsed = DirectEmailAddressSchema.safeParse(email);
        if (!parsed.success) {
            setError(t('admin-direct-email.testSend.emailInvalid'));
            return;
        }
        setError(null);
        await onSubmit({ email: parsed.data });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!isPending) onOpenChange(next);
            }}
        >
            <DialogContent className="max-w-md">
                <form
                    onSubmit={handleSubmit}
                    noValidate
                    className="space-y-4"
                >
                    <DialogHeader>
                        <DialogTitle>{t('admin-direct-email.testSend.title')}</DialogTitle>
                        <DialogDescription>
                            {t('admin-direct-email.testSend.description')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="direct-email-test-send">
                            {t('admin-direct-email.testSend.emailLabel')}
                        </Label>
                        <Input
                            id="direct-email-test-send"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            aria-invalid={error ? true : undefined}
                            disabled={isPending}
                        />
                        {error && (
                            <p
                                role="alert"
                                className="text-destructive text-xs"
                            >
                                {error}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isPending}
                        >
                            {t('admin-direct-email.testSend.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                        >
                            {isPending && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
                            {t('admin-direct-email.testSend.submit')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
