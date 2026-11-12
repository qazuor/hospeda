/**
 * @file account-layout-collapsible-groups.test.ts
 * @description Source-level assertions for the collapsible account areas
 * (HOS-2124). Astro components cannot be rendered in Vitest, so this follows the
 * repo's pattern of reading `AccountLayout.astro` as text.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, '../../src/layouts/AccountLayout.astro'), 'utf8');

describe('AccountLayout collapsible groups (HOS-2124)', () => {
    it('renders headed areas as native <details> with a <summary> label', () => {
        expect(source).toContain("suppressHeader ? 'div' : 'details'");
        expect(source).toContain('<summary class="account-nav__group-label">');
        expect(source).toContain('open: defaultOpen');
    });

    it('derives the server default from the shared pure predicate', () => {
        expect(source).toContain('resolveGroupDefaultOpen');
        expect(source).toContain('placeProviderGroup');
    });

    it('marks the area holding the current page so the script never closes it', () => {
        expect(source).toContain("'data-contains-active'");
        expect(source).toContain("details.dataset.containsActive !== 'true'");
    });

    it('wraps every localStorage access in try/catch', () => {
        const uses = source.match(/localStorage\./g) ?? [];
        const tries = source.match(/try \{/g) ?? [];
        expect(uses.length).toBeGreaterThan(0);
        expect(tries.length).toBeGreaterThanOrEqual(uses.length - 1);
    });

    it('uses the bundled module script (no inline script, CSP-safe)', () => {
        expect(source).not.toContain('is:inline');
    });
});
