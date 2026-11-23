/**
 * @file PreferencesHistorySection.tsx
 * @description The search-history opt-out, in Preferences (HOS-2479, D11).
 * Saves through `PATCH /search-history/preferences`, the call the history page
 * used. The plan lock is read the way the history page reads it: the list
 * endpoint answers 403 `ENTITLEMENT_REQUIRED` for a plan without the feature.
 * Plan names arrive from the catalog (read on the server), never as literals.
 */

import { useCallback, useEffect, useState } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import {
    AsyncRegion,
    type AsyncResult,
    AutoSaveChip,
    ErrorState,
    LockedState,
    Section,
    Skeleton,
    SwitchRow
} from '../ui';
import { joinApi, readApiError, sendMutation } from './preferences-api';
import { useAutoSave } from './use-auto-save';

/** Props of {@link PreferencesHistorySection}. */
export interface PreferencesHistorySectionProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** API base URL. */
    readonly apiUrl: string;
    /** Saved value of `settings.searchHistoryEnabled` (absent means enabled). */
    readonly enabled: boolean;
    /** Names of the catalog plans that include search history. */
    readonly gatePlanNames: readonly string[];
    /** Where «Ver planes» goes. */
    readonly plansHref: string;
}

type HistoryAccess = { readonly allowed: boolean };

const LOCKED_ANCHOR = 'preferences-history-locked';

async function probeAccess({
    apiUrl,
    signal
}: {
    readonly apiUrl: string;
    readonly signal?: AbortSignal;
}): Promise<HistoryAccess> {
    const res = await fetch(joinApi({ apiUrl, path: '/api/v1/protected/search-history' }), {
        credentials: 'include',
        signal
    });
    if (res.ok) return { allowed: true };
    const error = await readApiError({ res });
    if (res.status === 403 && error?.code === 'ENTITLEMENT_REQUIRED') return { allowed: false };
    throw new Error(`status ${res.status}`);
}

/**
 * Search-history section of the Preferences page.
 *
 * @param props - See {@link PreferencesHistorySectionProps}.
 */
export function PreferencesHistorySection({
    locale,
    apiUrl,
    enabled,
    gatePlanNames,
    plansHref
}: PreferencesHistorySectionProps) {
    const t = createT(locale);
    const [state, setState] = useState<AsyncResult<HistoryAccess>>({ status: 'loading' });
    const [value, setValue] = useState(enabled);
    const autoSave = useAutoSave();

    const load = useCallback(
        async (signal?: AbortSignal) => {
            setState({ status: 'loading' });
            try {
                const access = await probeAccess({ apiUrl, signal });
                setState({ status: 'ready', data: access });
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

    const label = t('account.searchHistory.optOut.label');
    const description = t('account.searchHistory.optOut.description');
    const planLabel =
        gatePlanNames.length > 0
            ? new Intl.ListFormat(locale, { style: 'long', type: 'disjunction' }).format(
                  gatePlanNames
              )
            : t('account.preferences.searchHistory.planFallback');

    return (
        <Section
            title={t('account.preferences.sections.searchHistory')}
            helpId="section:preferences.history"
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
                ready={({ allowed }) =>
                    allowed ? (
                        <SwitchRow
                            label={label}
                            description={description}
                            locale={locale}
                            checked={value}
                            onChange={(next) =>
                                autoSave.run({
                                    save: async () => {
                                        await sendMutation({
                                            url: joinApi({
                                                apiUrl,
                                                path: '/api/v1/protected/search-history/preferences'
                                            }),
                                            method: 'PATCH',
                                            body: { enabled: next },
                                            locale,
                                            fallback: t('account.searchHistory.optOut.error')
                                        });
                                        setValue(next);
                                    }
                                })
                            }
                            helpId="section:preferences.history#opt-out"
                        />
                    ) : (
                        <>
                            <SwitchRow
                                label={label}
                                description={description}
                                locale={locale}
                                checked={false}
                                onChange={async () => undefined}
                                locked={{ planLabel, href: `#${LOCKED_ANCHOR}` }}
                            />
                            <div id={LOCKED_ANCHOR}>
                                <LockedState
                                    locale={locale}
                                    reason={{
                                        kind: 'plan',
                                        feature: label,
                                        description,
                                        plans: gatePlanNames.map((name) => ({ name })),
                                        plansHref
                                    }}
                                />
                            </div>
                        </>
                    )
                }
            />
        </Section>
    );
}
