/**
 * @file use-photo-allowance.ts
 * @description The photo editor's cap state (HOS-2495), split out of
 * `use-photo-section.ts` to keep it under the repo's 500-line ceiling.
 *
 * Reads the listing's `photo-allowance` (the cap step 7 enforces) on mount and
 * whenever the caller says `used` changed, and derives everything the editor
 * gates on from it: the cap view, whether uploads are open, the over-cap tiles
 * and the cap-reached upsell.
 */

import type { ListingPhotoAllowance } from '@repo/schemas';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ListingPhotoApi } from '@/lib/api/listing-photo-api';
import type { AccommodationMediaItem } from '@/lib/api/types';
import { withLimitAddonOffer } from '@/lib/billing/limit-addon-offer';
import type { LimitReachedToastPayload } from '@/lib/billing-limit-error';
import type { SupportedLocale } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import {
    type GalleryCapView,
    galleryCapOf,
    isGalleryUploadOpen as isGalleryUploadOpenFor,
    resolveGalleryCapView,
    resolveOverCapIds
} from './photo-cap-view';
import { buildCapUpsell } from './photo-section-model';

/** What {@link usePhotoAllowance} returns. */
export interface UsePhotoAllowanceResult {
    readonly allowance: ListingPhotoAllowance | null;
    readonly capView: GalleryCapView;
    /** Finite cap, or the never-full placeholder when there is none. */
    readonly galleryCap: number;
    readonly isGalleryFull: boolean;
    readonly isGalleryUploadOpen: boolean;
    readonly isCoverUploadOpen: boolean;
    readonly overCapIds: ReadonlySet<string>;
    readonly capUpsell: LimitReachedToastPayload | null;
    /** Re-read the allowance; a failed read moves to the neutral `failed` state. */
    readonly refreshAllowance: () => Promise<void>;
}

/**
 * The listing's photo allowance and everything derived from it.
 *
 * @param params.api - The vertical's photo API.
 * @param params.listingId - The listing being edited.
 * @param params.galleryItems - The gallery in display order (the cover excluded).
 * @param params.locale - Active locale (for the upsell copy).
 * @returns See {@link UsePhotoAllowanceResult}.
 */
export function usePhotoAllowance({
    api,
    listingId,
    galleryItems,
    locale
}: {
    readonly api: ListingPhotoApi;
    readonly listingId: string;
    readonly galleryItems: readonly AccommodationMediaItem[];
    readonly locale: SupportedLocale;
}): UsePhotoAllowanceResult {
    const [allowance, setAllowance] = useState<ListingPhotoAllowance | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const refreshAllowance = useCallback(async () => {
        try {
            const result = await api.getAllowance({ id: listingId });
            if (result.ok) {
                setAllowance(result.data);
                setFailed(false);
            } else {
                webLogger.warn('[PhotoSection] getAllowance failed:', result.error);
                setFailed(true);
            }
        } catch (err) {
            webLogger.warn('[PhotoSection] getAllowance error:', err);
            setFailed(true);
        } finally {
            setIsLoading(false);
        }
    }, [api, listingId]);

    useEffect(() => {
        void refreshAllowance();
    }, [refreshAllowance]);

    const capView = useMemo(
        () => resolveGalleryCapView({ allowance, isLoading, failed }),
        [allowance, isLoading, failed]
    );
    const galleryCap = galleryCapOf(capView);
    const isGalleryFull = capView.kind === 'limited' && galleryItems.length >= galleryCap;
    const isGalleryUploadOpen = isGalleryUploadOpenFor(capView);
    const overCapIds = useMemo(
        () => resolveOverCapIds({ items: galleryItems, view: capView }),
        [galleryItems, capView]
    );

    // HOS-1024: see `buildCapUpsell` for why this reuses the limit-toast copy.
    const planCapUpsell = buildCapUpsell({
        isGalleryFull,
        limitKey: allowance?.limitKey ?? '',
        count: galleryItems.length,
        cap: galleryCap,
        locale
    });

    // HOS-2677: when the catalog sells an add-on for this photo cap, it leads the upsell and
    // the plan change follows. Keyed by the limit key it was read for, so a stale answer from
    // another vertical or locale is never shown.
    const [addonUpsell, setAddonUpsell] = useState<{
        readonly key: string;
        readonly payload: LimitReachedToastPayload;
    } | null>(null);
    const limitKey = allowance?.limitKey ?? '';
    const upsellKey = `${limitKey}|${locale}`;
    const hasPlanUpsell = planCapUpsell !== null;
    useEffect(() => {
        if (!hasPlanUpsell || limitKey === '') return;
        let alive = true;
        const plan = buildCapUpsell({
            isGalleryFull: true,
            limitKey,
            count: 0,
            cap: 0,
            locale
        });
        if (!plan) return;
        void withLimitAddonOffer({ payload: plan, details: { limitKey }, locale }).then(
            (payload) => {
                if (alive && payload.secondaryAction) {
                    setAddonUpsell({ key: upsellKey, payload });
                }
            }
        );
        return () => {
            alive = false;
        };
    }, [hasPlanUpsell, limitKey, locale, upsellKey]);
    const capUpsell =
        planCapUpsell && addonUpsell?.key === upsellKey
            ? {
                  ...planCapUpsell,
                  action: addonUpsell.payload.action,
                  secondaryAction: addonUpsell.payload.secondaryAction
              }
            : planCapUpsell;

    return {
        allowance,
        capView,
        galleryCap,
        isGalleryFull,
        isGalleryUploadOpen,
        isCoverUploadOpen: isGalleryUploadOpen && allowance?.coverAllowed === true,
        overCapIds,
        capUpsell,
        refreshAllowance
    };
}
