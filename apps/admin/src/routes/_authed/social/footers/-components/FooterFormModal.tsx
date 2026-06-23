/**
 * @file FooterFormModal.tsx
 * @description Create/Edit dialog for social post footer catalog entries (SPEC-254 T-020).
 *
 * Uses SocialPostFooterCreateSchema.safeParse() inside the submit handler per convention.
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
import { useCreateSocialFooter, useUpdateSocialFooter } from '@/hooks/use-social-catalog';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import {
    SocialPlatformEnum,
    type SocialPostFooter,
    SocialPostFooterCreateSchema
} from '@repo/schemas';
import { useState } from 'react';

/** Props for {@link FooterFormModal}. */
export interface FooterFormModalProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly item: SocialPostFooter | null;
}

interface FormState {
    name: string;
    content: string;
    platform: string;
    priority: string;
    active: boolean;
    isDefault: boolean;
    notes: string;
}

const EMPTY_FORM: FormState = {
    name: '',
    content: '',
    platform: '',
    priority: '0',
    active: true,
    isDefault: false,
    notes: ''
};

function itemToForm(item: SocialPostFooter): FormState {
    return {
        name: item.name,
        content: item.content,
        platform: item.platform ?? '',
        priority: String(item.priority),
        active: item.active,
        isDefault: item.isDefault,
        notes: item.notes ?? ''
    };
}

/**
 * Create / Edit dialog for a social post footer.
 *
 * @param props - {@link FooterFormModalProps}
 */
export function FooterFormModal({ open, onOpenChange, item }: FooterFormModalProps) {
    const { t } = useTranslations();
    const isEdit = item !== null;

    const [form, setForm] = useState<FormState>(item ? itemToForm(item) : EMPTY_FORM);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const createMutation = useCreateSocialFooter();
    const updateMutation = useUpdateSocialFooter();
    const isPending = createMutation.isPending || updateMutation.isPending;

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setForm(item ? itemToForm(item) : EMPTY_FORM);
            setFieldErrors({});
        }
        onOpenChange(next);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});

        const raw = {
            name: form.name.trim(),
            content: form.content.trim(),
            platform: form.platform || undefined,
            priority: Number(form.priority),
            active: form.active,
            isDefault: form.isDefault,
            notes: form.notes.trim() || undefined
        };

        const parsed = SocialPostFooterCreateSchema.safeParse(raw);
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
                { onSuccess: () => handleOpenChange(false) }
            );
        } else {
            createMutation.mutate(parsed.data, { onSuccess: () => handleOpenChange(false) });
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
                            ? t('social.footers.form.editTitle' as TranslationKey)
                            : t('social.footers.form.createTitle' as TranslationKey)}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? t('social.footers.form.editDesc' as TranslationKey)
                            : t('social.footers.form.createDesc' as TranslationKey)}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* Name */}
                    <div className="space-y-1">
                        <Label htmlFor="footer-name">
                            {t('social.footers.form.nameLabel' as TranslationKey)}
                        </Label>
                        <Input
                            id="footer-name"
                            value={form.name}
                            onChange={(e) => setField('name', e.target.value)}
                            required
                        />
                        {fieldErrors.name && (
                            <p className="text-destructive text-xs">{fieldErrors.name}</p>
                        )}
                    </div>

                    {/* Content */}
                    <div className="space-y-1">
                        <Label htmlFor="footer-content">
                            {t('social.footers.form.contentLabel' as TranslationKey)}
                        </Label>
                        <Textarea
                            id="footer-content"
                            value={form.content}
                            onChange={(e) => setField('content', e.target.value)}
                            rows={3}
                            required
                        />
                        {fieldErrors.content && (
                            <p className="text-destructive text-xs">{fieldErrors.content}</p>
                        )}
                    </div>

                    {/* Platform */}
                    <div className="space-y-1">
                        <Label htmlFor="footer-platform">
                            {t('social.footers.form.platformLabel' as TranslationKey)}
                        </Label>
                        <select
                            id="footer-platform"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={form.platform}
                            onChange={(e) => setField('platform', e.target.value)}
                        >
                            <option value="">
                                {t('social.footers.form.platformAll' as TranslationKey)}
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

                    {/* Priority + Active + isDefault row */}
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="footer-priority">
                                {t('social.footers.form.priorityLabel' as TranslationKey)}
                            </Label>
                            <Input
                                id="footer-priority"
                                type="number"
                                value={form.priority}
                                onChange={(e) => setField('priority', e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 pb-1">
                            <input
                                id="footer-active"
                                type="checkbox"
                                checked={form.active}
                                onChange={(e) => setField('active', e.target.checked)}
                                className="size-4"
                            />
                            <Label htmlFor="footer-active">
                                {t('social.footers.form.activeLabel' as TranslationKey)}
                            </Label>
                        </div>
                        <div className="flex items-center gap-2 pb-1">
                            <input
                                id="footer-is-default"
                                type="checkbox"
                                checked={form.isDefault}
                                onChange={(e) => setField('isDefault', e.target.checked)}
                                className="size-4"
                            />
                            <Label htmlFor="footer-is-default">
                                {t('social.footers.form.isDefaultLabel' as TranslationKey)}
                            </Label>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                        <Label htmlFor="footer-notes">
                            {t('social.footers.form.notesLabel' as TranslationKey)}
                        </Label>
                        <Textarea
                            id="footer-notes"
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
                            {t('social.footers.form.cancel' as TranslationKey)}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                        >
                            {isPending
                                ? t('social.footers.form.saving' as TranslationKey)
                                : isEdit
                                  ? t('social.footers.form.saveEdit' as TranslationKey)
                                  : t('social.footers.form.saveCreate' as TranslationKey)}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
