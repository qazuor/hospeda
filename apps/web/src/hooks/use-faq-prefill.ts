/**
 * One-shot FAQ prefill from the URL (HOS-2101).
 *
 * The «Preguntas a la IA» tab links to the FAQ page with
 * `?pregunta=<visitor question>`. Both FAQ editors (accommodation and
 * venue/experience) call this hook once: when the parameter is present they
 * open their «add» form with the question filled in, and the parameter is
 * dropped from the address bar so a reload does not reopen the form.
 *
 * Read in an effect, never during render: the page is server-rendered without
 * the query string's meaning, so reading it in a state initialiser would make
 * the hydrated markup differ from the server's.
 *
 * @module hooks/use-faq-prefill
 */

import { useEffect, useRef } from 'react';

/** Query parameter carrying the question to prefill. */
export const FAQ_PREFILL_PARAM = 'pregunta';

/** Longest prefill accepted — the FAQ question field's own limit. */
export const FAQ_PREFILL_MAX_LENGTH = 300;

/**
 * Reads and normalises the prefill question from a query string.
 *
 * @param input - The `location.search` string.
 * @returns `{ question }`, `null` when absent or blank.
 */
export function readFaqPrefill(input: { readonly search: string }): {
    readonly question: string | null;
} {
    const raw = new URLSearchParams(input.search).get(FAQ_PREFILL_PARAM);
    const question = raw?.trim().slice(0, FAQ_PREFILL_MAX_LENGTH) ?? '';
    return { question: question === '' ? null : question };
}

/**
 * Builds the FAQ page link that prefills `question`.
 *
 * @param input - The FAQ section URL and the question.
 * @returns `{ href }`.
 */
export function buildFaqPrefillHref(input: {
    readonly faqUrl: string;
    readonly question: string;
}): { readonly href: string } {
    const separator = input.faqUrl.includes('?') ? '&' : '?';
    const value = encodeURIComponent(input.question.slice(0, FAQ_PREFILL_MAX_LENGTH));
    return { href: `${input.faqUrl}${separator}${FAQ_PREFILL_PARAM}=${value}` };
}

/**
 * Calls `onPrefill` once with the question from the URL, if any, and removes
 * the parameter from the address bar.
 *
 * @param input - The callback that opens the add form.
 */
export function useFaqPrefill(input: { readonly onPrefill: (question: string) => void }): void {
    const handled = useRef(false);
    const { onPrefill } = input;

    useEffect(() => {
        if (handled.current) return;
        handled.current = true;
        const { question } = readFaqPrefill({ search: window.location.search });
        if (question === null) return;
        onPrefill(question);
        const url = new URL(window.location.href);
        url.searchParams.delete(FAQ_PREFILL_PARAM);
        window.history.replaceState(window.history.state, '', url.toString());
    }, [onPrefill]);
}
