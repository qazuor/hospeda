/**
 * @file CreateCollectionCTA.test.tsx
 * @description Unit tests for the CreateCollectionCTA island's disabled-state
 * priority (HOS-899) and its create flow (HOS-999).
 *
 * Covers:
 * - `accessDenied` disables the button with the entitlement-required message
 * - `isAtLimit` (no `accessDenied`) disables the button with the limit message
 * - `accessDenied` wins over `isAtLimit` when both are true
 * - Neither flag: button stays enabled
 * - HOS-999: a successful create broadcasts `hospeda:collection-created`,
 *   never calls `window.location.reload`, and shows a success toast
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateCollectionCTA } from '../../../src/components/account/CreateCollectionCTA.client';
import { COLLECTION_CREATED_EVENT } from '../../../src/components/account/collection-created-event';
import { addToast } from '../../../src/store/toast-store';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/CreateCollectionCTA.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', () => ({
    createT:
        () =>
        (key: string, fallback?: string, params?: Record<string, unknown>): string => {
            const text = fallback ?? key;
            if (!params) return text;
            return Object.entries(params).reduce(
                (acc, [name, value]) => acc.replace(`{{${name}}}`, String(value)),
                text
            );
        }
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

/** New collection returned by the stubbed sub-modal's "save" click. */
const NEW_COLLECTION = { id: 'new-col-1', name: 'Recién creada' };

// CreateEditCollectionModal renders nothing meaningful while closed; when
// open, the stub exposes a single "save" button that invokes `onSaved` with
// a fixed collection so tests can drive CreateCollectionCTA's own
// post-create logic without re-implementing the create form.
vi.mock('../../../src/components/account/CreateEditCollectionModal.client', () => ({
    CreateEditCollectionModal: ({
        isOpen,
        onSaved
    }: {
        isOpen: boolean;
        onSaved?: (collection: { id: string; name: string }) => void;
    }) =>
        isOpen ? (
            <button
                type="button"
                data-testid="stub-create-save"
                onClick={() => onSaved?.(NEW_COLLECTION)}
            >
                Save
            </button>
        ) : null
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

    // ── HOS-999: create flow reacts instead of reloading ───────────────────────
    describe('creating a collection', () => {
        let reloadSpy: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            vi.clearAllMocks();
            // A real jsdom navigation throws "Not implemented" — stub it so a
            // regression (the old `window.location.reload()` coming back)
            // fails loudly on the assertion below instead of crashing the test.
            reloadSpy = vi.fn();
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: { ...window.location, reload: reloadSpy }
            });
        });

        it('broadcasts hospeda:collection-created, never reloads, and shows a success toast', async () => {
            // Arrange
            const listener = vi.fn();
            window.addEventListener(COLLECTION_CREATED_EVENT, listener);
            render(
                <CreateCollectionCTA
                    locale="es"
                    isAtLimit={false}
                    maxCollections={5}
                />
            );
            fireEvent.click(screen.getByRole('button', { name: 'Crear colección' }));

            // Act
            fireEvent.click(screen.getByTestId('stub-create-save'));

            // Assert — broadcast fired with the new collection's id/name
            await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
            expect(listener.mock.calls[0][0].detail).toEqual(NEW_COLLECTION);

            // Assert — no full-page reload
            expect(reloadSpy).not.toHaveBeenCalled();

            // Assert — success toast shown, naming the new collection
            expect(addToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'success',
                    message: expect.stringContaining('Recién creada')
                })
            );

            window.removeEventListener(COLLECTION_CREATED_EVENT, listener);
        });
    });
});
