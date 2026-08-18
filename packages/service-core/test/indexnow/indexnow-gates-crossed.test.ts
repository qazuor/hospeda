/**
 * @fileoverview
 * AC-11: nothing goes out unless EVERY gate opens (HOS-585).
 *
 * The gates live in three different layers on purpose — the deployment
 * environment in the adapter factory, the operator toggle in the service, and
 * the key plus the noindex-host check in the web endpoint — and each has its
 * own tests. What none of those prove is the interaction, which is the only
 * thing that matters: a feature with three switches is safe when ANY closed
 * switch stops the send, not when each one works in isolation.
 *
 * So this file drives the real initializer, the real factory and the real
 * service, and watches `fetch`. A request leaving here is a request that would
 * have reached the web endpoint.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    _resetIndexNowService,
    initializeIndexNowService
} from '../../src/indexnow/indexnow-init.js';

const CREDENTIALS = {
    revalidationSecret: 'shared-secret',
    siteUrl: 'https://hospeda.com.ar'
} as const;

/** A change that IS notifiable, so a dropped event cannot explain a silent run. */
const NOTIFIABLE_EVENT = { entityType: 'accommodation', slug: 'hotel-a' } as const;

function stubFetch() {
    // Typed parameters, not a bare `async () =>`: without them `mock.calls` is
    // an empty tuple and reading calls[0][0] to assert the URL is a type error.
    return vi.fn(
        async (_input: string | URL | Request, _init?: RequestInit) =>
            new Response(JSON.stringify({ submitted: 3 }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
    );
}

describe('IndexNow gates, crossed (AC-11)', () => {
    let fetchSpy: ReturnType<typeof stubFetch>;

    beforeEach(() => {
        _resetIndexNowService();
        fetchSpy = stubFetch();
        vi.stubGlobal('fetch', fetchSpy);
    });

    afterEach(() => {
        _resetIndexNowService();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('sends when production, the secret and the toggle all line up', async () => {
        const service = initializeIndexNowService({
            ...CREDENTIALS,
            deployEnv: 'prod',
            isEnabled: () => Promise.resolve(true)
        });

        service.scheduleNotification(NOTIFIABLE_EVENT);
        await service.flush();

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        // Guards the control: if this ever stops being the notification URL, the
        // three negative cases below would pass for the wrong reason.
        expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/indexnow/');
    });

    it('sends NOTHING with the toggle off, even in production with the secret set', async () => {
        const service = initializeIndexNowService({
            ...CREDENTIALS,
            deployEnv: 'prod',
            isEnabled: () => Promise.resolve(false)
        });

        service.scheduleNotification(NOTIFIABLE_EVENT);
        await service.flush();

        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sends NOTHING from staging, even with the toggle on and the secret set', async () => {
        const service = initializeIndexNowService({
            ...CREDENTIALS,
            deployEnv: 'staging',
            isEnabled: () => Promise.resolve(true)
        });

        service.scheduleNotification(NOTIFIABLE_EVENT);
        await service.flush();

        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sends NOTHING in production without the secret, toggle on', async () => {
        const service = initializeIndexNowService({
            siteUrl: CREDENTIALS.siteUrl,
            deployEnv: 'prod',
            isEnabled: () => Promise.resolve(true)
        });

        service.scheduleNotification(NOTIFIABLE_EVENT);
        await service.flush();

        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sends NOTHING when a toggle read fails, rather than assuming yes', async () => {
        const service = initializeIndexNowService({
            ...CREDENTIALS,
            deployEnv: 'prod',
            isEnabled: () => Promise.reject(new Error('database unreachable'))
        });

        service.scheduleNotification(NOTIFIABLE_EVENT);
        await service.flush();

        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
