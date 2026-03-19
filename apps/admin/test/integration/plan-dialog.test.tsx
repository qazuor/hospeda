/**
 * PlanDialog Integration Tests - Create Mode
 *
 * Tests the plan creation dialog form: rendering, field interaction,
 * validation, and submit payload correctness.
 *
 * @module test/integration/plan-dialog
 */

import type { EntitlementKey, LimitKey } from '@repo/billing';
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
vi.mock('@repo/billing', () => {
    const EntitlementKey = {
        PUBLISH_ACCOMMODATIONS: 'publish_accommodations',
        EDIT_ACCOMMODATION_INFO: 'edit_accommodation_info',
        VIEW_BASIC_STATS: 'view_basic_stats',
        VIEW_ADVANCED_STATS: 'view_advanced_stats',
        RESPOND_REVIEWS: 'respond_reviews',
        PRIORITY_SUPPORT: 'priority_support',
        FEATURED_LISTING: 'featured_listing',
        CUSTOM_BRANDING: 'custom_branding',
        API_ACCESS: 'api_access',
        DEDICATED_MANAGER: 'dedicated_manager',
        CREATE_PROMOTIONS: 'create_promotions',
        SOCIAL_MEDIA_INTEGRATION: 'social_media_integration',
        CAN_USE_RICH_DESCRIPTION: 'can_use_rich_description',
        CAN_EMBED_VIDEO: 'can_embed_video',
        CAN_USE_CALENDAR: 'can_use_calendar',
        CAN_SYNC_EXTERNAL_CALENDAR: 'can_sync_external_calendar',
        CAN_CONTACT_WHATSAPP_DISPLAY: 'can_contact_whatsapp_display',
        CAN_CONTACT_WHATSAPP_DIRECT: 'can_contact_whatsapp_direct',
        HAS_VERIFICATION_BADGE: 'has_verification_badge',
        MULTI_PROPERTY_MANAGEMENT: 'multi_property_management',
        CONSOLIDATED_ANALYTICS: 'consolidated_analytics',
        CENTRALIZED_BOOKING: 'centralized_booking',
        STAFF_MANAGEMENT: 'staff_management',
        WHITE_LABEL: 'white_label',
        MULTI_CHANNEL_INTEGRATION: 'multi_channel_integration',
        SAVE_FAVORITES: 'save_favorites',
        WRITE_REVIEWS: 'write_reviews',
        READ_REVIEWS: 'read_reviews',
        AD_FREE: 'ad_free',
        PRICE_ALERTS: 'price_alerts',
        EARLY_ACCESS_EVENTS: 'early_access_events',
        EXCLUSIVE_DEALS: 'exclusive_deals',
        VIP_SUPPORT: 'vip_support',
        CONCIERGE_SERVICE: 'concierge_service',
        AIRPORT_TRANSFERS: 'airport_transfers',
        VIP_PROMOTIONS_ACCESS: 'vip_promotions_access'
    } as const;

    const LimitKey = {
        MAX_ACCOMMODATIONS: 'max_accommodations',
        MAX_PHOTOS_PER_ACCOMMODATION: 'max_photos_per_accommodation',
        MAX_ACTIVE_PROMOTIONS: 'max_active_promotions',
        MAX_FAVORITES: 'max_favorites',
        MAX_PROPERTIES: 'max_properties',
        MAX_STAFF_ACCOUNTS: 'max_staff_accounts'
    } as const;

    const LIMIT_METADATA: Record<string, { name: string; description: string }> = {
        max_accommodations: { name: 'Maximum accommodations', description: 'Max published' },
        max_photos_per_accommodation: {
            name: 'Photos per accommodation',
            description: 'Max photos'
        },
        max_active_promotions: { name: 'Active promotions', description: 'Max simultaneous' },
        max_favorites: { name: 'Favorites', description: 'Max saved favorites' },
        max_properties: { name: 'Properties', description: 'Max in complex' },
        max_staff_accounts: { name: 'Staff accounts', description: 'Max per complex' }
    };

    const ENTITLEMENT_DEFINITIONS = [
        { key: 'publish_accommodations', name: 'Publish accommodations', description: '' },
        { key: 'edit_accommodation_info', name: 'Edit accommodation info', description: '' },
        { key: 'view_basic_stats', name: 'Basic statistics', description: '' },
        { key: 'view_advanced_stats', name: 'Advanced statistics', description: '' },
        { key: 'respond_reviews', name: 'Respond to reviews', description: '' },
        { key: 'priority_support', name: 'Priority support', description: '' },
        { key: 'featured_listing', name: 'Featured listing', description: '' },
        { key: 'custom_branding', name: 'Custom branding', description: '' },
        { key: 'api_access', name: 'API access', description: '' },
        { key: 'dedicated_manager', name: 'Dedicated manager', description: '' },
        { key: 'create_promotions', name: 'Create promotions', description: '' },
        { key: 'social_media_integration', name: 'Social media integration', description: '' },
        { key: 'can_use_rich_description', name: 'Rich description', description: '' },
        { key: 'can_embed_video', name: 'Embed video', description: '' },
        { key: 'can_use_calendar', name: 'Availability calendar', description: '' },
        { key: 'can_sync_external_calendar', name: 'External calendar sync', description: '' },
        { key: 'can_contact_whatsapp_display', name: 'Display WhatsApp', description: '' },
        { key: 'can_contact_whatsapp_direct', name: 'Direct WhatsApp contact', description: '' },
        { key: 'has_verification_badge', name: 'Verification badge', description: '' },
        { key: 'multi_property_management', name: 'Multi-property management', description: '' },
        { key: 'consolidated_analytics', name: 'Consolidated analytics', description: '' },
        { key: 'centralized_booking', name: 'Centralized booking', description: '' },
        { key: 'staff_management', name: 'Staff management', description: '' },
        { key: 'white_label', name: 'White label', description: '' },
        { key: 'multi_channel_integration', name: 'Multi-channel integration', description: '' },
        { key: 'save_favorites', name: 'Save favorites', description: '' },
        { key: 'write_reviews', name: 'Write reviews', description: '' },
        { key: 'read_reviews', name: 'Read reviews', description: '' },
        { key: 'ad_free', name: 'Ad-free', description: '' },
        { key: 'price_alerts', name: 'Price alerts', description: '' },
        { key: 'early_access_events', name: 'Early access to events', description: '' },
        { key: 'exclusive_deals', name: 'Exclusive deals', description: '' },
        { key: 'vip_support', name: 'VIP support', description: '' },
        { key: 'concierge_service', name: 'Concierge service', description: '' },
        { key: 'airport_transfers', name: 'Airport transfers', description: '' },
        { key: 'vip_promotions_access', name: 'VIP promotions access', description: '' }
    ];

    return { EntitlementKey, LimitKey, LIMIT_METADATA, ENTITLEMENT_DEFINITIONS };
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

        it('calls onSubmit with correct payload on valid submit', async () => {
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

            // Act - fill required fields
            const slugInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.slug/);
            const nameInput = screen.getByLabelText(/admin-billing\.plans\.dialog\.fields\.name/);
            const descriptionInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.description/
            );
            const monthlyArsInput = screen.getByLabelText(
                /admin-billing\.plans\.dialog\.fields\.monthlyArs/
            );

            await user.clear(slugInput);
            await user.type(slugInput, 'test-plan');

            await user.clear(nameInput);
            await user.type(nameInput, 'Test Plan');

            await user.clear(descriptionInput);
            await user.type(descriptionInput, 'A test plan description');

            await user.clear(monthlyArsInput);
            await user.type(monthlyArsInput, '5000');

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
                limits: []
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
                entitlements: [
                    'publish_accommodations',
                    'edit_accommodation_info'
                ] as EntitlementKey[],
                limits: [
                    {
                        key: 'max_accommodations' as LimitKey,
                        value: 1,
                        name: 'Max Accommodations',
                        description: 'Max published'
                    }
                ]
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
                limits: []
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
