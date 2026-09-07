/**
 * @file CreateCollectionCTA.test.tsx
 * @description Unit tests for the CreateCollectionCTA island's disabled-state
 * priority (HOS-899).
 *
 * Covers:
 * - `accessDenied` disables the button with the entitlement-required message
 * - `isAtLimit` (no `accessDenied`) disables the button with the limit message
 * - `accessDenied` wins over `isAtLimit` when both are true
 * - Neither flag: button stays enabled
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateCollectionCTA } from '../../../src/components/account/CreateCollectionCTA.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/CreateCollectionCTA.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', () => ({
    createT:
        () =>
        (key: string, fallback?: string): string =>
            fallback ?? key
}));

// CreateEditCollectionModal renders nothing meaningful while closed; stub it
// so this test focuses on the CTA button's own disabled-state logic.
vi.mock('../../../src/components/account/CreateEditCollectionModal.client', () => ({
    CreateEditCollectionModal: () => null
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CreateCollectionCTA', () => {
    it('disables the button with the entitlement-required message when accessDenied is true', () => {
        // Arrange + Act
        render(
            <CreateCollectionCTA
                locale="es"
                isAtLimit={false}
                maxCollections={0}
                accessDenied
            />
        );

        // Assert
        const button = screen.getByRole('button', { name: /planes Plus y VIP/i });
        expect(button).toBeDisabled();
        expect(screen.getByText(/planes Plus y VIP/i)).toBeInTheDocument();
        // The limit-reached copy must not appear — this is what distinguishes
        // the two disabled reasons.
        expect(screen.queryByText(/alcanzaste el máximo/i)).not.toBeInTheDocument();
    });

    it('disables the button with the limit-reached message when only isAtLimit is true', () => {
        // Arrange + Act
        render(
            <CreateCollectionCTA
                locale="es"
                isAtLimit={true}
                maxCollections={5}
            />
        );

        // Assert
        const button = screen.getByRole('button', { name: /alcanzaste el máximo/i });
        expect(button).toBeDisabled();
        expect(screen.getByText(/alcanzaste el máximo/i)).toBeInTheDocument();
        expect(screen.queryByText(/planes Plus y VIP/i)).not.toBeInTheDocument();
    });

    it('accessDenied wins over isAtLimit when both are true', () => {
        // Arrange + Act
        render(
            <CreateCollectionCTA
                locale="es"
                isAtLimit={true}
                maxCollections={5}
                accessDenied
            />
        );

        // Assert: entitlement message shown, not the limit one.
        expect(screen.getByText(/planes Plus y VIP/i)).toBeInTheDocument();
        expect(screen.queryByText(/alcanzaste el máximo/i)).not.toBeInTheDocument();
    });

    it('leaves the button enabled and opens the modal on click when neither flag is set', () => {
        // Arrange
        render(
            <CreateCollectionCTA
                locale="es"
                isAtLimit={false}
                maxCollections={5}
            />
        );
        const button = screen.getByRole('button', { name: 'Crear colección' });
        expect(button).toBeEnabled();

        // Act — clicking an enabled CTA must not throw (opens the stubbed modal).
        fireEvent.click(button);

        // Assert: no disabled-state copy leaked in.
        expect(screen.queryByText(/planes Plus y VIP/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/alcanzaste el máximo/i)).not.toBeInTheDocument();
    });
});
