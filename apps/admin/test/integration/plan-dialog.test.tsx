/**
 * PlanDialog Integration Tests - Create Mode
 *
 * Tests the plan creation dialog form: rendering, field interaction,
 * validation, and submit payload correctness.
 *
 * @module test/integration/plan-dialog
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/render-with-providers';

/**
 * ResizeObserver polyfill for jsdom.
 * Radix UI Select uses ResizeObserver internally via @radix-ui/react-use-size.
 */
beforeAll(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
        globalThis.ResizeObserver = class ResizeObserver {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    }
});

/**
 * Override the global Proxy-based @repo/icons mock.
 * The Proxy mock causes an infinite hang when used with Radix Select
 * inside forwardRef + JSX. Explicit named exports fix the issue.
 */
vi.mock('@repo/icons', () => {
    const icon = (name: string) => (props: Record<string, unknown>) =>
        React.createElement('span', {
            ...props,
            'data-testid': `icon-${name}`,
            'aria-hidden': 'true'
        });
    return {
        CheckIcon: icon('CheckIcon'),
        ChevronDownIcon: icon('ChevronDownIcon'),
        ChevronUpIcon: icon('ChevronUpIcon'),
        CloseIcon: icon('CloseIcon'),
        LoaderIcon: icon('LoaderIcon')
    };
});

/**
 * Mock @repo/billing to avoid side-effect-heavy imports (MercadoPago adapter,
 * @repo/config, @repo/logger). We provide the exact enum values and metadata
 * that PlanDialog and plan-entitlement-groups consume.
 */
vi.mock('@repo/billing', async () => {
    // Import the REAL enum and metadata from the side-effect-free modules
    // instead of restating them. The hand-written copies had drifted: they were
    // missing the AI suite and five tourist entitlements, so every key added to
    // `ENTITLEMENT_GROUP_KEYS` resolved to `undefined` here and the dialog threw
    // on `key.replace(...)`. A mock that duplicates the thing it mocks is the
    // same defect this branch spent its time removing from marketing copy.
    //
    // `@repo/billing`'s barrel is what pulls in the MercadoPago adapter,
    // `@repo/config` and `@repo/logger`; these three modules import nothing but
    // each other, so reaching them directly keeps the mock cheap.
    const { EntitlementKey } = await import(
        '../../../../packages/billing/src/types/entitlement.types.js'
    );
    const { LimitKey } = await import('../../../../packages/billing/src/types/plan.types.js');
    const { ENTITLEMENT_DEFINITIONS } = await import(
        '../../../../packages/billing/src/config/entitlements.config.js'
    );
    const { LIMIT_METADATA } = await import(
        '../../../../packages/billing/src/config/limits.config.js'
    );

    return { EntitlementKey, LimitKey, ENTITLEMENT_DEFINITIONS, LIMIT_METADATA };
});

import { PlanDialog } from '@/features/billing-plans/components/PlanDialog';

