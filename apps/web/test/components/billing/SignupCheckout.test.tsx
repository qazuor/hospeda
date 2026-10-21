/** B3 UI (B3.md:1045-1053); VIP rejection cases cover AC:B3:28 (mitad web). */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupCheckout } from '@/components/billing/SignupCheckout.client';

const start = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({ billingSubscriptionApi: { start } }));

const props = {
    locale: 'es' as const,
    billingOptionId: '123e4567-e89b-42d3-a456-426614174000',
    accountEmail: 'account@example.test',
    plansHref: '/es/planes/turistas/',
    trialNotice: null,
    touristVipNotice: null,
    planSummary: null
};
const success = {
    ok: true,
    data: {
        subscriptionId: '123e4567-e89b-42d3-a456-426614174001',
        authorizationId: 'authorization-1',
        checkoutUrl: 'https://payments.example/continue',
        vertical: 'tourist',
        authorizationWindowEndsAt: '2026-10-13T02:30:00.000Z'
    }
};

beforeEach(() => vi.resetAllMocks());

describe('SignupCheckout — B3 UI (B3.md:1045-1053)', () => {
    it('TEST:1723:7 shows the selected plan summary before confirmation when available', () => {
        render(
            <SignupCheckout
                {...props}
                planSummary={{ name: 'Básico', amount: 1500000, currency: 'ARS', cycle: 'monthly' }}
            />
        );
        const summary = screen.getByTestId('signup-checkout-plan-summary');
        expect(summary).toHaveTextContent('Básico · $ 15.000 por mes');
        expect(
            summary.compareDocumentPosition(screen.getByTestId('signup-checkout-confirm')) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('does not show a plan summary when it is unavailable', () => {
        render(
            <SignupCheckout
                {...props}
                planSummary={null}
            />
        );
        expect(screen.queryByTestId('signup-checkout-plan-summary')).not.toBeInTheDocument();
    });

    it('renders idle server content and does not call S1 until clicked', () => {
        render(<SignupCheckout {...props} />);
        expect(screen.getByTestId('signup-checkout')).toHaveAttribute('data-state', 'idle');
        expect(
            screen.getByRole('heading', { name: 'Confirmá tu suscripción' })
        ).toBeInTheDocument();
        expect(start).not.toHaveBeenCalled();
    });

    it('enters pending after one click, with the API URL and authorization end', async () => {
        start.mockResolvedValue(success);
        render(<SignupCheckout {...props} />);
        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));
        expect(await screen.findByTestId('signup-checkout-pending')).toHaveAttribute(
            'data-subscription-id',
            success.data.subscriptionId
        );
        expect(screen.getByTestId('signup-checkout-pending')).toHaveAttribute(
            'data-vertical',
            'tourist'
        );
        expect(screen.getByTestId('signup-checkout-resume-link')).toHaveAttribute(
            'href',
            success.data.checkoutUrl
        );
        expect(screen.getByTestId('signup-checkout-window-ends')).toHaveAttribute(
            'dateTime',
            success.data.authorizationWindowEndsAt
        );
        expect(screen.queryByTestId('signup-checkout-confirm')).not.toBeInTheDocument();
    });

    it('keeps the pending state but omits a resume link for a javascript checkout URL', async () => {
        start.mockResolvedValue({
            ...success,
            data: { ...success.data, checkoutUrl: 'javascript:alert(1)' }
        });
        render(<SignupCheckout {...props} />);
        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));

        expect(await screen.findByTestId('signup-checkout-pending')).toBeInTheDocument();
        expect(screen.queryByTestId('signup-checkout-resume-link')).not.toBeInTheDocument();
    });

    it('shows the owner-approved inherited VIP rejection and no payment action', async () => {
        start.mockResolvedValue({
            ok: false,
            error: { status: 409, reason: 'TOURIST_VIP_INHERITED', message: 'API English text' }
        });
        render(<SignupCheckout {...props} />);
        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));
        const rejection = await screen.findByTestId('signup-checkout-rejection');
        expect(rejection).toHaveAttribute('data-reason', 'TOURIST_VIP_INHERITED');
        expect(rejection).toHaveTextContent(
            'Tu plan actual ya incluye los beneficios de Turista VIP'
        );
        expect(rejection).not.toHaveTextContent('API English text');
        expect(screen.queryByTestId('signup-checkout-resume-link')).not.toBeInTheDocument();
        expect(screen.queryByTestId('signup-checkout-confirm')).not.toBeInTheDocument();
    });

    it('shows plans for a retired option and retry for a closing previous attempt', async () => {
        start.mockResolvedValueOnce({
            ok: false,
            error: { status: 422, reason: 'PLAN_NOT_FOR_SALE', message: 'English' }
        });
        const { unmount } = render(<SignupCheckout {...props} />);
        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));
        expect(await screen.findByTestId('signup-checkout-plans-link')).toHaveAttribute(
            'href',
            props.plansHref
        );
        unmount();
        start.mockResolvedValueOnce({
            ok: false,
            error: { status: 409, reason: 'PREVIOUS_ATTEMPT_CLOSING', message: 'English' }
        });
        render(<SignupCheckout {...props} />);
        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));
        expect(await screen.findByTestId('signup-checkout-retry')).toBeInTheDocument();
        expect(screen.getByTestId('signup-checkout-rejection')).toHaveTextContent(
            'Estamos cerrando tu intento anterior; probá de nuevo en unos minutos.'
        );
    });

    it('TEST:1723:5b shows the translated retry action for an unfinished previous creation', async () => {
        start.mockResolvedValueOnce({
            ok: false,
            error: { status: 409, reason: 'PREVIOUS_ATTEMPT_IN_PROGRESS', message: 'English' }
        });
        render(<SignupCheckout {...props} />);
        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));
        expect(await screen.findByTestId('signup-checkout-retry')).toBeInTheDocument();
        expect(screen.getByTestId('signup-checkout-rejection')).toHaveTextContent(
            'Todavía estamos preparando tu intento anterior con Mercado Pago. Probá de nuevo en unos minutos.'
        );
    });

    it('uses generic localized copy for unknown reasons and prevents duplicate submits', async () => {
        let resolve: (value: unknown) => void = () => undefined;
        start.mockImplementation(
            () =>
                new Promise((done) => {
                    resolve = done;
                })
        );
        render(<SignupCheckout {...props} />);
        const button = screen.getByTestId('signup-checkout-confirm');
        fireEvent.click(button);
        fireEvent.click(button);
        expect(start).toHaveBeenCalledTimes(1);
        resolve({
            ok: false,
            error: { status: 409, reason: 'FUTURE_REASON', message: 'Recognizable API English' }
        });
        const rejection = await screen.findByTestId('signup-checkout-rejection');
        expect(rejection).toHaveAttribute('data-reason', 'UNKNOWN');
        expect(rejection).toHaveTextContent('No pudimos iniciar tu suscripción.');
        expect(rejection).not.toHaveTextContent('Recognizable API English');
    });

    it.each([
        ['es', 'Tu plan actual ya incluye los beneficios de Turista VIP'],
        ['en', 'Your current plan already includes Turista VIP benefits'],
        ['pt', 'Seu plano atual já inclui os benefícios do Turista VIP']
    ] as const)('renders inherited VIP copy in locale %s', async (locale, expectedCopy) => {
        start.mockResolvedValue({
            ok: false,
            error: { status: 409, reason: 'TOURIST_VIP_INHERITED', message: 'English API message' }
        });
        render(
            <SignupCheckout
                {...props}
                locale={locale}
            />
        );
        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));
        const rejection = await screen.findByTestId('signup-checkout-rejection');
        expect(rejection).toHaveTextContent(expectedCopy);
        expect(rejection).not.toHaveTextContent('billing.checkout.signup');
        expect(rejection).not.toHaveTextContent('English API message');
    });
});

