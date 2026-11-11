/**
 * @file ExternalReviews.test.tsx
 * @description Unit tests for the redesigned ExternalReviews React island.
 *
 * Coverage:
 * - Renders at most three review cards.
 * - Relative time is computed from `timeIso` in the page locale, not Google's
 *   English `relativeTime`.
 * - No time is rendered when `timeIso` is missing, even if `relativeTime` is.
 * - "Escrita en …" appears only when the review language differs from the page.
 * - The per-card "en Google" source label is gone.
 * - Exactly one "Powered by Google" attribution.
 * - The read-more toggle appears only when the clamped text overflows.
 */

import type { ExternalReviewSnippet } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/accommodation/ExternalReviews.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('@repo/icons', () => ({
    StarIcon: ({
        weight,
        'aria-hidden': ariaHidden
    }: {
        weight?: string;
        'aria-hidden'?: string;
    }) => (
        <svg
            data-testid={`star-${weight ?? 'regular'}`}
            aria-hidden={ariaHidden}
        />
    ),
    GoogleIcon: ({ 'aria-hidden': ariaHidden }: { 'aria-hidden'?: string }) => (
        <svg
            data-testid="google-icon"
            aria-hidden={ariaHidden}
        />
    )
}));

// ─── Import after mocks ────────────────────────────────────────────────────────

