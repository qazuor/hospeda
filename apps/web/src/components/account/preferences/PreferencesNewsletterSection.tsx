/**
 * @file PreferencesNewsletterSection.tsx
 * @description The newsletter on/off and its per-content-type switches, in
 * Preferences (HOS-2479, D11). Wired to the SAME endpoints the newsletter page
 * used: `GET /newsletter/status`, `POST /newsletter/subscribe`,
 * `DELETE /newsletter/unsubscribe` and `PATCH /newsletter/preferences`.
 */

import {
    DEFAULT_NEWSLETTER_PREFERENCES,
    type NewsletterContentPreferences,
    NewsletterContentTypeEnum
} from '@repo/schemas';
import { useCallback, useEffect, useState } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import {
    AsyncRegion,
    type AsyncResult,
    AutoSaveChip,
    ConfirmDialog,
    ErrorState,
    Section,
    Skeleton,
    StatusPill,
    SwitchRow
} from '../ui';
import { joinApi, sendMutation } from './preferences-api';
import { useAutoSave } from './use-auto-save';

/** Lifecycle status returned by `GET /newsletter/status`. */
export type NewsletterStatus =
    | 'active'
    | 'pending_verification'
    | 'unsubscribed'
    | 'bounced'
    | 'complained'
    | null;

interface NewsletterState {
    readonly status: NewsletterStatus;
    readonly preferences: NewsletterContentPreferences;
}

/** Props of {@link PreferencesNewsletterSection}. */
export interface PreferencesNewsletterSectionProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** API base URL. */
    readonly apiUrl: string;
}

const CONTENT_TYPES = Object.values(NewsletterContentTypeEnum);

/** Content-type key to its i18n label keys. */
const CONTENT_LABEL_KEYS: Record<
    NewsletterContentTypeEnum,
    { readonly label: string; readonly description: string }
> = {
    offers: {
        label: 'account.newsletter.preferences.offers',
        description: 'account.newsletter.preferences.offersDesc'
    },
    events: {
        label: 'account.newsletter.preferences.events',
        description: 'account.newsletter.preferences.eventsDesc'
    },
    guides: {
        label: 'account.newsletter.preferences.guides',
        description: 'account.newsletter.preferences.guidesDesc'
    },
    productNews: {
        label: 'account.newsletter.preferences.productNews',
        description: 'account.newsletter.preferences.productNewsDesc'
    }
};

