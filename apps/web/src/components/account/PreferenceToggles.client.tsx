/**
 * @file PreferenceToggles.client.tsx
 * @description The Preferences island (HOS-2479, D11): the ONE place every
 * account on/off setting lives. Kit `SwitchRow`s with an `AutoSaveChip` per
 * section (direct-action save model).
 *
 * Sections: appearance (theme, language), notifications (email, push, SMS and,
 * only for an account that owns listings with an AI assistant, the weekly AI
 * digest, and for a VIP tourist the weekly promotions digest), newsletter,
 * search history. The newsletter and the
 * search history have their own sections because their data comes from their
 * own endpoints (the ones the newsletter and history pages used before).
 *
 * Admin-only fields (themeAdmin, languageAdmin) are intentionally NOT shown.
 * Hydration: caller must use `client:load`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getEntitlementsCached } from '@/lib/entitlements-cache';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { applyThemeChoice, markThemeSynced } from '@/lib/theme';
import { buildLocaleSwitchPathname } from '@/lib/urls';
import styles from './PreferenceToggles.module.css';
import { PreferencesHistorySection } from './preferences/PreferencesHistorySection';
import { PreferencesNewsletterSection } from './preferences/PreferencesNewsletterSection';
import { joinApi, sendMutation } from './preferences/preferences-api';
import { useAutoSave } from './preferences/use-auto-save';
import {
    AsyncRegion,
    type AsyncResult,
    AutoSaveChip,
    ErrorState,
    Field,
    Section,
    Select,
    Skeleton,
    SwitchRow
} from './ui';

type ThemeWeb = 'system' | 'light' | 'dark';
type LanguageWeb = 'es' | 'en' | 'pt';

interface NotificationSettings {
    enabled: boolean;
    allowEmails: boolean;
    allowPush: boolean;
    allowSms: boolean;
}

/** Web-scoped settings managed by this island. */
interface WebSettings {
    themeWeb: ThemeWeb;
    languageWeb: LanguageWeb;
    notifications: NotificationSettings;
    /** Weekly email of unanswered AI chat questions (HOS-2101). Opt-out. */
    aiQuestionsDigest: boolean;
    /** Weekly email of the week's new promotions, VIP tourists only (HOS-2589). Opt-out. */
    vipPromotionsDigest: boolean;
    /** Search-history recording (opt-out: absent means enabled). */
    searchHistoryEnabled: boolean;
}

interface UserApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly settings?: {
            readonly themeWeb?: string;
            readonly languageWeb?: string;
            readonly notifications?: Partial<NotificationSettings>;
            readonly aiQuestionsDigest?: boolean;
            readonly vipPromotionsDigest?: boolean;
            readonly searchHistoryEnabled?: boolean;
        } | null;
    };
}

/** Props of {@link PreferenceToggles}. */
export interface PreferenceTogglesProps {
    /** Authenticated user ID (from Astro.locals.user). */
    readonly userId: string;
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** API base URL. */
    readonly apiUrl: string;
    /** Catalog plan names that include search history (read on the server). */
    readonly historyGatePlanNames?: readonly string[];
    /** Where the plan pages live, for the locked search-history row. */
    readonly plansHref: string;
    /**
     * Whether the account owns listings with an AI assistant (HOS-2602), decided
     * on the server by `hasListingAssistant`. When `false` the weekly AI digest
     * row is not rendered: it would talk about «the assistant of your listings»
     * to an account that has none. Absent reads as `false` (fail-closed).
     */
    readonly showAiQuestionsDigest?: boolean;
}

const DEFAULT_SETTINGS: WebSettings = {
    themeWeb: 'system',
    languageWeb: 'es',
    notifications: { enabled: true, allowEmails: true, allowPush: false, allowSms: false },
    aiQuestionsDigest: true,
    vipPromotionsDigest: true,
    searchHistoryEnabled: true
};

