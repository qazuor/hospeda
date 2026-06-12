/**
 * @file PromotionForm.test.tsx
 * @description Unit tests for the PromotionForm island (SPEC-205 T-308 — T-304).
 *
 * Covers:
 * - Renders all fields in create mode
 * - Validation error on empty required title
 * - Validation error when percentage discountValue > 100 (client-side guard)
 * - Successful create calls ownerPromotionApi.create() with the right body
 *   and redirects to /es/mi-cuenta/promociones/
 * - Edit mode pre-fills fields from initialData
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromotionForm } from '../../../src/components/host/PromotionForm.client';
import type { OwnerPromotionData } from '../../../src/lib/api/types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

/** Stub CSS modules — return className strings as-is. */
vi.mock('../../../src/components/host/PromotionForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

/** i18n: return the fallback string so assertions can use human-readable text. */
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

/** ownerPromotionApi: intercept create / update — controlled by each test. */
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    ownerPromotionApi: {
        create: (...args: unknown[]) => mockCreate(...args),
        update: (...args: unknown[]) => mockUpdate(...args)
    }
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal valid form state for a create submission. */
function fillCreateFields() {
    fireEvent.change(screen.getByLabelText(/Título/i), {
        target: { value: 'Oferta verano' }
    });
    fireEvent.change(screen.getByRole('combobox', { name: /Tipo de descuento/i }), {
        target: { value: 'percentage' }
    });
    fireEvent.change(screen.getByLabelText(/Valor del descuento/i), {
        target: { value: '20' }
    });
    fireEvent.change(screen.getByLabelText(/Válido desde/i), {
        target: { value: '2026-07-01' }
    });
}

/** Convenience: get the submit button by its label text. */
function getSubmitButton(): HTMLElement {
    return screen.getByRole('button', { name: /Guardar/i });
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();

    // Provide a writable window.location stub — JSDOM blocks direct assignment.
    Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PromotionForm — create mode', () => {
    it('renders all expected fields', () => {
        // Arrange + Act
        render(
            <PromotionForm
                locale="es"
                mode="create"
            />
        );

        // Assert — each field is present
        expect(screen.getByLabelText(/Título/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Descripción/i)).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /Tipo de descuento/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/Valor del descuento/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Válido desde/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Válido hasta/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Noches mínimas/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Usos máximos/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Propiedad/i)).toBeInTheDocument();

        // Actions
        expect(getSubmitButton()).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Cancelar/i })).toBeInTheDocument();
    });

    it('shows validation error when title is empty on submit', async () => {
        // Arrange
        render(
            <PromotionForm
                locale="es"
                mode="create"
            />
        );

        // Act — submit without filling title
        fireEvent.click(getSubmitButton());

        // Assert — Zod error for title should appear
        await waitFor(() => {
            const titleErrors = screen.queryAllByRole('alert');
            // There should be at least one alert (title required)
            expect(titleErrors.length).toBeGreaterThan(0);
        });

        // API must not have been called
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('shows field error when percentage discountValue exceeds 100', async () => {
        // Arrange
        render(
            <PromotionForm
                locale="es"
                mode="create"
            />
        );

        // Act — fill all required fields but set discountValue > 100 with percentage type
        fireEvent.change(screen.getByLabelText(/Título/i), {
            target: { value: 'Mega descuento' }
        });
        fireEvent.change(screen.getByRole('combobox', { name: /Tipo de descuento/i }), {
            target: { value: 'percentage' }
        });
        fireEvent.change(screen.getByLabelText(/Valor del descuento/i), {
            target: { value: '150' }
        });
        fireEvent.change(screen.getByLabelText(/Válido desde/i), {
            target: { value: '2026-07-01' }
        });

        fireEvent.click(getSubmitButton());

        // Assert — client-side guard fires before Zod / API
        await waitFor(() => {
            expect(screen.getByText(/El porcentaje no puede superar 100/i)).toBeInTheDocument();
        });

        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('calls ownerPromotionApi.create with correct body and redirects on success', async () => {
        // Arrange
        mockCreate.mockResolvedValueOnce({ ok: true, data: { id: 'new-promo-id' } });

        render(
            <PromotionForm
                locale="es"
                mode="create"
            />
        );

        fillCreateFields();

        // Act
        fireEvent.click(getSubmitButton());

        // Assert — wait for redirect
        await waitFor(() => {
            expect(window.location.href).toBe('/es/mi-cuenta/promociones/');
        });

        // Verify the API was called with the right shape
        expect(mockCreate).toHaveBeenCalledOnce();
        const callArg = mockCreate.mock.calls[0][0] as { body: Record<string, unknown> };
        expect(callArg.body).toMatchObject({
            title: 'Oferta verano',
            discountType: 'percentage',
            discountValue: 20
        });
        expect(callArg.body.validFrom).toBeDefined();
    });

    it('shows generic form-error banner when create API returns non-ok', async () => {
        // Arrange
        mockCreate.mockResolvedValueOnce({
            ok: false,
            error: { status: 500, message: 'Internal server error' }
        });

        render(
            <PromotionForm
                locale="es"
                mode="create"
            />
        );

        fillCreateFields();

        // Act
        fireEvent.click(getSubmitButton());

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('alert', { name: undefined })).toBeInTheDocument();
        });

        // Location must NOT have changed
        expect(window.location.href).toBe('');
    });

    it('shows LIMIT_REACHED banner with upgrade hint on 403 LIMIT_REACHED', async () => {
        // Arrange
        mockCreate.mockResolvedValueOnce({
            ok: false,
            error: { status: 403, code: 'LIMIT_REACHED', message: 'Limit reached' }
        });

        render(
            <PromotionForm
                locale="es"
                mode="create"
            />
        );

        fillCreateFields();

        // Act
        fireEvent.click(getSubmitButton());

        // Assert — the upgrade hint appears (distinct from generic error)
        await waitFor(() => {
            expect(
                screen.getByText(/Alcanzaste el límite de promociones activas/i)
            ).toBeInTheDocument();
        });

        expect(window.location.href).toBe('');
    });
});

