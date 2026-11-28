/**
 * @file TemplateForm.tsx
 * @description Create / edit form of a direct email template (HOS-2685): name,
 * subject and body (editor without dynamic blocks). Validated with the API's
 * `CreateDirectEmailTemplateSchema` before the parent persists it.
 */

import type { TranslationKey } from '@repo/i18n';
import { type CreateDirectEmailTemplate, CreateDirectEmailTemplateSchema } from '@repo/schemas';
import type { TiptapDocument } from '@repo/utils';
import { useState } from 'react';
import { RichTextEditor } from '@/components/newsletter/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';

/** Props for TemplateForm. */
export interface TemplateFormProps {
    /** `null` when creating. */
    readonly initial: {
        readonly name: string;
        readonly subject: string;
        readonly bodyJson: unknown;
    } | null;
    readonly isPending: boolean;
    readonly onSubmit: (input: CreateDirectEmailTemplate) => void | Promise<void>;
    readonly onCancel: () => void;
}

type FieldErrors = Readonly<Partial<Record<'name' | 'subject' | 'bodyJson', string>>>;

/**
 * Template form.
 *
 * @param props - TemplateFormProps
 */
export function TemplateForm({ initial, isPending, onSubmit, onCancel }: TemplateFormProps) {
    const { t } = useTranslations();
    const [name, setName] = useState(initial?.name ?? '');
    const [subject, setSubject] = useState(initial?.subject ?? '');
    const [bodyJson, setBodyJson] = useState<TiptapDocument | null>(
        (initial?.bodyJson as TiptapDocument | undefined) ?? null
    );
    const [errors, setErrors] = useState<FieldErrors>({});

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const parsed = CreateDirectEmailTemplateSchema.safeParse({
            name,
            subject,
            bodyJson: bodyJson ?? { type: 'doc', content: [] }
        });
        if (!parsed.success) {
            const next: Partial<Record<'name' | 'subject' | 'bodyJson', string>> = {};
            for (const issue of parsed.error.issues) {
                const head = issue.path[0];
                if ((head === 'name' || head === 'subject' || head === 'bodyJson') && !next[head]) {
                    next[head] = issue.message;
                }
            }
            setErrors(next);
            return;
        }
        setErrors({});
        await onSubmit(parsed.data);
    }

    const fieldError = (message: string | undefined) =>
        message ? (
            <p
                role="alert"
                className="text-destructive text-xs"
            >
                {t(message as TranslationKey)}
            </p>
        ) : null;

    return (
        <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-4 rounded-lg border bg-card p-4"
        >
            <h2 className="font-semibold text-lg">
                {initial
                    ? t('admin-direct-email.templates.formTitleEdit')
                    : t('admin-direct-email.templates.formTitleNew')}
            </h2>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="direct-email-template-name">
                    {t('admin-direct-email.templates.nameLabel')}
                </Label>
                <Input
                    id="direct-email-template-name"
                    value={name}
                    maxLength={120}
                    onChange={(event) => setName(event.target.value)}
                    aria-invalid={errors.name ? true : undefined}
                />
                {fieldError(errors.name)}
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="direct-email-template-subject">
                    {t('admin-direct-email.templates.subjectLabel')}
                </Label>
                <Input
                    id="direct-email-template-subject"
                    value={subject}
                    maxLength={200}
                    onChange={(event) => setSubject(event.target.value)}
                    aria-invalid={errors.subject ? true : undefined}
                />
                {fieldError(errors.subject)}
            </div>
            <div className="flex flex-col gap-1.5">
                <Label>{t('admin-direct-email.templates.bodyLabel')}</Label>
                <RichTextEditor
                    value={bodyJson}
                    onChange={setBodyJson}
                    enableDynamicBlocks={false}
                    ariaLabel={t('admin-direct-email.templates.bodyAriaLabel')}
                />
                {fieldError(errors.bodyJson)}
            </div>
            <div className="flex justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isPending}
                >
                    {t('admin-direct-email.templates.cancel')}
                </Button>
                <Button
                    type="submit"
                    disabled={isPending}
                >
                    {isPending
                        ? t('admin-direct-email.templates.saving')
                        : t('admin-direct-email.templates.save')}
                </Button>
            </div>
        </form>
    );
}
