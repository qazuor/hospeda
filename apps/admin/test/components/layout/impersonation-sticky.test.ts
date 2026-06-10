/**
 * @file impersonation-sticky.test.ts
 * @description Source-level regression guard for BETA-79.
 *
 * The impersonation banner and the header were each `sticky top-0`, so on
 * scroll they stacked at the same offset and the banner (z-50) covered the
 * header (z-40). The fix wraps both in a SINGLE sticky container so they pile
 * vertically instead of overlapping. These assertions keep that structure
 * from regressing (e.g. someone re-adding `sticky top-0` to either element).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string): string => readFileSync(resolve(__dirname, p), 'utf8');

const appLayout = read('../../../src/components/layout/AppLayout.tsx');
const banner = read('../../../src/components/auth/ImpersonationBanner.tsx');
const header = read('../../../src/components/layout/header/Header.tsx');

describe('admin sticky chrome (BETA-79)', () => {
    it('wraps the impersonation banner and header in one sticky container', () => {
        expect(appLayout).toMatch(
            /sticky top-0 z-50[\s\S]*<ImpersonationBanner \/>[\s\S]*<Header \/>/
        );
    });

    it('the impersonation banner is not individually sticky', () => {
        expect(banner).not.toMatch(/sticky top-0/);
    });

    it('the header element is not individually sticky', () => {
        expect(header).not.toMatch(/<header className="sticky top-0/);
    });
});
