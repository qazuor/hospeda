/**
 * @file contacto-social-links.test.ts
 * @description The contact page's social profile links come from the one brand
 * source, `BRAND_SOCIAL_PROFILES` in `@repo/config` (HOS-2565 PR-4). Before that the
 * page hand-wrote them, and its Facebook URL (`facebook.com/hospeda`) disagreed with
 * the canonical one the footer and the emails use (`www.facebook.com/hospeda.com.ar`).
 *
 * Source-read, matching the convention of the other `.astro` tests in this suite.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BRAND_SOCIAL_PROFILES } from '@repo/config';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/contacto/index.astro'), 'utf8');

describe('contact page social links (HOS-2565 PR-4)', () => {
    it('should read the profiles from @repo/config', () => {
        // Assert
        expect(src).toMatch(/import \{[^}]*\bBRAND_SOCIAL_PROFILES\b[^}]*\} from '@repo\/config'/);
        expect(src).toContain("href: brandProfileUrl('instagram')");
        expect(src).toContain("href: brandProfileUrl('facebook')");
    });

    it('should hand-write no social profile URL', () => {
        // Assert
        expect(src).not.toMatch(/https?:\/\/(www\.)?(instagram|facebook|x|twitter|tiktok)\.com\//);
    });

    it('should have a canonical Facebook profile to point at', () => {
        // Assert
        const facebook = BRAND_SOCIAL_PROFILES.find((profile) => profile.platform === 'facebook');
        expect(facebook?.url).toBe('https://www.facebook.com/hospeda.com.ar');
    });
});
