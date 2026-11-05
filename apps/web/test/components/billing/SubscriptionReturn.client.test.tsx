/** HOS-1979: render behaviour of the Mercado Pago return island. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/components/billing/SubscriptionReturn.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({ t: (key: string) => key })
}));

const readMock = vi.fn();
const startMock = vi.fn();
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    billingSubscriptionApi: {
        read: (...args: unknown[]) => readMock(...args),
        start: (...args: unknown[]) => startMock(...args)
    }
}));

import { SubscriptionReturn } from '../../../src/components/billing/SubscriptionReturn.client';
import {
    RETURN_POLL_INTERVAL_MS,
    RETURN_POLL_MAX_ATTEMPTS
} from '../../../src/lib/billing/subscription-return';

const SUB = '123e4567-e89b-42d3-a456-426614174000';
const OPTION = '223e4567-e89b-42d3-a456-426614174000';

const baseProps = {
    locale: 'es' as const,
    subscriptionId: SUB,
    billingOptionId: OPTION,
    accountEmail: 'account@example.test',
    declaredPayerEmail: null as string | null
};

beforeEach(() => {
    vi.useFakeTimers();
    readMock.mockReset();
    startMock.mockReset();
    window.sessionStorage.clear();
});
afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('SubscriptionReturn polling', () => {
    it('refreshes the page exactly once when polling confirms a pending subscription', async () => {
        const reload = vi.fn();
        readMock.mockResolvedValue({ ok: true, data: { status: 'ACTIVE' } });
        render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus="PENDING_AUTHORIZATION"
                refreshPage={reload}
            />
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(RETURN_POLL_INTERVAL_MS);
        });

        expect(screen.getByTestId('subscription-return').dataset.view).toBe('confirmed');
        expect(reload).toHaveBeenCalledTimes(1);
        expect(window.sessionStorage.getItem(`hospeda:subscriptionReturn:refreshed:${SUB}`)).toBe(
            '1'
        );
    });

    it('does not refresh after a processing-to-confirmed transition when the session marker exists', async () => {
        const reload = vi.fn();
        window.sessionStorage.setItem(`hospeda:subscriptionReturn:refreshed:${SUB}`, '1');
        readMock.mockResolvedValue({ ok: true, data: { status: 'ACTIVE' } });
        render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus="PENDING_AUTHORIZATION"
                refreshPage={reload}
            />
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(RETURN_POLL_INTERVAL_MS);
        });

        expect(screen.getByTestId('subscription-return').dataset.view).toBe('confirmed');
        expect(reload).not.toHaveBeenCalled();
    });

    it('never refreshes when sessionStorage throws, so a lagging SSR read cannot loop', async () => {
        const reload = vi.fn();
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage unavailable');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('storage unavailable');
        });
        readMock.mockResolvedValue({ ok: true, data: { status: 'ACTIVE' } });
        render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus="PENDING_AUTHORIZATION"
                refreshPage={reload}
            />
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(RETURN_POLL_INTERVAL_MS);
        });

        expect(screen.getByTestId('subscription-return').dataset.view).toBe('confirmed');
        expect(reload).not.toHaveBeenCalled();
    });

    it('never refreshes when only reading sessionStorage throws', async () => {
        const reload = vi.fn();
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage unavailable');
        });
        readMock.mockResolvedValue({ ok: true, data: { status: 'ACTIVE' } });
        render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus="PENDING_AUTHORIZATION"
                refreshPage={reload}
            />
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(RETURN_POLL_INTERVAL_MS);
        });

        expect(screen.getByTestId('subscription-return').dataset.view).toBe('confirmed');
        expect(reload).not.toHaveBeenCalled();
    });

    it('does not refresh when the server already rendered a confirmed subscription', () => {
        const reload = vi.fn();
        render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus="ACTIVE"
                refreshPage={reload}
            />
        );

        expect(screen.getByTestId('subscription-return').dataset.view).toBe('confirmed');
        expect(reload).not.toHaveBeenCalled();
    });

    it('does not refresh when the return remains pending or is rejected', async () => {
        const reload = vi.fn();
        readMock.mockResolvedValue({ ok: true, data: { status: 'PENDING_AUTHORIZATION' } });
        render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus="PENDING_AUTHORIZATION"
                refreshPage={reload}
            />
        );

        for (let poll = 0; poll < RETURN_POLL_MAX_ATTEMPTS; poll += 1) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(RETURN_POLL_INTERVAL_MS);
            });
        }
        expect(screen.getByTestId('subscription-return').dataset.view).toBe('stillProcessing');
        expect(reload).not.toHaveBeenCalled();

        cleanup();
        render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus="CHARGE_DECLINED"
                refreshPage={reload}
            />
        );
        expect(screen.getByTestId('subscription-return').dataset.view).toBe('rejected');
        expect(reload).not.toHaveBeenCalled();
    });

    it('re-reads the status while pending and stops once confirmed', async () => {
        const refreshPage = vi.fn();
        readMock.mockResolvedValue({ ok: true, data: { status: 'ACTIVE' } });
        render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus="PENDING_AUTHORIZATION"
                refreshPage={refreshPage}
            />
        );
        expect(screen.getByTestId('subscription-return').dataset.view).toBe('processing');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(RETURN_POLL_INTERVAL_MS);
        });

        expect(readMock).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('subscription-return').dataset.view).toBe('confirmed');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(RETURN_POLL_INTERVAL_MS * 3);
        });
        expect(readMock).toHaveBeenCalledTimes(1);
    });

    it('clears the pending timer on unmount so no read fires afterwards', async () => {
        readMock.mockResolvedValue({ ok: true, data: { status: 'PENDING_AUTHORIZATION' } });
        const { unmount } = render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus="PENDING_AUTHORIZATION"
            />
        );

        unmount();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(RETURN_POLL_INTERVAL_MS * 5);
        });

        expect(readMock).not.toHaveBeenCalled();
    });
});

describe('SubscriptionReturn retry', () => {
    it('locks the button so a double click starts exactly one checkout', async () => {
        let resolveStart: (value: unknown) => void = () => undefined;
        startMock.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveStart = resolve;
                })
        );
        render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus="CHARGE_DECLINED"
                declaredPayerEmail="mp@example.test"
            />
        );
        const button = screen.getByTestId('subscription-return-retry') as HTMLButtonElement;

        await act(async () => {
            fireEvent.click(button);
            fireEvent.click(button);
        });

        expect(startMock).toHaveBeenCalledTimes(1);
        expect(startMock).toHaveBeenCalledWith({
            billingOptionId: OPTION,
            payerEmail: 'mp@example.test'
        });
        expect(button.disabled).toBe(true);
        await act(async () => {
            resolveStart({ ok: false, error: { status: 503, reason: 'PROVIDER_BUSY' } });
        });
        expect(button.disabled).toBe(false);
    });

    it('reuses the declared email without showing the email field', () => {
        render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus="CHARGE_DECLINED"
                declaredPayerEmail="mp@example.test"
            />
        );

        expect(screen.queryByTestId('subscription-return-payer-email')).toBeNull();
    });

    it('asks for the payer email when the attempt stored none and never defaults silently', async () => {
        render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus="CHARGE_DECLINED"
            />
        );
        const input = screen.getByTestId('subscription-return-payer-email') as HTMLInputElement;
        expect(input.value).toBe('account@example.test');

        fireEvent.change(input, { target: { value: 'not-an-email' } });
        await act(async () => {
            fireEvent.click(screen.getByTestId('subscription-return-retry'));
        });

        expect(startMock).not.toHaveBeenCalled();
        expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    it('unlocks the button when the page is restored from the bfcache', async () => {
        startMock.mockReturnValue(new Promise(() => undefined));
        render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus="CHARGE_DECLINED"
                declaredPayerEmail="mp@example.test"
            />
        );
        const button = screen.getByTestId('subscription-return-retry') as HTMLButtonElement;
        await act(async () => {
            fireEvent.click(button);
        });
        expect(button.disabled).toBe(true);

        act(() => {
            window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
        });
        expect(button.disabled).toBe(true);
        act(() => {
            window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        });

        expect(button.disabled).toBe(false);
    });
});

describe('SubscriptionReturn recheck action', () => {
    it('offers "check again" when the server read failed (unknown)', () => {
        render(
            <SubscriptionReturn
                {...baseProps}
                initialStatus={null}
            />
        );

        expect(screen.getByTestId('subscription-return').dataset.view).toBe('unknown');
        expect(screen.getByText('billing.checkout.return.unknown.refresh')).toBeTruthy();
    });
});
