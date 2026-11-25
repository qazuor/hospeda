/**
 * @file TestSendDialog.tsx
 * @description Small dialog that lets the admin pick the recipient of a campaign
 * test email (HOS-2585). The field is prefilled with the logged-in user's email
 * and validated with Zod before the parent calls the API.
 *
 * @module TestSendDialog
 */

import { LoaderIcon } from '@repo/icons';
import { useEffect, useState } from 'react';
import { z } from 'zod';
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

/** Zod schema for the recipient field. */
const TestSendEmailSchema = z.string().trim().email();

/**
 * Decides the `toEmail` sent to the API. When the address equals the logged-in
 * user's own email it returns `undefined` so the API resolves the actor's email
 * itself (canonical source); otherwise the typed address.
 *
 * @param input.email - Address typed in the dialog.
 * @param input.actorEmail - Logged-in user's email.
 * @returns The override address, or `undefined` to use the actor's email.
 */
export function resolveTestSendRecipient({
    email,
    actorEmail
}: {
    readonly email: string;
    readonly actorEmail: string;
}): string | undefined {
    return email.trim().toLowerCase() === actorEmail.trim().toLowerCase() ? undefined : email;
}

/** Props for TestSendDialog. */
export interface TestSendDialogProps {
    /** Whether the dialog is open. */
    readonly open: boolean;
    /** Open/close callback. */
    readonly onOpenChange: (open: boolean) => void;
    /** Email prefilled in the field (the logged-in user's email). */
    readonly defaultEmail: string;
    /** True while the test-send request is in flight. */
    readonly isPending: boolean;
    /** Called with the validated, trimmed address when the form is submitted. */
    readonly onSubmit: (input: { readonly email: string }) => void | Promise<void>;
}

/**
 * Dialog with a single validated email field for the test send.
 *
 * @param props - TestSendDialogProps
 */
export function TestSendDialog({
    open,
    onOpenChange,
    defaultEmail,
    isPending,
    onSubmit
}: TestSendDialogProps) {
    const { t } = useTranslations();
    const [email, setEmail] = useState(defaultEmail);
    const [error, setError] = useState<string | null>(null);

    // Reset to the default each time the dialog opens.
    useEffect(() => {
        if (open) {
            setEmail(defaultEmail);
            setError(null);
        }
    }, [open, defaultEmail]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const parsed = TestSendEmailSchema.safeParse(email);
        if (!parsed.success) {
            setError(t('admin-newsletter.campaigns.testSendEmailInvalid'));
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
                        <DialogTitle>
                            {t('admin-newsletter.campaigns.testSendDialogTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('admin-newsletter.campaigns.testSendDialogDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="test-send-email">
                            {t('admin-newsletter.campaigns.testSendEmailLabel')}
                        </Label>
                        <Input
                            id="test-send-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? 'test-send-email-error' : undefined}
                            disabled={isPending}
                        />
                        {error && (
                            <p
                                id="test-send-email-error"
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
                            {t('admin-newsletter.campaigns.testSendCancel')}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                        >
                            {isPending && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
                            {t('admin-newsletter.campaigns.testSendSubmit')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
