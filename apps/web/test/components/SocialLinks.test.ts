/**
 * @file SocialLinks.test.ts
 * @description Guards the single-source-of-truth for social profile URLs
 * (SPEC-157 REQ-5 follow-up). SocialLinks.astro and OrganizationJsonLd both
 * derive from SOCIAL_PROFILES in constants.ts; this test prevents a regression
 * back to hardcoded URLs in the footer component.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOCIAL_PROFILES, SOCIAL_PROFILE_URLS, TWITTER_SITE_HANDLE } from '../../src/lib/constants';

const src = readFileSync(
    resolve(__dirname, '../../src/components/shared/SocialLinks.astro'),
    'utf8'
);

describe('SocialLinks.astro (SPEC-157 REQ-5 SSoT)', () => {
    it('sources profile URLs from SOCIAL_PROFILES, not hardcoded literals', () => {
        expect(src).toContain('SOCIAL_PROFILES');
        // The previously-hardcoded URLs must no longer live in the component.
        expect(src).not.toContain('facebook.com/hospeda');
        expect(src).not.toContain('wa.me/');
    });
});

describe('SOCIAL_PROFILES (constants)', () => {
    it('lists the brand profiles plus the WhatsApp channel', () => {
        const platforms = SOCIAL_PROFILES.map((profile) => profile.platform);
        expect(platforms).toContain('facebook');
        expect(platforms).toContain('instagram');
        expect(platforms).toContain('x');
        expect(platforms).toContain('youtube');
        expect(platforms).toContain('whatsapp');
    });

    it('excludes WhatsApp from the sameAs URL list (messaging, not a profile)', () => {
        expect(SOCIAL_PROFILE_URLS.some((url) => url.includes('wa.me'))).toBe(false);
        expect(SOCIAL_PROFILE_URLS).toHaveLength(4);
    });

    it('the X profile URL matches TWITTER_SITE_HANDLE (footer ↔ twitter:site coherence)', () => {
        const xProfile = SOCIAL_PROFILES.find((profile) => profile.platform === 'x');
        const handle = TWITTER_SITE_HANDLE.replace(/^@/, '');
        expect(xProfile?.url).toBe(`https://x.com/${handle}`);
    });
});
