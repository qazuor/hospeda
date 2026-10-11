import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscribeButton } from '@/components/billing/SubscribeButton.client';

const subscribeDestination = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({ publishApi: { subscribeDestination } }));

beforeEach(() => vi.clearAllMocks());

describe('SubscribeButton (TEST:V8a:3 / TEST:V8a:4)', () => {
    it('shows publish CTA and trial note with its destination', async () => {
        subscribeDestination.mockResolvedValue({
            ok: true,
            data: { destination: 'PUBLISH', trialDays: 14 }
        });
        render(
            <SubscribeButton
                locale="es"
                vertical="accommodation"
            />
        );
        const container = await screen.findByTestId('subscribe-button');
        expect(container).toHaveAttribute('data-destination', 'publish');
        expect(container.querySelector('a')).toHaveAttribute('href', '/es/publicar/');
        expect(container).toHaveTextContent('14 días');
        expect(container).toHaveTextContent(/empieza cuando publicás/i);
    });
    it('sends signed out visitors to signup without a trial note', async () => {
        subscribeDestination.mockResolvedValue({
            ok: false,
            error: { status: 401, message: 'unauthorized' }
        });
        render(
            <SubscribeButton
                locale="es"
                vertical="accommodation"
            />
        );
        const container = await screen.findByTestId('subscribe-button');
        expect(container).toHaveAttribute('data-destination', 'signed-out');
        expect(container.querySelector('a')).toHaveAttribute(
            'href',
            '/es/auth/signup/?returnUrl=%2Fes%2Fpublicar%2F'
        );
        expect(container).not.toHaveTextContent(/días/);
    });
    it('shows no plans without a button, purchase link, or subscription wording', async () => {
        subscribeDestination.mockResolvedValue({
            ok: true,
            data: { destination: 'NO_PLANS_AVAILABLE' }
        });
        render(
            <SubscribeButton
                locale="es"
                vertical="accommodation"
            />
        );
        const container = await screen.findByTestId('subscribe-button');
        expect(container).toHaveAttribute('data-destination', 'no-plans');
        expect(container).toHaveTextContent(/esta vertical no tiene planes disponibles/i);
        expect(container.querySelector('a, button')).toBeNull();
        expect(container).not.toHaveTextContent(/suscribite/i);
    });
    it('exposes checkout without inventing a link', async () => {
        subscribeDestination.mockResolvedValue({
            ok: true,
            data: { destination: 'CHECKOUT', reason: 'USER_ALREADY_HAS_TRIAL_ROW' }
        });
        render(
            <SubscribeButton
                locale="es"
                vertical="accommodation"
            />
        );
        const container = await screen.findByTestId('subscribe-button');
        expect(container).toHaveAttribute('data-destination', 'checkout');
        expect(container.querySelector('a')).toBeNull();
    });
    it.each([
        { destination: 'COVERED' },
        null
    ])('renders no content for covered or hidden results', async (data) => {
        subscribeDestination.mockResolvedValue(
            data ? { ok: true, data } : { ok: false, error: { status: 503, message: 'failure' } }
        );
        const { container } = render(
            <SubscribeButton
                locale="es"
                vertical="accommodation"
            />
        );
        await waitFor(() => expect(subscribeDestination).toHaveBeenCalledTimes(1));
        await act(async () => Promise.resolve());
        expect(container).toBeEmptyDOMElement();
    });
    it('renders nothing while loading and does not request again on rerender', async () => {
        let resolveRequest: (value: unknown) => void = () => undefined;
        subscribeDestination.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveRequest = resolve;
                })
        );
        const { container, rerender } = render(
            <SubscribeButton
                locale="es"
                vertical="accommodation"
            />
        );
        expect(container).toBeEmptyDOMElement();
        rerender(
            <SubscribeButton
                locale="es"
                vertical="accommodation"
            />
        );
        expect(subscribeDestination).toHaveBeenCalledTimes(1);
        await act(async () =>
            resolveRequest({
                ok: true,
                data: { destination: 'CHECKOUT', reason: 'USER_ALREADY_HAS_TRIAL_ROW' }
            })
        );
        expect(await screen.findByTestId('subscribe-button')).toHaveAttribute(
            'data-destination',
            'checkout'
        );
    });
});
