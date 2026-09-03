import type { QrCode, QrCodeCreateHttp, QrCodeUpdateHttp } from '@repo/schemas';
import {
    QR_CODE_MAX_MARGIN,
    QR_CODE_MAX_SIZE,
    QR_CODE_MIN_MARGIN,
    QR_CODE_MIN_SIZE,
    QrCodeCreateHttpSchema,
    QrCodeErrorCorrectionLevelEnum,
    QrCodeFormatEnum,
    QrCodeSourceEnum,
    QrCodeUpdateHttpSchema
} from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';

/**
 * Create / edit form for a redirectable QR code (HOS-981 PR 3).
 *
 * ## Two things this form is careful about
 *
 * **The slug is not editable in edit mode, and it is not merely disabled.** It
 * is absent from the submitted payload entirely, because the API refuses a body
 * that carries one — the slug is the half already printed on a sticker, and a
 * rename turns every code in the field into a dead link.
 *
 * **A render option the operator did not touch is not submitted.** The edit
 * payload carries only the drawing fields whose value actually changed against
 * the loaded row (see {@link diffRenderOptions}). That is what lets the API merge
 * the patch into the stored document instead of replacing it; submitting the
 * whole object would work too, but it would silently overwrite anything a
 * concurrent edit had changed in the meantime, and it would make the "only what
 * you touch is saved" promise in the UI a lie.
 *
 * @module features/qr-codes/components/QrCodeForm
 */

/** The drawing options the form edits. Mirrors `QrCodeRenderOptions`. */
type RenderOptionsValues = {
    format: QrCodeFormatEnum;
    errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum;
    margin: number;
    /** Empty string means "unconstrained" — the schema's `null`. */
    size: string;
    foregroundColor: string;
    backgroundColor: string;
};

/** Everything the form holds. `slug` is only ever populated in create mode. */
export type QrCodeFormValues = {
    label: string;
    targetUrl: string;
    description: string;
    slug: string;
    isActive: boolean;
    renderOptions: RenderOptionsValues;
};

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

const DEFAULT_RENDER_OPTIONS: RenderOptionsValues = {
    format: QrCodeFormatEnum.SVG,
    errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.M,
    margin: 4,
    size: '',
    foregroundColor: '#000000',
    backgroundColor: '#ffffff'
};

/** Turns a stored render document into the form's string-friendly shape. */
function toFormRenderOptions(qrCode?: QrCode): RenderOptionsValues {
    if (!qrCode) return { ...DEFAULT_RENDER_OPTIONS };
    const stored = qrCode.renderOptions;
    return {
        format: stored.format,
        errorCorrectionLevel: stored.errorCorrectionLevel,
        margin: stored.margin,
        size: stored.size === null ? '' : String(stored.size),
        foregroundColor: stored.foregroundColor,
        backgroundColor: stored.backgroundColor
    };
}

