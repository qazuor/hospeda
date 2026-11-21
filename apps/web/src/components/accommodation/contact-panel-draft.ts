import type { Dispatch, SetStateAction } from 'react';
import { createContext, useEffect, useState } from 'react';

/** Contact form values that outlive the contact sheet's portal while it is closed. */
export interface ContactPanelDraft {
    readonly name: string;
    readonly email: string;
    readonly phone: string;
    readonly editedMessage?: string;
}

/** Starting state for a new contact inquiry. */
export const emptyContactDraft: ContactPanelDraft = { name: '', email: '', phone: '' };

type SubmitState =
    | { readonly phase: 'idle' }
    | { readonly phase: 'submitting' }
    | { readonly phase: 'success'; readonly message: string; readonly keepForm: boolean }
    | { readonly phase: 'duplicate' }
    | { readonly phase: 'error'; readonly message: string }
    | { readonly phase: 'fieldError'; readonly field: 'message'; readonly message: string }
    | { readonly phase: 'rateLimit'; readonly retryAfter: number };

/** Owns the request outcome and retry countdown at the draft's lifetime. */
export function useContactSubmission() {
    const [submitState, setSubmitState] = useState<SubmitState>({ phase: 'idle' });
    const [retryCountdown, setRetryCountdown] = useState(0);

    useEffect(() => {
        if (submitState.phase !== 'rateLimit') return;
        let remaining = submitState.retryAfter;
        setRetryCountdown(remaining);
        const timer = setInterval(() => {
            remaining -= 1;
            setRetryCountdown(Math.max(0, remaining));
            if (remaining <= 0) setSubmitState({ phase: 'idle' });
        }, 1000);
        return () => clearInterval(timer);
    }, [submitState]);

    return { submitState, setSubmitState, retryCountdown };
}

/** Internal bridge for the panel instance; standalone forms keep their own state. */
export const ContactPanelDraftContext = createContext<{
    readonly draft: ContactPanelDraft;
    readonly setDraft: Dispatch<SetStateAction<ContactPanelDraft>>;
    readonly submission: ReturnType<typeof useContactSubmission>;
    /** Captures the submitted revision; the returned callback resets only that revision. */
    readonly captureDraftReset: () => () => boolean;
} | null>(null);
