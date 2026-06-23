/**
 * @file HashtagFormModal.tsx
 * @description Create/Edit dialog for social hashtag catalog entries (SPEC-254 T-020).
 *
 * Uses native form state (no zodResolver) — validates via SocialHashtagCreateSchema.safeParse()
 * inside the submit handler per project convention.
 * Surfaces a friendly 409/CONFLICT message when a duplicate normalizedHashtag is detected.
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
import {
    isConflictError,
    useCreateSocialHashtag,
    useUpdateSocialHashtag
} from '@/hooks/use-social-catalog';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { type SocialHashtag, SocialHashtagCreateSchema, SocialPlatformEnum } from '@repo/schemas';
import { useState } from 'react';

/** Props for {@link HashtagFormModal}. */
export interface HashtagFormModalProps {
    /** Whether the dialog is open. */
    readonly open: boolean;
    /** Called to change dialog open state. */
    readonly onOpenChange: (open: boolean) => void;
    /** Existing item for edit mode; null for create. */
    readonly item: SocialHashtag | null;
}

interface FormState {
    hashtag: string;
    category: string;
    platform: string;
    priority: string;
    active: boolean;
    notes: string;
}

const EMPTY_FORM: FormState = {
    hashtag: '',
    category: '',
    platform: '',
    priority: '0',
    active: true,
    notes: ''
};

function itemToForm(item: SocialHashtag): FormState {
    return {
        hashtag: item.hashtag,
        category: item.category,
        platform: item.platform ?? '',
        priority: String(item.priority),
        active: item.active,
        notes: item.notes ?? ''
    };
}

/**
 * Create / Edit dialog for a social hashtag.
 *
 * @param props - {@link HashtagFormModalProps}
 */
export function HashtagFormModal({ open, onOpenChange, item }: HashtagFormModalProps) {
    const { t } = useTranslations();
    const isEdit = item !== null;

    const [form, setForm] = useState<FormState>(item ? itemToForm(item) : EMPTY_FORM);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [conflictError, setConflictError] = useState(false);

    const createMutation = useCreateSocialHashtag();
    const updateMutation = useUpdateSocialHashtag();
    const isPending = createMutation.isPending || updateMutation.isPending;

    // Reset form when dialog opens/closes or item changes
    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setForm(item ? itemToForm(item) : EMPTY_FORM);
            setFieldErrors({});
            setConflictError(false);
        }
        onOpenChange(next);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});
        setConflictError(false);

        const raw = {
            hashtag: form.hashtag.trim(),
            category: form.category.trim(),
            platform: form.platform || undefined,
            priority: Number(form.priority),
            active: form.active,
            notes: form.notes.trim() || undefined
        };

        const parsed = SocialHashtagCreateSchema.safeParse(raw);
        if (!parsed.success) {
            const errors: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                const field = issue.path[0]?.toString() ?? '_';
                errors[field] = issue.message;
            }
            setFieldErrors(errors);
            return;
        }

        if (isEdit && item) {
            updateMutation.mutate(
                { id: item.id, input: parsed.data },
                {
                    onSuccess: () => handleOpenChange(false),
                    onError: (err) => {
                        if (isConflictError(err)) setConflictError(true);
                    }
                }
            );
        } else {
            createMutation.mutate(parsed.data, {
                onSuccess: () => handleOpenChange(false),
                onError: (err) => {
                    if (isConflictError(err)) setConflictError(true);
                }
            });
        }
    };

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    return (
        <Dialog
            open={open}
            onOpenChange={handleOpenChange}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit
                            ? t('social.hashtags.form.editTitle' as TranslationKey)
                            : t('social.hashtags.form.createTitle' as TranslationKey)}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? t('social.hashtags.form.editDesc' as TranslationKey)
                            : t('social.hashtags.form.createDesc' as TranslationKey)}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* Conflict error banner */}
                    {conflictError && (
                        <p
                            className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm"
                            role="alert"
                            data-testid="hashtag-conflict-error"
                        >
                            {t('social.hashtags.form.conflictError' as TranslationKey)}
                        </p>
                    )}

                    {/* Hashtag */}
                    <div className="space-y-1">
                        <Label htmlFor="hashtag-field">
                            {t('social.hashtags.form.hashtagLabel' as TranslationKey)}
                        </Label>
                        <Input
                            id="hashtag-field"
                            value={form.hashtag}
                            onChange={(e) => setField('hashtag', e.target.value)}
                            placeholder="#playa"
                            required
                        />
                        {fieldErrors.hashtag && (
                            <p className="text-destructive text-xs">{fieldErrors.hashtag}</p>
                        )}
                    </div>

                    {/* Category */}
                    <div className="space-y-1">
                        <Label htmlFor="hashtag-category">
                            {t('social.hashtags.form.categoryLabel' as TranslationKey)}
                        </Label>
                        <Input
                            id="hashtag-category"
                            value={form.category}
                            onChange={(e) => setField('category', e.target.value)}
                            placeholder="travel"
                            required
                        />
                        {fieldErrors.category && (
                            <p className="text-destructive text-xs">{fieldErrors.category}</p>
                        )}
                    </div>

                    {/* Platform */}
                    <div className="space-y-1">
                        <Label htmlFor="hashtag-platform">
                            {t('social.hashtags.form.platformLabel' as TranslationKey)}
                        </Label>
                        <select
                            id="hashtag-platform"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={form.platform}
                            onChange={(e) => setField('platform', e.target.value)}
                        >
                            <option value="">
                                {t('social.hashtags.form.platformAll' as TranslationKey)}
                            </option>
                            {Object.values(SocialPlatformEnum).map((p) => (
                                <option
                                    key={p}
                                    value={p}
                                >
                                    {p}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Priority + Active row */}
                    <div className="flex items-end gap-4">
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="hashtag-priority">
                                {t('social.hashtags.form.priorityLabel' as TranslationKey)}
                            </Label>
                            <Input
                                id="hashtag-priority"
                                type="number"
                                value={form.priority}
                                onChange={(e) => setField('priority', e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 pb-1">
                            <input
                                id="hashtag-active"
                                type="checkbox"
                                checked={form.active}
                                onChange={(e) => setField('active', e.target.checked)}
                                className="size-4"
                            />
                            <Label htmlFor="hashtag-active">
                                {t('social.hashtags.form.activeLabel' as TranslationKey)}
                            </Label>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                        <Label htmlFor="hashtag-notes">
                            {t('social.hashtags.form.notesLabel' as TranslationKey)}
                        </Label>
                        <Textarea
                            id="hashtag-notes"
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
                            {t('social.hashtags.form.cancel' as TranslationKey)}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                        >
                            {isPending
                                ? t('social.hashtags.form.saving' as TranslationKey)
                                : isEdit
                                  ? t('social.hashtags.form.saveEdit' as TranslationKey)
                                  : t('social.hashtags.form.saveCreate' as TranslationKey)}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