import { ExternalReviews } from '../../../src/components/accommodation/ExternalReviews.client';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeSnippet(overrides: Partial<ExternalReviewSnippet> = {}): ExternalReviewSnippet {
    return {
        author: 'María García',
        text: 'Excelente alojamiento, muy recomendado.',
        rating: 5,
        relativeTime: 'a month ago',
        timeIso: '2026-11-01T12:00:00Z',
        authorUrl: 'https://maps.google.com/user/1',
        profilePhoto: null,
        languageCode: null,
        ...overrides
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExternalReviews', () => {
    it('renders nothing when snippets is empty', () => {
        const { container } = render(
            <ExternalReviews
                snippets={[]}
                locale="es"
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders at most three snippets', () => {
        const snippets = Array.from({ length: 8 }, (_, i) =>
            makeSnippet({ author: `Author ${i}`, text: `Review text ${i}` })
        );
        render(
            <ExternalReviews
                snippets={snippets}
                locale="es"
            />
        );
        expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('renders author name as link when authorUrl is present', () => {
        render(
            <ExternalReviews
                snippets={[
                    makeSnippet({
                        author: 'Juan Pérez',
                        authorUrl: 'https://maps.google.com/user/42'
                    })
                ]}
                locale="es"
            />
        );
        const link = screen.getByRole('link', { name: 'Juan Pérez' });
        expect(link.getAttribute('href')).toBe('https://maps.google.com/user/42');
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('renders author name as plain text when authorUrl is absent or unsafe', () => {
        render(
            <ExternalReviews
                snippets={[
                    makeSnippet({ author: 'Sin Perfil', authorUrl: null }),
                    makeSnippet({ author: 'Unsafe Link', authorUrl: 'javascript:alert(1)' })
                ]}
                locale="es"
            />
        );
        expect(screen.getByText('Sin Perfil')).toBeDefined();
        const profileLinks = screen
            .queryAllByRole('link')
            .filter((l) => l.textContent === 'Sin Perfil' || l.textContent === 'Unsafe Link');
        expect(profileLinks).toHaveLength(0);
    });

    it('renders review text', () => {
        const text = 'Un lugar maravilloso con vistas increíbles.';
        render(
            <ExternalReviews
                snippets={[makeSnippet({ text })]}
                locale="es"
            />
        );
        expect(screen.getByText(text)).toBeDefined();
    });

    it('computes relative time from timeIso in the page locale', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));
        try {
            render(
                <ExternalReviews
                    snippets={[
                        makeSnippet({
                            timeIso: '2026-11-01T12:00:00Z',
                            relativeTime: '9 days ago'
                        })
                    ]}
                    locale="es"
                />
            );
            const time = document.querySelector('time');
            expect(time).not.toBeNull();
            expect(time?.getAttribute('dateTime')).toBe('2026-11-01T12:00:00Z');
            expect(time?.textContent).toBe('hace 9 días');
            expect(screen.queryByText('9 days ago')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('renders no time when timeIso is missing, even if relativeTime is present', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet({ timeIso: null, relativeTime: 'hace 3 días' })]}
                locale="es"
            />
        );
        expect(document.querySelectorAll('time')).toHaveLength(0);
        expect(screen.queryByText('hace 3 días')).toBeNull();
    });

    it('renders no time when timeIso is invalid', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet({ timeIso: 'not-a-date', relativeTime: 'a month ago' })]}
                locale="es"
            />
        );
        expect(document.querySelectorAll('time')).toHaveLength(0);
    });

    it('labels a review written in a different language', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet({ languageCode: 'pt', text: 'Lugar maravilhoso.' })]}
                locale="es"
            />
        );
        expect(screen.getByText('Escrita en portugués')).toBeDefined();
    });

    it('does not label a review written in the page language', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet({ languageCode: 'es', text: 'Un lugar increíble.' })]}
                locale="es"
            />
        );
        expect(screen.queryByText(/Escrita en/)).toBeNull();
    });

    it('does not render the per-card "en Google" source label', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet()]}
                locale="es"
            />
        );
        expect(screen.queryByText('en Google')).toBeNull();
    });

    it('renders exactly one Powered by Google attribution', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet(), makeSnippet({ author: 'Otro', text: 'Otra reseña' })]}
                locale="es"
            />
        );
        expect(screen.getAllByText('Powered by Google')).toHaveLength(1);
        const attribution = screen.getByRole('link', { name: 'Powered by Google' });
        expect(attribution.getAttribute('href')).toContain('google.com');
        expect(attribution.getAttribute('target')).toBe('_blank');
    });

    it('renders the star rating with a localized aria-label', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet({ rating: 4 })]}
                locale="es"
            />
        );
        // 4 filled + 1 regular
        expect(screen.getAllByTestId('star-fill')).toHaveLength(4);
        expect(screen.getAllByTestId('star-regular')).toHaveLength(1);
        expect(screen.getByRole('img', { name: '4 de 5 estrellas' })).toBeDefined();
    });

    it('renders the avatar fallback initial when profilePhoto is absent', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet({ author: 'Carlos', profilePhoto: null })]}
                locale="es"
            />
        );
        expect(screen.getByText('C')).toBeDefined();
    });

    it('shows a read-more toggle only when the text overflows', () => {
        const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
            HTMLElement.prototype,
            'scrollHeight'
        );
        const clientHeightDescriptor = Object.getOwnPropertyDescriptor(
            HTMLElement.prototype,
            'clientHeight'
        );

        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
            configurable: true,
            get: () => 200
        });
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
            configurable: true,
            get: () => 100
        });

        try {
            render(
                <ExternalReviews
                    snippets={[makeSnippet()]}
                    locale="es"
                />
            );

            const readMore = screen.getByRole('button', { name: 'Leer más' });
            expect(readMore.getAttribute('aria-expanded')).toBe('false');

            fireEvent.click(readMore);

            const readLess = screen.getByRole('button', { name: 'Leer menos' });
            expect(readLess.getAttribute('aria-expanded')).toBe('true');
        } finally {
            if (scrollHeightDescriptor) {
                Object.defineProperty(
                    HTMLElement.prototype,
                    'scrollHeight',
                    scrollHeightDescriptor
                );
            }
            if (clientHeightDescriptor) {
                Object.defineProperty(
                    HTMLElement.prototype,
                    'clientHeight',
                    clientHeightDescriptor
                );
            }
        }
    });
});
