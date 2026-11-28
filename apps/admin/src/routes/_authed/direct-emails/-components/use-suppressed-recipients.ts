/**
 * @file use-suppressed-recipients.ts
 * @description Keeps track of which recipients are on the suppression list
 * (HOS-2685). Each address is checked once with `POST /check-recipients` as soon
 * as it enters the list; the result is remembered for the life of the form.
 */

import { useEffect, useRef, useState } from 'react';
import { useCheckDirectEmailRecipients } from '@/hooks/direct-email';

/** Result of {@link useSuppressedRecipients}. */
export interface UseSuppressedRecipientsResult {
    /** Lowercased addresses reported as suppressed. */
    readonly suppressed: ReadonlySet<string>;
    /** True when the last check request failed (the API still skips suppressed mail on send). */
    readonly checkFailed: boolean;
}

/**
 * Checks new recipients against the suppression list.
 *
 * @param input.recipients - Current recipients (lowercased).
 * @returns The suppressed set and whether the last check failed.
 */
export function useSuppressedRecipients({
    recipients
}: {
    readonly recipients: ReadonlyArray<string>;
}): UseSuppressedRecipientsResult {
    const { mutateAsync } = useCheckDirectEmailRecipients();
    const [suppressed, setSuppressed] = useState<ReadonlySet<string>>(new Set());
    const [checkFailed, setCheckFailed] = useState(false);
    const checked = useRef<Set<string>>(new Set());
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        const pending = recipients.filter((email) => !checked.current.has(email));
        if (pending.length === 0) return;
        for (const email of pending) checked.current.add(email);

        void (async () => {
            try {
                const result = await mutateAsync({ emails: pending });
                if (!mounted.current) return;
                setCheckFailed(false);
                if (result.suppressed.length > 0) {
                    setSuppressed((prev) => {
                        const next = new Set(prev);
                        for (const email of result.suppressed) next.add(email.toLowerCase());
                        return next;
                    });
                }
            } catch {
                if (!mounted.current) return;
                // Forget them so the next change of the list retries the check.
                for (const email of pending) checked.current.delete(email);
                setCheckFailed(true);
            }
        })();
    }, [recipients, mutateAsync]);

    return { suppressed, checkFailed };
}
