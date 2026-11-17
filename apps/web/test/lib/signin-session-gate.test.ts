/**
 * @file signin-session-gate.test.ts
 * @description BETA-216: which authenticated `/auth/signin` visits keep the
 * silent redirect and which get the "already signed in" interstitial.
 */

import { describe, expect, it } from 'vitest';
import { resolveAuthenticatedSigninAction } from '../../src/lib/signin-session-gate';

describe('resolveAuthenticatedSigninAction', () => {
    it.each([
        ['no query', ''],
        ['a returnUrl', '?returnUrl=%2Fes%2Fmi-cuenta%2F'],
        ['a legacy redirect param', '?redirect=%2Fes%2Fmi-cuenta%2F'],
        ['an admin callbackUrl', '?callbackUrl=https%3A%2F%2Fadmin.hospeda.com.ar%2F'],
        ['verified=0', '?verified=0']
    ])('shows the interstitial for %s', (_label, search) => {
        expect(resolveAuthenticatedSigninAction({ search })).toBe('interstitial');
    });

    it('keeps the silent redirect for a signed OAuth authorization request', () => {
        const search = '?client_id=abc&sig=xyz&ba_param=client_id&scope=openid';
        expect(resolveAuthenticatedSigninAction({ search })).toBe('redirect');
    });

    it('keeps the silent redirect for the post-verification landing', () => {
        expect(resolveAuthenticatedSigninAction({ search: '?verified=1' })).toBe('redirect');
    });

    it('does not treat a half-signed OAuth query as a signed request', () => {
        expect(resolveAuthenticatedSigninAction({ search: '?client_id=abc&sig=xyz' })).toBe(
            'interstitial'
        );
    });
});
