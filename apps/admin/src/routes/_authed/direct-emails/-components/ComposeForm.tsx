/**
 * @file ComposeForm.tsx
 * @description Compose screen of the direct email module (HOS-2685).
 *
 * Optional template, subject, recipient chips (checked against the suppression
 * list), the rich text editor WITHOUT dynamic blocks, a server-rendered preview,
 * a test send and a confirmed send. After the send the per-recipient results are
 * shown and the admin continues to the detail page.
 */

import type { TranslationKey } from '@repo/i18n';
import {
    DIRECT_EMAIL_MAX_RECIPIENTS,
    type DirectEmailSendResult,
    PermissionEnum
} from '@repo/schemas';
import type { TiptapDocument } from '@repo/utils';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { RichTextEditor } from '@/components/newsletter/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    getDirectEmailErrorKey,
    useDirectEmailTemplates,
    useSendDirectEmail,
    useTestSendDirectEmail
} from '@/hooks/direct-email';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { buildSendPayload, buildTestSendPayload, type ComposeErrors } from './compose-payload';
import { DirectEmailSendConfirmDialog } from './DirectEmailSendConfirmDialog';
import { DirectEmailTestSendDialog } from './DirectEmailTestSendDialog';
import { EmailPreviewFrame } from './EmailPreviewFrame';
import { RecipientsInput } from './RecipientsInput';
import { pickSuppressed } from './recipient-utils';
import { SendResultsDialog } from './SendResultsDialog';
import { useSuppressedRecipients } from './use-suppressed-recipients';

const TEMPLATE_PAGE_SIZE = 100;

/**
 * Full compose form.
 */