describe('TEST:B13a:21c AC:B13a:5 the checkout says both trial halves before confirming', () => {
    it('shows days, date, both consequences, and places the note before confirm', () => {
        render(
            <SignupCheckout
                {...props}
                trialNotice={{ kind: 'RUNNING', daysLeft: 11, endsAt: '2026-10-20T08:00:00.000Z' }}
            />
        );
        const notice = screen.getByTestId('signup-checkout-trial-notice');
        const confirm = screen.getByTestId('signup-checkout-confirm');

        expect(notice).toHaveAttribute('data-kind', 'RUNNING');
        expect(
            notice.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(notice).toHaveTextContent('te quedan 11 días');
        expect(notice).toHaveTextContent('20 de octubre de 2026');
        expect(notice).toHaveTextContent('tu prueba termina y perdés esos días');
        expect(notice).toHaveTextContent('seguís en tu prueba con esos días');
    });

    it('shows the conditional copy when the trial lookup is unknown', () => {
        render(
            <SignupCheckout
                {...props}
                trialNotice={{ kind: 'UNKNOWN' }}
            />
        );
        const notice = screen.getByTestId('signup-checkout-trial-notice');

        expect(notice).toHaveAttribute('data-kind', 'UNKNOWN');
        expect(notice).toHaveTextContent('Si estás en tu período de prueba en esta vertical');
        expect(notice).toHaveTextContent('perdés los días que te quedaban');
        expect(notice).toHaveTextContent('seguís en tu prueba con esos días');
    });

    it('does not render a block without a notice or after checkout becomes pending', async () => {
        const { rerender } = render(
            <SignupCheckout
                {...props}
                trialNotice={null}
            />
        );
        expect(screen.queryByTestId('signup-checkout-trial-notice')).not.toBeInTheDocument();

        start.mockResolvedValue(success);
        rerender(
            <SignupCheckout
                {...props}
                trialNotice={{ kind: 'RUNNING', daysLeft: 2, endsAt: '2026-10-12T12:00:00.000Z' }}
            />
        );
        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));
        await screen.findByTestId('signup-checkout-pending');
        expect(screen.queryByTestId('signup-checkout-trial-notice')).not.toBeInTheDocument();
    });
});

