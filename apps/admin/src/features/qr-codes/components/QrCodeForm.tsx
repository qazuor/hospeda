import type { QrCode, QrCodeCreateHttp, QrCodeUpdateHttp } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import { QrCodeRenderFields } from './QrCodeRenderFields';
import {
    buildCreatePayload,
    buildUpdatePayload,
    type QrCodeFormError,
    type QrCodeFormValues,
    toFormRenderOptions
} from './qr-code-form.payload';

/**
 * Create / edit form for a redirectable QR code (HOS-981 PR 3).
 *
 * ## Three things this form is careful about
 *
 * **The slug is not editable in edit mode, and it is not merely disabled.** It
 * is absent from the submitted payload entirely, because the API refuses a body
 * that carries one — the slug is the half already printed on a sticker, and a
 * rename turns every code in the field into a dead link.
 *
 * **A render option the operator did not touch is not submitted.** The edit
 * payload carries only the drawing fields whose value actually changed against
 * the loaded row. That is what lets the API merge the patch into the stored
 * document instead of replacing it; submitting the whole object would work too,
 * but it would silently overwrite anything a concurrent edit had changed, and it
 * would make the "only what you touch is saved" promise in the UI a lie.
 *
 * **A refused submit SAYS SO.** The builders return `{ error }` rather than
 * throwing, and the error is rendered as a banner plus per-field marks. An
 * earlier version threw a raw i18n key inside a `form.handleSubmit()` nobody
 * caught, so leaving the destination blank and pressing Save did nothing at all:
 * no toast, no red field, no console line. A save that neither succeeds nor
 * complains is worse than one that fails loudly.
 *
 * The payload construction lives in `qr-code-form.payload.ts` and the drawing
 * fieldset in `QrCodeRenderFields.tsx` — this file was over the repo's 500-line
 * ceiling with all three in it.
 *
 * @module features/qr-codes/components/QrCodeForm
 */

export type { QrCodeFormValues } from './qr-code-form.payload';

export type QrCodeFormProps = {
    /** `create` shows the slug field and submits a full body; `edit` submits a patch. */
    readonly mode: 'create' | 'edit';
    /** The row being edited. Required in edit mode. */
    readonly initialData?: QrCode;
    /** Receives the validated payload. Rejects to signal a failed save. */
    readonly onSubmit: (payload: QrCodeCreateHttp | QrCodeUpdateHttp) => Promise<void>;
    readonly onCancel: () => void;
    readonly isSaving?: boolean;
};

