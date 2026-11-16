/**
 * @file AiResetReviewPrompt.client.tsx
 * @description Global prompt shown after a password RESET (forgot-password
 * flow) to a user who had AI assistants connected before it (HOS-2184).
 *
 * The user is OFFERED, never forced, to disconnect those assistants. Nothing is
 * disconnected until they choose, and the prompt has no close button on
 * purpose: it goes away only by answering "Desconectar asistentes" or
 * "Mantenerlos", both of which clear the question on the server. Changing the
 * password while signed in never raises it.
 *
 * Session-blind pages: the server never renders anything per user. This island
 * checks the session in the browser (cached `/auth/me`) and only then reads the
 * shared AI connections lookup (one request per page load, see
 * `ai-connections-count.ts`). It does not depend on `HOSPEDA_MCP_ENABLED`: a
 * user must be able to answer even while the feature is switched off.
 *
 * Hydration: `client:idle`, mounted once in `BaseLayout`.
 */

import { ShieldAlertIcon } from '@repo/icons';
import type { AiConnectionResetReviewAction } from '@repo/schemas';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildAiConnectionsResetReviewUrl } from '@/lib/ai-assistants';
import { getAiConnectionsSnapshot, resetAiConnectionCount } from '@/lib/ai-connections-count';
import { fetchAuthMe, readCachedAuthMe } from '@/lib/auth-cache';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { AI_ASSISTANTS_PATH } from '@/lib/routes';
import { buildUrl } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import styles from './AiResetReviewPrompt.module.css';

/** Props of {@link AiResetReviewPrompt}. */
export interface AiResetReviewPromptProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** API base URL. */
    readonly apiUrl: string;
}

type PromptState =
    | { readonly kind: 'hidden' }
    | { readonly kind: 'asking'; readonly count: number }
    | { readonly kind: 'sending'; readonly count: number }
    | { readonly kind: 'failed'; readonly count: number };

/**
 * Post-password-reset prompt.
 *
 * @example
 * ```astro
 * <AiResetReviewPrompt client:idle locale={locale} apiUrl={apiUrl} />
 * ```
 */
export function AiResetReviewPrompt({ locale, apiUrl }: AiResetReviewPromptProps) {
    const { t, tPlural } = useMemo(() => createTranslations(locale), [locale]);
    const [state, setState] = useState<PromptState>({ kind: 'hidden' });
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        void (async () => {
            const session = readCachedAuthMe() ?? (await fetchAuthMe({ apiUrl }));
            if (!session.isAuthenticated) {
                return;
            }
            const { pendingResetReview } = await getAiConnectionsSnapshot({ apiUrl });
            if (mounted.current && pendingResetReview) {
                setState({
                    kind: 'asking',
                    count: pendingResetReview.connectionsBeforeReset.length
                });
            }
        })();
        return () => {
            mounted.current = false;
        };
    }, [apiUrl]);

    if (state.kind === 'hidden') {
        return null;
    }

    const count = state.count;
    const busy = state.kind === 'sending';

    async function answer(action: AiConnectionResetReviewAction): Promise<void> {
        setState({ kind: 'sending', count });
        try {
            const res = await fetch(buildAiConnectionsResetReviewUrl({ apiUrl }), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            // 409 means it was already answered (another tab): that is the end state we want.
            if (!res.ok && res.status !== 409) {
                throw new Error(`reset review failed: ${res.status}`);
            }
            // The cached lookup still holds the question; drop it so a later
            // consumer (or a remount) reads the real state.
            resetAiConnectionCount();
            if (!mounted.current) {
                return;
            }
            setState({ kind: 'hidden' });
            if (action === 'revoke_previous' && res.ok) {
                addToast({
                    type: 'success',
                    message: t(
                        'account.aiAssistants.resetReview.revoked',
                        'Desconectamos tus asistentes de IA.'
                    )
                });
            }
        } catch {
            if (mounted.current) {
                setState({ kind: 'failed', count });
            }
        }
    }

    return (
        <section
            className={styles.prompt}
            aria-labelledby="ai-reset-review-title"
            aria-describedby="ai-reset-review-body"
        >
            <div className={styles.header}>
                <ShieldAlertIcon
                    size={24}
                    aria-hidden="true"
                />
                <h2
                    id="ai-reset-review-title"
                    className={styles.title}
                >
                    {t('account.aiAssistants.resetReview.title', 'Asistentes de IA conectados')}
                </h2>
            </div>
            <p
                id="ai-reset-review-body"
                className={styles.body}
            >
                {tPlural('account.aiAssistants.resetReview.body', count)}
            </p>
            {state.kind === 'failed' && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {t(
                        'account.aiAssistants.resetReview.failed',
                        'No pudimos guardar tu respuesta. Probá de nuevo.'
                    )}
                </p>
            )}
            <div className={styles.actions}>
                <button
                    type="button"
                    className={styles.revokeBtn}
                    disabled={busy}
                    onClick={() => void answer('revoke_previous')}
                >
                    {t('account.aiAssistants.resetReview.revoke', 'Desconectar asistentes')}
                </button>
                <button
                    type="button"
                    className={styles.keepBtn}
                    disabled={busy}
                    onClick={() => void answer('keep')}
                >
                    {t('account.aiAssistants.resetReview.keep', 'Mantenerlos')}
                </button>
            </div>
            <a
                className={styles.link}
                href={buildUrl({ locale, path: AI_ASSISTANTS_PATH })}
            >
                {t('account.aiAssistants.resetReview.link', 'Ver mis asistentes de IA')}
            </a>
        </section>
    );
}
