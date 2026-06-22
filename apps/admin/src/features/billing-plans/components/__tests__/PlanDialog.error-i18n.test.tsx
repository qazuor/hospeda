/**
 * PlanDialog — error i18n migration tests (SPEC-183 Phase 3 T-010).
 *
 * Verifies that when `onSubmit` throws, the error toast message goes through
 * `translateAdminApiError` rather than surfacing raw English error.message.
 */

// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Hoist mock so the factory runs before module initialization -------------
const { mockTranslateAdminApiError } = vi.hoisted(() => {
    return {
        mockTranslateAdminApiError: vi.fn(
            (input: { fallback?: string }) => input.fallback ?? 'translated-error'
        )
    };
});

vi.mock('@/lib/errors', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/errors')>();
    return {
        ...actual,
        translateAdminApiError: mockTranslateAdminApiError
    };
});

// ---- Minimal mocks for heavy deps ------------------------------------------
vi.mock('@repo/billing', () => ({
    LimitKey: {},
    LIMIT_METADATA: {}
}));

vi.mock('../plan-entitlement-groups', () => ({
    ENTITLEMENT_GROUP_KEYS: [],
    getEntitlementName: (key: string) => key
}));

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ addToast: vi.fn() })
}));

import { PlanDialog } from '../PlanDialog';

describe('PlanDialog — error i18n (SPEC-183 T-010)', () => {
    beforeEach(() => {
        mockTranslateAdminApiError.mockClear();
    });

    it('calls translateAdminApiError when onSubmit throws', async () => {
        const onSubmit = vi.fn().mockRejectedValue(new Error('Server error'));
        const onOpenChange = vi.fn();

        render(
            <PlanDialog
                open={true}
                onOpenChange={onOpenChange}
                onSubmit={onSubmit}
            />
        );

        // Fill required fields
        const slugInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.slug/i);
        fireEvent.change(slugInput, { target: { value: 'test-slug' } });

        const nameInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.name/i);
        fireEvent.change(nameInput, { target: { value: 'Test Plan' } });

        // Submit the form
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
