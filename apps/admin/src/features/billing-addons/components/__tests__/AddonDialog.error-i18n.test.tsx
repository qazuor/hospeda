/**
 * AddonDialog — error i18n migration tests (SPEC-183 Phase 3 T-010).
 *
 * Verifies that when `onSubmit` throws, the error toast message goes through
 * `translateAdminApiError` rather than surfacing raw English `error.message`.
 */

// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Hoist mock so factory runs before module initialization -----------------
const { mockTranslateAdminApiError } = vi.hoisted(() => ({
    mockTranslateAdminApiError: vi.fn(
        (input: { fallback?: string }) => input.fallback ?? 'translated-error'
    )
}));

vi.mock('@/lib/errors', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/errors')>();
    return {
        ...actual,
        translateAdminApiError: mockTranslateAdminApiError
    };
});

// ---- Minimal mocks for heavy deps ------------------------------------------
vi.mock('@repo/billing', () => ({
    EntitlementKey: {},
    LimitKey: {}
}));

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ addToast: vi.fn() })
}));

import { AddonDialog } from '../AddonDialog';

describe('AddonDialog — error i18n (SPEC-183 T-010)', () => {
    beforeEach(() => {
        mockTranslateAdminApiError.mockClear();
    });

    it('calls translateAdminApiError when onSubmit throws', async () => {
        const onSubmit = vi.fn().mockRejectedValue(new Error('Addon server error'));
        const onOpenChange = vi.fn();

        render(
            <AddonDialog
                open={true}
                onOpenChange={onOpenChange}
                onSubmit={onSubmit}
            />
        );

        // Fill required slug field
        const slugInput = screen.getByLabelText(
            /admin-billing\.addons\.catalogDialog\.fields\.slug/i
        );
        fireEvent.change(slugInput, { target: { value: 'test-addon' } });

        // Submit form
        const form = slugInput.closest('form');
        if (form) {
            fireEvent.submit(form);
        }

        await waitFor(() => {
            expect(mockTranslateAdminApiError).toHaveBeenCalled();
        });

        const callArg = mockTranslateAdminApiError.mock.calls[0]?.[0];
        expect(callArg).toBeDefined();
        expect(callArg).toHaveProperty('error');
        expect(callArg).toHaveProperty('t');
        expect(callArg).toHaveProperty('fallback');
    });
});
