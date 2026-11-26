import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SignupCheckout,
    type SignupCheckoutProps
} from '@/components/billing/SignupCheckout.client';

const start = vi.hoisted(() => vi.fn());
const readRememberedPayerEmail = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({
    billingSubscriptionApi: { start, readRememberedPayerEmail }
}));

const props: SignupCheckoutProps = {
    locale: 'es',
    billingOptionId: '123e4567-e89b-42d3-a456-426614174000',
    accountEmail: 'account@example.test',
    plansHref: '/es/planes/anfitriones/',
    trialNotice: null,
    touristVipNotice: null,
    planSummary: null,
    pendingAttempt: null,
    manualPaymentOnly: false
};

beforeEach(() => {
    vi.resetAllMocks();
    start.mockResolvedValue({ ok: false, error: { status: 500, message: 'stop' } });
});

describe('HOS-2616 the signup checkout uses the remembered payer email', () => {
    it('shows the note instead of the field and sends the remembered email', async () => {
        readRememberedPayerEmail.mockResolvedValue({
            ok: true,
            data: { rememberedPayerEmail: 'mp@example.test' }
        });
        const user = userEvent.setup();
        render(<SignupCheckout {...props} />);

        const note = await screen.findByTestId('remembered-payer-email-note');
        expect(note).toHaveTextContent('mp@example.test');
        expect(note).toHaveTextContent('Si Mercado Pago te dice que tu e-mail no coincide');
        expect(screen.queryByTestId('signup-checkout-payer-email')).toBeNull();

        await user.click(screen.getByTestId('signup-checkout-confirm'));
        await waitFor(() =>
            expect(start).toHaveBeenCalledWith(
                expect.objectContaining({ payerEmail: 'mp@example.test' })
            )
        );
    });

    it('opens the editable field with the remembered email when the payer asks to change it', async () => {
        readRememberedPayerEmail.mockResolvedValue({
            ok: true,
            data: { rememberedPayerEmail: 'mp@example.test' }
        });
        const user = userEvent.setup();
        render(<SignupCheckout {...props} />);

        await user.click(await screen.findByTestId('remembered-payer-email-change'));

        const input = screen.getByTestId('signup-checkout-payer-email');
        expect(input).toHaveValue('mp@example.test');
        expect(screen.queryByTestId('remembered-payer-email-note')).toBeNull();
    });

    it('keeps asking for the account email when nothing is remembered', async () => {
        readRememberedPayerEmail.mockResolvedValue({
            ok: true,
            data: { rememberedPayerEmail: null }
        });
        render(<SignupCheckout {...props} />);

        await waitFor(() => expect(readRememberedPayerEmail).toHaveBeenCalled());
        expect(screen.getByTestId('signup-checkout-payer-email')).toHaveValue(
            'account@example.test'
        );
        expect(screen.queryByTestId('remembered-payer-email-note')).toBeNull();
    });

    it('keeps asking for the email when the read fails', async () => {
        readRememberedPayerEmail.mockRejectedValue(new Error('network'));
        render(<SignupCheckout {...props} />);

        await waitFor(() => expect(readRememberedPayerEmail).toHaveBeenCalled());
        expect(screen.getByTestId('signup-checkout-payer-email')).toBeInTheDocument();
        expect(screen.queryByTestId('remembered-payer-email-note')).toBeNull();
    });
});
