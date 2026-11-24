/**
 * @file social-handle.test.ts
 * @description The handle ⇄ URL conversions of the accommodation contact page
 * (BETA-139), rehomed from the retired `SocialNetworksSection` (HOS-2508).
 */

import { describe, expect, it } from 'vitest';
import { ACCOMMODATION_SOCIAL_HTTP_KEYS } from '@/components/host/editor/forms/contact-payload';
import {
    ACCOMMODATION_SOCIAL_FIELDS,
    composeSocialUrl,
    parseSocialHandle
} from '@/components/host/editor/forms/social-handle';

describe('ACCOMMODATION_SOCIAL_FIELDS', () => {
    it('covers exactly the six HTTP keys, in order', () => {
        expect(ACCOMMODATION_SOCIAL_FIELDS.map((f) => f.schemaKey)).toEqual([
            ...ACCOMMODATION_SOCIAL_HTTP_KEYS
        ]);
    });

    it('pairs each network with its fixed domain addon', () => {
        expect(ACCOMMODATION_SOCIAL_FIELDS.map((f) => f.domain)).toEqual([
            'facebook.com/',
            'instagram.com/',
            'x.com/',
            'linkedin.com/in/',
            'tiktok.com/@',
            'youtube.com/@'
        ]);
    });
});

describe('parseSocialHandle', () => {
    it('strips scheme, www and the domain down to the handle', () => {
        expect(
            parseSocialHandle({ url: 'https://facebook.com/test', domain: 'facebook.com/' }).handle
        ).toBe('test');
        expect(
            parseSocialHandle({
                url: 'https://www.instagram.com/testuser',
                domain: 'instagram.com/'
            }).handle
        ).toBe('testuser');
    });

    it('returns an empty handle for an empty or missing value', () => {
        expect(parseSocialHandle({ url: '', domain: 'x.com/' }).handle).toBe('');
        expect(parseSocialHandle({ url: null, domain: 'x.com/' }).handle).toBe('');
        expect(parseSocialHandle({ url: undefined, domain: 'x.com/' }).handle).toBe('');
    });

    it('returns the raw value when it does not match the domain', () => {
        const url = 'https://not-facebook.example.com/test';
        expect(parseSocialHandle({ url, domain: 'facebook.com/' }).handle).toBe(url);
    });
});

describe('composeSocialUrl', () => {
    it('composes https://<domain><handle>', () => {
        expect(composeSocialUrl({ handle: 'mi-usuario', domain: 'x.com/' }).url).toBe(
            'https://x.com/mi-usuario'
        );
    });

    it('never saves a bare domain for a blank handle', () => {
        expect(composeSocialUrl({ handle: '   ', domain: 'x.com/' }).url).toBe('');
    });

    it('keeps a full URL as-is instead of double-prefixing it', () => {
        const url = 'https://not-facebook.example.com/test';
        expect(composeSocialUrl({ handle: url, domain: 'facebook.com/' }).url).toBe(url);
    });

    it('round-trips with parseSocialHandle', () => {
        for (const { domain } of ACCOMMODATION_SOCIAL_FIELDS) {
            const { url } = composeSocialUrl({ handle: 'hospeda', domain });
            expect(parseSocialHandle({ url, domain }).handle).toBe('hospeda');
        }
    });
});
