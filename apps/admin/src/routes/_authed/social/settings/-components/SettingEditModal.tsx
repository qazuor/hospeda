/**
 * @file SettingEditModal.tsx
 * @description Edit-only dialog for a single social automation setting (SPEC-254 T-021).
 *
 * Editable field: value only (string).
 * The key, type, and description are read-only display fields.
 * Secret-typed values arrive masked ('***') from the GET list; the PATCH response
 * returns the raw updated value, but the modal does NOT display it after save.
 *
 * Validation: Zod inline — value must be non-empty (matches the API's UpdateSettingValueSchema).
 * No zodResolver. No create or delete.
 */

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
import { useUpdateSocialSetting } from '@/hooks/use-social-platform-settings';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import type { SocialSetting } from '@repo/schemas';
import { useState } from 'react';
import { z } from 'zod';

/** Inline validation schema (mirrors API UpdateSettingValueSchema). */
const UpdateValueSchema = z.object({
    value: z.string().min(1, { message: 'zodError.socialSetting.value.required' })
});

/** Props for {@link SettingEditModal}. */
export interface SettingEditModalProps {
    /** Whether the dialog is open. */
    readonly open: boolean;
    /** Called to change dialog open state. */
    readonly onOpenChange: (open: boolean) => void;
    /** The setting row to edit; null hides the dialog. */
    readonly item: SocialSetting | null;
}

/**
 * Edit dialog for a social automation setting value.
 * Key, type, and description are shown as read-only context.
 *
 * @param props - {@link SettingEditModalProps}
 */
export function SettingEditModal({ open, onOpenChange, item }: SettingEditModalProps) {
    const { t } = useTranslations();
    const [value, setValue] = useState(item?.type === 'secret' ? '' : (item?.value ?? ''));
    const [valueError, setValueError] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);

    const updateMutation = useUpdateSocialSetting();
    const isPending = updateMutation.isPending;

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setValue(item?.type === 'secret' ? '' : (item?.value ?? ''));
            setValueError(null);
            setApiError(null);
        }
        onOpenChange(next);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setValueError(null);
        setApiError(null);

        const parsed = UpdateValueSchema.safeParse({ value });
        if (!parsed.success) {
            setValueError(
                parsed.error.issues[0]?.message ??
                    t('social.settings.form.valueRequired' as TranslationKey)
            );
            return;
        }

        if (!item) return;

        updateMutation.mutate(
            { key: item.key, value: parsed.data.value },
            {
                onSuccess: () => handleOpenChange(false),
                onError: (err) => {
                    setApiError(
                        err instanceof Error
                            ? err.message
                            : t('social.settings.form.saveError' as TranslationKey)
                    );
                }
            }
        );
    };

    if (!item) return null;

    const isSecret = item.type === 'secret';

    return (
        <Dialog
            open={open}
            onOpenChange={handleOpenChange}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {t('social.settings.form.editTitle' as TranslationKey)}
                    </DialogTitle>
                    <DialogDescription>
                        {t('social.settings.form.editDesc' as TranslationKey)}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* API error */}
                    {apiError && (
                        <p
                            className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm"
                            role="alert"
                            data-testid="setting-api-error"
                        >
                            {apiError}
                        </p>
                    )}

                    {/* Read-only key */}
                    <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">
                            {t('social.settings.form.keyLabel' as TranslationKey)}
                        </Label>
                        <p className="font-medium font-mono text-sm">{item.key}</p>
                    </div>

                    {/* Read-only type */}
                    <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">
                            {t('social.settings.form.typeLabel' as TranslationKey)}
                        </Label>
                        <p className="text-sm">{item.type}</p>
                    </div>

                    {/* Read-only description */}
                    {item.description && (
                        <div className="space-y-1">
                            <Label className="text-muted-foreground text-xs">
                                {t('social.settings.form.descriptionLabel' as TranslationKey)}
                            </Label>
                            <p className="text-muted-foreground text-sm">{item.description}</p>
                        </div>
                    )}

                    {/* Editable value */}
                    <div className="space-y-1">
                        <Label htmlFor="setting-value">
                            {t('social.settings.form.valueLabel' as TranslationKey)}
                        </Label>
                        {isSecret && (
                            <p
                                className="text-amber-600 text-xs"
                                data-testid="setting-secret-hint"
                            >
                                {t('social.settings.form.secretHint' as TranslationKey)}
                            </p>
                        )}
                        <Input
                            id="setting-value"
                            type={isSecret ? 'password' : 'text'}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={
                                isSecret
                                    ? t('social.settings.form.secretPlaceholder' as TranslationKey)
                                    : undefined
                            }
                            required
                        />
                        {valueError && <p className="text-destructive text-xs">{valueError}</p>}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={isPending}
                        >
                            {t('social.settings.form.cancel' as TranslationKey)}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                        >
                            {isPending
                                ? t('social.settings.form.saving' as TranslationKey)
                                : t('social.settings.form.saveEdit' as TranslationKey)}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
