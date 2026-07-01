/**
 * @file RecommendationsFeed.test.tsx
 * @description Minimal smoke tests for the RecommendationsFeed React island
 * (SPEC-284 T-011). Full state-matrix coverage (error / entitlement-required /
 * cold-start / true-empty / populated grid) is added in T-016.
 *
 * Covers:
 *  - Renders without crashing.
 *  - Shows the loading state initially (before the fetch resolves).
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationsFeed } from '../../src/components/account/RecommendationsFeed.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../src/components/account/RecommendationsFeed.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const API_URL = 'http://localhost:3001';
const LOCALE = 'es' as const;

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    // A fetch that never resolves within the test is enough to assert the
    // loading state without needing to mock a full response body.
    vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise(() => undefined))
    );
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RecommendationsFeed', () => {
    it('renders without crashing', () => {
        expect(() =>
            render(
                <RecommendationsFeed
                    locale={LOCALE}
                    apiUrl={API_URL}
                />
            )
        ).not.toThrow();
    });

    it('shows the loading state initially', () => {
        render(
            <RecommendationsFeed
                locale={LOCALE}
                apiUrl={API_URL}
            />
        );

        expect(screen.getByLabelText('Cargando recomendaciones...')).toBeInTheDocument();
    });
});
