/**
 * @file use-external-listings.ts
 * @description Data hook of the external reputation section: loads the
 * listings and metadata, and owns the persisting actions on them (master
 * toggle, per-row flags, removal). HOS-2515.
 *
 * Every persisting action goes through `runEditorAutoSave` so the editor's
 * single chip reports it. The switch rows and the confirm dialog REVERT or stay
 * open when an action throws, so the handlers throw on failure after reporting.
 */

import { useCallback, useEffect, useState } from 'react';
import { runEditorAutoSave } from '@/components/account/editor-shell/editor-auto-save-signal';
import type { TranslationFn } from '@/lib/i18n';
import {
    deleteExternalListing,
    loadExternalListings,
    saveListingToggle,
    saveMasterToggle
} from './external-reputation-api';
import type {
    ExternalListingRow,
    ListingToggleField,
    ReputationMeta
} from './external-reputation-types';

/** Return shape of {@link useExternalListings}. */
export interface UseExternalListingsResult {
    readonly listings: readonly ExternalListingRow[];
    readonly masterToggle: boolean;
    readonly aggregateFetchedAt: ReputationMeta['aggregateFetchedAt'];
    /** True when the automation enabled the section and the owner has not decided since. */
    readonly showAutoEnabledNotice: boolean;
    readonly isLoading: boolean;
    readonly loadError: string | null;
    readonly masterToggleError: string | null;
    readonly removeError: string | null;
    /** Re-fetches the listings and metadata. */
    readonly reload: () => Promise<void>;
    /** Saves the master toggle; throws on failure so the switch reverts. */
    readonly changeMasterToggle: (next: boolean) => Promise<void>;
    /** Saves one flag of one listing; throws on failure so the switch reverts. */
    readonly changeListingFlag: (input: {
        readonly listingId: string;
        readonly field: ListingToggleField;
        readonly next: boolean;
    }) => Promise<void>;
    /** Deletes one listing; throws on failure so the dialog stays open. */
    readonly removeListing: (listing: ExternalListingRow) => Promise<void>;
}

/**
 * Loads and mutates the external listings of one accommodation.
 *
 * @param params - The accommodation id and a STABLE `t` (memoize it: an
 * unstable `t` re-triggers the mount load in an infinite loop).
 * @returns The state and the actions.
 */
export function useExternalListings({
    accommodationId,
    t
}: {
    readonly accommodationId: string;
    readonly t: TranslationFn;
}): UseExternalListingsResult {
    const [listings, setListings] = useState<readonly ExternalListingRow[]>([]);
    const [masterToggle, setMasterToggle] = useState(false);
    const [aggregateFetchedAt, setAggregateFetchedAt] =
        useState<ReputationMeta['aggregateFetchedAt']>(null);
    const [autoEnabledAt, setAutoEnabledAt] = useState<ReputationMeta['autoEnabledAt']>(null);
    const [toggleDecidedAt, setToggleDecidedAt] = useState<ReputationMeta['toggleDecidedAt']>(null);
    /** True once the owner flips the toggle in THIS session: hides the notice at once. */
    const [hasManuallyToggled, setHasManuallyToggled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [masterToggleError, setMasterToggleError] = useState<string | null>(null);
    const [removeError, setRemoveError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        const result = await loadExternalListings({ accommodationId });
        if (result.ok) {
            const { listings: rows, reputation } = result.data;
            setListings(rows);
            setMasterToggle(reputation.showExternalReputation);
            setAggregateFetchedAt(reputation.aggregateFetchedAt);
            setAutoEnabledAt(reputation.autoEnabledAt ?? null);
            setToggleDecidedAt(reputation.toggleDecidedAt ?? null);
        } else {
            setLoadError(t('external-reputation.errors.fetchFailed'));
        }
        setIsLoading(false);
    }, [accommodationId, t]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const changeMasterToggle = useCallback(
        async (next: boolean) => {
            const ok = await runEditorAutoSave({
                save: () => saveMasterToggle({ accommodationId, value: next }),
                retry: () => void changeMasterToggle(next).catch(() => undefined)
            });
            if (!ok) {
                // Never fail silently: a 400 on EVERY toggle went unnoticed all
                // the way to production once (HOS-290).
                setMasterToggleError(t('external-reputation.errors.masterToggleFailed'));
                throw new Error('master-toggle-failed');
            }
            setMasterToggle(next);
            setMasterToggleError(null);
            setHasManuallyToggled(true);
        },
        [accommodationId, t]
    );

    const changeListingFlag = useCallback(
        async ({
            listingId,
            field,
            next
        }: {
            readonly listingId: string;
            readonly field: ListingToggleField;
            readonly next: boolean;
        }) => {
            const ok = await runEditorAutoSave({
                save: () => saveListingToggle({ accommodationId, listingId, field, value: next }),
                retry: () =>
                    void changeListingFlag({ listingId, field, next }).catch(() => undefined)
            });
            if (!ok) throw new Error('listing-flag-failed');
            setListings((prev) =>
                prev.map((row) => (row.id === listingId ? { ...row, [field]: next } : row))
            );
        },
        [accommodationId]
    );

    const removeListing = useCallback(
        async (listing: ExternalListingRow) => {
            setRemoveError(null);
            const ok = await runEditorAutoSave({
                // No chip retry: the confirm dialog stays open on a failure and
                // its own button retries, so a retry here would skip the confirmation.
                save: () => deleteExternalListing({ accommodationId, listingId: listing.id })
            });
            if (!ok) {
                setRemoveError(t('external-reputation.ownerConfig.removeError'));
                throw new Error('listing-remove-failed');
            }
            setListings((prev) => prev.filter((row) => row.id !== listing.id));
        },
        [accommodationId, t]
    );

    const showAutoEnabledNotice =
        masterToggle &&
        !hasManuallyToggled &&
        autoEnabledAt != null &&
        toggleDecidedAt != null &&
        autoEnabledAt.getTime() === toggleDecidedAt.getTime();

    return {
        listings,
        masterToggle,
        aggregateFetchedAt,
        showAutoEnabledNotice,
        isLoading,
        loadError,
        masterToggleError,
        removeError,
        reload,
        changeMasterToggle,
        changeListingFlag,
        removeListing
    };
}