/** `''` is the UI's spelling of "do not constrain the size". */
function parseSize(size: string): number | null {
    const trimmed = size.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The drawing fields whose value actually changed.
 *
 * Returns `undefined` when nothing did, so an edit that only renamed the code
 * sends no `renderOptions` key at all. Comparing against the LOADED row rather
 * than against the schema defaults is the point: a code stored red must not be
 * reported as "changed to black" merely because black is the default.
 */
export function diffRenderOptions(
    current: RenderOptionsValues,
    original: RenderOptionsValues
): Record<string, unknown> | undefined {
    const patch: Record<string, unknown> = {};

    if (current.format !== original.format) patch.format = current.format;
    if (current.errorCorrectionLevel !== original.errorCorrectionLevel) {
        patch.errorCorrectionLevel = current.errorCorrectionLevel;
    }
    if (Number(current.margin) !== Number(original.margin)) patch.margin = Number(current.margin);
    if (current.size.trim() !== original.size.trim()) patch.size = parseSize(current.size);
    if (current.foregroundColor !== original.foregroundColor) {
        patch.foregroundColor = current.foregroundColor;
    }
    if (current.backgroundColor !== original.backgroundColor) {
        patch.backgroundColor = current.backgroundColor;
    }

    return Object.keys(patch).length > 0 ? patch : undefined;
}

/**
 * Builds the body for `POST /admin/qr-codes`.
 *
 * `source` is always `MANUAL`: a `GENERATED` code is one the platform derives
 * for an entity, and the panel has no entity picker because minting those is
 * the provider generator's job, not an operator's.
 */
function buildCreatePayload(values: QrCodeFormValues): Record<string, unknown> {
    const slug = values.slug.trim();
    return {
        ...(slug === '' ? {} : { slug }),
        targetUrl: values.targetUrl.trim(),
        label: values.label.trim(),
        description: values.description.trim() === '' ? null : values.description.trim(),
        source: QrCodeSourceEnum.MANUAL,
        isActive: values.isActive,
        renderOptions: {
            format: values.renderOptions.format,
            errorCorrectionLevel: values.renderOptions.errorCorrectionLevel,
            margin: Number(values.renderOptions.margin),
            size: parseSize(values.renderOptions.size),
            foregroundColor: values.renderOptions.foregroundColor,
            backgroundColor: values.renderOptions.backgroundColor
        }
    };
}

/**
 * Builds the body for `PATCH /admin/qr-codes/{id}`.
 *
 * Carries no `slug` under any circumstance, and carries `renderOptions` only if
 * a drawing field moved.
 */
function buildUpdatePayload(values: QrCodeFormValues, original: QrCode): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const originalDescription = original.description ?? '';
    const description = values.description.trim();

    if (values.label.trim() !== original.label) payload.label = values.label.trim();
    if (values.targetUrl.trim() !== original.targetUrl) payload.targetUrl = values.targetUrl.trim();
    if (description !== originalDescription)
        payload.description = description === '' ? null : description;
    if (values.isActive !== original.isActive) payload.isActive = values.isActive;

    const renderOptions = diffRenderOptions(values.renderOptions, toFormRenderOptions(original));
    if (renderOptions) payload.renderOptions = renderOptions;

    return payload;
}

const ERROR_CORRECTION_LEVELS = [
    QrCodeErrorCorrectionLevelEnum.L,
    QrCodeErrorCorrectionLevelEnum.M,
    QrCodeErrorCorrectionLevelEnum.Q,
    QrCodeErrorCorrectionLevelEnum.H
] as const;

