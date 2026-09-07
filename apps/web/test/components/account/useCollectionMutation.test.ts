/**
 * @file useCollectionMutation.test.ts
 * @description Unit tests for the useCollectionMutation hook (HOS-899).
 *
 * Covers:
 * - Successful create calls onSaved + onClose and returns true
 * - 409 NAME_TAKEN sets an inline field error (no toast, no onClose)
 * - 403 ENTITLEMENT_REQUIRED closes the modal and toasts the upgrade message
 *   (translated via t(), NOT the LIMIT_REACHED message)
 * - 403 LIMIT_REACHED closes the modal and toasts the limit message
 *   (NOT the upgrade message)
 * - Any other error toasts the generic translateApiError fallback
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type CollectionMutationCallbacks,
    useCollectionMutation
} from '../../../src/components/account/useCollectionMutation';
import { addToast } from '../../../src/store/toast-store';

// ─── Module mocks ─────────────────────────────────────────────────────────────

const createMock = vi.fn();
const updateMock = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    userBookmarkCollectionsApi: {
        create: (...args: unknown[]) => createMock(...args),
        update: (...args: unknown[]) => updateMock(...args)
    }
}));

vi.mock('../../../src/lib/api-errors', () => ({
    translateApiError: ({ fallback }: { fallback?: string }) =>
        fallback ?? 'Ocurrió un error. Intentá de nuevo.'
}));

vi.mock('../../../src/lib/i18n', () => ({
    createT:
        (_locale: string) =>
        (key: string, fallback?: string): string =>
            `[t:${key}]${fallback ? `(${fallback})` : ''}`
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FORM_INPUT = {
    name: 'Mi colección',
    description: '',
    color: '',
    icon: ''
};

function makeCallbacks(): CollectionMutationCallbacks & {
    onSaved: ReturnType<typeof vi.fn>;
    onClose: ReturnType<typeof vi.fn>;
    setNameError: ReturnType<typeof vi.fn>;
} {
    return {
        onSaved: vi.fn(),
        onClose: vi.fn(),
        setNameError: vi.fn()
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useCollectionMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls onSaved and onClose and returns true on success', async () => {
        // Arrange
        createMock.mockResolvedValue({
            ok: true,
            data: { id: 'col-1', name: 'Mi colección' }
        });
        const callbacks = makeCallbacks();
        const { result } = renderHook(() => useCollectionMutation({ callbacks, locale: 'es' }));

        // Act
        let returned: boolean | undefined;
        await act(async () => {
            returned = await result.current.submit(FORM_INPUT);
        });

        // Assert
        expect(returned).toBe(true);
        expect(callbacks.onSaved).toHaveBeenCalledWith({ id: 'col-1', name: 'Mi colección' });
        expect(callbacks.onClose).toHaveBeenCalledTimes(1);
        expect(addToast).not.toHaveBeenCalled();
    });

    it('sets an inline field error on 409 NAME_TAKEN without a toast or closing', async () => {
        // Arrange
        createMock.mockResolvedValue({
            ok: false,
            error: { status: 409, code: 'NAME_TAKEN', message: 'Name taken' }
        });
        const callbacks = makeCallbacks();
        const { result } = renderHook(() => useCollectionMutation({ callbacks, locale: 'es' }));

        // Act
        let returned: boolean | undefined;
        await act(async () => {
            returned = await result.current.submit(FORM_INPUT);
        });

        // Assert
        expect(returned).toBe(false);
        expect(callbacks.setNameError).toHaveBeenCalledWith('Ese nombre ya está en uso');
        expect(callbacks.onClose).not.toHaveBeenCalled();
        expect(addToast).not.toHaveBeenCalled();
    });

    it('closes the modal and toasts the upgrade message on 403 ENTITLEMENT_REQUIRED', async () => {
        // Arrange
        createMock.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'ENTITLEMENT_REQUIRED', message: 'Forbidden' }
        });
        const callbacks = makeCallbacks();
        const { result } = renderHook(() => useCollectionMutation({ callbacks, locale: 'es' }));

        // Act
        let returned: boolean | undefined;
        await act(async () => {
            returned = await result.current.submit(FORM_INPUT);
        });

        // Assert
        expect(returned).toBe(false);
        expect(callbacks.onClose).toHaveBeenCalledTimes(1);
        expect(addToast).toHaveBeenCalledTimes(1);
        const toastCall = (addToast as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(toastCall.type).toBe('error');
        // Routed through t() with the shared upgrade-cartel key — distinct
        // message from LIMIT_REACHED's plain "Ya alcanzaste..." string.
        expect(toastCall.message).toContain('account.favorites.collections.upgrade.message');
        expect(toastCall.message).not.toContain('máximo de colecciones');
    });

    it('closes the modal and toasts the limit message on 403 LIMIT_REACHED (not the upgrade message)', async () => {
        // Arrange
        createMock.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'LIMIT_REACHED', message: 'Forbidden' }
        });
        const callbacks = makeCallbacks();
        const { result } = renderHook(() => useCollectionMutation({ callbacks, locale: 'es' }));

        // Act
        let returned: boolean | undefined;
        await act(async () => {
            returned = await result.current.submit(FORM_INPUT);
        });

        // Assert
        expect(returned).toBe(false);
        expect(callbacks.onClose).toHaveBeenCalledTimes(1);
        expect(addToast).toHaveBeenCalledWith({
            type: 'error',
            message: 'Ya alcanzaste el máximo de colecciones'
        });
    });

    it('toasts the generic translated fallback for any other error', async () => {
        // Arrange
        createMock.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'Boom' }
        });
        const callbacks = makeCallbacks();
        const { result } = renderHook(() => useCollectionMutation({ callbacks, locale: 'es' }));

        // Act
        let returned: boolean | undefined;
        await act(async () => {
            returned = await result.current.submit(FORM_INPUT);
        });

        // Assert
        expect(returned).toBe(false);
        // Generic branch does not close the modal (only NAME_TAKEN/LIMIT_REACHED/
        // ENTITLEMENT_REQUIRED/success do).
        expect(callbacks.onClose).not.toHaveBeenCalled();
        expect(addToast).toHaveBeenCalledWith({
            type: 'error',
            message: 'Ocurrió un error. Intentá de nuevo.'
        });
    });
});
