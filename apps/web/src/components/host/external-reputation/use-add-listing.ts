/**
 * @file use-add-listing.ts
 * @description Form state and submit handler of the «add platform» form
 * (HOS-2515). The submit is a persisting action, so it is reported through
 * `runEditorAutoSave`; a client-side validation failure never reaches it
 * because nothing was saved.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runEditorAutoSave } from '@/components/account/editor-shell/editor-auto-save-signal';
import type { TranslationFn } from '@/lib/i18n';
import { createExternalListing, isValidListingUrl } from './external-reputation-api';
import {
    type ExternalListingRow,
    type ExternalPlatform,
    PLATFORMS
} from './external-reputation-types';

/** Return shape of {@link useAddListing}. */
export interface UseAddListingResult {
    readonly platform: ExternalPlatform;
    readonly url: string;
    readonly showLink: boolean;
    readonly showReviews: boolean;
    /** Platforms with no live listing yet. */
    readonly availablePlatforms: readonly ExternalPlatform[];
    readonly isAdding: boolean;
    readonly formError: string | null;
    readonly urlError: string | null;
    readonly setPlatform: (platform: ExternalPlatform) => void;
    readonly setUrl: (url: string) => void;
    readonly setShowLink: (value: boolean) => void;
    readonly setShowReviews: (value: boolean) => void;
    /** Validates, saves and reloads the listings. */
    readonly submit: () => Promise<void>;
}

/**
 * State of the add form.
 *
 * @param params - The accommodation id, the loaded `listings`, a `reload`
 * callback and a STABLE `t`.
 * @returns The form state and its submit.
 */
export function useAddListing({
    accommodationId,
    listings,
    reload,
    t
}: {
    readonly accommodationId: string;
    readonly listings: readonly ExternalListingRow[];
    readonly reload: () => Promise<void>;
    readonly t: TranslationFn;
}): UseAddListingResult {
    const [platform, setPlatform] = useState<ExternalPlatform>('GOOGLE');
    const [url, setUrlState] = useState('');
    const [showLink, setShowLink] = useState(false);
    const [showReviews, setShowReviews] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [urlError, setUrlError] = useState<string | null>(null);

    /**
     * Platforms with no listing yet (HOS-190): the select used to offer all
     * four, so a taken platform was only discovered as a duplicate 400.
     * Soft-deleted rows do not occupy a platform.
     */
    const availablePlatforms = useMemo<readonly ExternalPlatform[]>(() => {
        const taken = new Set<string>(
            listings.filter((row) => row.deletedAt == null).map((row) => row.platform)
        );
        return PLATFORMS.filter((candidate) => !taken.has(candidate));
    }, [listings]);

    // Keep the selection valid as the available set changes. Guarded so it
    // converges after a single render instead of looping.
    useEffect(() => {
        const [first] = availablePlatforms;
        if (first !== undefined && !availablePlatforms.includes(platform)) setPlatform(first);
    }, [availablePlatforms, platform]);

    const setUrl = useCallback(
        (next: string) => {
            setUrlState(next);
            if (urlError) setUrlError(null);
        },
        [urlError]
    );

    const submitRef = useRef<() => Promise<void>>(async () => undefined);

    const submit = useCallback(async () => {
        const trimmed = url.trim();
        if (!trimmed) return;
        if (!isValidListingUrl({ url: trimmed })) {
            setFormError(null);
            setUrlError(t('external-reputation.errors.invalidUrl'));
            return;
        }
        setUrlError(null);
        setFormError(null);
        setIsAdding(true);
        const failure: { message: string | null } = { message: null };
        const ok = await runEditorAutoSave({
            save: async () => {
                const result = await createExternalListing({
                    accommodationId,
                    platform,
                    url: trimmed,
                    showLink,
                    showReviews
                });
                if (result.ok) return true;
                // `message` of a 500 is raw driver text and is never returned by
                // the api layer; only server-authored user-facing text gets here.
                failure.message =
                    result.kind === 'duplicate'
                        ? t('external-reputation.errors.duplicatePlatform', undefined, {
                              platform: t(`external-reputation.platform.${platform.toLowerCase()}`)
                          })
                        : (result.message ?? t('external-reputation.errors.addFailed'));
                return false;
            },
            retry: () => void submitRef.current()
        });
        setIsAdding(false);
        if (!ok) {
            setFormError(failure.message ?? t('external-reputation.errors.addFailed'));
            return;
        }
        setUrlState('');
        setShowLink(false);
        setShowReviews(false);
        await reload();
    }, [accommodationId, platform, url, showLink, showReviews, reload, t]);

    submitRef.current = submit;

    return {
        platform,
        url,
        showLink,
        showReviews,
        availablePlatforms,
        isAdding,
        formError,
        urlError,
        setPlatform,
        setUrl,
        setShowLink,
        setShowReviews,
        submit
    };
}
