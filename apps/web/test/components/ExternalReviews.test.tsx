/**
 * @file ExternalReviews.test.tsx
 * @description Unit tests for the ExternalReviews React island (SPEC-237 T-012).
 *
 * Coverage:
 * - Renders nothing when snippets array is empty.
 * - Renders author name (with link when authorUrl present).
 * - Renders star rating for each snippet.
 * - Renders review text.
 * - Renders relative time when present.
 * - Renders Google attribution link.
 * - Renders profile photo when present, fallback initial otherwise.
 * - Caps to MAX_SNIPPETS (5) when more provided.
 */

import type { ExternalReviewSnippet } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/components/accommodation/ExternalReviews.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string, params?: Record<string, unknown>): string => {
            if (!fallback) return _key;
            if (!params) return fallback;
            return Object.entries(params).reduce<string>(
                (acc, [k, v]) => acc.replace(new RegExp(`{{${k}}}`, 'g'), String(v)),
                fallback
            );
        }
    })
}));

vi.mock('@repo/icons', () => ({
    StarIcon: ({
        weight,
        'aria-hidden': ariaHidden
    }: { weight?: string; 'aria-hidden'?: string }) => (
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

import { ExternalReviews } from '../../src/components/accommodation/ExternalReviews.client';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeSnippet(overrides: Partial<ExternalReviewSnippet> = {}): ExternalReviewSnippet {
    return {
        author: 'María García',
        text: 'Excelente alojamiento, muy recomendado.',
        rating: 5,
        relativeTime: 'hace 2 semanas',
        timeIso: '2024-06-01T12:00:00Z',
        authorUrl: 'https://maps.google.com/user/1',
        profilePhoto: null,
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
        expect(link).toBeDefined();
        expect(link.getAttribute('href')).toBe('https://maps.google.com/user/42');
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('renders author name as plain text when authorUrl is absent', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet({ author: 'Sin Perfil', authorUrl: null })]}
                locale="es"
            />
        );
        expect(screen.getByText('Sin Perfil')).toBeDefined();
        // Should not be a link
        const links = screen.queryAllByRole('link');
        const profileLinks = links.filter((l) => l.textContent === 'Sin Perfil');
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

    it('renders relative time when present', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet({ relativeTime: 'hace 3 días' })]}
                locale="es"
            />
        );
        expect(screen.getByText('hace 3 días')).toBeDefined();
    });

    it('does not render time element when relativeTime is null', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet({ relativeTime: null })]}
                locale="es"
            />
        );
        // No <time> element with relative text should appear
        const times = document.querySelectorAll('time');
        expect(times).toHaveLength(0);
    });

    it('renders star rating icons for snippet with rating', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet({ rating: 4 })]}
                locale="es"
            />
        );
        // 4 filled + 1 regular
        const filledStars = screen.getAllByTestId('star-fill');
        const emptyStars = screen.getAllByTestId('star-regular');
        expect(filledStars).toHaveLength(4);
        expect(emptyStars).toHaveLength(1);
    });

    it('does not render star rating when rating is null', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet({ rating: null })]}
                locale="es"
            />
        );
        const filledStars = screen.queryAllByTestId('star-fill');
        expect(filledStars).toHaveLength(0);
    });

    it('renders profile photo img when profilePhoto is present', () => {
        const photoUrl = 'https://lh3.googleusercontent.com/photo.jpg';
        render(
            <ExternalReviews
                snippets={[makeSnippet({ author: 'Ana López', profilePhoto: photoUrl })]}
                locale="es"
            />
        );
        const img = screen.getByRole('img', { name: 'Ana López' });
        expect(img.getAttribute('src')).toBe(photoUrl);
    });

    it('renders avatar fallback initial when profilePhoto is absent', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet({ author: 'Carlos', profilePhoto: null })]}
                locale="es"
            />
        );
        // The fallback span renders the first letter
        const fallback = screen.getByText('C');
        expect(fallback).toBeDefined();
    });

    it('renders Google attribution link', () => {
        render(
            <ExternalReviews
                snippets={[makeSnippet()]}
                locale="es"
            />
        );
        const attribution = screen.getByRole('link', { name: 'Powered by Google' });
        expect(attribution).toBeDefined();
        expect(attribution.getAttribute('href')).toContain('google.com');
        expect(attribution.getAttribute('target')).toBe('_blank');
    });

    it('renders at most 5 snippets when more are provided', () => {
        const snippets = Array.from({ length: 8 }, (_, i) =>
            makeSnippet({ author: `Author ${i}`, text: `Review text ${i}` })
        );
        render(
            <ExternalReviews
                snippets={snippets}
                locale="es"
            />
        );
        // Each snippet renders its review text
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(5);
    });

    it('renders multiple snippets', () => {
        const snippets = [
            makeSnippet({ author: 'Author A', text: 'Texto A' }),
            makeSnippet({ author: 'Author B', text: 'Texto B' })
        ];
        render(
            <ExternalReviews
                snippets={snippets}
                locale="es"
            />
        );
        expect(screen.getByText('Texto A')).toBeDefined();
        expect(screen.getByText('Texto B')).toBeDefined();
    });
});
