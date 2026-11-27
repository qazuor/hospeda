/**
 * @file ListingTranslationsSection.client.tsx
 * @description The one translations section of the accommodation, venue and
 * experience editors (HOS-2658 §6, §10).
 *
 * The state of every `(field, locale)` pair is computed by the API and fetched
 * on mount, client-side, so no `src/pages` frontmatter reads the session. Each
 * write (manual `PUT`, AI `POST`) answers the whole state, which replaces the
 * section's. The section never reloads on its own: after a Spanish save in
 * another section the AI run is asynchronous, and an "Actualizar" button is
 * offered while any pair is pending (no polling).
 */
import type {
    ListingTranslationField,
    ListingTranslationsResponse,
    ListingTranslationVertical
} from '@repo/schemas';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TranslationEditor } from '@/components/account/editor/TranslationEditor';
import { Alert, Button, Skeleton } from '@/components/account/ui';
import {
    type ListingTranslationTargetLocale,
    listingTranslationsApi
} from '@/lib/api/endpoints-protected-translations';
import type { ApiError } from '@/lib/api/types';
import { translateApiError } from '@/lib/api-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import {
    ListingTranslationPairRow,
    type ListingTranslationRowBusy,
    ListingTranslationSourceRow
} from './ListingTranslationRow.client';
import styles from './ListingTranslationsSection.module.css';
import { needsReview } from './listing-translations-section.helpers';

/** Props of {@link ListingTranslationsSection}. */
export interface ListingTranslationsSectionProps {
    readonly locale: SupportedLocale;
    readonly vertical: ListingTranslationVertical;
    readonly listingId: string;
    /** Resolved name of the editor section that holds each field's Spanish source. */
    readonly sourceSectionLabels: Readonly<Partial<Record<ListingTranslationField, string>>>;
}

type PairKey = `${string}:${ListingTranslationTargetLocale}`;

type LoadState =
    | { readonly status: 'loading' }
    | { readonly status: 'error'; readonly message: string }
    | { readonly status: 'ready'; readonly data: ListingTranslationsResponse };

const KEY = 'account.editorTranslations';
const TARGET_LOCALES: readonly ListingTranslationTargetLocale[] = ['en', 'pt'];

function pairKey(field: string, locale: ListingTranslationTargetLocale): PairKey {
    return `${field}:${locale}`;
}

function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
    const { [key]: _removed, ...rest } = record;
    return rest;
}

