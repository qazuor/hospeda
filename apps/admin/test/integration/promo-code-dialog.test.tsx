/**
 * PromoCodeFormDialog Integration Tests
 *
 * Tests for the promo code create/edit dialog component.
 * Validates form behavior: auto-uppercase, edit mode pre-fill,
 * disabled fields, submit payload, and cancel handling.
 *
 * Radix UI primitives (Dialog, Select, Switch) are mocked to avoid
 * jsdom rendering hangs. The component logic is exercised through
 * lightweight HTML stand-ins that preserve props and event handlers.
 *
 * @module test/integration/promo-code-dialog
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { PromoCode } from '@/features/promo-codes';
import { PromoCodeFormDialog } from '@/features/promo-codes/components/PromoCodeFormDialog';
import { mockPromoCode } from '../fixtures/promo-code.fixture';
import { renderWithProviders } from '../helpers/render-with-providers';

// ---------------------------------------------------------------------------
// Radix UI mocks — prevent jsdom hangs from portals / animations
// ---------------------------------------------------------------------------

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
        open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>
}));

vi.mock('@/components/ui/select', () => ({
    Select: ({
        children,
        value,
        onValueChange
    }: {
        children: ReactNode;
        value: string;
        onValueChange: (v: string) => void;
    }) => (
        <div
            data-testid="select"
            data-value={value}
            onClick={() => onValueChange(value)}
            onKeyDown={(e) => e.key === 'Enter' && onValueChange(value)}
        >
            {children}
        </div>
    ),
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
        <option value={value}>{children}</option>
    ),
    SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectValue: () => <span />
}));

vi.mock('@/components/ui/switch', () => ({
    Switch: ({
        id,
        checked,
        onCheckedChange
    }: {
        id: string;
        checked: boolean;
        onCheckedChange: (v: boolean) => void;
    }) => (
        <button
            type="button"
            id={id}
            role="switch"
            aria-checked={checked}
            onClick={() => onCheckedChange(!checked)}
            data-testid={`switch-${id}`}
        >
            {checked ? 'on' : 'off'}
        </button>
    )
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a PromoCode object from the fixture (fixture uses string dates,
 * but PromoCode expects Date instances).
 */
