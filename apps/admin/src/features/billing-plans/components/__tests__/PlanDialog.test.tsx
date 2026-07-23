/**
 * PlanDialog — Model C edit-mode field lock (HOS-39 T-026).
 *
 * `category` and `isDefault` are capability-layer per Model C
 * (`MODEL_C_FIELD_SPLIT`) and were removed from `UpdatePlanInput` — the
 * service now silently ignores them on update. The dialog must not let an
 * operator believe they can change these fields once a plan exists: they
 * stay visible (so the current value is legible) but disabled in edit mode,
 * mirroring the existing `slug` field lock pattern.
 */

// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const addToastMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ addToast: addToastMock })
}));

import type { CreatePlanPayload, ParsedPlanRecord, PlanSubmitResult } from '../../types';
import { PlanDialog } from '../PlanDialog';

function basePlan(overrides: Partial<ParsedPlanRecord> = {}): ParsedPlanRecord {
    return {
        id: 'plan-uuid-1',
        slug: 'owner-basico',
        name: 'Básico',
        description: 'Plan básico',
        category: 'owner',
        monthlyPriceArs: 500000,
        annualPriceArs: null,
        monthlyPriceUsdRef: 5,
        hasTrial: false,
        trialDays: 0,
        entitlements: [],
        limits: [],
        isDefault: false,
        sortOrder: 1,
        isActive: true,
        ...overrides
    } as ParsedPlanRecord;
}

function renderDialog(
    plan: ParsedPlanRecord | null,
    onSubmit: (payload: CreatePlanPayload) => Promise<PlanSubmitResult> = vi.fn()
) {
    return render(
        <PlanDialog
            open={true}
            onOpenChange={vi.fn()}
            plan={plan}
            onSubmit={onSubmit}
        />
    );
}

/**
 * Submits the dialog's form directly via its `type="submit"` button.
 *
 * Deliberately NOT queried by translated label text: this unit suite runs
 * without the i18n translation bundle loaded, so `t()` renders raw dot-path
 * keys rather than actual copy — matching on a real Spanish/English string
 * would be fragile either way. Queried against `document` (not the RTL
 * `container`) because Radix's `DialogContent` portals into `document.body`.
 */
function submitForm() {
    const submitButton = document.querySelector('button[type="submit"]');
    if (!submitButton) {
        throw new Error('Expected a type="submit" button in the rendered dialog');
    }
    fireEvent.click(submitButton);
}

describe('PlanDialog — Model C edit-mode field lock (HOS-39 T-026)', () => {
    it('leaves category and isDefault ENABLED in create mode', () => {
        renderDialog(null);

        expect(screen.getByRole('combobox', { name: /category/i })).toBeEnabled();
        expect(screen.getByRole('switch', { name: /isDefault/i })).toBeEnabled();
    });

    it('disables category and isDefault in edit mode (capability-layer, no longer admin-editable)', () => {
        renderDialog(basePlan());

        expect(screen.getByRole('combobox', { name: /category/i })).toBeDisabled();
        expect(screen.getByRole('switch', { name: /isDefault/i })).toBeDisabled();
    });

    it('still disables the slug field in edit mode (pre-existing lock, unaffected by this change)', () => {
        renderDialog(basePlan());

        expect(screen.getByLabelText(/slug/i)).toBeDisabled();
    });
});

describe('PlanDialog — price-change impact toast (HOS-176)', () => {
    beforeEach(() => {
        addToastMock.mockClear();
    });

    it('fires a follow-up impact toast per price-change effect when onSubmit resolves non-empty', async () => {
        const onSubmit = vi.fn().mockResolvedValue({
            priceChangeEffects: [
                {
                    billingInterval: 'month',
                    direction: 'increase',
                    effectiveAt: '2026-08-01T00:00:00.000Z',
                    affectedSubscriberCount: 12
                }
            ]
        } satisfies PlanSubmitResult);

        renderDialog(basePlan(), onSubmit);

        submitForm();

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        await waitFor(() =>
            expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'info' }))
        );
        // Success toast fires too — the impact toast is a follow-up, not a replacement.
        expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));

        // The single info toast picked the INCREASE branch (message references the increase
        // key). The unit env renders raw i18n keys, so the key name is what surfaces.
        const infoCalls = addToastMock.mock.calls.filter(
            (c) => (c[0] as { variant?: string }).variant === 'info'
        );
        expect(infoCalls).toHaveLength(1);
        expect((infoCalls[0]?.[0] as { message: string }).message).toContain(
            'priceChangeImpactIncrease'
        );
    });

    it('fires ONE info toast per effect — two effects (monthly increase + annual decrease) → two toasts, each on the correct branch', async () => {
        const onSubmit = vi.fn().mockResolvedValue({
            priceChangeEffects: [
                {
                    billingInterval: 'month',
                    direction: 'increase',
                    effectiveAt: '2026-08-01T00:00:00.000Z',
                    affectedSubscriberCount: 12
                },
                {
                    billingInterval: 'year',
                    direction: 'decrease',
                    effectiveAt: '2026-07-23T00:00:00.000Z',
                    affectedSubscriberCount: 1
                }
            ]
        } satisfies PlanSubmitResult);

        renderDialog(basePlan(), onSubmit);
        submitForm();

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        await waitFor(() => {
            const infoCalls = addToastMock.mock.calls.filter(
                (c) => (c[0] as { variant?: string }).variant === 'info'
            );
            expect(infoCalls).toHaveLength(2);
        });
        const infoMessages = addToastMock.mock.calls
            .filter((c) => (c[0] as { variant?: string }).variant === 'info')
            .map((c) => (c[0] as { message: string }).message);
        // Both direction branches are exercised — one toast selects the increase message
        // key, one the decrease. (The unit env renders raw i18n keys, which don't surface the
        // interval, so this asserts branch coverage, not the interval↔direction pairing.)
        expect(infoMessages.some((m) => m.includes('priceChangeImpactIncrease'))).toBe(true);
        expect(infoMessages.some((m) => m.includes('priceChangeImpactDecrease'))).toBe(true);
    });

    it('does NOT fire an impact toast when onSubmit resolves with an empty priceChangeEffects array', async () => {
        const onSubmit = vi
            .fn()
            .mockResolvedValue({ priceChangeEffects: [] } satisfies PlanSubmitResult);

        renderDialog(basePlan(), onSubmit);

        submitForm();

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        await waitFor(() =>
            expect(addToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ variant: 'success' })
            )
        );
        expect(addToastMock).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'info' }));
    });
});
