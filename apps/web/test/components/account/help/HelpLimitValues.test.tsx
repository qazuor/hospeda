/**
 * HOS-2410 web-ui §4, §7 and §8 — the limit island: a number, unlimited, and
 * the neutral text kept on loading or error.
 */

import { UNLIMITED_LIMIT_VALUE } from '@repo/schemas';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ useMyEntitlements: vi.fn() }));

vi.mock('../../../../src/hooks/useMyEntitlements', () => ({
    useMyEntitlements: mocks.useMyEntitlements
}));

import {
    formatHelpLimit,
    HelpLimitValues
} from '../../../../src/components/account/help/HelpLimitValues.client';

const NEUTRAL = 'el tope de tu plan';

function mountSpan(): HTMLElement {
    document.body.innerHTML = `<p><span data-help-limit="max_photos_per_accommodation" data-vertical="accommodation">${NEUTRAL}</span></p>`;
    return document.querySelector<HTMLElement>('[data-help-limit]') as HTMLElement;
}

const entitlements = (value: number, overrides: Record<string, unknown> = {}) => ({
    has: () => true,
    limit: () => value,
    draftLimit: () => 0,
    isLoading: false,
    error: null,
    ...overrides
});

describe('HelpLimitValues', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    it('replaces the neutral text with the reader number', async () => {
        // Arrange
        const span = mountSpan();
        mocks.useMyEntitlements.mockReturnValue(entitlements(12));

        // Act
        render(
            <HelpLimitValues
                locale="es"
                verticals={['accommodation']}
            />
        );

        // Assert
        await waitFor(() => expect(span.textContent).toBe('12'));
        expect(mocks.useMyEntitlements).toHaveBeenCalledWith({ vertical: 'accommodation' });
    });

    it('reads "sin tope" for the unlimited sentinel', async () => {
        const span = mountSpan();
        mocks.useMyEntitlements.mockReturnValue(entitlements(UNLIMITED_LIMIT_VALUE));
        render(
            <HelpLimitValues
                locale="es"
                verticals={['accommodation']}
            />
        );
        await waitFor(() => expect(span.textContent).toBe('sin tope'));
    });

    it('keeps the neutral text while loading and on error', () => {
        // Arrange
        const span = mountSpan();
        mocks.useMyEntitlements.mockReturnValue(entitlements(12, { isLoading: true }));

        // Act
        const { rerender } = render(
            <HelpLimitValues
                locale="es"
                verticals={['accommodation']}
            />
        );
        mocks.useMyEntitlements.mockReturnValue(entitlements(12, { error: new Error('x') }));
        rerender(
            <HelpLimitValues
                locale="es"
                verticals={['accommodation']}
            />
        );

        // Assert
        expect(span.textContent).toBe(NEUTRAL);
    });

    it('leaves spans of another vertical alone', async () => {
        // Arrange
        const span = mountSpan();
        mocks.useMyEntitlements.mockReturnValue(entitlements(5));

        // Act
        render(
            <HelpLimitValues
                locale="es"
                verticals={['venue']}
            />
        );

        // Assert
        await waitFor(() => expect(mocks.useMyEntitlements).toHaveBeenCalled());
        expect(span.textContent).toBe(NEUTRAL);
    });
});

describe('formatHelpLimit', () => {
    it('keeps the neutral text for a missing (zero) value', () => {
        expect(
            formatHelpLimit({ value: 0, locale: 'es', unlimitedText: 'sin tope' })
        ).toBeUndefined();
        expect(formatHelpLimit({ value: 1500, locale: 'es', unlimitedText: 'sin tope' })).toBe(
            '1500'
        );
    });
});
