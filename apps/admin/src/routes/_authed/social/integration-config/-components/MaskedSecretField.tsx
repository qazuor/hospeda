/**
 * @file MaskedSecretField.tsx
 * @description Masked secret value with reveal-on-click toggle + copy (HOS-67 G-6, T-008).
 *
 * Used for the Make.com API key in the "not configured" / configured states.
 * HOS-64's credential vault UI (`_authed/social/credentials`) never displays
 * plaintext secrets at all (only masked metadata cards — the vault API never
 * returns plaintext for existing credentials), so there is no existing
 * reveal-on-click component to reuse; this is a new, purpose-built primitive
 * for the one case (HOS-67) where the API deliberately returns a real secret
 * value to the admin UI (see the security note in
 * `apps/api/src/routes/social/admin/make-webhook-schema.ts`).
 */

import type { TranslationKey } from '@repo/i18n';
import { EyeIcon, EyeOffIcon } from '@repo/icons';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { CopyButton } from './CopyButton';

/** Placeholder shown while the secret is masked. */
const MASK_PLACEHOLDER = '••••••••••••';

/** Props for {@link MaskedSecretField}. */
export interface MaskedSecretFieldProps {
    /** The real secret value. */
    readonly value: string;
    /** `data-testid` prefix for the value/toggle/copy elements. */
    readonly testId?: string;
}

/** A masked secret value with a reveal-on-click toggle and a copy button. */
export function MaskedSecretField({ value, testId }: MaskedSecretFieldProps) {
    const [revealed, setRevealed] = useState(false);
    const { t } = useTranslations();

    return (
        <div className="flex flex-wrap items-center gap-2">
            <code
                className="rounded bg-muted px-2 py-1 font-mono text-xs"
                data-testid={testId ? `${testId}-value` : undefined}
            >
                {revealed ? value : MASK_PLACEHOLDER}
            </code>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRevealed((prev) => !prev)}
                data-testid={testId ? `${testId}-toggle` : undefined}
            >
                {revealed ? (
                    <EyeOffIcon
                        className="h-4 w-4"
                        aria-hidden="true"
                    />
                ) : (
                    <EyeIcon
                        className="h-4 w-4"
                        aria-hidden="true"
                    />
                )}
                <span className="sr-only">
                    {revealed
                        ? t('social.integrationConfig.hideSecret' as TranslationKey)
                        : t('social.integrationConfig.revealSecret' as TranslationKey)}
                </span>
            </Button>
            <CopyButton
                value={value}
                testId={testId ? `${testId}-copy` : undefined}
            />
        </div>
    );
}
