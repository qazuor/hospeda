/**
 * @file CampaignFormModal.tsx
 * @description Create/Edit dialog for social campaign catalog entries (SPEC-254 T-020).
 *
 * Uses SocialCampaignCreateSchema.safeParse() inside submit handler per convention.
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
import { useCreateSocialCampaign, useUpdateSocialCampaign } from '@/hooks/use-social-catalog';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { type SocialCampaign, SocialCampaignCreateSchema } from '@repo/schemas';
import { useState } from 'react';

/** Props for {@link CampaignFormModal}. */
export interface CampaignFormModalProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly item: SocialCampaign | null;
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

function itemToForm(item: SocialCampaign): FormState {
    return {
        name: item.name,
        description: item.description ?? '',
        active: item.active,
        startsAt: isoDatePart(item.startsAt),
        endsAt: isoDatePart(item.endsAt)
    };
}

/**
 * Create / Edit dialog for a social campaign.
 *
 * @param props - {@link CampaignFormModalProps}
 */
export function CampaignFormModal({ open, onOpenChange, item }: CampaignFormModalProps) {
    const { t } = useTranslations();
    const isEdit = item !== null;

    const [form, setForm] = useState<FormState>(item ? itemToForm(item) : EMPTY_FORM);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const createMutation = useCreateSocialCampaign();
    const updateMutation = useUpdateSocialCampaign();
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

        const parsed = SocialCampaignCreateSchema.safeParse(raw);
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
                            ? t('social.campaigns.form.editTitle' as TranslationKey)
                            : t('social.campaigns.form.createTitle' as TranslationKey)}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? t('social.campaigns.form.editDesc' as TranslationKey)
                            : t('social.campaigns.form.createDesc' as TranslationKey)}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* Name */}
                    <div className="space-y-1">
                        <Label htmlFor="campaign-name">
                            {t('social.campaigns.form.nameLabel' as TranslationKey)}
                        </Label>
                        <Input
                            id="campaign-name"
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
                        <Label htmlFor="campaign-desc">
                            {t('social.campaigns.form.descLabel' as TranslationKey)}
                        </Label>
                        <Textarea
                            id="campaign-desc"
                            value={form.description}
                            onChange={(e) => setField('description', e.target.value)}
                            rows={2}
                        />
                    </div>

                    {/* Dates row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="campaign-starts">
                                {t('social.campaigns.form.startsAtLabel' as TranslationKey)}
                            </Label>
                            <Input
                                id="campaign-starts"
                                type="date"
                                value={form.startsAt}
                                onChange={(e) => setField('startsAt', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="campaign-ends">
                                {t('social.campaigns.form.endsAtLabel' as TranslationKey)}
                            </Label>
                            <Input
                                id="campaign-ends"
                                type="date"
                                value={form.endsAt}
                                onChange={(e) => setField('endsAt', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Active */}
                    <div className="flex items-center gap-2">
                        <input
                            id="campaign-active"
                            type="checkbox"
                            checked={form.active}
                            onChange={(e) => setField('active', e.target.checked)}
                            className="size-4"
                        />
                        <Label htmlFor="campaign-active">
                            {t('social.campaigns.form.activeLabel' as TranslationKey)}
                        </Label>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={isPending}
                        >
                            {t('social.campaigns.form.cancel' as TranslationKey)}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                        >
                            {isPending
                                ? t('social.campaigns.form.saving' as TranslationKey)
                                : isEdit
                                  ? t('social.campaigns.form.saveEdit' as TranslationKey)
                                  : t('social.campaigns.form.saveCreate' as TranslationKey)}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
