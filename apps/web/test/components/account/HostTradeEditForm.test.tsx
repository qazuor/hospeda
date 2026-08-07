/**
 * @file HostTradeEditForm.test.tsx
 * @description RTL tests for the HostTradeEditForm React island (HOS-278 §8).
 *
 * Covers:
 * - Identity fields (name/slug/category) render disabled
 * - The benefit-atom rule: a benefitText-only edit still carries benefitType
 *   AND benefitValue in the PATCH payload (both at the pure-helper level and
 *   through a real form interaction)
 * - A non-numeric benefitType hides the number input and sends `benefitValue: null`
 * - A purely operational edit sends no benefit keys at all
 * - The pending-review block renders only when `benefitReviewState === 'pending'`
 */

import { HostTradeBenefitTypeEnum, HostTradeCategoryEnum } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostTradeEditForm } from '../../../src/components/account/HostTradeEditForm.client';
import {
    buildHostTradeEditSnapshot,
    buildHostTradeOwnerPatch
} from '../../../src/components/account/HostTradeEditForm.helpers';
import type { MyHostTrade } from '../../../src/lib/api/endpoints-protected';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/HostTradeEditForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

const mockUpdateMine = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    hostTradesApi: {
        updateMine: (...args: unknown[]) => mockUpdateMine(...args)
    }
}));

const mockAddToast = vi.fn();

vi.mock('../../../src/store/toast-store', () => ({
    addToast: (params: unknown) => mockAddToast(params)
}));

