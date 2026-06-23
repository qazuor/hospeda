/**
 * @file BatchFormModal.tsx
 * @description Create/Edit dialog for social content batch catalog entries (SPEC-254 T-020).
 *
 * Uses SocialContentBatchCreateSchema.safeParse() inside submit handler per convention.
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
import { useCreateSocialBatch, useUpdateSocialBatch } from '@/hooks/use-social-catalog';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { type SocialContentBatch, SocialContentBatchCreateSchema } from '@repo/schemas';
import { useState } from 'react';

/** Props for {@link BatchFormModal}. */
export interface BatchFormModalProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly item: SocialContentBatch | null;
}

interface FormState {
    name: string;
    description: string;
    active: boolean;
    startsAt: string;
    endsAt: string;
}

const EMPTY_FORM: FormState = {
    name: '',
    description: '',
    active: true,
    startsAt: '',
    endsAt: ''
};

function isoDatePart(d: Date | undefined): string {
    if (!d) return '';
    return d instanceof Date ? d.toISOString().slice(0, 10) : '';
}

function itemToForm(item: SocialContentBatch): FormState {
    return {
        name: item.name,
        description: item.description ?? '',
        active: item.active,
        startsAt: isoDatePart(item.startsAt),
        endsAt: isoDatePart(item.endsAt)
    };
}

/**
 * Create / Edit dialog for a social content batch.
 *
 * @param props - {@link BatchFormModalProps}
 */
export function BatchFormModal({ open, onOpenChange, item }: BatchFormModalProps) {
    const { t } = useTranslations();
    const isEdit = item !== null;

    const [form, setForm] = useState<FormState>(item ? itemToForm(item) : EMPTY_FORM);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const createMutation = useCreateSocialBatch();
    const updateMutation = useUpdateSocialBatch();
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
            active: form.active,
            startsAt: form.startsAt ? new Date(form.startsAt) : undefined,
            endsAt: form.endsAt ? new Date(form.endsAt) : undefined
        };

        const parsed = SocialContentBatchCreateSchema.safeParse(raw);
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
                            ? t('social.batches.form.editTitle' as TranslationKey)
                            : t('social.batches.form.createTitle' as TranslationKey)}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? t('social.batches.form.editDesc' as TranslationKey)
                            : t('social.batches.form.createDesc' as TranslationKey)}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* Name */}
                    <div className="space-y-1">
                        <Label htmlFor="batch-name">
                            {t('social.batches.form.nameLabel' as TranslationKey)}
                        </Label>
                        <Input
                            id="batch-name"
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
                        <Label htmlFor="batch-desc">
                            {t('social.batches.form.descLabel' as TranslationKey)}
                        </Label>
                        <Textarea
                            id="batch-desc"
                            value={form.description}
                            onChange={(e) => setField('description', e.target.value)}
                            rows={2}
                        />
                    </div>

                    {/* Dates row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="batch-starts">
                                {t('social.batches.form.startsAtLabel' as TranslationKey)}
                            </Label>
                            <Input
                                id="batch-starts"
                                type="date"
                                value={form.startsAt}
                                onChange={(e) => setField('startsAt', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="batch-ends">
                                {t('social.batches.form.endsAtLabel' as TranslationKey)}
                            </Label>
                            <Input
                                id="batch-ends"
                                type="date"
                                value={form.endsAt}
                                onChange={(e) => setField('endsAt', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Active */}
                    <div className="flex items-center gap-2">
                        <input
                            id="batch-active"
                            type="checkbox"
                            checked={form.active}
                            onChange={(e) => setField('active', e.target.checked)}
                            className="size-4"
                        />
                        <Label htmlFor="batch-active">
                            {t('social.batches.form.activeLabel' as TranslationKey)}
                        </Label>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={isPending}
                        >
                            {t('social.batches.form.cancel' as TranslationKey)}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                        >
                            {isPending
                                ? t('social.batches.form.saving' as TranslationKey)
                                : isEdit
                                  ? t('social.batches.form.saveEdit' as TranslationKey)
                                  : t('social.batches.form.saveCreate' as TranslationKey)}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
