/**
 * @file CopyButton.tsx
 * @description Copy-to-clipboard button (HOS-67 G-6, T-008).
 *
 * Shared by both Integration Config Export panels (GPT Action, Make.com
 * webhook). Copies the given plain-text `value` via `navigator.clipboard` and
 * shows a success/error toast, mirroring the clipboard pattern already used in
 * `GlobalErrorBoundary` (write + toast, no other admin component wraps this in
 * a reusable primitive yet).
 */

import type { TranslationKey } from '@repo/i18n';
import { CopyIcon } from '@repo/icons';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';

/** Props for {@link CopyButton}. */
export interface CopyButtonProps {
    /** The plain-text value to copy to the clipboard. */
    readonly value: string;
    /** Disables the button (e.g. when there is nothing to copy). */
    readonly disabled?: boolean;
    /** Overrides the visible button label (defaults to the generic "Copy"). */
    readonly label?: string;
    /** `data-testid` for the button. */
    readonly testId?: string;
}

/** A button that copies `value` to the clipboard and toasts the result. */
export function CopyButton({ value, disabled = false, label, testId }: CopyButtonProps) {
    const { addToast } = useToast();
    const { t } = useTranslations();

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            addToast({
                title: t('social.integrationConfig.copySuccessTitle' as TranslationKey),
                message: t('social.integrationConfig.copySuccessDescription' as TranslationKey),
                variant: 'success'
            });
        } catch {
            addToast({
                title: t('social.integrationConfig.copyErrorTitle' as TranslationKey),
                message: t('social.integrationConfig.copyErrorDescription' as TranslationKey),
                variant: 'error'
            });
        }
    };

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={handleCopy}
            data-testid={testId}
        >
            <CopyIcon
                className="mr-2 h-4 w-4"
                aria-hidden="true"
            />
            {label ?? t('social.integrationConfig.copyButton' as TranslationKey)}
        </Button>
    );
}
