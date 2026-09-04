import {
    QR_CODE_MAX_MARGIN,
    QR_CODE_MAX_SIZE,
    QR_CODE_MIN_MARGIN,
    QR_CODE_MIN_SIZE,
    QrCodeCenterLogoEnum,
    QrCodeErrorCorrectionLevelEnum,
    QrCodeFormatEnum,
    qrCodeCenterLogoFits
} from '@repo/schemas';
import type { ReactNode } from 'react';
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
import { useTranslations } from '@/hooks/use-translations';

/**
 * The "how it is drawn" fieldset of the QR form (HOS-981 PR 3).
 *
 * Split out of `QrCodeForm.tsx` so that file stays under the repo's 500-line
 * ceiling. It is a presentation slice, not a boundary: the form owns the state
 * and passes its `Field` renderer in, so the six inputs still live inside the
 * same TanStack Form instance and still take part in the same partial-diff
 * submit.
 *
 * @module features/qr-codes/components/QrCodeRenderFields
 */

/**
 * Minimal shape of a TanStack Form field the inputs here need.
 *
 * Declared structurally instead of importing the form's generic field type: the
 * concrete type is parameterised over the whole form values object, and naming
 * it here would couple this file to that shape for no benefit.
 */
type FieldApiLike<TValue> = {
    state: { value: TValue };
    handleChange: (value: TValue) => void;
    handleBlur: () => void;
};

export type QrCodeRenderFieldsProps = {
    /**
     * The form's `Field` component, passed down rather than re-created.
     *
     * Typed loosely on purpose — see {@link FieldApiLike}.
     */
    // biome-ignore lint/suspicious/noExplicitAny: the form's Field generic is parameterised over the whole values object; narrowing it here would couple this slice to that shape.
    readonly Field: any;
    /** Field names the last submit attempt reported as invalid. */
    readonly invalidFields: readonly string[];
};

const ERROR_CORRECTION_LEVELS = [
    QrCodeErrorCorrectionLevelEnum.L,
    QrCodeErrorCorrectionLevelEnum.M,
    QrCodeErrorCorrectionLevelEnum.Q,
    QrCodeErrorCorrectionLevelEnum.H
] as const;

export function QrCodeRenderFields({ Field, invalidFields }: QrCodeRenderFieldsProps) {
    const { t } = useTranslations();

    /** Renders the inline "check this field" note, or nothing. */
    const fieldError = (name: string): ReactNode =>
        invalidFields.includes(name) ? (
            <p className="text-destructive text-xs">{t('admin-qr-codes.messages.fieldInvalid')}</p>
        ) : null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin-qr-codes.form.renderTitle')}</CardTitle>
                <CardDescription>{t('admin-qr-codes.form.renderHelp')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
                <Field name="renderOptions.format">
                    {(field: FieldApiLike<QrCodeFormatEnum>) => (
                        <div className="space-y-1">
                            <Label htmlFor="format">{t('admin-qr-codes.form.formatLabel')}</Label>
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
                            {fieldError('renderOptions.format')}
                        </div>
                    )}
                </Field>

                <Field name="renderOptions.errorCorrectionLevel">
                    {(field: FieldApiLike<QrCodeErrorCorrectionLevelEnum>) => (
                        <div className="space-y-1">
                            <Label htmlFor="errorCorrectionLevel">
                                {t('admin-qr-codes.form.errorCorrectionLabel')}
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
                                            {t(`admin-qr-codes.errorCorrection.${level}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldError('renderOptions.errorCorrectionLevel')}
                        </div>
                    )}
                </Field>

                {/*
                 * The centre mark, nested inside a read-only Field on the
                 * correction level so the two can be shown together.
                 *
                 * Nested rather than read off `form.state`, which is frozen at
                 * first render — the warning would then keep saying the level
                 * is too low after the operator had already raised it, or worse,
                 * stop saying it after they lowered it. A nested Field
                 * re-renders with the value.
                 *
                 * The select is never disabled. The server refuses the pair and
                 * says why; a control that silently could not be clicked would
                 * leave an operator with no idea what to change.
                 */}
                <Field name="renderOptions.errorCorrectionLevel">
                    {(level: FieldApiLike<QrCodeErrorCorrectionLevelEnum>) => (
                        <Field name="renderOptions.centerLogo">
                            {(field: FieldApiLike<QrCodeCenterLogoEnum>) => (
                                <div className="space-y-1">
                                    <Label htmlFor="centerLogo">
                                        {t('admin-qr-codes.form.centerLogoLabel')}
                                    </Label>
                                    <Select
                                        value={field.state.value}
                                        onValueChange={(v) =>
                                            field.handleChange(v as QrCodeCenterLogoEnum)
                                        }
                                    >
                                        <SelectTrigger
                                            id="centerLogo"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={QrCodeCenterLogoEnum.NONE}>
                                                {t('admin-qr-codes.centerLogo.NONE')}
                                            </SelectItem>
                                            <SelectItem value={QrCodeCenterLogoEnum.HOSPEDA}>
                                                {t('admin-qr-codes.centerLogo.HOSPEDA')}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {qrCodeCenterLogoFits({
                                        centerLogo: field.state.value,
                                        errorCorrectionLevel: level.state.value
                                    }) ? (
                                        <p className="text-muted-foreground text-xs">
                                            {t('admin-qr-codes.form.centerLogoHelp')}
                                        </p>
                                    ) : (
                                        <p className="text-destructive text-xs">
                                            {t('admin-qr-codes.form.centerLogoNeedsCorrection')}
                                        </p>
                                    )}
                                    {fieldError('renderOptions.centerLogo')}
                                </div>
                            )}
                        </Field>
                    )}
                </Field>

                <Field name="renderOptions.margin">
                    {(field: FieldApiLike<number>) => (
                        <div className="space-y-1">
                            <Label htmlFor="margin">{t('admin-qr-codes.form.marginLabel')}</Label>
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
                            {fieldError('renderOptions.margin')}
                        </div>
                    )}
                </Field>

                <Field name="renderOptions.size">
                    {(field: FieldApiLike<string>) => (
                        <div className="space-y-1">
                            <Label htmlFor="size">{t('admin-qr-codes.form.sizeLabel')}</Label>
                            <Input
                                id="size"
                                name="size"
                                type="number"
                                min={QR_CODE_MIN_SIZE}
                                max={QR_CODE_MAX_SIZE}
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                placeholder={t('admin-qr-codes.form.sizePlaceholder')}
                            />
                            {fieldError('renderOptions.size')}
                        </div>
                    )}
                </Field>

                <Field name="renderOptions.foregroundColor">
                    {(field: FieldApiLike<string>) => (
                        <div className="space-y-1">
                            <Label htmlFor="foregroundColor">
                                {t('admin-qr-codes.form.foregroundColorLabel')}
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
                            {fieldError('renderOptions.foregroundColor')}
                        </div>
                    )}
                </Field>

                <Field name="renderOptions.backgroundColor">
                    {(field: FieldApiLike<string>) => (
                        <div className="space-y-1">
                            <Label htmlFor="backgroundColor">
                                {t('admin-qr-codes.form.backgroundColorLabel')}
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
                            {fieldError('renderOptions.backgroundColor')}
                        </div>
                    )}
                </Field>
            </CardContent>
        </Card>
    );
}
