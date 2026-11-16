/**
 * @file LocationExceptionReasonDialog.tsx
 * One dialog for every location-exception action that carries a reason
 * (approve, reject, revoke, grant). A TanStack Form holds the reason; the
 * schema from `@repo/schemas` is applied with `safeParse` inside the submit
 * handler. A required reason is refused when it is not 10..500 characters; an
 * optional one (revoke) is sent only when typed, and then must be 10..500.
 */

import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/** Structural subset of a Zod schema the dialog needs. */
interface ReasonSchema {
    safeParse(input: unknown): {
        readonly success: boolean;
        readonly data?: { readonly reason?: string };
    };
}

/** Props for {@link LocationExceptionReasonDialog}. */
export interface LocationExceptionReasonDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly title: string;
    readonly description: string;
    readonly reasonLabel: string;
    readonly confirmLabel: string;
    readonly cancelLabel: string;
    /** Shown when the reason fails the schema. */
    readonly invalidMessage: string;
    /** Schema of the body: `{ reason }`, required or optional. */
    readonly schema: ReasonSchema;
    /** Reason the textarea starts with (approve preloads the owner's). */
    readonly initialReason?: string;
    /** When true an empty reason is valid and submits `undefined`. */
    readonly optional?: boolean;
    readonly isPending?: boolean;
    /** Server error to show under the field. */
    readonly error?: string | null;
    /** Called with the validated reason; reject by throwing/rejecting keeps it open. */
    readonly onSubmit: (input: { readonly reason: string | undefined }) => Promise<void> | void;
}

/**
 * Renders the reason dialog. The form is mounted only while open so every
 * opening starts from `initialReason`.
 *
 * @param props - See {@link LocationExceptionReasonDialogProps}.
 */
export function LocationExceptionReasonDialog(props: LocationExceptionReasonDialogProps) {
    return (
        <Dialog
            open={props.open}
            onOpenChange={props.onOpenChange}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{props.title}</DialogTitle>
                    <DialogDescription>{props.description}</DialogDescription>
                </DialogHeader>
                {props.open && <ReasonForm {...props} />}
            </DialogContent>
        </Dialog>
    );
}

function ReasonForm({
    reasonLabel,
    confirmLabel,
    cancelLabel,
    invalidMessage,
    schema,
    initialReason = '',
    optional = false,
    isPending = false,
    error,
    onOpenChange,
    onSubmit
}: LocationExceptionReasonDialogProps) {
    const [invalid, setInvalid] = useState(false);
    const form = useForm({
        defaultValues: { reason: initialReason },
        onSubmit: async ({ value }) => {
            const trimmed = value.reason.trim();
            if (optional && trimmed.length === 0) {
                setInvalid(false);
                await onSubmit({ reason: undefined });
                return;
            }
            const parsed = schema.safeParse({ reason: trimmed });
            if (!parsed.success) {
                setInvalid(true);
                return;
            }
            setInvalid(false);
            await onSubmit({ reason: parsed.data?.reason ?? trimmed });
        }
    });

    return (
        <form
            className="space-y-3"
            onSubmit={(event) => {
                event.preventDefault();
                form.handleSubmit();
            }}
        >
            <form.Field name="reason">
                {(field) => (
                    <>
                        <Label htmlFor={field.name}>{reasonLabel}</Label>
                        <Textarea
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            rows={4}
                        />
                    </>
                )}
            </form.Field>
            {invalid && (
                <p
                    role="alert"
                    className="text-destructive text-sm"
                >
                    {invalidMessage}
                </p>
            )}
            {error && (
                <p
                    role="alert"
                    className="text-destructive text-sm"
                >
                    {error}
                </p>
            )}
            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                >
                    {cancelLabel}
                </Button>
                <Button
                    type="submit"
                    disabled={isPending}
                >
                    {confirmLabel}
                </Button>
            </DialogFooter>
        </form>
    );
}
