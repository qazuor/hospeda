/**
 * @file PromotionForm.error-messages.test.tsx
 * @description Regression suite for HOS-190 BETA-190 — the PromotionForm used to
 * render RAW i18n keys (`zodError.ownerPromotion.*`) surfaced by the schema
 * validation instead of a human Spanish message.
 *
 * Renders with the REAL translations (no `@/lib/i18n` mock) so the assertion is
 * on the actual string the user sees.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromotionForm } from '../../../src/components/host/PromotionForm.client';

// endpoints-protected: the form fetches the owner's accommodations on mount.
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockGetById = vi.fn();
const mockListOwn = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    ownerPromotionApi: {
        create: (...args: unknown[]) => mockCreate(...args),
        update: (...args: unknown[]) => mockUpdate(...args),
        getById: (...args: unknown[]) => mockGetById(...args)
    },
    protectedAccommodationsApi: {
        listOwn: (...args: unknown[]) => mockListOwn(...args)
    }
}));

beforeEach(() => {
    vi.clearAllMocks();
    mockListOwn.mockResolvedValue({
        ok: true,
        data: { items: [], total: 0, page: 1, pageSize: 100 }
    });
    Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('PromotionForm — human validation messages (HOS-190 BETA-190)', () => {
    it('renders a schema validation error as human Spanish, not a raw zodError.* key', async () => {
        render(
            <PromotionForm
                locale="es"
                mode="create"
            />
        );

        // Fill required fields so the explicit required-checks pass, but push
        // discountValue negative so the OwnerPromotion schema's `.min(0)` fires
        // (the path that previously surfaced `zodError.ownerPromotion.discountValue.min`).
        fireEvent.change(document.querySelector('[name="title"]') as HTMLInputElement, {
            target: { value: 'Oferta verano' }
        });
        fireEvent.change(document.querySelector('[name="discountType"]') as HTMLSelectElement, {
            target: { value: 'percentage' }
        });
        fireEvent.change(document.querySelector('[name="discountValue"]') as HTMLInputElement, {
            target: { value: '-5' }
        });
        fireEvent.change(document.querySelector('[name="validFrom"]') as HTMLInputElement, {
            target: { value: '2026-07-01' }
        });

        fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

        await waitFor(() => {
            expect(
                screen.getByText('El valor del descuento no puede ser negativo')
            ).toBeInTheDocument();
        });

        // The create endpoint must NOT be reached — validation blocked it.
        expect(mockCreate).not.toHaveBeenCalled();
        // No raw i18n key leaked into the DOM.
        expect(document.body.textContent ?? '').not.toMatch(/zodError\./);
    });
});
