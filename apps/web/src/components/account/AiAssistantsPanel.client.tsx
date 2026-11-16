/**
 * @file AiAssistantsPanel.client.tsx
 * @description React island for the "Asistentes de IA" account section
 * (HOS-2184 T-028).
 *
 * Lists the AI assistants (OAuth clients) the user connected to the MCP server
 * and lets them disconnect one. When the MCP feature is on it also shows the
 * MCP URL to paste into the assistant. When it is off the panel only exists
 * to manage what is already connected.
 *
 * Per-user data is fetched here, in the browser, so the Astro page stays
 * session-blind. Names, URIs and logos are declared by the client itself and
 * are untrusted: they render as React text, the logo is never fetched (a
 * generic icon stands in) and a URI becomes a link only when it is https.
 *
 * Hydration: `client:load` (the list is the whole page).
 */

import { AskToAiIcon } from '@repo/icons';
import type { AiConnection } from '@repo/schemas';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AI_CAPABILITY_FALLBACKS,
    AI_CAPABILITY_KEYS,
    buildAiConnectionsUrl,
    parseAiConnections,
    resolveAiAssistantsVisibility
} from '@/lib/ai-assistants';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { toSafeHttpsUrl } from '@/lib/oauth-consent';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import styles from './AiAssistantsPanel.module.css';

/** Props of {@link AiAssistantsPanel}. */
export interface AiAssistantsPanelProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** API base URL. */
    readonly apiUrl: string;
    /** Canonical MCP URL when the feature is on, `null` when it is off. */
    readonly mcpUrl: string | null;
}

type LoadState =
    | { readonly kind: 'loading' }
    | { readonly kind: 'error' }
    | { readonly kind: 'ready' };

/**
 * Account panel to connect and disconnect AI assistants.
 *
 * @example
 * ```astro
 * <AiAssistantsPanel client:load locale={locale} apiUrl={apiUrl} mcpUrl={mcpUrl} />
 * ```
 */