describe('PromotionForm — edit mode', () => {
    const INITIAL_DATA: OwnerPromotionData = {
        id: 'promo-uuid-1',
        slug: 'oferta-verano',
        ownerId: 'owner-uuid-1',
        accommodationId: null,
        title: 'Oferta de verano',
        description: 'Descuento especial para el verano',
        discountType: 'percentage',
        discountValue: 15,
        minNights: 3,
        validFrom: '2026-07-01T00:00:00.000Z',
        validUntil: '2026-08-31T00:00:00.000Z',
        maxRedemptions: 50,
        currentRedemptions: 5,
        lifecycleState: 'ACTIVE',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z'
    };

    it('pre-fills all fields from initialData', () => {
        // Arrange + Act
        render(
            <PromotionForm
                locale="es"
                mode="edit"
                initialData={INITIAL_DATA}
                promotionId="promo-uuid-1"
            />
        );

        // Assert — text inputs
        expect(screen.getByLabelText(/Título/i)).toHaveValue('Oferta de verano');
        expect(screen.getByLabelText(/Descripción/i)).toHaveValue(
            'Descuento especial para el verano'
        );

        // Select
        expect(screen.getByRole('combobox', { name: /Tipo de descuento/i })).toHaveValue(
            'percentage'
        );

        // Number input
        expect(screen.getByLabelText(/Valor del descuento/i)).toHaveValue(15);
        expect(screen.getByLabelText(/Noches mínimas/i)).toHaveValue(3);
        expect(screen.getByLabelText(/Usos máximos/i)).toHaveValue(50);

        // Date inputs
        expect(screen.getByLabelText(/Válido desde/i)).toHaveValue('2026-07-01');
        expect(screen.getByLabelText(/Válido hasta/i)).toHaveValue('2026-08-31');
    });

    it('calls ownerPromotionApi.update (not create) on submit', async () => {
        // Arrange
        mockUpdate.mockResolvedValueOnce({ ok: true, data: { id: 'promo-uuid-1' } });

        render(
            <PromotionForm
                locale="es"
                mode="edit"
                initialData={INITIAL_DATA}
                promotionId="promo-uuid-1"
            />
        );

        // Act — submit without changes (all fields already valid from initialData)
        fireEvent.click(getSubmitButton());

        // Assert — update called, create NOT called
        await waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledOnce();
        });

        expect(mockCreate).not.toHaveBeenCalled();

        const callArg = mockUpdate.mock.calls[0][0] as {
            id: string;
            body: Record<string, unknown>;
        };
        expect(callArg.id).toBe('promo-uuid-1');
        expect(callArg.body).toMatchObject({
            title: 'Oferta de verano',
            discountType: 'percentage',
            discountValue: 15
        });

        // Redirect on success
        expect(window.location.href).toBe('/es/mi-cuenta/promociones/');
    });
});
