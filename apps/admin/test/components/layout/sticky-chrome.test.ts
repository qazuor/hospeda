/**
 * @file sticky-chrome.test.ts
 * @description Source-level regression guard for BETA-79.
 *
 * The header used to share the top offset with a second sticky element (the
 * impersonation banner, retired by HOS-1352 V5), and on scroll the two
 * overlapped. The fix wraps the chrome in a SINGLE sticky container and keeps
 * the header itself non-sticky. These assertions keep that structure from
 * regressing (e.g. someone re-adding `sticky top-0` to the header).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string): string => readFileSync(resolve(__dirname, p), 'utf8');

const appLayout = read('../../../src/components/layout/AppLayout.tsx');
const header = read('../../../src/components/layout/header/Header.tsx');

describe('admin sticky chrome (BETA-79)', () => {
    it('wraps the header in one sticky container', () => {
        expect(appLayout).toMatch(/<div className="sticky top-0 z-50">\s*\{[^}]*\}\s*<Header \/>/);
    });

    it('the header element is not individually sticky', () => {
        expect(header).not.toMatch(/<header className="sticky top-0/);
    });
});
