/**
 * @file use-listing-edit-state.ts
 * @description Form state and change handlers of the listing owner editor
 * (moved out of `ListingEditor.client.tsx`, HOS-2415 AC-12). The island keeps
 * the save, the diff and the rendering; this hook owns what the fields write.
 */

import { useCallback, useState } from 'react';
import type { AmenityAttributeValue } from '@/lib/api/types';
import { setListingPolicy } from '@/lib/listing/listing-policies';
import type { ListingI18nValues } from '../ListingTranslationPanel.client';
import type { ContactValues, ListingEditData, SocialValues } from './listing-edit-data';
import type { ListingPolicyChange } from './PoliciesPanel.client';

/** The save lifecycle the island shows (`aria-busy`) and resets on every edit. */
export type ListingSaveStatus =
    | { readonly kind: 'idle' }
    | { readonly kind: 'saving' }
    | { readonly kind: 'success' }
    | { readonly kind: 'error' };

/**
 * Form state, persisted baseline and every field handler of the listing editor.
 *
 * @param params - `buildInitialEditData` seeds both the form and the baseline.
 * @returns The state, its setters and the handlers the section renderers take.
 */
export function useListingEditState({
    buildInitialEditData
}: {
    readonly buildInitialEditData: () => ListingEditData;
}) {
    const [formData, setFormData] = useState<ListingEditData>(buildInitialEditData);
    // The PATCH diff is computed against this MUTABLE baseline, resynced to the
    // persisted values after every successful save — mirroring the accommodation
    // editor (HOS-190 F6). Diffing against the load-time `initialData` prop
    // instead would make reverting a just-saved field produce an empty diff
    // while the DB still held the new value, leaving the owner unable to undo
    // the change without a full page reload.
    const [baseline, setBaseline] = useState<ListingEditData>(buildInitialEditData);

    const [status, setStatus] = useState<ListingSaveStatus>({ kind: 'idle' });

    /**
     * Generic single-field change, shared by every scalar input in the form —
     * the venue/experience counterpart of the accommodation editor's
     * `handleTextFieldChange`. Resets any stale save status, exactly as the
     * former `markDirty` did.
     */
    const onFieldChange = useCallback(
        <K extends keyof ListingEditData>(field: K, value: ListingEditData[K]) => {
            setFormData((prev) => ({ ...prev, [field]: value }));
            setStatus({ kind: 'idle' });
        },
        []
    );

    const updateContact = useCallback((patch: Partial<ContactValues>) => {
        setFormData((prev) => ({ ...prev, contact: { ...prev.contact, ...patch } }));
        setStatus({ kind: 'idle' });
    }, []);

    const updateSocial = useCallback((key: keyof SocialValues, val: string) => {
        setFormData((prev) => ({ ...prev, social: { ...prev.social, [key]: val } }));
        setStatus({ kind: 'idle' });
    }, []);

    /** Sets or removes (`undefined`) one house-rule key (HOS-2060). */
    const onPolicyChange: ListingPolicyChange = useCallback((key, value) => {
        setFormData((prev) => ({
            ...prev,
            policies: setListingPolicy({ policies: prev.policies, key, value })
        }));
        setStatus({ kind: 'idle' });
    }, []);

    const toggleAmenity = useCallback((id: string) => {
        setFormData((prev) => {
            const next = new Set(prev.amenityIds);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return { ...prev, amenityIds: next };
        });
        setStatus({ kind: 'idle' });
    }, []);

    /** Sets one declared attribute of a checked amenity (HOS-2061). */
    const changeAmenityAttribute = useCallback(
        <K extends keyof AmenityAttributeValue>(
            amenityId: string,
            field: K,
            value: AmenityAttributeValue[K]
        ) => {
            setFormData((prev) => ({
                ...prev,
                amenityAttributes: {
                    ...prev.amenityAttributes,
                    [amenityId]: {
                        ...(prev.amenityAttributes[amenityId] ?? {
                            scope: null,
                            availability: null
                        }),
                        [field]: value
                    }
                }
            }));
            setStatus({ kind: 'idle' });
        },
        []
    );

    const toggleFeature = useCallback((id: string) => {
        setFormData((prev) => {
            const next = new Set(prev.featureIds);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return { ...prev, featureIds: next };
        });
        setStatus({ kind: 'idle' });
    }, []);

    /**
     * Handle i18n panel changes. The callback always carries the FULL
     * `ListingI18nValues` shape (that is the panel's state), but the PATCH
     * diff (`buildPatchPayload`) still compares and sends each of the four
     * fields independently — see its JSDoc (HOS-902).
     */
    const handleI18nChange = useCallback((updated: ListingI18nValues) => {
        setFormData((prev) => ({ ...prev, i18nValues: updated }));
        setStatus({ kind: 'idle' });
    }, []);

    return {
        formData,
        setFormData,
        baseline,
        setBaseline,
        status,
        setStatus,
        onFieldChange,
        updateContact,
        updateSocial,
        onPolicyChange,
        toggleAmenity,
        changeAmenityAttribute,
        toggleFeature,
        handleI18nChange
    };
}
