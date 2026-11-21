/**
 * @file EmailPlainTextPanel.tsx
 * @description Collapsible "Texto plano" panel of the email previewer: the
 * text/plain part the inbox receives (HOS-2519 AC-7.6).
 */

import { useTranslations } from '@/hooks/use-translations';

/** Props of {@link EmailPlainTextPanel}. */
export interface EmailPlainTextPanelProps {
    /** The text/plain body, exactly as the transport posts it. */
    readonly text: string;
}

/**
 * Collapsed by default; shows the text body verbatim (React escapes it).
 *
 * @param props - See {@link EmailPlainTextPanelProps}.
 */
export function EmailPlainTextPanel({ text }: EmailPlainTextPanelProps) {
    const { t } = useTranslations();
    return (
        <details className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2 font-medium text-sm">
                {t('admin-pages.emailPreviews.plainText')}
            </summary>
            <pre
                data-testid="email-plain-text"
                className="max-h-96 overflow-auto whitespace-pre-wrap border-t bg-muted/40 px-3 py-2 font-mono text-xs"
            >
                {text}
            </pre>
        </details>
    );
}
