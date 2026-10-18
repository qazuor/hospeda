import type { TranslationKey } from '@repo/i18n';
import { type AdminPromoCodeCreateRequest, AdminPromoCodeCreateRequestSchema } from '@repo/schemas';
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
import { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { adminLogger } from '@/utils/logger';
import { useCreatePromoCodeMutation } from '../hooks/usePromoCodes';
import {
    describePromoCodeDraft,
    type PromoCodeDraft,
    promoCodeRejectionLabel
} from '../promo-code-draft';
import { PromoCodeEffectFields } from './PromoCodeEffectFields';
import { PromoCodeScopeFields } from './PromoCodeScopeFields';
import {
    initialPromoCodeFormValues,
    makePromoCodeCreateRequest,
    type PromoCodeFormValues
} from './promo-code-form-values';

/** Two-step create dialog: review the consequences, then send the validated request. */
export function PromoCodeCreateDialog({
    open,
    onOpenChange
}: {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}) {
    const { t, locale } = useTranslations();
    const { addToast } = useToast();
    const mutation = useCreatePromoCodeMutation();
    const [candidate, setCandidate] = useState<AdminPromoCodeCreateRequest | null>(null);
    const [summary, setSummary] = useState<ReturnType<typeof describePromoCodeDraft> | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);
    const key = (value: string) => t(value as TranslationKey);

    const form = useForm<PromoCodeFormValues>({
        defaultValues: initialPromoCodeFormValues,
        onSubmit: ({ value }) => {
            setValidationError(null);
            setApiError(null);
            try {
                const parsed = AdminPromoCodeCreateRequestSchema.safeParse(
                    makePromoCodeCreateRequest(value)
                );
                if (!parsed.success) {
                    setValidationError(key('admin-billing.promoCodes.editor.form.invalid'));
                    setCandidate(null);
                    return;
                }
                const draft: PromoCodeDraft = {
                    ...parsed.data,
                    effect:
                        parsed.data.effect.kind === 'DISCOUNT' &&
                        parsed.data.effect.discountKind === 'FIXED'
                            ? { ...parsed.data.effect, pesos: value.value }
                            : parsed.data.effect
                };
                setCandidate(parsed.data);
                setSummary(describePromoCodeDraft({ draft, locale, t: key }));
            } catch {
                setValidationError(key('admin-billing.promoCodes.editor.form.invalid'));
                setCandidate(null);
            }
        }
    });

    const create = async () => {
        if (!candidate || mutation.isPending) return;
        setApiError(null);
        try {
            await mutation.mutateAsync(candidate);
            addToast({
                title: key('admin-billing.promoCodes.editor.toasts.created'),
                message: key('admin-billing.promoCodes.editor.toasts.created'),
                variant: 'success'
            });
            form.reset();
            setCandidate(null);
            setSummary(null);
            onOpenChange(false);
        } catch (error) {
            adminLogger.error('[PromoCodeCreateDialog] Failed to create a promo code', { error });
            const reason = isApiError(error)
                ? (error.body as { error?: { reason?: unknown } } | undefined)?.error?.reason
                : undefined;
            setApiError(
                reason
                    ? promoCodeRejectionLabel({ reason, t: key })
                    : key('admin-billing.promoCodes.editor.toasts.createError')
            );
        }
    };

    const close = (next: boolean) => {
        if (!next) {
            setCandidate(null);
            setSummary(null);
            setValidationError(null);
            setApiError(null);
        }
        onOpenChange(next);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={close}
        >
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {key(
                            candidate
                                ? 'admin-billing.promoCodes.editor.reviewTitle'
                                : 'admin-billing.promoCodes.editor.form.title'
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {key('admin-billing.promoCodes.editor.form.description')}
                    </DialogDescription>
                </DialogHeader>
                {candidate && summary ? (
                    <div
                        data-testid="promo-code-confirmation"
                        className="space-y-3"
                    >
                        <p>
                            <strong>
                                {key('admin-billing.promoCodes.editor.columns.effect')}:
                            </strong>{' '}
                            <span data-testid="promo-code-confirmation-effect">
                                {summary.effect}
                            </span>
                        </p>
                        <p>
                            <strong>{key('admin-billing.promoCodes.editor.columns.reach')}:</strong>{' '}
                            <span data-testid="promo-code-confirmation-reach">{summary.reach}</span>
                        </p>
                        <p>
                            <strong>{key('admin-billing.promoCodes.editor.columns.uses')}:</strong>{' '}
                            <span data-testid="promo-code-confirmation-uses">{summary.uses}</span>
                        </p>
                        <p>
                            <strong>
                                {key('admin-billing.promoCodes.editor.columns.validity')}:
                            </strong>{' '}
                            <span data-testid="promo-code-confirmation-validity">
                                {summary.validity}
                            </span>
                        </p>
                        {apiError ? <p role="alert">{apiError}</p> : null}
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setCandidate(null);
                                    setSummary(null);
                                }}
                            >
                                {key('admin-billing.promoCodes.editor.back')}
                            </Button>
                            <Button
                                disabled={mutation.isPending}
                                onClick={() => void create()}
                            >
                                {key('admin-billing.promoCodes.editor.create')}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void form.handleSubmit();
                        }}
                        className="space-y-4"
                    >
                        <PromoCodeEffectFields
                            form={form}
                            t={key}
                        />
                        <PromoCodeScopeFields
                            form={form}
                            t={key}
                        />
                        {validationError ? <p role="alert">{validationError}</p> : null}
                        <DialogFooter>
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => close(false)}
                            >
                                {key('admin-billing.promoCodes.editor.cancel')}
                            </Button>
                            <Button type="submit">
                                {key('admin-billing.promoCodes.editor.review')}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
