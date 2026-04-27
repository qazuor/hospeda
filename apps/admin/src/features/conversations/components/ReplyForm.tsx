/**
 * ReplyForm component for owner replies in a conversation thread.
 *
 * Hidden when conversation status is CLOSED or BLOCKED.
 * Shows a character counter (0/5000).
 * Displays inline 422/error messages from useReplyMutation.
 *
 * Uses TanStack Form (project standard for admin forms).
 */

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { useReplyMutation } from '../hooks/useReplyMutation';
import type { ConversationStatus } from '../types';

/** Props for the ReplyForm component */
export interface ReplyFormProps {
    /** ID of the conversation to reply to */
    conversationId: string;
    /** Current conversation status — form is hidden for CLOSED/BLOCKED */
    status: ConversationStatus;
}

const MAX_LENGTH = 5000;

const bodyValidator = z
    .string()
    .min(1, 'conversations.errors.messageRequired')
    .max(MAX_LENGTH, 'conversations.errors.messageTooLong');

/**
 * Form for submitting an owner reply. Hidden when status is CLOSED or BLOCKED.
 *
 * @param props - ReplyFormProps
 */
export function ReplyForm({ conversationId, status }: ReplyFormProps) {
    const { t } = useTranslations();
    const mutation = useReplyMutation();

    const form = useForm({
        defaultValues: { body: '' },
        onSubmit: async ({ value }) => {
            await mutation.mutateAsync({ conversationId, body: value.body });
            form.reset();
        }
    });

    // Hide form when conversation cannot receive messages
    if (status === 'CLOSED' || status === 'BLOCKED') {
        return null;
    }

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
            }}
            className="flex flex-col gap-2"
        >
            <form.Field
                name="body"
                validators={{
                    onChange: ({ value }) => {
                        const result = bodyValidator.safeParse(value);
                        return result.success ? undefined : result.error.issues[0]?.message;
                    }
                }}
            >
                {(field) => (
                    <div className="flex flex-col gap-1">
                        <Textarea
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder={t('conversations.thread.replyPlaceholder')}
                            rows={3}
                            maxLength={MAX_LENGTH}
                            disabled={mutation.isPending}
                            aria-label={t('conversations.thread.replyPlaceholder')}
                        />

                        {/* Character counter */}
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground text-xs">
                                {t('conversations.form.charCount', {
                                    current: String(field.state.value.length),
                                    max: String(MAX_LENGTH)
                                })}
                            </span>

                            <Button
                                type="submit"
                                size="sm"
                                disabled={
                                    mutation.isPending ||
                                    field.state.value.length === 0 ||
                                    Boolean(field.state.meta.errors.length)
                                }
                            >
                                {t('conversations.thread.send')}
                            </Button>
                        </div>

                        {/* Field validation error */}
                        {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                            <p className="text-destructive text-xs">
                                {t(field.state.meta.errors[0] as unknown as TranslationKey)}
                            </p>
                        )}
                    </div>
                )}
            </form.Field>

            {/* Inline mutation error (422 and other API errors) */}
            {mutation.isError && (
                <p className="text-destructive text-xs">
                    {(mutation.error as Error)?.message ??
                        t('conversations.errors.messageSendFailed')}
                </p>
            )}
        </form>
    );
}
