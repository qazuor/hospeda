/**
 * @file AudienceFormModal.tsx
 * @description Create/Edit dialog for social audience catalog entries (SPEC-254 T-020).
 *
 * Uses SocialAudienceCreateSchema.safeParse() inside submit handler per convention.
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
import { useCreateSocialAudience, useUpdateSocialAudience } from '@/hooks/use-social-catalog';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { type SocialAudience, SocialAudienceCreateSchema } from '@repo/schemas';
import { useState } from 'react';

/** Props for {@link AudienceFormModal}. */
export interface AudienceFormModalProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly item: SocialAudience | null;
}

interface FormState {
    name: string;
    description: string;
    active: boolean;
}

const EMPTY_FORM: FormState = { name: '', description: '', active: true };

function itemToForm(item: SocialAudience): FormState {
    return {
        name: item.name,
        description: item.description ?? '',
        active: item.active
    };
}

/**
 * Create / Edit dialog for a social audience.
 *
 * @param props - {@link AudienceFormModalProps}
 */
export function AudienceFormModal({ open, onOpenChange, item }: AudienceFormModalProps) {
    const { t } = useTranslations();
    const isEdit = item !== null;

    const [form, setForm] = useState<FormState>(item ? itemToForm(item) : EMPTY_FORM);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const createMutation = useCreateSocialAudience();
    const updateMutation = useUpdateSocialAudience();
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
            description: form.description.trim() || undefined,
            active: form.active
        };

        const parsed = SocialAudienceCreateSchema.safeParse(raw);
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

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    return (
        <Dialog
            open={open}
            onOpenChange={handleOpenChange}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit
                            ? t('social.audiences.form.editTitle' as TranslationKey)
                            : t('social.audiences.form.createTitle' as TranslationKey)}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? t('social.audiences.form.editDesc' as TranslationKey)
                            : t('social.audiences.form.createDesc' as TranslationKey)}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* Name */}
                    <div className="space-y-1">
                        <Label htmlFor="audience-name">
                            {t('social.audiences.form.nameLabel' as TranslationKey)}
                        </Label>
                        <Input
                            id="audience-name"
                            value={form.name}
                            onChange={(e) => setField('name', e.target.value)}
                            required
                        />
                        {fieldErrors.name && (
                            <p className="text-destructive text-xs">{fieldErrors.name}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <Label htmlFor="audience-desc">
                            {t('social.audiences.form.descLabel' as TranslationKey)}
                        </Label>
                        <Textarea
                            id="audience-desc"
                            value={form.description}
                            onChange={(e) => setField('description', e.target.value)}
                            rows={2}
                        />
                    </div>

                    {/* Active */}
                    <div className="flex items-center gap-2">
                        <input
                            id="audience-active"
                            type="checkbox"
                            checked={form.active}
                            onChange={(e) => setField('active', e.target.checked)}
                            className="size-4"
                        />
                        <Label htmlFor="audience-active">
                            {t('social.audiences.form.activeLabel' as TranslationKey)}
                        </Label>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={isPending}
                        >
                            {t('social.audiences.form.cancel' as TranslationKey)}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                        >
                            {isPending
                                ? t('social.audiences.form.saving' as TranslationKey)
                                : isEdit
                                  ? t('social.audiences.form.saveEdit' as TranslationKey)
                                  : t('social.audiences.form.saveCreate' as TranslationKey)}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