describe('TEST:1623:6 Tourist VIP return warning', () => {
    it('shows the cancellation and no-refund warning before confirm with a positive marker', () => {
        render(
            <SignupCheckout
                {...props}
                touristVipNotice={{ kind: 'CANCELLED_ON_RETURN' }}
            />
        );
        const section = screen.getByTestId('signup-checkout');
        const notice = screen.getByTestId('signup-checkout-tourist-vip-notice');
        const confirm = screen.getByTestId('signup-checkout-confirm');
        expect(section).toHaveAttribute('data-tourist-vip', 'CANCELLED_ON_RETURN');
        expect(notice).toHaveAttribute('role', 'note');
        expect(notice).toHaveTextContent('se cancela en el momento');
        expect(notice).toHaveTextContent('no se reembolsa');
        expect(
            notice.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('shows the conditional warning for an unknown lookup and marks the result', () => {
        render(
            <SignupCheckout
                {...props}
                touristVipNotice={{ kind: 'UNKNOWN' }}
            />
        );
        expect(screen.getByTestId('signup-checkout')).toHaveAttribute(
            'data-tourist-vip',
            'UNKNOWN'
        );
        expect(screen.getByTestId('signup-checkout-tourist-vip-notice')).toHaveTextContent(
            'Si tenés una suscripción suspendida cuyo plan te daba los beneficios de Turista VIP'
        );
    });

    it('marks the checkout unaffected when the API resolved no warning', () => {
        render(
            <SignupCheckout
                {...props}
                touristVipNotice={null}
            />
        );
        expect(screen.getByTestId('signup-checkout')).toHaveAttribute(
            'data-tourist-vip',
            'NOT_AFFECTED'
        );
    });
});
