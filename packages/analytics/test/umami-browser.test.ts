/**
 * Tests for the Umami browser client (HOS-2119, T-020).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserAnalytics } from '../src/browser.js';
import {
    createUmamiBrowserClient,
    hasUmamiCacheToken,
    type UmamiTracker
} from '../src/providers/umami-browser.js';

type FakeWindow = { umami?: UmamiTracker };

function setWindow(value: FakeWindow | undefined): void {
    (globalThis as { window?: FakeWindow }).window = value;
}

function makeTracker() {
    return { track: vi.fn(), identify: vi.fn() } satisfies UmamiTracker;
}

afterEach(() => {
    setWindow(undefined);
});

describe('createUmamiBrowserClient', () => {
    describe('when the tracker is unavailable', () => {
        it('should not throw with no window (SSR)', () => {
            setWindow(undefined);
            const client = createUmamiBrowserClient();
            expect(() => client.capture('a', { x: 1 })).not.toThrow();
            expect(() => client.identify('u1', { plan: 'p' })).not.toThrow();
            expect(() => client.captureTagged({ name: 'a', tag: 't' })).not.toThrow();
            expect(() => client.reset()).not.toThrow();
        });

        it('should not throw with a window without umami (ad-blocked)', () => {
            setWindow({});
            const client = createUmamiBrowserClient();
            expect(() => client.capture('a')).not.toThrow();
            expect(() => client.identify('u1')).not.toThrow();
        });

        it('should swallow errors thrown by the tracker', () => {
            const tracker = makeTracker();
            tracker.track.mockImplementation(() => {
                throw new Error('boom');
            });
            setWindow({ umami: tracker });
            expect(() => createUmamiBrowserClient().capture('a')).not.toThrow();
        });
    });

    describe('when the tracker is loaded', () => {
        it('should forward name and data exactly on capture', () => {
            const tracker = makeTracker();
            setWindow({ umami: tracker });
            createUmamiBrowserClient().capture('contact_owner_started', { a: 'x', n: 2 });
            expect(tracker.track).toHaveBeenCalledTimes(1);
            expect(tracker.track.mock.calls[0]).toEqual([
                'contact_owner_started',
                { a: 'x', n: 2 }
            ]);
        });

        it('should forward id and data on identify', () => {
            const tracker = makeTracker();
            setWindow({ umami: tracker });
            createUmamiBrowserClient().identify('user-1', { role: 'host' });
            expect(tracker.identify.mock.calls[0]).toEqual(['user-1', { role: 'host' }]);
        });

        it('should forward only the id on identify without data', () => {
            const tracker = makeTracker();
            setWindow({ umami: tracker });
            createUmamiBrowserClient().identify('user-1');
            expect(tracker.identify.mock.calls[0]).toEqual(['user-1']);
        });

        it('should send a tagged event through the callback form', () => {
            const tracker = makeTracker();
            setWindow({ umami: tracker });
            createUmamiBrowserClient().captureTagged({ name: 'e', data: { k: 'v' }, tag: 'ent-1' });
            const arg = tracker.track.mock.calls[0]?.[0] as (p: Record<string, unknown>) => unknown;
            expect(typeof arg).toBe('function');
            expect(arg({ website: 'w', url: '/x' })).toEqual({
                website: 'w',
                url: '/x',
                name: 'e',
                data: { k: 'v' },
                tag: 'ent-1'
            });
        });
    });

    describe('when the tracker loads late', () => {
        it('should pick up window.umami on the next call (not captured at construction)', () => {
            setWindow({});
            const client = createUmamiBrowserClient();
            client.capture('early');
            const tracker = makeTracker();
            setWindow({ umami: tracker });
            client.capture('late', { a: 1 });
            expect(tracker.track.mock.calls).toEqual([['late', { a: 1 }]]);
        });
    });

    describe('integration with createBrowserAnalytics', () => {
        it('should work as getClient provider', () => {
            const tracker = makeTracker();
            setWindow({ umami: tracker });
            const client = createUmamiBrowserClient();
            const analytics = createBrowserAnalytics({ enabled: true, getClient: () => client });
            analytics.reset();
            expect(tracker.track).not.toHaveBeenCalled();
        });
    });
});

describe('hasUmamiCacheToken (identify order, OQ-5)', () => {
    it('should be true when getSession() holds a non-empty cache token', () => {
        const tracker = { ...makeTracker(), getSession: () => ({ cache: 'token', website: 'w' }) };
        expect(hasUmamiCacheToken({ tracker })).toBe(true);
    });

    it.each([
        ['an unanswered pageview (no cache)', { getSession: () => ({ website: 'w' }) }],
        ['an empty cache', { getSession: () => ({ cache: '' }) }],
        ['a non-string cache', { getSession: () => ({ cache: 42 }) }],
        ['a null session', { getSession: () => null }],
        ['a tracker without getSession', {}],
        [
            'a getSession that throws',
            {
                getSession: () => {
                    throw new Error('boom');
                }
            }
        ]
    ])('should be false for %s', (_label, extra) => {
        expect(hasUmamiCacheToken({ tracker: { ...makeTracker(), ...extra } })).toBe(false);
    });

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['a string', 'umami']
    ])('should be false, never throw, for a %s tracker', (_label, tracker) => {
        expect(hasUmamiCacheToken({ tracker })).toBe(false);
    });
});