async function loadStatus({
    apiUrl,
    signal
}: {
    readonly apiUrl: string;
    readonly signal?: AbortSignal;
}): Promise<NewsletterState> {
    const res = await fetch(joinApi({ apiUrl, path: '/api/v1/protected/newsletter/status' }), {
        credentials: 'include',
        signal
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const envelope = (await res.json()) as {
        readonly data?: {
            readonly status: NewsletterStatus;
            readonly preferences: NewsletterContentPreferences | null;
        };
    };
    if (!envelope.data) throw new Error('empty envelope');
    return {
        status: envelope.data.status,
        preferences: envelope.data.preferences ?? DEFAULT_NEWSLETTER_PREFERENCES
    };
}

/**
 * Newsletter section of the Preferences page.
 *
 * @param props - See {@link PreferencesNewsletterSectionProps}.
 */
export function PreferencesNewsletterSection({
    locale,
    apiUrl
}: PreferencesNewsletterSectionProps) {
    const t = createT(locale);
    const [state, setState] = useState<AsyncResult<NewsletterState>>({ status: 'loading' });
    const autoSave = useAutoSave();
    const [confirmingUnsubscribe, setConfirmingUnsubscribe] = useState(false);

    const load = useCallback(
        async (signal?: AbortSignal) => {
            setState({ status: 'loading' });
            try {
                const data = await loadStatus({ apiUrl, signal });
                setState({ status: 'ready', data });
            } catch (error) {
                if ((error as Error).name === 'AbortError') return;
                setState({ status: 'error', retry: () => void load() });
            }
        },
        [apiUrl]
    );

    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load]);

    const setSubscribed = (next: boolean) => {
        // The chip's retry repeats this same closure. Once the mutation has been
        // accepted it must only re-read the status, never POST/DELETE again.
        let mutated = false;
        return autoSave.run({
            save: async () => {
                if (!mutated) {
                    await sendMutation({
                        url: joinApi({
                            apiUrl,
                            path: next
                                ? '/api/v1/protected/newsletter/subscribe'
                                : '/api/v1/protected/newsletter/unsubscribe'
                        }),
                        method: next ? 'POST' : 'DELETE',
                        body: next ? { locale, source: 'account_preferences' } : undefined,
                        locale,
                        fallback: t('newsletter.errorMessage')
                    });
                    mutated = true;
                }
                // Double opt-in: the status after a subscribe is read back, not guessed.
                const data = await loadStatus({ apiUrl });
                setState({ status: 'ready', data });
            }
        });
    };

    const handleSwitch = async (next: boolean) => {
        if (next) {
            await setSubscribed(true).catch(() => undefined);
            return;
        }
        // Unsubscribing asks first, as the old page did.
        setConfirmingUnsubscribe(true);
    };

    const setContentType = ({
        key,
        next
    }: {
        readonly key: NewsletterContentTypeEnum;
        readonly next: boolean;
    }) =>
        autoSave.run({
            save: async () => {
                await sendMutation({
                    url: joinApi({ apiUrl, path: '/api/v1/protected/newsletter/preferences' }),
                    method: 'PATCH',
                    body: { [key]: next },
                    locale,
                    fallback: t('account.newsletter.preferences.error')
                });
                setState((current) =>
                    current.status === 'ready'
                        ? {
                              status: 'ready',
                              data: {
                                  ...current.data,
                                  preferences: { ...current.data.preferences, [key]: next }
                              }
                          }
                        : current
                );
            }
        });

    return (
        <Section
            title={t('account.preferences.sections.newsletter')}
            helpId="section:preferences.newsletter"
            actions={
                autoSave.status ? (
                    <AutoSaveChip
                        status={autoSave.status}
                        savedAt={autoSave.savedAt}
                        onRetry={autoSave.retry}
                        locale={locale}
                    />
                ) : undefined
            }
        >
            <AsyncRegion
                state={state}
                loading={() => (
                    <Skeleton
                        locale={locale}
                        lines={2}
                    />
                )}
                error={({ retry }) => (
                    <ErrorState
                        locale={locale}
                        onRetry={retry}
                        variant="inline"
                    />
                )}
                empty={() => null}
                locked={() => null}
                ready={({ status, preferences }) => {
                    const terminal = status === 'bounced' || status === 'complained';
                    return (
                        <>
                            <SwitchRow
                                label={t('account.preferences.newsletter.label')}
                                description={t('account.preferences.newsletter.description')}
                                locale={locale}
                                checked={status === 'active' || status === 'pending_verification'}
                                disabled={terminal}
                                onChange={handleSwitch}
                                helpId="section:preferences.newsletter"
                            />
                            {status === 'pending_verification' ? (
                                <p role="status">{t('account.newsletter.pendingBanner')}</p>
                            ) : null}
                            {terminal ? (
                                <StatusPill tone="danger">
                                    {status === 'bounced'
                                        ? t('account.newsletter.statusBounced')
                                        : t('account.newsletter.statusComplained')}
                                </StatusPill>
                            ) : null}
                            {status === 'active'
                                ? CONTENT_TYPES.map((key) => (
                                      <SwitchRow
                                          key={key}
                                          label={t(CONTENT_LABEL_KEYS[key].label)}
                                          description={t(CONTENT_LABEL_KEYS[key].description)}
                                          locale={locale}
                                          checked={preferences[key]}
                                          onChange={(next) => setContentType({ key, next })}
                                      />
                                  ))
                                : null}
                        </>
                    );
                }}
            />
            <ConfirmDialog
                open={confirmingUnsubscribe}
                locale={locale}
                tone="destructive"
                title={t('footer.newsletter.unsubscribeConfirmTitle')}
                description={t('footer.newsletter.unsubscribeConfirm')}
                confirmLabel={t('footer.newsletter.unsubscribeConfirmButton')}
                onCancel={() => setConfirmingUnsubscribe(false)}
                onConfirm={async () => {
                    // A failure is reported by the chip (with its retry), not by the dialog.
                    await setSubscribed(false).catch(() => undefined);
                    setConfirmingUnsubscribe(false);
                }}
            />
        </Section>
    );
}