async function loadSettings({
    apiUrl,
    userId
}: {
    readonly apiUrl: string;
    readonly userId: string;
}): Promise<WebSettings> {
    const res = await fetch(joinApi({ apiUrl, path: `/api/v1/protected/users/${userId}` }), {
        credentials: 'include'
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = (await res.json()) as UserApiResponse;
    if (!body.success) throw new Error('unsuccessful');
    const raw = body.data?.settings;
    const defaults = DEFAULT_SETTINGS;
    return {
        themeWeb: (raw?.themeWeb as ThemeWeb | undefined) ?? defaults.themeWeb,
        languageWeb: (raw?.languageWeb as LanguageWeb | undefined) ?? defaults.languageWeb,
        notifications: {
            enabled: raw?.notifications?.enabled ?? defaults.notifications.enabled,
            allowEmails: raw?.notifications?.allowEmails ?? defaults.notifications.allowEmails,
            allowPush: raw?.notifications?.allowPush ?? defaults.notifications.allowPush,
            allowSms: raw?.notifications?.allowSms ?? defaults.notifications.allowSms
        },
        aiQuestionsDigest: raw?.aiQuestionsDigest ?? defaults.aiQuestionsDigest,
        // HOS-2589: only an explicit `false` opts out of the VIP promotions digest.
        vipPromotionsDigest: raw?.vipPromotionsDigest !== false,
        // Explicit `false` is the opt-out; everything else is enabled.
        searchHistoryEnabled: raw?.searchHistoryEnabled !== false
    };
}

/**
 * Preferences island: every account on/off setting, saved on its own.
 *
 * @param props - See {@link PreferenceTogglesProps}.
 */
export function PreferenceToggles({
    userId,
    locale,
    apiUrl,
    historyGatePlanNames = [],
    plansHref,
    showAiQuestionsDigest = false
}: PreferenceTogglesProps) {
    const t = createT(locale);
    const [state, setState] = useState<AsyncResult<WebSettings>>({ status: 'loading' });
    const settingsRef = useRef<WebSettings>(DEFAULT_SETTINGS);
    const appearanceSave = useAutoSave();
    const notificationsSave = useAutoSave();

    const load = useCallback(async () => {
        setState({ status: 'loading' });
        try {
            const settings = await loadSettings({ apiUrl, userId });
            settingsRef.current = settings;
            setState({ status: 'ready', data: settings });
        } catch {
            setState({ status: 'error', retry: () => void load() });
        }
    }, [apiUrl, userId]);

    useEffect(() => {
        void load();
    }, [load]);

    // HOS-2589 AC-20: the VIP promotions digest row is shown only to a VIP tourist,
    // decided by the TOURIST effective set (a failed read hides it: fail-closed).
    const [isVipTourist, setIsVipTourist] = useState(false);
    useEffect(() => {
        let cancelled = false;
        const check = async (): Promise<void> => {
            const effectiveSet = await getEntitlementsCached({ vertical: 'tourist' });
            if (cancelled) return;
            setIsVipTourist(
                !effectiveSet.failed && (effectiveSet.entitlements.vip_promotions_access ?? 0) > 0
            );
        };
        void check();
        return () => {
            cancelled = true;
        };
    }, []);

    /** PATCHes one slice of `settings` and merges it into the island state. */
    const patchSettings = async ({
        patch,
        local
    }: {
        readonly patch: Record<string, unknown>;
        readonly local: Partial<WebSettings>;
    }): Promise<void> => {
        await sendMutation({
            url: joinApi({ apiUrl, path: `/api/v1/protected/users/${userId}` }),
            method: 'PATCH',
            body: { settings: patch },
            locale,
            fallback: t('account.preferences.errors.saveFailed')
        });
        const next = { ...settingsRef.current, ...local };
        settingsRef.current = next;
        setState({ status: 'ready', data: next });
    };

    const changeTheme = (value: ThemeWeb) =>
        appearanceSave.run({
            save: async () => {
                const previous = settingsRef.current.themeWeb;
                applyThemeChoice({ choice: value });
                try {
                    await patchSettings({ patch: { themeWeb: value }, local: { themeWeb: value } });
                } catch (error) {
                    applyThemeChoice({ choice: previous });
                    throw error;
                }
                markThemeSynced({ userId });
            }
        });

    const changeLanguage = async (value: LanguageWeb) => {
        try {
            await appearanceSave.run({
                save: () =>
                    patchSettings({ patch: { languageWeb: value }, local: { languageWeb: value } })
            });
        } catch {
            return;
        }
        // The web locale comes from the URL prefix, so persisting alone changes
        // nothing visible: swap the locale segment (same-origin path only).
        if (typeof window === 'undefined') return;
        const nextPath = buildLocaleSwitchPathname({
            pathname: window.location.pathname,
            locale: value
        });
        if (nextPath) window.location.pathname = nextPath;
    };

    const toggleNotification = ({
        key,
        next
    }: {
        readonly key: 'allowEmails' | 'allowPush' | 'allowSms';
        readonly next: boolean;
    }) =>
        notificationsSave.run({
            save: () => {
                const notifications = { ...settingsRef.current.notifications, [key]: next };
                return patchSettings({ patch: { notifications }, local: { notifications } });
            }
        });

    const toggleDigest = (next: boolean) =>
        notificationsSave.run({
            save: () =>
                patchSettings({
                    patch: { aiQuestionsDigest: next },
                    local: { aiQuestionsDigest: next }
                })
        });

    const toggleVipDigest = (next: boolean) =>
        notificationsSave.run({
            save: () =>
                patchSettings({
                    patch: { vipPromotionsDigest: next },
                    local: { vipPromotionsDigest: next }
                })
        });

    const chip = (save: ReturnType<typeof useAutoSave>) =>
        save.status ? (
            <AutoSaveChip
                status={save.status}
                savedAt={save.savedAt}
                onRetry={save.retry}
                locale={locale}
            />
        ) : undefined;

    return (
        <AsyncRegion
            state={state}
            loading={() => (
                <Skeleton
                    locale={locale}
                    shape="block"
                />
            )}
            error={({ retry }) => (
                <ErrorState
                    locale={locale}
                    onRetry={retry}
                />
            )}
            empty={() => null}
            locked={() => null}
            ready={(settings) => (
                <div className={styles.root}>
                    <Section
                        title={t('account.preferences.sections.appearance')}
                        helpId="section:preferences.appearance"
                        actions={chip(appearanceSave)}
                    >
                        <div className={styles.fields}>
                            <Field
                                label={t('account.preferences.theme.label')}
                                hint={t('account.preferences.theme.description')}
                                locale={locale}
                            >
                                <Select
                                    value={settings.themeWeb}
                                    onChange={(event) => {
                                        void changeTheme(event.target.value as ThemeWeb).catch(
                                            () => undefined
                                        );
                                    }}
                                >
                                    <option value="system">
                                        {t('account.preferences.theme.system')}
                                    </option>
                                    <option value="light">
                                        {t('account.preferences.theme.light')}
                                    </option>
                                    <option value="dark">
                                        {t('account.preferences.theme.dark')}
                                    </option>
                                </Select>
                            </Field>
                            <Field
                                label={t('account.preferences.language.label')}
                                hint={t('account.preferences.language.description')}
                                locale={locale}
                            >
                                <Select
                                    value={settings.languageWeb}
                                    onChange={(event) => {
                                        void changeLanguage(event.target.value as LanguageWeb);
                                    }}
                                >
                                    <option value="es">Español</option>
                                    <option value="en">English</option>
                                    <option value="pt">Português</option>
                                </Select>
                            </Field>
                        </div>
                    </Section>

                    <Section
                        title={t('account.preferences.sections.notifications')}
                        helpId="section:preferences.notifications"
                        actions={chip(notificationsSave)}
                    >
                        <SwitchRow
                            label={t('account.preferences.notifications.email.label')}
                            description={t('account.preferences.notifications.email.description')}
                            locale={locale}
                            checked={settings.notifications.allowEmails}
                            onChange={(next) => toggleNotification({ key: 'allowEmails', next })}
                        />
                        <SwitchRow
                            label={t('account.preferences.notifications.push.label')}
                            description={t('account.preferences.notifications.push.description')}
                            locale={locale}
                            checked={settings.notifications.allowPush}
                            onChange={(next) => toggleNotification({ key: 'allowPush', next })}
                        />
                        <SwitchRow
                            label={t('account.preferences.notifications.sms.label')}
                            description={t('account.preferences.notifications.sms.description')}
                            locale={locale}
                            checked={settings.notifications.allowSms}
                            onChange={(next) => toggleNotification({ key: 'allowSms', next })}
                        />
                        {showAiQuestionsDigest ? (
                            <SwitchRow
                                label={t('account.preferences.aiQuestionsDigest.label')}
                                description={t('account.preferences.aiQuestionsDigest.description')}
                                locale={locale}
                                checked={settings.aiQuestionsDigest}
                                onChange={toggleDigest}
                            />
                        ) : null}
                        {isVipTourist ? (
                            <SwitchRow
                                label={t('account.preferences.vipPromotionsDigest.label')}
                                description={t(
                                    'account.preferences.vipPromotionsDigest.description'
                                )}
                                locale={locale}
                                checked={settings.vipPromotionsDigest}
                                onChange={toggleVipDigest}
                            />
                        ) : null}
                    </Section>

                    <PreferencesNewsletterSection
                        locale={locale}
                        apiUrl={apiUrl}
                    />

                    <PreferencesHistorySection
                        locale={locale}
                        apiUrl={apiUrl}
                        enabled={settings.searchHistoryEnabled}
                        gatePlanNames={historyGatePlanNames}
                        plansHref={plansHref}
                    />
                </div>
            )}
        />
    );
}
