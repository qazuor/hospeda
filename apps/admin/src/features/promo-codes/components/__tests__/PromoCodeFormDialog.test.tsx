/**
 * PromoCodeFormDialog — typed effect engine tests (SPEC-262 T-010).
 *
 * Verifies the effect-type selector + conditional parameter panels and the
 * client-side validation that mirrors `PromoEffectSchema` (AC-5.1..AC-5.4).
 * i18n is mocked globally in test/setup.tsx so `t(key)` returns the raw key,
 * which the assertions match against.
 */

// @vitest-environment jsdom

import { PromoEffectKindEnum } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// usePlansQuery needs a QueryClient; mock the feature to return empty plans.
vi.mock('@/features/billing-plans', () => ({
    usePlansQuery: () => ({ data: { items: [] } })
}));

import type { PromoCode } from '@/features/promo-codes';
import { PromoCodeFormDialog } from '../PromoCodeFormDialog';

const EFFECT = {
    discountValue: /promoCodes\.form\.valueLabel/i,
    durationCycles: /promoCodes\.form\.effect\.durationCyclesLabel/i,
    extraDays: /promoCodes\.form\.effect\.extraDaysLabel/i
};

function baseCode(overrides: Partial<PromoCode> = {}): PromoCode {
    return {
        id: '11111111-1111-1111-1111-111111111111',
        code: 'PROMO10',
        type: 'percentage',
        value: 10,
        description: 'desc',
        active: true,
        expiresAt: null,
        validFrom: null,
        maxUses: null,
        maxUsesPerUser: null,
        timesRedeemed: 0,
        validPlans: [],
        newCustomersOnly: false,
        isStackable: false,
        minAmount: null,
        status: 'active',
        ...overrides
    };
}

function renderDialog(promoCode: PromoCode | null, onSubmit = vi.fn()) {
    render(
        <PromoCodeFormDialog
            promoCode={promoCode}
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={onSubmit}
        />
    );
    return { onSubmit };
}

describe('PromoCodeFormDialog — typed effect (SPEC-262 T-010)', () => {
    it('shows the discount panel by default on create (value + cycles)', () => {
        renderDialog(null);

        expect(screen.getByLabelText(EFFECT.discountValue)).toBeInTheDocument();
        expect(screen.getByLabelText(EFFECT.durationCycles)).toBeInTheDocument();
        expect(screen.queryByLabelText(EFFECT.extraDays)).not.toBeInTheDocument();
    });

    it('hydrates a trial_extension code and hides value/cycles, shows extraDays', () => {
        renderDialog(
            baseCode({ effect: { kind: PromoEffectKindEnum.TRIAL_EXTENSION, extraDays: 45 } })
        );

        const extraDays = screen.getByLabelText(EFFECT.extraDays) as HTMLInputElement;
        expect(extraDays).toBeInTheDocument();
        expect(extraDays.value).toBe('45');
        expect(screen.queryByLabelText(EFFECT.discountValue)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(EFFECT.durationCycles)).not.toBeInTheDocument();
    });

    it('hydrates a comp code and hides all parameter inputs', () => {
        renderDialog(baseCode({ effect: { kind: PromoEffectKindEnum.COMP } }));

        expect(screen.queryByLabelText(EFFECT.discountValue)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(EFFECT.durationCycles)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(EFFECT.extraDays)).not.toBeInTheDocument();
    });

    it('blocks submit when a percentage discount exceeds 100', async () => {
        const { onSubmit } = renderDialog(null);

        fireEvent.change(screen.getByLabelText(/promoCodes\.form\.codeLabel/i), {
            target: { value: 'BIG' }
        });
        fireEvent.change(screen.getByLabelText(/promoCodes\.form\.descriptionLabel/i), {
            target: { value: 'too big' }
        });
        fireEvent.change(screen.getByLabelText(EFFECT.discountValue), {
            target: { value: '150' }
        });

        const form = screen.getByLabelText(EFFECT.discountValue).closest('form');
        if (form) fireEvent.submit(form);

        await waitFor(() => {
            expect(
                screen.getByText(/promoCodes\.form\.effect\.validationError/i)
            ).toBeInTheDocument();
        });
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits a valid discount with the assembled effect fields', async () => {
        const { onSubmit } = renderDialog(null);

        fireEvent.change(screen.getByLabelText(/promoCodes\.form\.codeLabel/i), {
            target: { value: 'promo' }
        });
        fireEvent.change(screen.getByLabelText(/promoCodes\.form\.descriptionLabel/i), {
            target: { value: 'half off' }
        });
        fireEvent.change(screen.getByLabelText(EFFECT.discountValue), {
            target: { value: '50' }
        });

        const form = screen.getByLabelText(EFFECT.discountValue).closest('form');
        if (form) fireEvent.submit(form);

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'PROMO',
                effectKind: 'discount',
                valueKind: 'percentage',
                discountValue: 50,
                durationForever: false
            })
        );
    });

    it('hydrates a legacy code (no typed effect) as a one-shot discount', () => {
        renderDialog(baseCode({ type: 'fixed', value: 500, effect: undefined }));

        const value = screen.getByLabelText(EFFECT.discountValue) as HTMLInputElement;
        expect(value.value).toBe('500');
        expect(screen.queryByLabelText(EFFECT.extraDays)).not.toBeInTheDocument();
    });

    it('blocks submit when trial_extension extraDays is below 1', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderDialog(null);

        // Open the effect-kind selector and choose trial_extension.
        await user.click(screen.getByLabelText(/promoCodes\.form\.effect\.kindLabel/i));
        await user.click(
            screen.getByRole('option', {
                name: /promoCodes\.form\.effect\.kindTrialExtension/i
            })
        );

        const extraDays = await screen.findByLabelText(EFFECT.extraDays);
        fireEvent.change(extraDays, { target: { value: '0' } });

        const form = extraDays.closest('form');
        if (form) fireEvent.submit(form);

        await waitFor(() => {
            expect(
                screen.getByText(/promoCodes\.form\.effect\.validationError/i)
            ).toBeInTheDocument();
        });
        expect(onSubmit).not.toHaveBeenCalled();
    });
});
