/**
 * @file RecipientsInput.tsx
 * @description Chips input for the direct email recipients (HOS-2685).
 *
 * Each address is validated on entry (Enter, comma, blur or paste), deduplicated
 * case-insensitively and capped at the API limit. Suppressed addresses stay in
 * the list but are marked with a warning, so the admin sees them and removes
 * them (the send is blocked while any remains).
 */

import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import {
    addRecipients,
    pickSuppressed,
    type RecipientRejection,
    type RecipientRejectionReason
} from './recipient-utils';

/** Props for RecipientsInput. */
export interface RecipientsInputProps {
    /** Current addresses (lowercased). */
    readonly recipients: ReadonlyArray<string>;
    /** Called with the new list. */
    readonly onChange: (next: ReadonlyArray<string>) => void;
    /** Addresses reported as suppressed by `check-recipients` (lowercased). */
    readonly suppressed: ReadonlySet<string>;
    /** Maximum number of recipients. */
    readonly max: number;
    /** Disables the whole control. */
    readonly disabled?: boolean;
    /** Error from the last submit attempt (for example "recipients.min"), already translated. */
    readonly error?: string | null;
}

const REJECTION_KEYS = {
    invalid: 'admin-direct-email.compose.recipientsInvalid',
    duplicate: 'admin-direct-email.compose.recipientsDuplicate',
    limit: 'admin-direct-email.compose.recipientsLimit'
} as const satisfies Record<RecipientRejectionReason, string>;

/**
 * Recipients field made of removable chips plus a text input.
 *
 * @param props - RecipientsInputProps
 */
export function RecipientsInput({
    recipients,
    onChange,
    suppressed,
    max,
    disabled = false,
    error = null
}: RecipientsInputProps) {
    const { t, tPlural } = useTranslations();
    const inputId = useId();
    const [draft, setDraft] = useState('');
    const [rejection, setRejection] = useState<RecipientRejection | null>(null);

    const suppressedInList = pickSuppressed({ recipients, suppressed });

    function commit(raw: string): void {
        if (!raw.trim()) return;
        const result = addRecipients({ current: recipients, raw, max });
        if (result.recipients.length !== recipients.length) onChange(result.recipients);
        setRejection(result.rejected[0] ?? null);
        // Keep the offending text so the admin can fix it; clear when all went in.
        setDraft(result.rejected.map((item) => item.value).join(' '));
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
        if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
            event.preventDefault();
            commit(draft);
        } else if (event.key === 'Backspace' && draft === '' && recipients.length > 0) {
            onChange(recipients.slice(0, -1));
        }
    }

    function handlePaste(event: React.ClipboardEvent<HTMLInputElement>): void {
        const text = event.clipboardData.getData('text');
        if (/[\s,;]/.test(text.trim())) {
            event.preventDefault();
            commit(text);
        }
    }

    const message = rejection
        ? t(REJECTION_KEYS[rejection.reason], { email: rejection.value, max })
        : error;

    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={inputId}>{t('admin-direct-email.compose.recipientsLabel')}</Label>
            <div
                className={cn(
                    'flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-2',
                    disabled && 'opacity-60'
                )}
            >
                {recipients.map((email) => {
                    const isSuppressed = suppressed.has(email.toLowerCase());
                    return (
                        <span
                            key={email}
                            data-testid="recipient-chip"
                            data-suppressed={isSuppressed ? 'true' : 'false'}
                            className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs',
                                isSuppressed
                                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                                    : 'border-border bg-muted'
                            )}
                        >
                            {email}
                            {isSuppressed && (
                                <span className="font-semibold">
                                    ({t('admin-direct-email.compose.recipientsSuppressedTag')})
                                </span>
                            )}
                            <button
                                type="button"
                                aria-label={t('admin-direct-email.compose.recipientRemove', {
                                    email
                                })}
                                disabled={disabled}
                                onClick={() =>
                                    onChange(recipients.filter((item) => item !== email))
                                }
                                className="rounded-full px-1 hover:bg-background/60"
                            >
                                ×
                            </button>
                        </span>
                    );
                })}
                <Input
                    id={inputId}
                    type="text"
                    inputMode="email"
                    autoComplete="off"
                    value={draft}
                    disabled={disabled || recipients.length >= max}
                    placeholder={
                        recipients.length === 0
                            ? t('admin-direct-email.compose.recipientsPlaceholder')
                            : ''
                    }
                    onChange={(event) => {
                        setDraft(event.target.value);
                        if (rejection) setRejection(null);
                    }}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onBlur={() => commit(draft)}
                    aria-invalid={message ? true : undefined}
                    className="h-7 min-w-[12rem] flex-1 border-0 p-0 shadow-none focus-visible:ring-0"
                />
            </div>
            <p className="text-muted-foreground text-xs">
                {tPlural('admin-direct-email.compose.recipientsHint', recipients.length, { max })}
            </p>
            {message && (
                <p
                    role="alert"
                    className="text-destructive text-xs"
                >
                    {message}
                </p>
            )}
            {suppressedInList.length > 0 && (
                <p
                    role="alert"
                    data-testid="suppressed-warning"
                    className="text-destructive text-xs"
                >
                    {t('admin-direct-email.compose.recipientsSuppressedWarning', {
                        emails: suppressedInList.join(', ')
                    })}
                </p>
            )}
        </div>
    );
}