export function ComposeForm() {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const actorEmail = user?.email ?? '';
    const canSend = useHasPermission(PermissionEnum.DIRECT_EMAIL_SEND);

    const [subject, setSubject] = useState('');
    const [bodyJson, setBodyJson] = useState<TiptapDocument | null>(null);
    const [recipients, setRecipients] = useState<ReadonlyArray<string>>([]);
    const [templateId, setTemplateId] = useState<string | null>(null);
    const [errors, setErrors] = useState<ComposeErrors>({});
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [testOpen, setTestOpen] = useState(false);
    const [results, setResults] = useState<{
        readonly messageId: string;
        readonly items: ReadonlyArray<DirectEmailSendResult>;
    } | null>(null);

    const templatesQuery = useDirectEmailTemplates({ page: 1, pageSize: TEMPLATE_PAGE_SIZE });
    const sendMutation = useSendDirectEmail();
    const testSendMutation = useTestSendDirectEmail();
    const { suppressed, checkFailed } = useSuppressedRecipients({ recipients });

    const hasSuppressed = pickSuppressed({ recipients, suppressed }).length > 0;
    const templates = templatesQuery.data?.items ?? [];

    function translateIssue(message: string | undefined): string | null {
        if (!message) return null;
        // Zod issue messages are `zodError.*` i18n keys, resolved at runtime.
        return t(message as TranslationKey);
    }

    function applyTemplate(id: string): void {
        if (!id) {
            setTemplateId(null);
            return;
        }
        const template = templates.find((item) => item.id === id);
        if (!template) return;
        setTemplateId(template.id);
        setSubject(template.subject);
        setBodyJson(template.bodyJson as TiptapDocument);
        setErrors({});
        addToast({ message: t('admin-direct-email.compose.templateApplied'), variant: 'success' });
    }

    function handleOpenConfirm(): void {
        const built = buildSendPayload({
            values: { subject, bodyJson, recipients, templateId }
        });
        if (!built.success) {
            setErrors(built.errors);
            addToast({
                message: t('admin-direct-email.compose.validationFailed'),
                variant: 'error'
            });
            return;
        }
        setErrors({});
        setConfirmOpen(true);
    }

    async function handleSend(): Promise<void> {
        const built = buildSendPayload({
            values: { subject, bodyJson, recipients, templateId }
        });
        if (!built.success) {
            setConfirmOpen(false);
            setErrors(built.errors);
            return;
        }
        try {
            const response = await sendMutation.mutateAsync(built.payload);
            setConfirmOpen(false);
            setResults({ messageId: response.messageId, items: response.results });
        } catch (error) {
            setConfirmOpen(false);
            addToast({ message: t(getDirectEmailErrorKey({ error })), variant: 'error' });
        }
    }

    async function handleTestSend({ email }: { readonly email: string }): Promise<void> {
        // Omit `toEmail` for the admin's own address: the API resolves it itself.
        const toEmail = email.toLowerCase() === actorEmail.toLowerCase() ? undefined : email;
        const built = buildTestSendPayload({ subject, bodyJson, toEmail });
        if (!built.success) {
            setTestOpen(false);
            setErrors(built.errors);
            return;
        }
        try {
            const result = await testSendMutation.mutateAsync(built.payload);
            setTestOpen(false);
            addToast({
                message: t('admin-direct-email.testSend.sentToast', { email: result.sentTo }),
                variant: 'success'
            });
        } catch (error) {
            setTestOpen(false);
            addToast({ message: t(getDirectEmailErrorKey({ error })), variant: 'error' });
        }
    }

    function handleContinue(): void {
        if (!results) return;
        void navigate({
            to: '/direct-emails/$messageId',
            params: { messageId: results.messageId }
        });
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <div className="space-y-5">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="direct-email-template">
                        {t('admin-direct-email.compose.templateLabel')}
                    </Label>
                    <select
                        id="direct-email-template"
                        className="rounded-md border bg-background px-3 py-2 text-sm"
                        value={templateId ?? ''}
                        onChange={(event) => applyTemplate(event.target.value)}
                        disabled={templatesQuery.isLoading}
                    >
                        <option value="">{t('admin-direct-email.compose.templateNone')}</option>
                        {templates.map((template) => (
                            <option
                                key={template.id}
                                value={template.id}
                            >
                                {template.name}
                            </option>
                        ))}
                    </select>
                    {templatesQuery.isError && (
                        <p
                            role="alert"
                            className="text-destructive text-xs"
                        >
                            {t('admin-direct-email.compose.templateLoadError')}
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="direct-email-subject">
                        {t('admin-direct-email.compose.subjectLabel')}
                    </Label>
                    <Input
                        id="direct-email-subject"
                        value={subject}
                        maxLength={200}
                        placeholder={t('admin-direct-email.compose.subjectPlaceholder')}
                        onChange={(event) => setSubject(event.target.value)}
                        aria-invalid={errors.subject ? true : undefined}
                    />
                    {errors.subject && (
                        <p
                            role="alert"
                            className="text-destructive text-xs"
                        >
                            {translateIssue(errors.subject)}
                        </p>
                    )}
                </div>

                <RecipientsInput
                    recipients={recipients}
                    onChange={setRecipients}
                    suppressed={suppressed}
                    max={DIRECT_EMAIL_MAX_RECIPIENTS}
                    error={translateIssue(errors.recipients)}
                />
                {checkFailed && (
                    <p
                        role="status"
                        className="text-muted-foreground text-xs"
                    >
                        {t('admin-direct-email.compose.recipientsCheckError')}
                    </p>
                )}

                <div className="flex flex-col gap-1.5">
                    <Label>{t('admin-direct-email.compose.bodyLabel')}</Label>
                    <RichTextEditor
                        value={bodyJson}
                        onChange={setBodyJson}
                        enableDynamicBlocks={false}
                        ariaLabel={t('admin-direct-email.compose.bodyAriaLabel')}
                    />
                    {errors.bodyJson && (
                        <p
                            role="alert"
                            className="text-destructive text-xs"
                        >
                            {translateIssue(errors.bodyJson)}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={!canSend}
                        onClick={() => setTestOpen(true)}
                    >
                        {t('admin-direct-email.compose.testSend')}
                    </Button>
                    <Button
                        type="button"
                        disabled={!canSend || hasSuppressed || sendMutation.isPending}
                        onClick={handleOpenConfirm}
                    >
                        {t('admin-direct-email.compose.send')}
                    </Button>
                </div>
            </div>

            <EmailPreviewFrame
                subject={subject}
                bodyJson={bodyJson}
            />

            <DirectEmailTestSendDialog
                open={testOpen}
                onOpenChange={setTestOpen}
                defaultEmail={actorEmail}
                isPending={testSendMutation.isPending}
                onSubmit={handleTestSend}
            />
            <DirectEmailSendConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                subject={subject.trim()}
                recipients={recipients}
                isPending={sendMutation.isPending}
                onConfirm={handleSend}
            />
            <SendResultsDialog
                open={results !== null}
                results={results?.items ?? []}
                onContinue={handleContinue}
            />
        </div>
    );
}