vi.mock('../../../src/lib/api-errors', () => ({
    translateApiError: ({ fallback }: { fallback?: string }) => fallback ?? 'error'
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_TRADE: MyHostTrade = {
    id: 'trade-1',
    slug: 'plomeria-juan',
    name: 'Plomería Juan',
    category: HostTradeCategoryEnum.PLOMERIA,
    contact: '+5493441112233',
    benefit: 'Válido de lunes a viernes.',
    benefitType: HostTradeBenefitTypeEnum.PERCENTAGE,
    benefitValue: 10,
    pendingBenefitType: null,
    pendingBenefitValue: null,
    pendingBenefitText: null,
    benefitReviewState: null,
    destinationId: 'dest-1',
    is24h: false,
    scheduleText: 'Lunes a Viernes 9 a 18',
    isActive: true,
    revokedAt: null,
    revokeReason: null
};

function renderForm(trade: MyHostTrade = BASE_TRADE) {
    return render(
        <HostTradeEditForm
            locale="es"
            trade={trade}
        />
    );
}

// ─── Pure helper tests ────────────────────────────────────────────────────────

describe('buildHostTradeOwnerPatch (pure)', () => {
    const baseline = buildHostTradeEditSnapshot(BASE_TRADE);

    it('returns {} when nothing changed', () => {
        expect(buildHostTradeOwnerPatch({ current: baseline, baseline })).toEqual({});
    });

    it('THE ATOM RULE: a benefitText-only change still carries benefitType AND benefitValue', () => {
        const current = { ...baseline, benefitText: 'Nuevo texto de condiciones' };
        const payload = buildHostTradeOwnerPatch({ current, baseline });
        expect(payload).toEqual({
            benefitType: HostTradeBenefitTypeEnum.PERCENTAGE,
            benefitValue: 10,
            benefitText: 'Nuevo texto de condiciones'
        });
    });

    it('a non-numeric benefitType sends benefitValue: null', () => {
        const current = { ...baseline, benefitType: HostTradeBenefitTypeEnum.TWO_FOR_ONE };
        const payload = buildHostTradeOwnerPatch({ current, baseline });
        expect(payload.benefitType).toBe(HostTradeBenefitTypeEnum.TWO_FOR_ONE);
        expect(payload.benefitValue).toBeNull();
    });

    it('a purely operational change sends no benefit keys at all', () => {
        const current = { ...baseline, contact: '+5493440009999' };
        const payload = buildHostTradeOwnerPatch({ current, baseline });
        expect(payload).toEqual({ contact: '+5493440009999' });
        expect(payload).not.toHaveProperty('benefitType');
        expect(payload).not.toHaveProperty('benefitValue');
        expect(payload).not.toHaveProperty('benefitText');
    });

    it('omits benefitType (never sends null) when the selection is cleared', () => {
        const current = { ...baseline, benefitType: '', benefitValue: '', benefitText: 'x' };
        const payload = buildHostTradeOwnerPatch({ current, baseline });
        expect(payload).not.toHaveProperty('benefitType');
        expect(payload.benefitValue).toBeNull();
    });
});

describe('buildHostTradeEditSnapshot (pure)', () => {
    it('seeds the benefit trio from the LIVE values when nothing is pending', () => {
        const snapshot = buildHostTradeEditSnapshot(BASE_TRADE);
        expect(snapshot.benefitType).toBe(HostTradeBenefitTypeEnum.PERCENTAGE);
        expect(snapshot.benefitValue).toBe('10');
        expect(snapshot.benefitText).toBe('Válido de lunes a viernes.');
    });

    it('seeds the benefit trio from the PENDING values when a review is in flight', () => {
        const pendingTrade: MyHostTrade = {
            ...BASE_TRADE,
            benefitReviewState: 'pending',
            pendingBenefitType: HostTradeBenefitTypeEnum.FIXED_AMOUNT,
            pendingBenefitValue: 500000,
            pendingBenefitText: 'Nuevo texto pendiente'
        };
        const snapshot = buildHostTradeEditSnapshot(pendingTrade);
        expect(snapshot.benefitType).toBe(HostTradeBenefitTypeEnum.FIXED_AMOUNT);
        expect(snapshot.benefitValue).toBe('500000');
        expect(snapshot.benefitText).toBe('Nuevo texto pendiente');
    });
});

// ─── Component tests ──────────────────────────────────────────────────────────

describe('HostTradeEditForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpdateMine.mockResolvedValue({ ok: true, data: { trade: BASE_TRADE } });
    });

    it('renders the identity fields (name/slug/category) as disabled', () => {
        renderForm();
        expect((screen.getByLabelText('Nombre') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByLabelText('Identificador (slug)') as HTMLInputElement).disabled).toBe(
            true
        );
        expect((screen.getByLabelText('Categoría') as HTMLInputElement).disabled).toBe(true);
    });

    it('pre-fills the identity fields with the trade values', () => {
        renderForm();
        expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Plomería Juan');
        expect((screen.getByLabelText('Identificador (slug)') as HTMLInputElement).value).toBe(
            'plomeria-juan'
        );
    });

    it('does NOT render destinationId or isActive fields', () => {
        renderForm();
        expect(screen.queryByText(/destinationId/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/isActive/i)).not.toBeInTheDocument();
    });

    it('shows the benefitValue number input when benefitType requires one (PERCENTAGE)', () => {
        renderForm();
        expect(screen.getByLabelText('Valor del beneficio')).toBeInTheDocument();
    });

    it('hides the benefitValue input after switching to a non-numeric benefitType', () => {
        renderForm();
        fireEvent.change(screen.getByLabelText('Beneficio para los anfitriones'), {
            target: { value: HostTradeBenefitTypeEnum.TWO_FOR_ONE }
        });
        expect(screen.queryByLabelText('Valor del beneficio')).not.toBeInTheDocument();
    });

    it('renders the pending-review block only when benefitReviewState is "pending"', () => {
        renderForm();
        expect(screen.queryByTestId('pending-benefit-review')).not.toBeInTheDocument();
    });

    it('renders the pending-review block when a benefit edit is awaiting review', () => {
        renderForm({
            ...BASE_TRADE,
            benefitReviewState: 'pending',
            pendingBenefitType: HostTradeBenefitTypeEnum.FIXED_AMOUNT,
            pendingBenefitValue: 500000,
            pendingBenefitText: 'Pendiente de revisión'
        });
        const pendingBlock = screen.getByTestId('pending-benefit-review');
        expect(pendingBlock).toBeInTheDocument();
        expect(pendingBlock.textContent).toContain('500000');
        expect(pendingBlock.textContent).toContain('Pendiente de revisión');
    });

    it('THE ATOM RULE end-to-end: editing only benefitText still submits benefitType and benefitValue', async () => {
        renderForm();

        fireEvent.change(screen.getByLabelText('Condiciones del beneficio (opcional)'), {
            target: { value: 'Condiciones actualizadas' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await vi.waitFor(() => expect(mockUpdateMine).toHaveBeenCalledTimes(1));
        expect(mockUpdateMine).toHaveBeenCalledWith(
            expect.objectContaining({
                benefitType: HostTradeBenefitTypeEnum.PERCENTAGE,
                benefitValue: 10,
                benefitText: 'Condiciones actualizadas'
            })
        );
    });

    it('a purely operational edit (contact only) submits no benefit keys', async () => {
        renderForm();

        fireEvent.change(screen.getByLabelText('Contacto'), {
            target: { value: '+5493440009999' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await vi.waitFor(() => expect(mockUpdateMine).toHaveBeenCalledTimes(1));
        const sentPayload = mockUpdateMine.mock.calls[0]?.[0];
        expect(sentPayload).toEqual({ contact: '+5493440009999' });
    });

    it('does not call the API when nothing changed', () => {
        renderForm();
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(mockUpdateMine).not.toHaveBeenCalled();
        expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));
    });
});