export function AiAssistantsPanel({ locale, apiUrl, mcpUrl }: AiAssistantsPanelProps) {
    const { t } = useMemo(() => createTranslations(locale), [locale]);

    const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
    const [items, setItems] = useState<readonly AiConnection[]>([]);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [disconnectError, setDisconnectError] = useState<string | null>(null);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const loadConnections = useCallback(async () => {
        setLoad({ kind: 'loading' });
        try {
            const res = await fetch(buildAiConnectionsUrl({ apiUrl }), {
                credentials: 'include'
            });
            const parsed = res.ok ? parseAiConnections({ body: await res.json() }) : null;
            if (!mounted.current) {
                return;
            }
            if (parsed?.ok) {
                setItems(parsed.items);
                setLoad({ kind: 'ready' });
            } else {
                setLoad({ kind: 'error' });
            }
        } catch {
            if (mounted.current) {
                setLoad({ kind: 'error' });
            }
        }
    }, [apiUrl]);

    useEffect(() => {
        void loadConnections();
    }, [loadConnections]);

    const unnamed = t('account.aiAssistants.list.unnamed', 'Asistente sin nombre');
    const displayName = (item: AiConnection): string => item.name?.trim() || unnamed;

    /** Optimistic removal; the item goes back where it was if the API refuses. */
    async function disconnect(item: AiConnection): Promise<void> {
        const index = items.findIndex((candidate) => candidate.clientId === item.clientId);
        setConfirmingId(null);
        setDisconnectError(null);
        setItems((current) => current.filter((candidate) => candidate.clientId !== item.clientId));
        try {
            const res = await fetch(buildAiConnectionsUrl({ apiUrl, clientId: item.clientId }), {
                method: 'DELETE',
                credentials: 'include'
            });
            // 404 means it is already gone, which is what the user wanted.
            if (!res.ok && res.status !== 404) {
                throw new Error(`disconnect failed: ${res.status}`);
            }
        } catch {
            if (!mounted.current) {
                return;
            }
            setItems((current) => {
                const next = [...current];
                next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
                return next;
            });
            setDisconnectError(
                t(
                    'account.aiAssistants.errors.disconnectFailed',
                    'No pudimos desconectar el asistente. Probá de nuevo.'
                )
            );
        }
    }

    async function copyMcpUrl(): Promise<void> {
        if (!mcpUrl) {
            return;
        }
        try {
            await navigator.clipboard.writeText(mcpUrl);
            setCopyState('copied');
        } catch {
            setCopyState('failed');
        }
    }

    const visibility = resolveAiAssistantsVisibility({
        mcpEnabled: mcpUrl !== null,
        connectionCount: items.length
    });
    const showUnavailable = load.kind === 'ready' && visibility === 'unavailable';

    return (
        <div className={styles.root}>
            {mcpUrl && (
                <section
                    className={styles.section}
                    aria-labelledby="ai-connect-title"
                >
                    <h2
                        id="ai-connect-title"
                        className={styles.sectionTitle}
                    >
                        {t('account.aiAssistants.connect.title', 'Cómo conectar un asistente')}
                    </h2>
                    <p className={styles.text}>
                        {t(
                            'account.aiAssistants.connect.intro',
                            'En Claude, ChatGPT, Gemini u otro asistente compatible con MCP, agregá un conector personalizado y pegá esta dirección. Después iniciá sesión en Hospeda y aprobá el acceso.'
                        )}
                    </p>
                    <span
                        className={styles.urlLabel}
                        id="ai-mcp-url-label"
                    >
                        {t('account.aiAssistants.connect.urlLabel', 'Dirección del servidor MCP')}
                    </span>
                    <div className={styles.urlRow}>
                        <code className={styles.urlValue}>{mcpUrl}</code>
                        <button
                            type="button"
                            className={styles.copyBtn}
                            onClick={() => void copyMcpUrl()}
                        >
                            {t('account.aiAssistants.connect.copy', 'Copiar')}
                        </button>
                    </div>
                    <p
                        className={styles.copyFeedback}
                        role="status"
                    >
                        {copyState === 'copied' &&
                            t('account.aiAssistants.connect.copied', 'Copiada')}
                        {copyState === 'failed' &&
                            t(
                                'account.aiAssistants.connect.copyFailed',
                                'No pudimos copiarla. Seleccionala y copiala a mano.'
                            )}
                    </p>
                    <h3 className={styles.capabilitiesTitle}>
                        {t(
                            'account.aiAssistants.capabilitiesTitle',
                            'Un asistente conectado puede'
                        )}
                    </h3>
                    <ul className={styles.capabilities}>
                        {AI_CAPABILITY_KEYS.map((key) => (
                            <li key={key}>
                                {t(
                                    `auth.consent.capabilities.${key}`,
                                    AI_CAPABILITY_FALLBACKS[key]
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {!mcpUrl && load.kind === 'ready' && visibility === 'manage-only' && (
                <p className={styles.notice}>
                    {t(
                        'account.aiAssistants.paused',
                        'La conexión de nuevos asistentes está pausada por ahora. Podés desconectar los que ya tenés.'
                    )}
                </p>
            )}

            {showUnavailable && (
                <p className={styles.notice}>
                    {t(
                        'account.aiAssistants.unavailable',
                        'La conexión de asistentes de IA todavía no está disponible.'
                    )}
                </p>
            )}

            {load.kind === 'loading' && (
                <p
                    className={styles.loadingWrap}
                    role="status"
                >
                    {t('account.aiAssistants.list.loading', 'Cargando tus asistentes...')}
                </p>
            )}

            {load.kind === 'error' && (
                <div
                    className={styles.errorWrap}
                    role="alert"
                >
                    <span>
                        {t(
                            'account.aiAssistants.errors.loadFailed',
                            'No pudimos cargar tus asistentes. Probá de nuevo.'
                        )}
                    </span>
                    <button
                        type="button"
                        className={styles.retryBtn}
                        onClick={() => void loadConnections()}
                    >
                        {t('account.aiAssistants.errors.retry', 'Reintentar')}
                    </button>
                </div>
            )}

            {load.kind === 'ready' && visibility !== 'unavailable' && (
                <section
                    className={styles.section}
                    aria-labelledby="ai-list-title"
                >
                    <h2
                        id="ai-list-title"
                        className={styles.sectionTitle}
                    >
                        {t('account.aiAssistants.list.title', 'Asistentes conectados')}
                    </h2>

                    {disconnectError && (
                        <p
                            className={styles.errorWrap}
                            role="alert"
                        >
                            {disconnectError}
                        </p>
                    )}

                    {items.length === 0 ? (
                        <p className={styles.text}>
                            {t(
                                'account.aiAssistants.list.empty',
                                'Todavía no conectaste ningún asistente.'
                            )}
                        </p>
                    ) : (
                        <ul className={styles.list}>
                            {items.map((item) => {
                                const name = displayName(item);
                                const link = resolveSafeExternalUrl(
                                    toSafeHttpsUrl({ raw: item.uri }) ?? undefined
                                );
                                const confirming = confirmingId === item.clientId;
                                return (
                                    <li
                                        key={item.clientId}
                                        className={styles.item}
                                    >
                                        <div className={styles.itemMain}>
                                            <AskToAiIcon
                                                size={24}
                                                aria-hidden="true"
                                            />
                                            <div className={styles.itemText}>
                                                <p className={styles.itemName}>{name}</p>
                                                {link && (
                                                    <p className={styles.itemMeta}>
                                                        <a
                                                            className={styles.itemLink}
                                                            href={link}
                                                            target="_blank"
                                                            rel="noopener noreferrer nofollow"
                                                        >
                                                            {new URL(link).host}
                                                        </a>
                                                    </p>
                                                )}
                                                {item.connectedAt && (
                                                    <p className={styles.itemMeta}>
                                                        {t(
                                                            'account.aiAssistants.list.connectedAt',
                                                            'Conectado el {{date}}',
                                                            {
                                                                date: formatDate({
                                                                    date: item.connectedAt,
                                                                    locale
                                                                })
                                                            }
                                                        )}
                                                    </p>
                                                )}
                                                <p className={styles.itemMeta}>
                                                    {item.lastUsedAt
                                                        ? t(
                                                              'account.aiAssistants.list.lastUsed',
                                                              'Último uso aprox.: {{date}}',
                                                              {
                                                                  date: formatDate({
                                                                      date: item.lastUsedAt,
                                                                      locale
                                                                  })
                                                              }
                                                          )
                                                        : t(
                                                              'account.aiAssistants.list.neverUsed',
                                                              'Sin uso registrado'
                                                          )}
                                                </p>
                                            </div>
                                        </div>
                                        {!confirming && (
                                            <button
                                                type="button"
                                                className={styles.disconnectBtn}
                                                aria-label={t(
                                                    'account.aiAssistants.disconnect.ariaLabel',
                                                    'Desconectar {{name}}',
                                                    { name }
                                                )}
                                                onClick={() => {
                                                    setDisconnectError(null);
                                                    setConfirmingId(item.clientId);
                                                }}
                                            >
                                                {t(
                                                    'account.aiAssistants.disconnect.action',
                                                    'Desconectar'
                                                )}
                                            </button>
                                        )}
                                        {confirming && (
                                            <div className={styles.confirm}>
                                                <p className={styles.confirmTitle}>
                                                    {t(
                                                        'account.aiAssistants.disconnect.confirmTitle',
                                                        '¿Desconectar a {{name}}?',
                                                        { name }
                                                    )}
                                                </p>
                                                <p className={styles.confirmBody}>
                                                    {t(
                                                        'account.aiAssistants.disconnect.confirmBody',
                                                        'Pierde el acceso a tu cuenta de inmediato. Podés volver a conectarlo cuando quieras.'
                                                    )}
                                                </p>
                                                <div className={styles.confirmActions}>
                                                    <button
                                                        type="button"
                                                        className={styles.confirmBtn}
                                                        onClick={() => void disconnect(item)}
                                                    >
                                                        {t(
                                                            'account.aiAssistants.disconnect.confirm',
                                                            'Sí, desconectar'
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.cancelBtn}
                                                        onClick={() => setConfirmingId(null)}
                                                    >
                                                        {t(
                                                            'account.aiAssistants.disconnect.cancel',
                                                            'Cancelar'
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            )}
        </div>
    );
}