export function QrCodeForm({
    mode,
    initialData,
    onSubmit,
    onCancel,
    isSaving = false
}: QrCodeFormProps) {
    const { t } = useTranslations();

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
            if (mode === 'create') {
                const parsed = QrCodeCreateHttpSchema.safeParse(buildCreatePayload(value));
                if (!parsed.success) {
                    throw new Error(parsed.error.issues[0]?.message ?? 'invalid');
                }
                await onSubmit(parsed.data);
                return;
            }

            if (!initialData) return;
            const parsed = QrCodeUpdateHttpSchema.safeParse(buildUpdatePayload(value, initialData));
            if (!parsed.success) {
                throw new Error(parsed.error.issues[0]?.message ?? 'invalid');
            }
            await onSubmit(parsed.data);
        }
    });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
            }}
            className="space-y-6"
        >
            <Card>
                <CardHeader>
                    <CardTitle>
                        {mode === 'create' ? t('qr-codes.create') : t('qr-codes.edit')}
                    </CardTitle>
                    <CardDescription>{t('qr-codes.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form.Field name="label">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="label">{t('qr-codes.form.labelLabel')}</Label>
                                <Input
                                    id="label"
                                    name="label"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                    placeholder={t('qr-codes.form.labelPlaceholder')}
                                />
                                <p className="text-muted-foreground text-sm">
                                    {t('qr-codes.form.labelHelp')}
                                </p>
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="targetUrl">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="targetUrl">
                                    {t('qr-codes.form.targetUrlLabel')}
                                </Label>
                                <Input
                                    id="targetUrl"
                                    name="targetUrl"
                                    type="url"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                    placeholder={t('qr-codes.form.targetUrlPlaceholder')}
                                />
                                <p className="text-muted-foreground text-sm">
                                    {t('qr-codes.form.targetUrlHelp')}
                                </p>
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="description">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="description">
                                    {t('qr-codes.form.descriptionLabel')}
                                </Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    rows={3}
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                    placeholder={t('qr-codes.form.descriptionPlaceholder')}
                                />
                            </div>
                        )}
                    </form.Field>

                    {mode === 'create' ? (
                        <form.Field name="slug">
                            {(field) => (
                                <div className="space-y-1">
                                    <Label htmlFor="slug">{t('qr-codes.form.slugLabel')}</Label>
                                    <Input
                                        id="slug"
                                        name="slug"
                                        className="font-mono"
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        placeholder={t('qr-codes.form.slugPlaceholder')}
                                    />
                                    <p className="text-muted-foreground text-sm">
                                        {t('qr-codes.form.slugHelp')}
                                    </p>
                                </div>
                            )}
                        </form.Field>
                    ) : (
                        <div className="space-y-1">
                            <Label htmlFor="slug-readonly">{t('qr-codes.form.slugLabel')}</Label>
                            <p
                                id="slug-readonly"
                                className="font-mono text-lg"
                            >
                                {initialData?.slug}
                            </p>
                            <p className="text-muted-foreground text-sm">
                                {t('qr-codes.form.slugLocked')}
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
                                        {t('qr-codes.form.isActiveLabel')}
                                    </Label>
                                </div>
                                <p className="text-muted-foreground text-sm">
                                    {t('qr-codes.form.isActiveHelp')}
                                </p>
                            </div>
                        )}
                    </form.Field>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('qr-codes.form.renderTitle')}</CardTitle>
                    <CardDescription>{t('qr-codes.form.renderHelp')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2">
                    <form.Field name="renderOptions.format">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="format">{t('qr-codes.form.formatLabel')}</Label>
                                <Select
                                    value={field.state.value}
                                    onValueChange={(v) => field.handleChange(v as QrCodeFormatEnum)}
                                >
                                    <SelectTrigger
                                        id="format"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={QrCodeFormatEnum.SVG}>SVG</SelectItem>
                                        <SelectItem value={QrCodeFormatEnum.PNG}>PNG</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="renderOptions.errorCorrectionLevel">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="errorCorrectionLevel">
                                    {t('qr-codes.form.errorCorrectionLabel')}
                                </Label>
                                <Select
                                    value={field.state.value}
                                    onValueChange={(v) =>
                                        field.handleChange(v as QrCodeErrorCorrectionLevelEnum)
                                    }
                                >
                                    <SelectTrigger
                                        id="errorCorrectionLevel"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ERROR_CORRECTION_LEVELS.map((level) => (
                                            <SelectItem
                                                key={level}
                                                value={level}
                                            >
                                                {t(`qr-codes.errorCorrection.${level}`)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="renderOptions.margin">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="margin">{t('qr-codes.form.marginLabel')}</Label>
                                <Input
                                    id="margin"
                                    name="margin"
                                    type="number"
                                    min={QR_CODE_MIN_MARGIN}
                                    max={QR_CODE_MAX_MARGIN}
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(Number(e.target.value))}
                                    onBlur={field.handleBlur}
                                />
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="renderOptions.size">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="size">{t('qr-codes.form.sizeLabel')}</Label>
                                <Input
                                    id="size"
                                    name="size"
                                    type="number"
                                    min={QR_CODE_MIN_SIZE}
                                    max={QR_CODE_MAX_SIZE}
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                    placeholder={t('qr-codes.form.sizePlaceholder')}
                                />
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="renderOptions.foregroundColor">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="foregroundColor">
                                    {t('qr-codes.form.foregroundColorLabel')}
                                </Label>
                                <Input
                                    id="foregroundColor"
                                    name="foregroundColor"
                                    type="color"
                                    className="h-10 w-24 p-1"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                />
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="renderOptions.backgroundColor">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="backgroundColor">
                                    {t('qr-codes.form.backgroundColorLabel')}
                                </Label>
                                <Input
                                    id="backgroundColor"
                                    name="backgroundColor"
                                    type="color"
                                    className="h-10 w-24 p-1"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                />
                            </div>
                        )}
                    </form.Field>
                </CardContent>
            </Card>

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
