/**
 * @file PlatformFormatFormModal.tsx
 * @description Edit-only dialog for social platform format config rows (SPEC-254 T-021).
 *
 * Platform and publishFormat are immutable (seed-only). Editable fields:
 * enabled, mvpEnabled, maxCaptionLength, makeChannelKey, notes.
 *
 * When the edit would DISABLE a currently-enabled format (enabled: true → false),
 * a warning badge is shown in the modal to alert the operator that active targets
 * may still reference this format. The API confirms the actual count in the response
 * warnings array (see PATCH /platform-formats/:id).
 *
 * Validation: SocialPlatformFormatUpdateSchema.safeParse() inside the submit handler.
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
import { Textarea } from '@/components/ui/textarea';
import { useUpdatePlatformFormat } from '@/hooks/use-social-platform-settings';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { type SocialPlatformFormat, SocialPlatformFormatUpdateSchema } from '@repo/schemas';
import { useState } from 'react';

/** Props for {@link PlatformFormatFormModal}. */
export interface PlatformFormatFormModalProps {
    /** Whether the dialog is open. */
    readonly open: boolean;
    /** Called to change dialog open state. */
    readonly onOpenChange: (open: boolean) => void;
    /** The platform format row to edit; null hides the dialog. */
    readonly item: SocialPlatformFormat | null;
}

interface FormState {
    enabled: boolean;
    mvpEnabled: boolean;
    maxCaptionLength: string;
    makeChannelKey: string;
    notes: string;
}

function itemToForm(item: SocialPlatformFormat): FormState {
    return {
        enabled: item.enabled,
        mvpEnabled: item.mvpEnabled,
        maxCaptionLength: item.maxCaptionLength != null ? String(item.maxCaptionLength) : '',
        makeChannelKey: item.makeChannelKey ?? '',
        notes: item.notes ?? ''
    };
}

const EMPTY_FORM: FormState = {
    enabled: true,
    mvpEnabled: false,
    maxCaptionLength: '',
    makeChannelKey: '',
    notes: ''
};

/**
 * Edit dialog for a social platform format config row.
 * Platform + publishFormat are read-only (seed-only columns).
 *
 * @param props - {@link PlatformFormatFormModalProps}
 */
export function PlatformFormatFormModal({
    open,
    onOpenChange,
    item
}: PlatformFormatFormModalProps) {
    const { t } = useTranslations();

    const [form, setForm] = useState<FormState>(item ? itemToForm(item) : EMPTY_FORM);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState<string | null>(null);

    const updateMutation = useUpdatePlatformFormat();
    const isPending = updateMutation.isPending;

    /**
     * Whether disabling this format may affect active targets.
     * True when the item is currently enabled and the operator is toggling it off.
     */
    const willDisableActiveFormat = item?.enabled === true && !form.enabled;

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setForm(item ? itemToForm(item) : EMPTY_FORM);
            setFieldErrors({});
            setApiError(null);
        }
        onOpenChange(next);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});
        setApiError(null);

        const raw = {
            enabled: form.enabled,
            mvpEnabled: form.mvpEnabled,
            maxCaptionLength: form.maxCaptionLength ? Number(form.maxCaptionLength) : undefined,
            makeChannelKey: form.makeChannelKey.trim() || undefined,
            notes: form.notes.trim() || undefined
        };

        const parsed = SocialPlatformFormatUpdateSchema.safeParse(raw);
        if (!parsed.success) {
            const errors: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                const field = issue.path[0]?.toString() ?? '_';
                errors[field] = issue.message;
            }
            setFieldErrors(errors);
            return;
        }

        if (!item) return;

        updateMutation.mutate(
            { id: item.id, input: parsed.data },
            {
                onSuccess: () => handleOpenChange(false),
                onError: (err) => {
                    setApiError(
                        err instanceof Error
                            ? err.message
                            : t('social.platformFormats.form.saveError' as TranslationKey)
                    );
                }
            }
        );
    };

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    if (!item) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={handleOpenChange}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {t('social.platformFormats.form.editTitle' as TranslationKey)}
                    </DialogTitle>
                    <DialogDescription>
                        <span className="font-semibold">
                            {item.platform} / {item.publishFormat}
                        </span>
                        {'  '}
                        {t('social.platformFormats.form.editDesc' as TranslationKey)}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* API error banner */}
                    {apiError && (
                        <p
                            className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm"
                            role="alert"
                            data-testid="platform-format-api-error"
                        >
                            {apiError}
                        </p>
                    )}

                    {/* Active targets warning */}
                    {willDisableActiveFormat && (
                        <div
                            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 text-sm"
                            role="alert"
                            data-testid="platform-format-disable-warning"
                        >
                            {t(
                                'social.platformFormats.form.disableActiveTargetsWarning' as TranslationKey
                            )}
                        </div>
                    )}

                    {/* Enabled + mvpEnabled row */}
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <input
                                id="pf-enabled"
                                type="checkbox"
                                checked={form.enabled}
                                onChange={(e) => setField('enabled', e.target.checked)}
                                className="size-4"
                            />
                            <Label htmlFor="pf-enabled">
                                {t('social.platformFormats.form.enabledLabel' as TranslationKey)}
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                id="pf-mvp-enabled"
                                type="checkbox"
                                checked={form.mvpEnabled}
                                onChange={(e) => setField('mvpEnabled', e.target.checked)}
                                className="size-4"
                            />
                            <Label htmlFor="pf-mvp-enabled">
                                {t('social.platformFormats.form.mvpEnabledLabel' as TranslationKey)}
                            </Label>
                        </div>
                    </div>

                    {/* Max caption length */}
                    <div className="space-y-1">
                        <Label htmlFor="pf-max-caption">
                            {t(
                                'social.platformFormats.form.maxCaptionLengthLabel' as TranslationKey
                            )}
                        </Label>
                        <Input
                            id="pf-max-caption"
                            type="number"
                            min={1}
                            value={form.maxCaptionLength}
                            onChange={(e) => setField('maxCaptionLength', e.target.value)}
                            placeholder="2200"
                        />
                        {fieldErrors.maxCaptionLength && (
                            <p className="text-destructive text-xs">
                                {fieldErrors.maxCaptionLength}
                            </p>
                        )}
                    </div>

                    {/* Make channel key */}
                    <div className="space-y-1">
                        <Label htmlFor="pf-make-key">
                            {t('social.platformFormats.form.makeChannelKeyLabel' as TranslationKey)}
                        </Label>
                        <Input
                            id="pf-make-key"
                            value={form.makeChannelKey}
                            onChange={(e) => setField('makeChannelKey', e.target.value)}
                            placeholder="instagram_feed_post"
                            className="font-mono"
                        />
                        {fieldErrors.makeChannelKey && (
                            <p className="text-destructive text-xs">{fieldErrors.makeChannelKey}</p>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                        <Label htmlFor="pf-notes">
                            {t('social.platformFormats.form.notesLabel' as TranslationKey)}
                        </Label>
                        <Textarea
                            id="pf-notes"
                            value={form.notes}
                            onChange={(e) => setField('notes', e.target.value)}
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={isPending}
                        >
                            {t('social.platformFormats.form.cancel' as TranslationKey)}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                        >
                            {isPending
                                ? t('social.platformFormats.form.saving' as TranslationKey)
                                : t('social.platformFormats.form.saveEdit' as TranslationKey)}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
