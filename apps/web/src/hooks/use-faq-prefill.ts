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
/** FAQ answer field limit used for URL prefills. */
export const FAQ_PREFILL_ANSWER_MAX_LENGTH = 2000;

/**
 * Reads and normalises the prefill question from a query string.
 *
 * @param input - The `location.search` string.
 * @returns `{ question }`, `null` when absent or blank.
 */
export function readFaqPrefill(input: { readonly search: string }): {
    readonly question: string | null;
    readonly answer: string | null;
    readonly messageId: string | null;
} {
    const params = new URLSearchParams(input.search);
    const raw = params.get(FAQ_PREFILL_PARAM);
    const question = raw?.trim().slice(0, FAQ_PREFILL_MAX_LENGTH) ?? '';
    const answer = params.get('respuesta')?.trim().slice(0, FAQ_PREFILL_ANSWER_MAX_LENGTH) ?? '';
    const message = params.get('mensaje') ?? '';
    return {
        question: question === '' ? null : question,
        answer: answer === '' ? null : answer,
        messageId: /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(message) ? message : null
    };
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
    readonly answer?: string;
    readonly messageId?: string;
    readonly includeAnswer?: boolean;
}): { readonly href: string } {
    const separator = input.faqUrl.includes('?') ? '&' : '?';
    const params = new URLSearchParams({
        [FAQ_PREFILL_PARAM]: input.question.slice(0, FAQ_PREFILL_MAX_LENGTH)
    });
    if (input.messageId) params.set('mensaje', input.messageId);
    if (input.includeAnswer && input.answer)
        params.set('respuesta', input.answer.slice(0, FAQ_PREFILL_ANSWER_MAX_LENGTH));
    return { href: `${input.faqUrl}${separator}${params.toString()}` };
}

/**
 * Calls `onPrefill` once with the question from the URL, if any, and removes
 * the parameter from the address bar.
 *
 * @param input - The callback that opens the add form.
 */
export function useFaqPrefill(input: {
    readonly onPrefill: (prefill: {
        readonly question: string;
        readonly answer: string;
        readonly messageId: string | null;
    }) => void;
}): void {
    const handled = useRef(false);
    const { onPrefill } = input;

    useEffect(() => {
        if (handled.current) return;
        handled.current = true;
        const { question, answer, messageId } = readFaqPrefill({ search: window.location.search });
        if (question === null) return;
        onPrefill({ question, answer: answer ?? '', messageId });
        const url = new URL(window.location.href);
        url.searchParams.delete(FAQ_PREFILL_PARAM);
        url.searchParams.delete('respuesta');
        url.searchParams.delete('mensaje');
        window.history.replaceState(window.history.state, '', url.toString());
    }, [onPrefill]);
}
