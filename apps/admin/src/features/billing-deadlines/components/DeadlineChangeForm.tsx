import type { TranslationKey } from '@repo/i18n';
import type { BillingDeadlineValuesSchema, VerticalDeadlineValuesSchema } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { DEADLINE_HALVES } from '../config/deadline-halves';
import {
    type DeadlineHalf,
    useChangeDeadline,
    usePreviewDeadlineChange
} from '../hooks/useDeadlines';
import { fromFormFields, toFormFields } from '../lib/deadline-value-form';

type Schema = typeof VerticalDeadlineValuesSchema | typeof BillingDeadlineValuesSchema;
type Version = { readonly version: number; readonly values: Record<string, unknown> };

/** Edits one deadline through client validation, review, and explicit confirmation. */
export function DeadlineChangeForm({
    half,
    keyNumber,
    current,
    onCancel
}: {
    readonly half: DeadlineHalf;
    readonly keyNumber: number;
    readonly current: Version;
    readonly onCancel: () => void;
}) {
    const { t } = useTranslations();
    const translate = (key: string, values?: Record<string, string | number>) =>
        t(key as TranslationKey, values);
    const schema = DEADLINE_HALVES[half].valuesSchema as Schema;
    const initialFields = toFormFields({ value: current.values[String(keyNumber)] });
    const preview = usePreviewDeadlineChange({ half });
    const change = useChangeDeadline({ half });
    const [review, setReview] = useState<{
        readonly value: Record<string, unknown>;
        readonly preview: { currentValue: unknown; newValue: unknown; message: string };
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const form = useForm({
        defaultValues: { fields: initialFields },
        onSubmit: async ({ value }) => {
            setError(null);
            const draft = fromFormFields({ fields: value.fields });
            const parsed = schema.safeParse({ ...current.values, [String(keyNumber)]: draft });
            if (!parsed.success) {
                setError(
                    translate('admin-billing.deadlinesEditor.errors.invalid', {
                        message: parsed.error.issues[0]?.message ?? ''
                    })
                );
                return;
            }
            try {
                const result = await preview.mutateAsync({ key: keyNumber, value: draft });
                setReview({ value: draft, preview: result });
            } catch (reason) {
                setError(errorMessage(reason));
            }
        }
    });

    const errorMessage = (reason: unknown) => {
        if (isApiError(reason) && reason.status === 403)
            return translate('admin-billing.deadlinesEditor.errors.forbidden');
        if (isApiError(reason) && reason.status === 400)
            return translate('admin-billing.deadlinesEditor.errors.rejected', {
                message: reason.message
            });
        return translate('admin-billing.deadlinesEditor.errors.generic');
    };

    const confirm = async () => {
        if (!review) return;
        setError(null);
        try {
            const result = await change.mutateAsync({
                key: keyNumber,
                value: review.value,
                expectedVersion: current.version
            });
            setSuccess(
                translate('admin-billing.deadlinesEditor.success', { version: result.version })
            );
            setReview(null);
        } catch (reason) {
            setError(errorMessage(reason));
        }
    };

    if (success)
        return (
            <p
                role="status"
                data-testid={`deadline-success-${keyNumber}`}
            >
                {success}
            </p>
        );
    if (review)
        return (
            <div
                data-testid={`deadline-review-${keyNumber}`}
                className="space-y-3 rounded-md border p-3"
            >
                <ValueSummary
                    label={translate('admin-billing.deadlinesEditor.currentValue')}
                    value={review.preview.currentValue}
                />
                <ValueSummary
                    label={translate('admin-billing.deadlinesEditor.newValue')}
                    value={review.preview.newValue}
                />
                <p>{review.preview.message}</p>
                {error && <p role="alert">{error}</p>}
                <div className="flex gap-2">
                    <Button
                        type="button"
                        onClick={confirm}
                        disabled={change.isPending}
                    >
                        {translate('admin-billing.deadlinesEditor.confirm')}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setReview(null)}
                    >
                        {translate('admin-billing.deadlinesEditor.back')}
                    </Button>
                </div>
            </div>
        );

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
            }}
            className="space-y-3"
        >
            <form.Field
                name="fields"
                mode="array"
            >
                {(field) =>
                    field.state.value.map((item, index) => (
                        <form.Field
                            key={item.name}
                            name={`fields[${index}].text`}
                        >
                            {(input) => (
                                <label
                                    htmlFor={`deadline-${keyNumber}-${item.name}`}
                                    className="block space-y-1 text-sm"
                                >
                                    <span>
                                        {translate(
                                            `admin-billing.deadlinesEditor.fields.${item.name}`
                                        )}
                                    </span>
                                    <input
                                        id={`deadline-${keyNumber}-${item.name}`}
                                        className="w-full rounded-md border px-3 py-2"
                                        inputMode={item.kind === 'list' ? 'text' : 'numeric'}
                                        value={input.state.value}
                                        onChange={(event) => input.handleChange(event.target.value)}
                                    />
                                    {item.kind === 'list' && (
                                        <span className="text-muted-foreground">
                                            {translate('admin-billing.deadlinesEditor.listHelp')}
                                        </span>
                                    )}
                                </label>
                            )}
                        </form.Field>
                    ))
                }
            </form.Field>
            {error && <p role="alert">{error}</p>}
            <div className="flex gap-2">
                <Button
                    type="submit"
                    disabled={preview.isPending}
                >
                    {translate('admin-billing.deadlinesEditor.review')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                >
                    {translate('admin-billing.deadlinesEditor.cancel')}
                </Button>
            </div>
        </form>
    );
}

function ValueSummary({ label, value }: { readonly label: string; readonly value: unknown }) {
    const { t } = useTranslations();
    const translate = (key: string) => t(key as TranslationKey);
    const fields = toFormFields({ value });
    return (
        <div>
            <h4 className="font-medium">{label}</h4>
            <dl>
                {fields.map((field) => (
                    <div
                        key={field.name}
                        className="flex gap-2"
                    >
                        <dt>{translate(`admin-billing.deadlinesEditor.fields.${field.name}`)}</dt>
                        <dd>{field.text}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