/** Owner translations editor for one listing. */
export function ListingTranslationsSection({
    locale,
    vertical,
    listingId,
    sourceSectionLabels
}: ListingTranslationsSectionProps) {
    // Stable per locale: `reload` depends on it, and a fresh `t` every render
    // would re-run the mount effect forever.
    const t = useMemo(() => createT(locale), [locale]);
    const [load, setLoad] = useState<LoadState>({ status: 'loading' });
    const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
    const [busy, setBusy] = useState<Readonly<Record<string, ListingTranslationRowBusy>>>({});
    const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

    const errorMessage = useCallback(
        (error: ApiError, fallback?: string) => translateApiError({ error, locale, fallback }),
        [locale]
    );

    const reload = useCallback(async () => {
        setLoad((current) => (current.status === 'ready' ? current : { status: 'loading' }));
        const result = await listingTranslationsApi.get({ vertical, id: listingId });
        if (result.ok) {
            setLoad({ status: 'ready', data: result.data });
            return;
        }
        setLoad({
            status: 'error',
            message: errorMessage(result.error, t(`${KEY}.toast.loadFailed`))
        });
    }, [errorMessage, listingId, t, vertical]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const setPairBusy = (key: PairKey, value: ListingTranslationRowBusy) =>
        setBusy((current) =>
            value === null ? without(current, key) : { ...current, [key]: value }
        );

    /**
     * A save's validation error goes under its control; anything else is a toast.
     * A 403 means a gate moved under the owner: say why and re-read the pills.
     */
    const handleFailure = ({
        error,
        key,
        inlineValidation,
        fallback
    }: {
        readonly error: ApiError;
        readonly key: PairKey;
        readonly inlineValidation: boolean;
        readonly fallback?: string;
    }) => {
        if (inlineValidation && error.status === 400) {
            setErrors((current) => ({ ...current, [key]: errorMessage(error) }));
            return;
        }
        addToast({ type: 'error', message: errorMessage(error, fallback) });
        if (error.status === 403) void reload();
    };

    const handleSave = async (field: string, target: ListingTranslationTargetLocale) => {
        if (load.status !== 'ready') return;
        const key = pairKey(field, target);
        const entry = load.data.fields.find((item) => item.field === field);
        if (!entry || busy[key]) return;
        const value = drafts[key] ?? entry.locales[target].value;
        setPairBusy(key, 'save');
        setErrors((current) => without(current, key));
        const result = await listingTranslationsApi.saveManual({
            vertical,
            id: listingId,
            field,
            locale: target,
            value
        });
        setPairBusy(key, null);
        if (!result.ok) {
            handleFailure({ error: result.error, key, inlineValidation: true });
            return;
        }
        setDrafts((current) => without(current, key));
        setLoad({ status: 'ready', data: result.data });
        addToast({ type: 'success', message: t(`${KEY}.toast.saved`) });
    };

    const handleTranslate = async (field: string, target: ListingTranslationTargetLocale) => {
        const key = pairKey(field, target);
        if (busy[key]) return;
        setPairBusy(key, 'ai');
        setErrors((current) => without(current, key));
        const result = await listingTranslationsApi.translateWithAi({
            vertical,
            id: listingId,
            field,
            locales: [target]
        });
        setPairBusy(key, null);
        if (!result.ok) {
            // PROVIDER_ERROR's generic copy speaks of payments; the AI copy is the
            // fallback, still resolved by the shared translator.
            const { code, ...withoutCode } = result.error;
            handleFailure({
                error: code === 'PROVIDER_ERROR' ? withoutCode : result.error,
                key,
                inlineValidation: false,
                fallback: t(`${KEY}.toast.aiFailed`)
            });
            return;
        }
        setDrafts((current) => without(current, key));
        setLoad({ status: 'ready', data: result.data });
        addToast({ type: 'success', message: t(`${KEY}.toast.aiDone`) });
    };

    const description = t(`${KEY}.description`);
    const ariaLabel = t(`${KEY}.title`);

    if (load.status !== 'ready') {
        const isLoading = load.status === 'loading';
        return (
            <TranslationEditor
                locale={locale}
                vertical={vertical}
                description={description}
                ariaLabel={ariaLabel}
                defaultLocale="en"
                isBusy={isLoading}
                tabs={
                    isLoading
                        ? (['es', 'en', 'pt'] as const).map((tab) => ({
                              locale: tab,
                              count: 0,
                              countLabel: '',
                              content: (
                                  <li>
                                      <Skeleton
                                          locale={locale}
                                          lines={3}
                                      />
                                  </li>
                              )
                          }))
                        : []
                }
            >
                {load.status === 'error' && (
                    <Alert
                        tone="danger"
                        locale={locale}
                        title={t(`${KEY}.toast.loadFailed`)}
                        action={
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => void reload()}
                            >
                                {t(`${KEY}.action.retry`)}
                            </Button>
                        }
                    >
                        {load.message}
                    </Alert>
                )}
            </TranslationEditor>
        );
    }

    const { data } = load;
    const anyPending = data.fields.some((entry) =>
        TARGET_LOCALES.some((target) => entry.locales[target].state === 'pending')
    );
    const reviewCount = (target: ListingTranslationTargetLocale) =>
        data.fields.filter(
            (entry) => needsReview({ state: entry.locales[target].state }).needsReview
        ).length;

    const tabs = [
        {
            locale: 'es' as const,
            count: 0,
            countLabel: '',
            content: data.fields.map((entry) => (
                <ListingTranslationSourceRow
                    key={entry.field}
                    locale={locale}
                    entry={entry}
                    sectionLabel={sourceSectionLabels[entry.field]}
                />
            ))
        },
        ...TARGET_LOCALES.map((target) => {
            const count = reviewCount(target);
            return {
                locale: target,
                count,
                countLabel: t(`${KEY}.reviewCount`, undefined, { count }),
                content: data.fields.map((entry) => {
                    const key = pairKey(entry.field, target);
                    return (
                        <ListingTranslationPairRow
                            key={entry.field}
                            locale={locale}
                            entry={entry}
                            targetLocale={target}
                            aiStatus={data.ai.status}
                            draft={drafts[key]}
                            busy={busy[key] ?? null}
                            error={errors[key]}
                            onDraftChange={(value) =>
                                setDrafts((current) => ({ ...current, [key]: value }))
                            }
                            onSave={() => void handleSave(entry.field, target)}
                            onTranslate={() => void handleTranslate(entry.field, target)}
                        />
                    );
                })
            };
        })
    ];

    return (
        <TranslationEditor
            locale={locale}
            vertical={vertical}
            description={description}
            ariaLabel={ariaLabel}
            defaultLocale="en"
            isBusy={Object.keys(busy).length > 0}
            tabs={tabs}
        >
            {anyPending && (
                <div className={styles.refresh}>
                    <p className={styles.hint}>{t(`${KEY}.pendingHint`)}</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void reload()}
                    >
                        {t(`${KEY}.action.refresh`)}
                    </Button>
                </div>
            )}
        </TranslationEditor>
    );
}
