/**
 * @file ExternalReputationSection.client.tsx
 * @description Owner-facing section of the accommodation editor for managing
 * external platform listings and refreshing the reputation (SPEC-237 T-013,
 * SPEC-250 Phase 7, rebuilt on the Mi Cuenta kit by HOS-2515).
 *
 * Composition (every piece lives in `./external-reputation/`):
 *  - `useExternalListings`: load, master toggle, per-row flags, removal.
 *  - `useAddListing` + `AddListingForm`: the «add a platform» form.
 *  - `useReputationRefresh` + `RefreshPanel`: refresh and status polling.
 *  - `ListingsList`: the connected sources.
 *
 * Save model: `auto` (see `accommodation-editor-sections.ts`). Every persisting
 * action reports through `runEditorAutoSave`; the editor shell already mounts
 * the one chip near the page title, so this section renders none.
 *
 * Removing a platform asks for confirmation through the kit `useConfirm`
 * (HOS-794): a single click on a bare button used to wipe the row.
 */

import { useCallback, useMemo } from 'react';
import { Alert } from '@/components/account/ui/Alert';
import { Section } from '@/components/account/ui/Section';
import { SwitchRow } from '@/components/account/ui/Switch';
import { useConfirm } from '@/components/account/ui/use-confirm';
import { Spinner } from '@/components/shared/feedback/Spinner';
import { sectionHelpAnchor } from '@/lib/help/help-entry';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { AddListingForm } from './external-reputation/AddListingForm';
import styles from './external-reputation/ExternalReputation.module.css';
import type { ExternalListingRow } from './external-reputation/external-reputation-types';
import { ListingsList, platformLabel } from './external-reputation/ListingsList';
import { RefreshPanel } from './external-reputation/RefreshPanel';
import { useAddListing } from './external-reputation/use-add-listing';
import { useExternalListings } from './external-reputation/use-external-listings';
import { useReputationRefresh } from './external-reputation/use-reputation-refresh';

export type {
    ExternalListingRow,
    ReputationMeta
} from './external-reputation/external-reputation-types';

/** The editor shell renders the same anchor in its help link. */
const HELP_ANCHOR = sectionHelpAnchor({
    vertical: 'accommodation',
    slug: 'reputacion'
}) as `section:${string}.${string}`;

/** Props for ExternalReputationSection. */
export interface ExternalReputationSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
}

/**
 * Owner-facing external reputation management section.
 *
 * Self-contained: fetches its own data on mount and persists every change on
 * its own, with `credentials: 'include'`.
 *
 * @param props - See {@link ExternalReputationSectionProps}.
 * @returns The kit `Section`.
 */
export function ExternalReputationSection({
    locale,
    accommodationId
}: ExternalReputationSectionProps) {
    // Memoized so `t` keeps a stable reference: a new `t` every render would
    // re-trigger the mount load in an infinite loop (fetch -> setState ->
    // render -> new `t` -> fetch ...).
    const { t, tPlural } = useMemo(() => createTranslations(locale), [locale]);

    const data = useExternalListings({ accommodationId, t });
    const addForm = useAddListing({
        accommodationId,
        listings: data.listings,
        reload: data.reload,
        t
    });
    const refresh = useReputationRefresh({ accommodationId, reload: data.reload, t });
    const { confirm: askConfirm, confirmDialog } = useConfirm({ locale });

    const requestRemove = useCallback(
        (listing: ExternalListingRow) => {
            // Not awaited: the promise stays pending after a failed delete (the
            // dialog stays open for a retry) and nothing waits on the answer.
            void askConfirm({
                title: t('external-reputation.ownerConfig.removeDialogTitle'),
                description: (
                    <>
                        {t('external-reputation.ownerConfig.removeConfirm')}{' '}
                        <strong>{platformLabel({ t, platform: listing.platform })}</strong>
                    </>
                ),
                confirmLabel: t('external-reputation.ownerConfig.removeConfirmButton'),
                onConfirm: () => data.removeListing(listing)
            });
        },
        [askConfirm, data.removeListing, t]
    );

    // Nothing to refresh until a platform link exists. Only once the listings
    // loaded: while loading, or after a failed load, the list is empty without
    // that meaning "no platforms" (HOS-1944).
    const hasNoPlatforms = !data.isLoading && !data.loadError && data.listings.length === 0;

    return (
        <Section
            title={t('external-reputation.ownerConfig.title')}
            description={t('external-reputation.ownerConfig.googleOnlyExplainer')}
            helpId={HELP_ANCHOR}
        >
            <div className={styles.stack}>
                {data.showAutoEnabledNotice && (
                    <Alert
                        tone="info"
                        locale={locale}
                    >
                        {t('external-reputation.ownerConfig.autoEnabledNotice')}
                    </Alert>
                )}

                <SwitchRow
                    locale={locale}
                    label={t('external-reputation.ownerConfig.masterToggle')}
                    checked={data.masterToggle}
                    disabled={data.isLoading}
                    onChange={data.changeMasterToggle}
                />

                {data.masterToggleError && (
                    <Alert
                        tone="danger"
                        locale={locale}
                    >
                        {data.masterToggleError}
                    </Alert>
                )}

                {data.loadError && (
                    <Alert
                        tone="danger"
                        locale={locale}
                    >
                        {data.loadError}
                    </Alert>
                )}

                {data.isLoading && !data.loadError && (
                    <Spinner
                        size="sm"
                        label={t('external-reputation.ownerConfig.loading')}
                    />
                )}

                {!data.isLoading && data.listings.length === 0 && !data.loadError && (
                    <p
                        className={styles.mutedText}
                        data-testid="ext-rep-empty"
                    >
                        {t('external-reputation.aggregate.noData')}
                    </p>
                )}

                {data.listings.length > 0 && (
                    <ListingsList
                        locale={locale}
                        t={t}
                        listings={data.listings}
                        statuses={refresh.statusPlatforms}
                        onFlagChange={data.changeListingFlag}
                        onRemove={requestRemove}
                    />
                )}

                <AddListingForm
                    locale={locale}
                    t={t}
                    form={addForm}
                />

                {refresh.statusError && (
                    <Alert
                        tone="danger"
                        locale={locale}
                    >
                        {t('external-reputation.errors.statusFailed')}
                    </Alert>
                )}

                <RefreshPanel
                    locale={locale}
                    t={t}
                    tPlural={tPlural}
                    refresh={refresh}
                    aggregateFetchedAt={data.aggregateFetchedAt}
                    hasNoPlatforms={hasNoPlatforms}
                />

                {data.removeError && (
                    <Alert
                        tone="danger"
                        locale={locale}
                    >
                        {data.removeError}
                    </Alert>
                )}
            </div>
            {confirmDialog}
        </Section>
    );
}
