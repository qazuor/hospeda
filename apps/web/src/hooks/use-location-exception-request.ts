/**
 * @file use-location-exception-request.ts
 * @description State of the owner's "Pedir una excepción" form (HOS-2192).
 *
 * A small native-form hook: the reason, the 10 to 500 character validation
 * (shared limits from `@repo/schemas`), the submit and the mapping of every
 * failure to a message key. The API owns the rules; this only reflects them.
 */

import { type ChangeEvent, type FormEvent, useCallback, useState } from 'react';
import {
    type LocationExceptionTarget,
    type LocationExceptionVertical,
    mapLocationExceptionError,
    requestLocationException,
    validateLocationExceptionReason
} from '@/lib/listing/location-exception';

/** Lifecycle of the submit. */
export type LocationExceptionRequestPhase = 'editing' | 'submitting' | 'sent';

/** Inputs of {@link useLocationExceptionRequest}. */
export interface UseLocationExceptionRequestInput {
    readonly vertical: LocationExceptionVertical;
    readonly listingId: string;
    /** The address the owner was trying to save, for a request to move the listing there. */
    readonly location?: LocationExceptionTarget;
    /** Called once after the API accepted the request (201). */
    readonly onSent?: () => void;
}

/** What {@link useLocationExceptionRequest} returns. */
export interface UseLocationExceptionRequestResult {
    readonly reason: string;
    readonly length: number;
    readonly phase: LocationExceptionRequestPhase;
    /** Sub-key under `listing.owner.locationException.validation`, shown once the owner tried to submit. */
    readonly validationKey: 'tooShort' | 'tooLong' | null;
    /** Sub-key under `listing.owner.locationException.errors` of the last failed request. */
    readonly errorKey: string | null;
    readonly onReasonChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
    readonly onSubmit: (event: FormEvent) => Promise<void>;
}

/**
 * Drive the request form.
 *
 * @param input - Vertical, listing id and the optional success callback.
 * @returns Form state and handlers.
 */
export function useLocationExceptionRequest({
    vertical,
    listingId,
    location,
    onSent
}: UseLocationExceptionRequestInput): UseLocationExceptionRequestResult {
    const [reason, setReason] = useState('');
    const [phase, setPhase] = useState<LocationExceptionRequestPhase>('editing');
    const [attempted, setAttempted] = useState(false);
    const [errorKey, setErrorKey] = useState<string | null>(null);

    const validation = validateLocationExceptionReason({ reason });

    const onReasonChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
        setReason(event.target.value);
        setErrorKey(null);
    }, []);

    const onSubmit = useCallback(
        async (event: FormEvent): Promise<void> => {
            event.preventDefault();
            if (phase === 'submitting') return;
            setAttempted(true);
            if (!validation.ok) return;
            setPhase('submitting');
            setErrorKey(null);
            const result = await requestLocationException({
                vertical,
                listingId,
                reason,
                location
            });
            if (result.ok) {
                setPhase('sent');
                onSent?.();
                return;
            }
            setErrorKey(mapLocationExceptionError({ error: result.error }));
            setPhase('editing');
        },
        [phase, validation.ok, vertical, listingId, reason, location, onSent]
    );

    return {
        reason,
        length: validation.length,
        phase,
        validationKey: attempted ? validation.errorKey : null,
        errorKey,
        onReasonChange,
        onSubmit
    };
}
