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

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ addToast: vi.fn() })
}));

import type { ParsedPlanRecord } from '../../types';
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

function renderDialog(plan: ParsedPlanRecord | null) {
    render(
        <PlanDialog
            open={true}
            onOpenChange={vi.fn()}
            plan={plan}
            onSubmit={vi.fn()}
        />
    );
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
