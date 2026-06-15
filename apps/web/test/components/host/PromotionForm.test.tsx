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

/** ownerPromotionApi: intercept create / update / getById — controlled by each test. */
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockGetById = vi.fn();

/** protectedAccommodationsApi: intercept listOwn — returns empty list by default. */
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

    // Default: listOwn returns an empty list — no accommodations loaded yet.
    // Individual tests that need accommodations will override this.
    mockListOwn.mockResolvedValue({
        ok: true,
        data: { items: [], total: 0, page: 1, pageSize: 100 }
    });

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

    it('shows ENTITLEMENT_REQUIRED upgrade banner with plans link on 403', async () => {
        // Arrange — host whose plan does not include promotions (bug #4): the
        // form must surface an upgrade prompt + plans link, not a generic
        // "could not save" message the host would retry forever.
        mockCreate.mockResolvedValueOnce({
            ok: false,
            error: {
                status: 403,
                code: 'ENTITLEMENT_REQUIRED',
                message:
                    "Access denied. This feature requires the 'create_promotions' entitlement.",
                details: { requiredEntitlement: 'create_promotions', upgradeUrl: '/billing/plans' }
            }
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

        // Assert — upgrade banner + localized hint + web plans link (not the
        // backend /billing/plans path); backend technical message must not leak.
        await waitFor(() => {
            expect(screen.getByText('Tu plan no incluye promociones.')).toBeInTheDocument();
        });
        expect(screen.getByText(/Mejorá tu plan para crear promociones/i)).toBeInTheDocument();
        const plansLink = screen.getByRole('link', { name: /ver planes/i });
        expect(plansLink).toHaveAttribute('href', '/es/suscriptores/planes/');
        expect(
            screen.queryByText(/requires the 'create_promotions' entitlement/i)
        ).not.toBeInTheDocument();
        expect(window.location.href).toBe('');
    });

    it('renders the accommodation select with "all properties" option when listOwn returns empty', async () => {
        // Arrange — default mock already returns empty list
        render(
            <PromotionForm
                locale="es"
                mode="create"
            />
        );

        // Wait for listOwn to resolve and select to update
        await waitFor(() => {
            const select = screen.getByRole('combobox', { name: /Propiedad/i });
            expect(select).toBeInTheDocument();
        });

        const select = screen.getByRole('combobox', { name: /Propiedad/i });
        const options = select.querySelectorAll('option');
        // Only the "all properties" option should be present
        expect(options).toHaveLength(1);
        expect(options[0]).toHaveValue('');
        expect(options[0]).toHaveTextContent('Todas mis propiedades');
    });

    it('renders accommodation options from listOwn in the select', async () => {
        // Arrange — override with two accommodations
        mockListOwn.mockResolvedValueOnce({
            ok: true,
            data: {
                items: [
                    { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Casa del lago' },
                    { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', name: 'Cabaña del bosque' }
                ],
                total: 2,
                page: 1,
                pageSize: 100
            }
        });

        render(
            <PromotionForm
                locale="es"
                mode="create"
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('option', { name: 'Casa del lago' })).toBeInTheDocument();
        });

        expect(screen.getByRole('option', { name: 'Todas mis propiedades' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Cabaña del bosque' })).toBeInTheDocument();
    });

    it('sends selected accommodationId in create payload when one is chosen', async () => {
        // Arrange — use a real UUID so Zod validation passes
        const ACC_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        mockListOwn.mockResolvedValueOnce({
            ok: true,
            data: {
                items: [{ id: ACC_UUID, name: 'Casa del lago' }],
                total: 1,
                page: 1,
                pageSize: 100
            }
        });
        mockCreate.mockResolvedValueOnce({ ok: true, data: { id: 'new-promo-id' } });

        render(
            <PromotionForm
                locale="es"
                mode="create"
            />
        );

        // Wait for options to load
        await waitFor(() => {
            expect(screen.getByRole('option', { name: 'Casa del lago' })).toBeInTheDocument();
        });

        // Fill required fields and select a specific accommodation
        fillCreateFields();
        fireEvent.change(screen.getByRole('combobox', { name: /Propiedad/i }), {
            target: { value: ACC_UUID }
        });

        // Act
        fireEvent.click(getSubmitButton());

        await waitFor(() => {
            expect(window.location.href).toBe('/es/mi-cuenta/promociones/');
        });

        const callArg = mockCreate.mock.calls[0][0] as { body: Record<string, unknown> };
        expect(callArg.body.accommodationId).toBe(ACC_UUID);
    });

    it('omits accommodationId from payload when "all properties" is selected', async () => {
        // Arrange — default mock returns empty list (all properties selected = empty value)
        mockCreate.mockResolvedValueOnce({ ok: true, data: { id: 'new-promo-id' } });

        render(
            <PromotionForm
                locale="es"
                mode="create"
            />
        );

        await waitFor(() => {
            const select = screen.getByRole('combobox', { name: /Propiedad/i });
            // Select is not disabled (list loaded)
            expect(select).not.toBeDisabled();
        });

        fillCreateFields();

        fireEvent.click(getSubmitButton());

        await waitFor(() => {
            expect(window.location.href).toBe('/es/mi-cuenta/promociones/');
        });

        const callArg = mockCreate.mock.calls[0][0] as { body: Record<string, unknown> };
        // Empty string maps to undefined — should not be in the payload
        expect(callArg.body.accommodationId).toBeUndefined();
    });

    it('falls back gracefully to "all properties" only when listOwn fails', async () => {
        // Arrange — simulate network failure
        mockListOwn.mockResolvedValueOnce({ ok: false, error: { message: 'Network error' } });

        render(
            <PromotionForm
                locale="es"
                mode="create"
            />
        );

        // Wait for the error path to resolve
        await waitFor(() => {
            const select = screen.getByRole('combobox', { name: /Propiedad/i });
            expect(select).not.toBeDisabled();
        });

        const select = screen.getByRole('combobox', { name: /Propiedad/i });
        const options = select.querySelectorAll('option');
        // Only the "all properties" fallback option
        expect(options).toHaveLength(1);
        expect(options[0]).toHaveValue('');
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

    it('fetches promotion via getById when no initialData is provided and shows loading indicator', async () => {
        // Arrange — getById never resolves (simulates in-flight fetch)
        mockGetById.mockReturnValue(new Promise(() => {}));

        render(
            <PromotionForm
                locale="es"
                mode="edit"
                promotionId="promo-uuid-1"
            />
        );

        // Assert — loading indicator is shown, form is not rendered
        expect(screen.getByText(/Cargando promoción/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/Título/i)).not.toBeInTheDocument();

        // Confirm getById was called with the correct id
        expect(mockGetById).toHaveBeenCalledWith({ id: 'promo-uuid-1' });
    });

    it('prefills fields via getById when no initialData is provided', async () => {
        // Arrange — getById resolves with a raw API response
        const rawApiResponse = {
            id: INITIAL_DATA.id,
            slug: INITIAL_DATA.slug,
            ownerId: INITIAL_DATA.ownerId,
            accommodationId: null,
            title: INITIAL_DATA.title,
            description: INITIAL_DATA.description,
            discountType: INITIAL_DATA.discountType,
            discountValue: INITIAL_DATA.discountValue,
            minNights: INITIAL_DATA.minNights,
            validFrom: INITIAL_DATA.validFrom,
            validUntil: INITIAL_DATA.validUntil,
            maxRedemptions: INITIAL_DATA.maxRedemptions,
            currentRedemptions: INITIAL_DATA.currentRedemptions,
            lifecycleState: INITIAL_DATA.lifecycleState,
            createdAt: INITIAL_DATA.createdAt,
            updatedAt: INITIAL_DATA.updatedAt
        };
        mockGetById.mockResolvedValueOnce({ ok: true, data: rawApiResponse });

        render(
            <PromotionForm
                locale="es"
                mode="edit"
                promotionId="promo-uuid-1"
            />
        );

        // Wait for the fetch to complete and the form to appear
        await waitFor(() => {
            expect(screen.getByLabelText(/Título/i)).toBeInTheDocument();
        });

        // Assert — form is pre-filled from the fetched data
        expect(screen.getByLabelText(/Título/i)).toHaveValue('Oferta de verano');
        expect(screen.getByRole('combobox', { name: /Tipo de descuento/i })).toHaveValue(
            'percentage'
        );
        expect(screen.getByLabelText(/Valor del descuento/i)).toHaveValue(15);
    });

    it('shows localized not-found error when getById returns 404 without initialData', async () => {
        // Arrange — backend 404 carries a technical message that must NOT leak
        // (bug #3 regression): the status is mapped to a localized string.
        mockGetById.mockResolvedValueOnce({
            ok: false,
            error: { status: 404, message: 'Promotion not found' }
        });

        render(
            <PromotionForm
                locale="es"
                mode="edit"
                promotionId="promo-uuid-1"
            />
        );

        // Assert — error state shown, form not rendered
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
        expect(screen.getByText('No se encontró la promoción.')).toBeInTheDocument();
        expect(screen.queryByText('Promotion not found')).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Título/i)).not.toBeInTheDocument();
    });
});
