/**
 * TEST:B1:18 (AC:B1:17): the composition root injects the clock.
 *
 * - `apps/api` started through its composition root with nothing injected (as
 *   `src/index.ts` does in production) reads the system time;
 * - started in a test with the adjustable clock, it reads that one;
 * - advancing the adjustable clock moves the time the code reads, both from
 *   the injected instance and from inside a request.
 *
 * The app is built whole (`initApp`, every route) over the suite's mocked
 * database layer: the clock itself touches no table.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { getClock, injectClock, systemClock } from '../../src/utils/clock';
import { validateApiEnv } from '../../src/utils/env';

const THREE_AM = new Date('2026-10-01T03:00:00.000Z');

beforeAll(() => {
    validateApiEnv();
});

describe('TEST:B1:18 the composition root injects the clock', () => {
    it('in production (nothing injected) the app reads the system time', () => {
        // Act
        initApp();
        const before = Date.now();
        const read = getClock().clock.now().getTime();
        const after = Date.now();

        // Assert
        expect(getClock().clock).toBe(systemClock);
        expect(read).toBeGreaterThanOrEqual(before);
        expect(read).toBeLessThanOrEqual(after);
    });

    it('in a test the app reads the adjustable clock, and advancing it moves the time', () => {
        // Arrange
        const clock = createAdjustableClock({ start: THREE_AM });

        // Act
        initApp({ clock });
        const first = getClock().clock.now();
        clock.advance({ ms: 10 * 24 * 60 * 60_000 });
        const second = getClock().clock.now();

        // Assert
        expect(getClock().clock).toBe(clock);
        expect(first).toEqual(THREE_AM);
        expect(second).toEqual(new Date('2026-10-11T03:00:00.000Z'));
    });

    it('a request handled by the app reads the injected time', async () => {
        // Arrange: a probe route on the app the root composed
        const clock = createAdjustableClock({ start: THREE_AM });
        const app = initApp({ clock });
        app.get('/__test/clock-probe', (c) =>
            c.json({ now: getClock().clock.now().toISOString() })
        );
        const probe = async (): Promise<{ readonly status: number; readonly now?: string }> => {
            const res = await app.request('/__test/clock-probe', {
                headers: { 'user-agent': 'vitest' }
            });
            // The app's response middleware wraps every JSON body in `{ data }`.
            const body = (await res.json()) as { data?: { now?: string } };
            return { status: res.status, now: body.data?.now };
        };

        // Act
        const first = await probe();
        clock.advance({ ms: 40 * 60_000 });
        const second = await probe();

        // Assert
        expect(first.status).toBe(200);
        expect(first.now).toBe('2026-10-01T03:00:00.000Z');
        expect(second.now).toBe('2026-10-01T03:40:00.000Z');
    });

    it('the system clock reads the time fresh on every call', () => {
        const a = systemClock.now();
        a.setTime(0);
        expect(systemClock.now().getTime()).toBeGreaterThan(0);
    });

    it('refuses to inject something that is not a clock', () => {
        expect(() => injectClock({ clock: {} as unknown as typeof systemClock })).toThrow(
            TypeError
        );
    });
});
