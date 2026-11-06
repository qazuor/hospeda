import { describe, expect, it } from 'vitest';
import {
    AUTHORIZATION_RETURN_PATH,
    AUTHORIZATION_RETURN_SUBSCRIPTION_PARAM,
    buildAuthorizationReturnUrl
} from '../../../../src/services/billing/subscription/authorization-return-url.js';

const subscriptionId = '123e4567-e89b-42d3-a456-426614174000';

describe('buildAuthorizationReturnUrl (HOS-1979)', () => {
    it('points at the account subscription screen, not the home page', () => {
        const url = new URL(
            buildAuthorizationReturnUrl({ siteUrl: 'https://hospeda.com.ar', subscriptionId })
        );

        expect(url.origin).toBe('https://hospeda.com.ar');
        expect(url.pathname).toBe(AUTHORIZATION_RETURN_PATH);
        expect(url.pathname).toBe('/es/mi-cuenta/suscripcion/');
    });

    it('carries our subscription id in the query', () => {
        const url = new URL(
            buildAuthorizationReturnUrl({ siteUrl: 'https://hospeda.com.ar', subscriptionId })
        );

        expect(url.searchParams.get(AUTHORIZATION_RETURN_SUBSCRIPTION_PARAM)).toBe(subscriptionId);
    });

    it('follows the environment origin, including a local port', () => {
        expect(
            buildAuthorizationReturnUrl({ siteUrl: 'http://localhost:4321', subscriptionId })
        ).toBe(`http://localhost:4321/es/mi-cuenta/suscripcion/?subscription=${subscriptionId}`);
    });

    it('ignores a trailing slash and any path on the site url', () => {
        expect(
            buildAuthorizationReturnUrl({
                siteUrl: 'https://staging.hospeda.com.ar/',
                subscriptionId
            })
        ).toBe(
            `https://staging.hospeda.com.ar/es/mi-cuenta/suscripcion/?subscription=${subscriptionId}`
        );
        expect(
            buildAuthorizationReturnUrl({
                siteUrl: 'https://hospeda.example/account',
                subscriptionId
            })
        ).toContain('https://hospeda.example/es/mi-cuenta/suscripcion/');
    });

    it('never leaves the old home-page back_url', () => {
        const built = buildAuthorizationReturnUrl({
            siteUrl: 'https://hospeda.com.ar',
            subscriptionId
        });

        expect(built).not.toBe('https://hospeda.com.ar');
        expect(built).not.toBe('https://hospeda.com.ar/');
    });
});