function buildPromoCode(overrides?: Partial<Record<string, unknown>>): PromoCode {
    return {
        ...mockPromoCode,
        validFrom: new Date(mockPromoCode.validFrom),
        validUntil: mockPromoCode.validUntil ? new Date(mockPromoCode.validUntil) : null,
        createdAt: new Date(mockPromoCode.createdAt),
        updatedAt: new Date(mockPromoCode.updatedAt),
        ...overrides
    } as unknown as PromoCode;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PromoCodeFormDialog', () => {
    const defaultProps = {
        promoCode: null,
        isOpen: true,
        onClose: vi.fn(),
        onSubmit: vi.fn()
    };

    it('auto-uppercases the code field on every keystroke', async () => {
        // Arrange
        const user = userEvent.setup();
        renderWithProviders(<PromoCodeFormDialog {...defaultProps} />);

        const codeInput = screen.getByLabelText('admin-billing.promoCodes.form.codeLabel');

        // Act
        await user.type(codeInput, 'abc');

        // Assert
        expect(codeInput).toHaveValue('ABC');
    });

    it('shows discount value field for percentage type', () => {
        // Arrange & Act
        renderWithProviders(<PromoCodeFormDialog {...defaultProps} />);

        // Assert — discount value input is present with percentage suffix
        const valueLabel = screen.getByText(/admin-billing\.promoCodes\.form\.valueLabel/);
        expect(valueLabel).toBeInTheDocument();
        expect(
            screen.getByText(/admin-billing\.promoCodes\.form\.valuePercentageSuffix/)
        ).toBeInTheDocument();
    });

    it('shows discount value field for fixed type', () => {
        // Arrange — provide a promo code with fixed type
        const fixedPromo = buildPromoCode({ type: 'fixed' });

        // Act
        renderWithProviders(
            <PromoCodeFormDialog
                {...defaultProps}
                promoCode={fixedPromo}
            />
        );

        // Assert — discount value input is present with fixed suffix
        expect(
            screen.getByText(/admin-billing\.promoCodes\.form\.valueFixedSuffix/)
        ).toBeInTheDocument();
    });

    it('pre-fills fields in edit mode', () => {
        // Arrange
        const promoCode = buildPromoCode();

        // Act
        renderWithProviders(
            <PromoCodeFormDialog
                {...defaultProps}
                promoCode={promoCode}
            />
        );

        // Assert — verify pre-filled values
        expect(screen.getByLabelText('admin-billing.promoCodes.form.codeLabel')).toHaveValue(
            mockPromoCode.code
        );

        expect(screen.getByLabelText('admin-billing.promoCodes.form.descriptionLabel')).toHaveValue(
            mockPromoCode.description
        );

        expect(screen.getByLabelText('admin-billing.promoCodes.form.maxUsesLabel')).toHaveValue(
            mockPromoCode.maxUses
        );

        expect(
            screen.getByLabelText('admin-billing.promoCodes.form.maxUsesPerUserLabel')
        ).toHaveValue(mockPromoCode.maxUsesPerUser);

        // Edit title should be shown
        expect(screen.getByText('admin-billing.promoCodes.form.editTitle')).toBeInTheDocument();
    });

    it('disables code field in edit mode', () => {
        // Arrange
        const promoCode = buildPromoCode();

        // Act
        renderWithProviders(
            <PromoCodeFormDialog
                {...defaultProps}
                promoCode={promoCode}
            />
        );

        // Assert
        const codeInput = screen.getByLabelText('admin-billing.promoCodes.form.codeLabel');
        expect(codeInput).toBeDisabled();
    });

    it('code field is enabled in create mode', () => {
        // Arrange & Act
        renderWithProviders(<PromoCodeFormDialog {...defaultProps} />);

        // Assert
        const codeInput = screen.getByLabelText('admin-billing.promoCodes.form.codeLabel');
        expect(codeInput).toBeEnabled();
    });

    it('calls onSubmit with correct payload', async () => {
        // Arrange
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        renderWithProviders(
            <PromoCodeFormDialog
                {...defaultProps}
                onSubmit={onSubmit}
            />
        );

        // Act — fill in required fields
        const codeInput = screen.getByLabelText('admin-billing.promoCodes.form.codeLabel');
        const descInput = screen.getByLabelText('admin-billing.promoCodes.form.descriptionLabel');
        const valueInput = screen.getByLabelText(/admin-billing\.promoCodes\.form\.valueLabel/);

        await user.type(codeInput, 'summer30');
        await user.type(descInput, 'Summer sale');

        // Clear and type discount value
        await user.clear(valueInput);
        await user.type(valueInput, '30');

        // Submit the form — use fireEvent.submit to bypass jsdom's
        // incomplete type="date" validation which blocks userEvent.click
        const form = screen
            .getByText('admin-billing.promoCodes.form.createSubmit')
            .closest('form') as HTMLFormElement;
        fireEvent.submit(form);

        // Assert
        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledTimes(1);
        });

        const payload = onSubmit.mock.calls[0]?.[0];
        expect(payload).toBeDefined();
        expect(payload.code).toBe('SUMMER30');
        expect(payload.description).toBe('Summer sale');
        expect(payload.discountValue).toBe(30);
        expect(payload.type).toBe('percentage');
    });

    it('calls onClose when cancel button is clicked', async () => {
        // Arrange
        const user = userEvent.setup();
        const onClose = vi.fn();
        renderWithProviders(
            <PromoCodeFormDialog
                {...defaultProps}
                onClose={onClose}
            />
        );

        // Act
        const cancelButton = screen.getByText('admin-billing.promoCodes.form.cancelButton');
        await user.click(cancelButton);

        // Assert
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows create title when promoCode is null', () => {
        // Arrange & Act
        renderWithProviders(<PromoCodeFormDialog {...defaultProps} />);

        // Assert
        expect(screen.getByText('admin-billing.promoCodes.form.createTitle')).toBeInTheDocument();
    });

    it('shows edit submit label in edit mode', () => {
        // Arrange
        const promoCode = buildPromoCode();

        // Act
        renderWithProviders(
            <PromoCodeFormDialog
                {...defaultProps}
                promoCode={promoCode}
            />
        );

        // Assert
        expect(screen.getByText('admin-billing.promoCodes.form.editSubmit')).toBeInTheDocument();
    });
});
