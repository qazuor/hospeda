import { afterEach, describe, expect, it, vi } from 'vitest';
import { scheduleSubscriptionRefresh } from '@/lib/billing/refresh-subscription-card';

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('TEST:HOS-2303 scheduleSubscriptionRefresh', () => {
    it('reloads the page once after the default 2500 ms delay', () => {
        const reload = vi.fn();
        vi.stubGlobal('location', { reload });
        vi.useFakeTimers();

        scheduleSubscriptionRefresh({});

        expect(reload).not.toHaveBeenCalled();
        vi.advanceTimersByTime(2499);
        expect(reload).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('honours a custom delay', () => {
        const reload = vi.fn();
        vi.stubGlobal('location', { reload });
        vi.useFakeTimers();

        scheduleSubscriptionRefresh({ delayMs: 1000 });

        vi.advanceTimersByTime(999);
        expect(reload).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(reload).toHaveBeenCalledTimes(1);
    });
});
