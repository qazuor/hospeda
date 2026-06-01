/**
 * Tests for the plan delete confirmation dialogs — SPEC-168.
 *
 * Verifies that the soft-delete confirmation surfaces the plan's live
 * subscriber count (the dialog passes `{ count }` into the translation call so
 * the `{count}` token is interpolated), and that the dialogs only render when a
 * plan is provided.
 *
 * `@/hooks/use-translations` is mocked with a translator that performs the SAME
 * `{count}` interpolation as `@repo/i18n` at runtime. The jsdom test env does
 * not load locale data, so the real `useTranslations` returns raw keys — using
 * a faithful interpolating stub lets us assert the load-bearing behavior (the
 * count reaches the rendered copy) without depending on the i18n bundle.
 */

import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string, params?: Record<string, unknown>): string => {
            // The only key whose copy is load-bearing for these tests.
            const raw =
                key === 'admin-billing.plans.confirmSoftDeleteWithCount'
                    ? 'This plan has {count} active subscription(s).'
                    : key;
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k])),
                raw
            );
        }
    })
}));

import {
    HardDeleteConfirmDialog,
    SoftDeleteConfirmDialog
} from '../../../src/features/billing-plans/components/PlanDeleteDialogs';
import type { ParsedPlanRecord } from '../../../src/features/billing-plans/types';
import { renderWithProviders } from '../../helpers/render-with-providers';

/** Builds a ParsedPlanRecord with a given subscriber count. */
function makePlan(activeSubscriptionCount: number): ParsedPlanRecord {
    return {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        slug: 'owner-basico',
        name: 'Básico Propietario',
        description: 'Plan básico.',
        category: 'owner',
        monthlyPriceArs: 150000,
        annualPriceArs: null,
        monthlyPriceUsdRef: 12,
        hasTrial: false,
        trialDays: 0,
        isDefault: false,
        sortOrder: 1,
        entitlements: [],
        limits: [],
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
        isDeleted: false,
        activeSubscriptionCount
    };
}

describe('SoftDeleteConfirmDialog — subscriber count (SPEC-168)', () => {
    it('renders the dialog and interpolates the subscriber count', () => {
        // Arrange — a plan with 7 live subscribers
        const plan = makePlan(7);

        // Act
        renderWithProviders(
            <SoftDeleteConfirmDialog
                plan={plan}
                onCancel={() => {}}
                onConfirm={() => {}}
            />
        );

        // Assert — the dialog is open and the count is surfaced.
        const dialog = screen.getByRole('alertdialog');
        expect(dialog).toBeInTheDocument();
        // The {count} token must be replaced by the real number, never left raw.
        expect(dialog.textContent).toContain('This plan has 7 active subscription(s).');
        expect(dialog.textContent).not.toContain('{count}');
    });

    it('shows 0 when the plan has no live subscribers', () => {
        // Arrange
        const plan = makePlan(0);

        // Act
        renderWithProviders(
            <SoftDeleteConfirmDialog
                plan={plan}
                onCancel={() => {}}
                onConfirm={() => {}}
            />
        );

        // Assert
        const dialog = screen.getByRole('alertdialog');
        expect(dialog.textContent).toContain('This plan has 0 active subscription(s).');
        expect(dialog.textContent).not.toContain('{count}');
    });

    it('does not render when no plan is provided', () => {
        // Act
        renderWithProviders(
            <SoftDeleteConfirmDialog
                plan={null}
                onCancel={() => {}}
                onConfirm={() => {}}
            />
        );

        // Assert — closed dialog has no content in the DOM
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
});

describe('HardDeleteConfirmDialog (SPEC-168)', () => {
    it('renders a confirmation when a plan is provided', () => {
        // Act
        renderWithProviders(
            <HardDeleteConfirmDialog
                plan={makePlan(0)}
                onCancel={() => {}}
                onConfirm={() => {}}
            />
        );

        // Assert
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('does not render when no plan is provided', () => {
        // Act
        renderWithProviders(
            <HardDeleteConfirmDialog
                plan={null}
                onCancel={() => {}}
                onConfirm={() => {}}
            />
        );

        // Assert
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
});