describe('PlanDialog', () => {
    describe('Create mode (plan = null)', () => {
        it('renders dialog with create title and empty fields when open', () => {
            // Arrange & Act
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={vi.fn()}
                />
            );

            // Assert - dialog is visible
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            // Assert - create mode title (translation mock returns keys as-is)
            expect(screen.getByText('admin-billing.plans.dialog.createTitle')).toBeInTheDocument();

            // Assert - create mode description
            expect(
                screen.getByText('admin-billing.plans.dialog.createDescription')
            ).toBeInTheDocument();

            // Assert - basic info fields are present and empty
            const slugInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.slug/);
            expect(slugInput).toHaveValue('');
            expect(slugInput).not.toBeDisabled();

            const nameInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.name/);
            expect(nameInput).toHaveValue('');

            // Assert - create button is shown (not save button)
            expect(
                screen.getByRole('button', { name: 'admin-billing.plans.dialog.createButton' })
            ).toBeInTheDocument();

            // Assert - cancel button is present
            expect(
                screen.getByRole('button', { name: 'admin-billing.plans.dialog.cancelButton' })
            ).toBeInTheDocument();
        });

        it('does not render dialog when open is false', () => {
            // Arrange & Act
            renderWithProviders(
                <PlanDialog
                    open={false}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={vi.fn()}
                />
            );

            // Assert
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        // SPEC-103 T-090 RESOLVED: the original test used `user.type()` 4
        // times across the form fields (~45 keypresses total). In jsdom
        // each keystroke triggers a TanStack Form state update + Zod
        // validation re-render, which compounds well past the 5000ms
        // vitest default. Replaced with `fireEvent.change` for the
        // value-setting steps — same final state, single render per
        // field. userEvent.setup() is still used for the few interactions
        // (Select dropdowns, button clicks) that genuinely benefit from
        // the higher-fidelity simulation, but for plain text inputs the
        // change event is faithful and orders of magnitude faster.
        it('calls onSubmit with correct payload on valid submit', async () => {
            // Arrange
            const onSubmit = vi.fn().mockResolvedValue(undefined);

            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={onSubmit}
                />
            );

            // Act - fill required fields via fireEvent.change (fast path).
            const slugInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.slug/
            ) as HTMLInputElement;
            const nameInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.name/
            ) as HTMLInputElement;
            const descriptionInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.description/
            ) as HTMLInputElement | HTMLTextAreaElement;
            const monthlyArsInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.monthlyArs/
            ) as HTMLInputElement;

            fireEvent.change(slugInput, { target: { value: 'test-plan' } });
            fireEvent.change(nameInput, { target: { value: 'Test Plan' } });
            fireEvent.change(descriptionInput, {
                target: { value: 'A test plan description' }
            });
            fireEvent.change(monthlyArsInput, { target: { value: '5000' } });

            // Act - submit the form via fireEvent (TanStack Form handleSubmit is async)
            const form = screen.getByRole('dialog').querySelector('form');
            expect(form).not.toBeNull();
            fireEvent.submit(form!);

            // Assert
            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledTimes(1);
            });

            const payload = onSubmit.mock.calls[0][0];
            expect(payload.slug).toBe('test-plan');
            expect(payload.name).toBe('Test Plan');
            expect(payload.description).toBe('A test plan description');
            // monthlyPriceArs is multiplied by 100 (centavos conversion)
            expect(payload.monthlyPriceArs).toBe(500000);
            // Default category is 'owner'
            expect(payload.category).toBe('owner');
            // Default isActive is true
            expect(payload.isActive).toBe(true);
        });

        it('calls onOpenChange when cancel button is clicked', async () => {
            // Arrange
            const user = userEvent.setup();
            const onOpenChange = vi.fn();

            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={onOpenChange}
                    plan={null}
                    onSubmit={vi.fn()}
                />
            );

            // Act
            const cancelButton = screen.getByRole('button', {
                name: 'admin-billing.plans.dialog.cancelButton'
            });
            await user.click(cancelButton);

            // Assert
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });

        it('disables submit and cancel buttons when isSubmitting is true', () => {
            // Arrange & Act
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={vi.fn()}
                    isSubmitting={true}
                />
            );

            // Assert
            const submitButton = screen.getByRole('button', {
                name: /admin-billing\.plans\.dialog\.createButton/
            });
            const cancelButton = screen.getByRole('button', {
                name: 'admin-billing.plans.dialog.cancelButton'
            });

            expect(submitButton).toBeDisabled();
            expect(cancelButton).toBeDisabled();
        });

        it('renders all form sections', () => {
            // Arrange & Act
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={vi.fn()}
                />
            );

            // Assert - section headings are present
            expect(
                screen.getByText('admin-billing.plans.dialog.sections.basicInfo')
            ).toBeInTheDocument();
            expect(
                screen.getByText('admin-billing.plans.dialog.sections.pricing')
            ).toBeInTheDocument();
            expect(
                screen.getByText('admin-billing.plans.dialog.sections.trial')
            ).toBeInTheDocument();
            expect(
                screen.getByText('admin-billing.plans.dialog.sections.entitlements')
            ).toBeInTheDocument();
            expect(
                screen.getByText('admin-billing.plans.dialog.sections.limits')
            ).toBeInTheDocument();
            expect(
                screen.getByText('admin-billing.plans.dialog.sections.configuration')
            ).toBeInTheDocument();
        });

        it('renders pricing fields with default zero values', () => {
            // Arrange & Act
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={vi.fn()}
                />
            );

            // Assert
            const monthlyArsInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.monthlyArs/
            );
            const annualArsInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.annualArs/
            );
            const usdRefInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.usdRef/
            );

            expect(monthlyArsInput).toHaveValue(0);
            expect(annualArsInput).toHaveValue(0);
            expect(usdRefInput).toHaveValue(0);
        });

        it('renders trial fields with trial disabled by default', () => {
            // Arrange & Act
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={vi.fn()}
                />
            );

            // Assert - trial days input is disabled when hasTrial is false
            const trialDaysInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.trialDays/
            );
            expect(trialDaysInput).toBeDisabled();
        });

        it('enables trial days input when plan has trial enabled', () => {
            // Arrange - provide a plan with hasTrial: true to verify conditional rendering.
            // Note: Radix Switch click events do not propagate correctly in jsdom,
            // so we test the enabled/disabled state via the plan prop instead.
            const planWithTrial = {
                slug: 'trial-plan',
                name: 'Trial Plan',
                description: 'Plan with trial',
                category: 'owner' as const,
                monthlyPriceArs: 100000,
                annualPriceArs: 1000000,
                monthlyPriceUsdRef: 100,
                hasTrial: true,
                trialDays: 14,
                isDefault: false,
                sortOrder: 0,
                isActive: true,
                entitlements: [],
                limits: [],
                id: '11111111-1111-4111-8111-111111111111',
                createdAt: '2026-05-30T00:00:00.000Z',
                updatedAt: '2026-05-30T00:00:00.000Z',
                isDeleted: false,
                activeSubscriptionCount: 0
            };

            // Act
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={planWithTrial}
                    onSubmit={vi.fn()}
                />
            );

            // Assert - trial days input is enabled because hasTrial defaults to true
            const trialDaysInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.trialDays/
            );
            expect(trialDaysInput).not.toBeDisabled();
            expect(trialDaysInput).toHaveValue(14);
        });

        it('renders category select with default owner value', () => {
            // Arrange & Act
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={vi.fn()}
                />
            );

            // Assert - category combobox is present
            const categoryTrigger = screen.getByRole('combobox', {
                name: /admin-billing\.plans\.dialog\.fields\.category/
            });
            expect(categoryTrigger).toBeInTheDocument();

            // Default value is 'owner' - Radix Select renders both a visible span and a hidden option
            const ownerLabels = screen.getAllByText('admin-billing.plans.categoryLabels.owner');
            expect(ownerLabels.length).toBeGreaterThanOrEqual(1);
        });

        it('renders entitlement checkboxes unchecked by default', () => {
            // Arrange & Act
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={vi.fn()}
                />
            );

            // Assert - all entitlement checkboxes should be unchecked
            const dialog = screen.getByRole('dialog');
            const checkboxes = within(dialog).getAllByRole('checkbox');
            for (const checkbox of checkboxes) {
                expect(checkbox).not.toBeChecked();
            }
        });

        it('submits with hasTrial false and trialDays 0 when trial is not enabled', async () => {
            // Arrange
            const user = userEvent.setup();
            const onSubmit = vi.fn().mockResolvedValue(undefined);

            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={onSubmit}
                />
            );

            // Act - fill minimum fields
            const slugInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.slug/);
            const nameInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.name/);
            const descriptionInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.description/
            );

            await user.clear(slugInput);
            await user.type(slugInput, 'no-trial-plan');
            await user.clear(nameInput);
            await user.type(nameInput, 'No Trial Plan');
            await user.clear(descriptionInput);
            await user.type(descriptionInput, 'Plan without trial');

            // Submit form via fireEvent (TanStack Form handleSubmit is async)
            const form = screen.getByRole('dialog').querySelector('form');
            expect(form).not.toBeNull();
            fireEvent.submit(form!);

            // Assert
            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledTimes(1);
            });

            const payload = onSubmit.mock.calls[0][0];
            expect(payload.hasTrial).toBe(false);
            expect(payload.trialDays).toBe(0);
        });

        it('filters out zero-value limits from the submit payload', async () => {
            // Arrange
            const user = userEvent.setup();
            const onSubmit = vi.fn().mockResolvedValue(undefined);

            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={onSubmit}
                />
            );

            // Act - fill required fields (limits default to 0, filtered out on submit)
            const slugInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.slug/);
            const nameInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.name/);
            const descriptionInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.description/
            );

            await user.clear(slugInput);
            await user.type(slugInput, 'zero-limits-plan');
            await user.clear(nameInput);
            await user.type(nameInput, 'Zero Limits Plan');
            await user.clear(descriptionInput);
            await user.type(descriptionInput, 'Plan with default limits');

            // Submit form via fireEvent (TanStack Form handleSubmit is async)
            const form = screen.getByRole('dialog').querySelector('form');
            expect(form).not.toBeNull();
            fireEvent.submit(form!);

            // Assert - limits with value 0 are filtered out
            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledTimes(1);
            });

            const payload = onSubmit.mock.calls[0][0];
            expect(payload.limits).toEqual([]);
        });

        it('converts annualPriceArs to null when left at zero', async () => {
            // Arrange
            const user = userEvent.setup();
            const onSubmit = vi.fn().mockResolvedValue(undefined);

            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={onSubmit}
                />
            );

            // Act - fill required fields, leave annualPriceArs at 0
            const slugInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.slug/);
            const nameInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.name/);
            const descriptionInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.description/
            );

            await user.clear(slugInput);
            await user.type(slugInput, 'annual-null-plan');
            await user.clear(nameInput);
            await user.type(nameInput, 'Annual Null Plan');
            await user.clear(descriptionInput);
            await user.type(descriptionInput, 'Plan testing annual null');

            // Submit form via fireEvent (TanStack Form handleSubmit is async)
            const form = screen.getByRole('dialog').querySelector('form');
            expect(form).not.toBeNull();
            fireEvent.submit(form!);

            // Assert - annualPriceArs: value ? Math.round(value * 100) : null
            // 0 is falsy, so it becomes null
            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledTimes(1);
            });

            const payload = onSubmit.mock.calls[0][0];
            expect(payload.annualPriceArs).toBeNull();
        });
    });

    describe('Edit mode (plan = existing)', () => {
        it('pre-fills all fields with existing plan data', () => {
            // Arrange - import fixture inline to avoid circular deps
            const existingPlan = {
                slug: 'basic-owner',
                name: 'Basic Owner',
                description: 'Basic plan for accommodation owners',
                category: 'owner' as const,
                monthlyPriceArs: 500000,
                annualPriceArs: 5000000,
                monthlyPriceUsdRef: 500,
                hasTrial: true,
                trialDays: 14,
                isDefault: true,
                sortOrder: 1,
                isActive: true,
                entitlements: ['publish_accommodations', 'edit_accommodation_info'],
                limits: [{ key: 'max_accommodations', value: 1 }],
                id: '22222222-2222-4222-8222-222222222222',
                createdAt: '2026-05-30T00:00:00.000Z',
                updatedAt: '2026-05-30T00:00:00.000Z',
                isDeleted: false,
                activeSubscriptionCount: 0
            };

            // Act
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={existingPlan}
                    onSubmit={vi.fn()}
                />
            );

            // Assert - basic info fields are pre-filled
            const slugInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.slug/);
            expect(slugInput).toHaveValue('basic-owner');

            const nameInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.name/);
            expect(nameInput).toHaveValue('Basic Owner');

            const descriptionInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.description/
            );
            expect(descriptionInput).toHaveValue('Basic plan for accommodation owners');

            // Assert - pricing fields are pre-filled (converted from centavos to display)
            const monthlyArsInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.monthlyArs/
            );
            expect(monthlyArsInput).toHaveValue(5000);

            const annualArsInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.annualArs/
            );
            expect(annualArsInput).toHaveValue(50000);

            const usdRefInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.usdRef/
            );
            expect(usdRefInput).toHaveValue(500);

            // Assert - trial fields are pre-filled
            const trialDaysInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.trialDays/
            );
            expect(trialDaysInput).not.toBeDisabled();
            expect(trialDaysInput).toHaveValue(14);
        });

        it('renders Save button (saveButton key) instead of Create', () => {
            // Arrange
            const existingPlan = {
                slug: 'pro-owner',
                name: 'Pro Owner',
                description: 'Professional plan',
                category: 'owner' as const,
                monthlyPriceArs: 1500000,
                annualPriceArs: 15000000,
                monthlyPriceUsdRef: 1500,
                hasTrial: false,
                trialDays: 0,
                isDefault: false,
                sortOrder: 2,
                isActive: true,
                entitlements: [],
                limits: [],
                id: '33333333-3333-4333-8333-333333333333',
                createdAt: '2026-05-30T00:00:00.000Z',
                updatedAt: '2026-05-30T00:00:00.000Z',
                isDeleted: false,
                activeSubscriptionCount: 0
            };

            // Act
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={existingPlan}
                    onSubmit={vi.fn()}
                />
            );

            // Assert - save button is shown (not create button)
            expect(
                screen.getByRole('button', { name: 'admin-billing.plans.dialog.saveButton' })
            ).toBeInTheDocument();

            // Assert - create button is NOT shown
            expect(
                screen.queryByRole('button', { name: 'admin-billing.plans.dialog.createButton' })
            ).not.toBeInTheDocument();
        });
    });

    describe('Loading state', () => {
        it('disables submit button when isSubmitting=true', () => {
            // Arrange & Act
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={vi.fn()}
                    isSubmitting={true}
                />
            );

            // Assert - submit button is disabled
            const submitButton = screen.getByRole('button', {
                name: /admin-billing\.plans\.dialog\.createButton/
            });
            expect(submitButton).toBeDisabled();
        });
    });

    describe('Cancel behavior', () => {
        it('calls onOpenChange(false) when cancel button clicked', async () => {
            // Arrange
            const user = userEvent.setup();
            const onOpenChange = vi.fn();

            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={onOpenChange}
                    plan={null}
                    onSubmit={vi.fn()}
                />
            );

            // Act
            const cancelButton = screen.getByRole('button', {
                name: 'admin-billing.plans.dialog.cancelButton'
            });
            await user.click(cancelButton);

            // Assert
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });
});
