/**
 * @fileoverview
 * Tests for the IndexNow singleton wiring (HOS-585 G-1).
 *
 * What matters here is which adapter a given deployment gets. The gate is
 * deliberately stricter than revalidation's: staging has a real cache to purge
 * and NO business announcing URLs it serves under `Disallow: /`. So the only
 * environment that gets a live adapter is production, and anything the resolver
 * cannot name is treated as "not production" rather than guessed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    _resetIndexNowService,
    getIndexNowService,
    initializeIndexNowService
} from '../../src/indexnow/indexnow-init.js';

const alwaysEnabled = () => Promise.resolve(true);

/** Every parameter a live adapter needs, minus the environment. */
const LIVE_CREDENTIALS = {
    revalidationSecret: 'shared-secret',
    siteUrl: 'https://hospeda.com.ar',
    isEnabled: alwaysEnabled
} as const;

describe('initializeIndexNowService', () => {
    beforeEach(() => {
        _resetIndexNowService();
    });

    afterEach(() => {
        _resetIndexNowService();
        vi.restoreAllMocks();
    });

    it('gets the live adapter in production', () => {
        const service = initializeIndexNowService({
            ...LIVE_CREDENTIALS,
            deployEnv: 'prod'
        });

        expect(service.getAdapterName()).toBe('http');
    });

    it.each([
        'staging',
        'dev',
        'test'
    ])('sends nothing from %s, even with the secret configured', (deployEnv) => {
        const service = initializeIndexNowService({
            ...LIVE_CREDENTIALS,
            deployEnv
        });

        expect(service.getAdapterName()).toBe('noop');
    });

    it('sends nothing in production without the shared secret', () => {
        const service = initializeIndexNowService({
            siteUrl: 'https://hospeda.com.ar',
            isEnabled: alwaysEnabled,
            deployEnv: 'prod'
        });

        expect(service.getAdapterName()).toBe('noop');
    });

    it('sends nothing in production without a site URL', () => {
        const service = initializeIndexNowService({
            revalidationSecret: 'shared-secret',
            isEnabled: alwaysEnabled,
            deployEnv: 'prod'
        });

        expect(service.getAdapterName()).toBe('noop');
    });

    it('fails closed when the deployment cannot be named', () => {
        // NODE_ENV=production with no HOSPEDA_DEPLOY_ENV: the resolver refuses
        // to guess, because staging runs it too. Refusing must mean "no
        // notification", never "assume prod".
        const service = initializeIndexNowService({
            ...LIVE_CREDENTIALS,
            deployEnv: undefined,
            nodeEnv: 'production'
        });

        expect(service.getAdapterName()).toBe('noop');
    });

    it('fails closed on an unrecognised HOSPEDA_DEPLOY_ENV', () => {
        const service = initializeIndexNowService({
            ...LIVE_CREDENTIALS,
            deployEnv: 'produccion'
        });

        expect(service.getAdapterName()).toBe('noop');
    });

    it('is idempotent — a second call returns the first instance untouched', () => {
        const first = initializeIndexNowService({ ...LIVE_CREDENTIALS, deployEnv: 'staging' });
        const second = initializeIndexNowService({ ...LIVE_CREDENTIALS, deployEnv: 'prod' });

        expect(second).toBe(first);
        expect(second.getAdapterName()).toBe('noop');
    });

    it('getIndexNowService returns undefined before startup wiring runs', () => {
        expect(getIndexNowService()).toBeUndefined();
    });

    it('getIndexNowService returns the instance after initialization', () => {
        const service = initializeIndexNowService({ ...LIVE_CREDENTIALS, deployEnv: 'prod' });

        expect(getIndexNowService()).toBe(service);
    });
});