export function QrCodeForm({
    mode,
    initialData,
    onSubmit,
    onCancel,
    isSaving = false
}: QrCodeFormProps) {
    const { t } = useTranslations();
    const [submitError, setSubmitError] = useState<QrCodeFormError | null>(null);

    const form = useForm({
        defaultValues: {
            label: initialData?.label ?? '',
            targetUrl: initialData?.targetUrl ?? '',
            description: initialData?.description ?? '',
            slug: '',
            isActive: initialData?.isActive ?? true,
            renderOptions: toFormRenderOptions(initialData)
        } satisfies QrCodeFormValues,
        onSubmit: async ({ value }) => {
            const result =
                mode === 'create'
                    ? buildCreatePayload(value)
                    : initialData
                      ? buildUpdatePayload(value, initialData)
                      : { error: { messageKey: 'invalid', fields: [] } as QrCodeFormError };

            if ('error' in result) {
                setSubmitError(result.error);
                return;
            }

            setSubmitError(null);
            await onSubmit(result.payload);
        }
    });

    /** Renders the inline "check this field" note, or nothing. */
    const fieldError = (name: string): ReactNode =>
        submitError?.fields.includes(name) ? (
            <p className="text-destructive text-xs">{t('admin-qr-codes.messages.fieldInvalid')}</p>
        ) : null;

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
            }}
            className="space-y-6"
        >
            {submitError ? (
                <output
                    className="block rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-destructive text-sm"
                    data-testid="qr-code-form-error"
                >
                    {t(`admin-qr-codes.messages.${submitError.messageKey}`)}
                </output>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle>
                        {mode === 'create' ? t('admin-qr-codes.create') : t('admin-qr-codes.edit')}
                    </CardTitle>
                    <CardDescription>{t('admin-qr-codes.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form.Field name="label">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="label">{t('admin-qr-codes.form.labelLabel')}</Label>
                                <Input
                                    id="label"
                                    name="label"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                    placeholder={t('admin-qr-codes.form.labelPlaceholder')}
                                />
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-qr-codes.form.labelHelp')}
                                </p>
                                {fieldError('label')}
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="targetUrl">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="targetUrl">
                                    {t('admin-qr-codes.form.targetUrlLabel')}
                                </Label>
                                <Input
                                    id="targetUrl"
                                    name="targetUrl"
                                    type="url"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                    placeholder={t('admin-qr-codes.form.targetUrlPlaceholder')}
                                />
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-qr-codes.form.targetUrlHelp')}
                                </p>
                                {fieldError('targetUrl')}
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="description">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="description">
                                    {t('admin-qr-codes.form.descriptionLabel')}
                                </Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    rows={3}
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                    placeholder={t('admin-qr-codes.form.descriptionPlaceholder')}
                                />
                                {fieldError('description')}
                            </div>
                        )}
                    </form.Field>

                    {mode === 'create' ? (
                        <form.Field name="slug">
                            {(field) => (
                                <div className="space-y-1">
                                    <Label htmlFor="slug">
                                        {t('admin-qr-codes.form.slugLabel')}
                                    </Label>
                                    <Input
                                        id="slug"
                                        name="slug"
                                        className="font-mono"
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        placeholder={t('admin-qr-codes.form.slugPlaceholder')}
                                    />
                                    <p className="text-muted-foreground text-sm">
                                        {t('admin-qr-codes.form.slugHelp')}
                                    </p>
                                    {fieldError('slug')}
                                </div>
                            )}
                        </form.Field>
                    ) : (
                        <div className="space-y-1">
                            <Label htmlFor="slug-readonly">
                                {t('admin-qr-codes.form.slugLabel')}
                            </Label>
                            <p
                                id="slug-readonly"
                                className="font-mono text-lg"
                            >
                                {initialData?.slug}
                            </p>
                            <p className="text-muted-foreground text-sm">
                                {t('admin-qr-codes.form.slugLocked')}
                            </p>
                        </div>
                    )}

                    <form.Field name="isActive">
                        {(field) => (
                            <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="isActive"
                                        name="isActive"
                                        checked={field.state.value}
                                        onCheckedChange={(checked) => field.handleChange(checked)}
                                    />
                                    <Label htmlFor="isActive">
                                        {t('admin-qr-codes.form.isActiveLabel')}
                                    </Label>
                                </div>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-qr-codes.form.isActiveHelp')}
                                </p>
                            </div>
                        )}
                    </form.Field>
                </CardContent>
            </Card>

            <QrCodeRenderFields
                Field={form.Field}
                invalidFields={submitError?.fields ?? []}
            />

            <div className="flex gap-4">
                {/*
                 * `form.Subscribe`, not `form.state.isSubmitting` read here.
                 * Reading form state during render captures the value at first
                 * render and never updates, so the button would stay in
                 * whatever state it was born in — with typecheck perfectly
                 * happy about it.
                 */}
                <form.Subscribe selector={(state) => state.isSubmitting}>
                    {(isSubmitting) => (
                        <Button
                            type="submit"
                            disabled={isSubmitting || isSaving}
                        >
                            {isSubmitting || isSaving
                                ? t('admin-entities.messages.saving')
                                : t('admin-entities.actions.save')}
                        </Button>
                    )}
                </form.Subscribe>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                >
                    {t('admin-entities.actions.cancel')}
                </Button>
            </div>
        </form>
    );
}
