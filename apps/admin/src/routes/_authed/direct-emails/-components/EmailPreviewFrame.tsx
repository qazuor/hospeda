/**
 * @file EmailPreviewFrame.tsx
 * @description Real-layout preview of a direct email (HOS-2685): an iframe whose
 * `srcDoc` is the HTML rendered by `POST /direct-emails/preview`, the same
 * render the recipient gets. Requests are debounced and out-of-order replies
 * are dropped.
 */

import { hasTiptapContent, type PreviewDirectEmailRequest } from '@repo/schemas';
import type { TiptapDocument } from '@repo/utils';
import { useEffect, useRef, useState } from 'react';
import { usePreviewDirectEmail } from '@/hooks/direct-email';
import { useTranslations } from '@/hooks/use-translations';

/** Debounce between the last edit and the preview request. */
export const PREVIEW_DEBOUNCE_MS = 500;

/** Props for EmailPreviewFrame. */
export interface EmailPreviewFrameProps {
    readonly subject: string;
    readonly bodyJson: TiptapDocument | null;
}

/**
 * Iframe preview, sandboxed without scripts.
 *
 * @param props - EmailPreviewFrameProps
 */
export function EmailPreviewFrame({ subject, bodyJson }: EmailPreviewFrameProps) {
    const { t } = useTranslations();
    const { mutateAsync } = usePreviewDirectEmail();
    const [html, setHtml] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const requestId = useRef(0);

    const hasBody = bodyJson !== null && hasTiptapContent(bodyJson);

    useEffect(() => {
        if (!hasBody || !bodyJson) {
            requestId.current += 1;
            setHtml(null);
            setStatus('idle');
            return;
        }
        const current = ++requestId.current;
        setStatus('loading');
        const timer = setTimeout(async () => {
            try {
                const result = await mutateAsync({
                    subject,
                    // TiptapDocument is structurally the schema's document, minus `readonly`.
                    bodyJson: bodyJson as PreviewDirectEmailRequest['bodyJson']
                });
                if (requestId.current !== current) return;
                setHtml(result.html);
                setStatus('idle');
            } catch {
                if (requestId.current !== current) return;
                setStatus('error');
            }
        }, PREVIEW_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [subject, bodyJson, hasBody, mutateAsync]);

    return (
        <div className="flex flex-col gap-2">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                {t('admin-direct-email.compose.previewTitle')}
            </p>
            {!hasBody && (
                <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
                    {t('admin-direct-email.compose.previewEmpty')}
                </p>
            )}
            {hasBody && status === 'loading' && html === null && (
                <p
                    role="status"
                    className="text-muted-foreground text-sm"
                >
                    {t('admin-direct-email.compose.previewLoading')}
                </p>
            )}
            {status === 'error' && (
                <p
                    role="alert"
                    className="text-destructive text-sm"
                >
                    {t('admin-direct-email.compose.previewError')}
                </p>
            )}
            {hasBody && html !== null && (
                <iframe
                    title={t('admin-direct-email.compose.previewFrameTitle')}
                    srcDoc={html}
                    sandbox=""
                    className="h-[640px] w-full rounded-md border bg-white"
                />
            )}
        </div>
    );
}
