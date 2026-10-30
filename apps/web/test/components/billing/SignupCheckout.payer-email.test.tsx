import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupCheckout } from '@/components/billing/SignupCheckout.client';

const start = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({ billingSubscriptionApi: { start } }));

const props = {
    locale: 'es' as const,
    billingOptionId: '123e4567-e89b-42d3-a456-426614174000',
    accountEmail: 'account@example.test',
    plansHref: '/es/planes/',
    trialNotice: null,
    touristVipNotice: null,
    planSummary: null,
    pendingAttempt: null
};

const success = {
    ok: true,
    data: {
        subscriptionId: '123e4567-e89b-42d3-a456-426614174001',
        authorizationId: 'authorization-1',
        // No safe URL keeps this suite on the pending fallback while it checks
        // the declared payer email; HOS-1896 covers the redirect elsewhere.
        checkoutUrl: null,
        vertical: 'tourist',
        authorizationWindowEndsAt: '2026-10-13T02:30:00.000Z'
    }
};

beforeEach(() => vi.resetAllMocks());

describe('TEST:1730:5 checkout payer email', () => {
    it('prefills an editable account email without starting or showing a resume link', () => {
        render(<SignupCheckout {...props} />);
        const input = screen.getByTestId('signup-checkout-payer-email');
        expect(input).toHaveValue(props.accountEmail);
        fireEvent.change(input, { target: { value: 'changed@example.test' } });
        expect(input).toHaveValue('changed@example.test');
        expect(screen.queryByTestId('signup-checkout-resume-link')).not.toBeInTheDocument();
        expect(start).not.toHaveBeenCalled();
    });

    it('starts once with the edited payer email and selected option', async () => {
        start.mockResolvedValue(success);
        render(<SignupCheckout {...props} />);
        fireEvent.change(screen.getByTestId('signup-checkout-payer-email'), {
            target: { value: 'other@example.test' }
        });
        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));
        await screen.findByTestId('signup-checkout-pending');
        expect(start).toHaveBeenCalledTimes(1);
        expect(start).toHaveBeenCalledWith({
            billingOptionId: props.billingOptionId,
            payerEmail: 'other@example.test'
        });
    });

    it.each([
        '',
        'invalid'
    ])('rejects value %s without calling start and clears error on edit', async (value) => {
        render(<SignupCheckout {...props} />);
        const input = screen.getByTestId('signup-checkout-payer-email');
        fireEvent.change(input, { target: { value } });
        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));
        expect(await screen.findByRole('alert')).toHaveTextContent('Ingresá un email válido.');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(start).not.toHaveBeenCalled();
        fireEvent.change(input, { target: { value: 'fixed@example.test' } });
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        expect(start).not.toHaveBeenCalled();
    });

    it('trims spaces before sending the payer email', async () => {
        start.mockResolvedValue(success);
        render(<SignupCheckout {...props} />);
        fireEvent.change(screen.getByTestId('signup-checkout-payer-email'), {
            target: { value: '  other@example.test  ' }
        });
        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));
        await screen.findByTestId('signup-checkout-pending');
        expect(start).toHaveBeenCalledWith({
            billingOptionId: props.billingOptionId,
            payerEmail: 'other@example.test'
        });
    });

    it('keeps the edited email after a server rejection and retry', async () => {
        start.mockResolvedValueOnce({
            ok: false,
            error: { status: 409, reason: 'PREVIOUS_ATTEMPT_CLOSING' }
        });
        render(<SignupCheckout {...props} />);
        const input = screen.getByTestId('signup-checkout-payer-email');
        fireEvent.change(input, { target: { value: 'other@example.test' } });
        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));
        fireEvent.click(await screen.findByTestId('signup-checkout-retry'));
        expect(screen.getByTestId('signup-checkout-payer-email')).toHaveValue('other@example.test');
    });
});

describe('TEST:1759:5 payer email validation on blur', () => {
    it.each(['', 'no-es-un-email'])('marks %s invalid on blur without starting', async (value) => {
        render(<SignupCheckout {...props} />);
        const input = screen.getByTestId('signup-checkout-payer-email');
        fireEvent.change(input, { target: { value } });
        fireEvent.blur(input);
        expect(await screen.findByRole('alert')).toHaveTextContent('Ingresá un email válido.');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(start).not.toHaveBeenCalled();
    });

    it('keeps valid email clear on blur', () => {
        render(<SignupCheckout {...props} />);
        const input = screen.getByTestId('signup-checkout-payer-email');
        fireEvent.change(input, { target: { value: 'ok@example.test' } });
        fireEvent.blur(input);
        expect(screen.queryByRole('alert')).toBeNull();
        expect(input).toHaveAttribute('aria-invalid', 'false');
        expect(start).not.toHaveBeenCalled();
    });

    it('clears blur error after correction', async () => {
        render(<SignupCheckout {...props} />);
        const input = screen.getByTestId('signup-checkout-payer-email');
        fireEvent.change(input, { target: { value: 'no-es-un-email' } });
        fireEvent.blur(input);
        await screen.findByRole('alert');
        fireEvent.change(input, { target: { value: 'ok@example.test' } });
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        expect(start).not.toHaveBeenCalled();
    });

    it('starts once with the corrected email after a blur error', async () => {
        start.mockResolvedValue(success);
        render(<SignupCheckout {...props} />);
        const input = screen.getByTestId('signup-checkout-payer-email');
        fireEvent.change(input, { target: { value: 'no-es-un-email' } });
        fireEvent.blur(input);
        await screen.findByRole('alert');
        fireEvent.change(input, { target: { value: 'ok@example.test' } });
        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));
        await screen.findByTestId('signup-checkout-pending');
        expect(start).toHaveBeenCalledTimes(1);
        expect(start).toHaveBeenCalledWith({
            billingOptionId: props.billingOptionId,
            payerEmail: 'ok@example.test'
        });
    });
});
