/**
 * FAQ prefill from the AI questions tab (HOS-2101).
 */

import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildFaqPrefillHref,
    FAQ_PREFILL_MAX_LENGTH,
    readFaqPrefill,
    useFaqPrefill
} from '../../src/hooks/use-faq-prefill';

function Probe({ onPrefill }: { readonly onPrefill: (question: string) => void }) {
    useFaqPrefill({ onPrefill });
    return null;
}

describe('readFaqPrefill', () => {
    it.each([
        ['', null],
        ['?pregunta=', null],
        ['?pregunta=%20%20', null],
        ['?pregunta=%C2%BFHay%20cochera%3F', '¿Hay cochera?'],
        ['?otra=1&pregunta=Wifi', 'Wifi']
    ])('reads %j as %j', (search, expected) => {
        expect(readFaqPrefill({ search }).question).toBe(expected);
    });

    it('caps the question at the FAQ field limit', () => {
        const long = 'a'.repeat(FAQ_PREFILL_MAX_LENGTH + 50);
        expect(readFaqPrefill({ search: `?pregunta=${long}` }).question).toHaveLength(
            FAQ_PREFILL_MAX_LENGTH
        );
    });
});

describe('buildFaqPrefillHref', () => {
    it('encodes the question so it round-trips through readFaqPrefill', () => {
        const question = '¿Aceptan mascotas & niños?';
        const { href } = buildFaqPrefillHref({ faqUrl: '/es/x/editar/preguntas/', question });

        expect(href.startsWith('/es/x/editar/preguntas/?pregunta=')).toBe(true);
        expect(readFaqPrefill({ search: href.slice(href.indexOf('?')) }).question).toBe(question);
    });

    it('appends with & when the URL already has a query', () => {
        expect(buildFaqPrefillHref({ faqUrl: '/p/?a=1', question: 'q' }).href).toBe(
            '/p/?a=1&pregunta=q'
        );
    });
});

describe('useFaqPrefill', () => {
    afterEach(() => {
        window.history.replaceState(null, '', '/');
    });

    it('calls back once with the question and drops it from the URL', () => {
        // Arrange
        window.history.replaceState(null, '', '/es/editar/preguntas/?pregunta=Hay%20wifi&x=1');
        const onPrefill = vi.fn();

        // Act
        const { rerender } = render(<Probe onPrefill={onPrefill} />);
        rerender(<Probe onPrefill={onPrefill} />);

        // Assert
        expect(onPrefill).toHaveBeenCalledTimes(1);
        expect(onPrefill).toHaveBeenCalledWith('Hay wifi');
        expect(window.location.search).toBe('?x=1');
    });

    it('does nothing without the parameter', () => {
        window.history.replaceState(null, '', '/es/editar/preguntas/');
        const onPrefill = vi.fn();

        render(<Probe onPrefill={onPrefill} />);

        expect(onPrefill).not.toHaveBeenCalled();
    });
});
