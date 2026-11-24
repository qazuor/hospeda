/**
 * @file account-layout-collapsible-groups.test.ts
 * @description Source-level assertions for the collapsible account areas
 * (HOS-2124). Since HOS-2508 removed the legacy frame, the areas render in the
 * kit `AccountSidebar`, the remembered state is applied by `AccountShell`'s
 * pre-paint script and `applyStoredNavState` (`lib/account-nav-collapse.ts`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, '../../src/layouts/AccountLayout.astro'), 'utf8');
const sidebarSource = readFileSync(
    resolve(__dirname, '../../src/components/account/ui/AccountSidebar.tsx'),
    'utf8'
);
const collapseSource = readFileSync(
    resolve(__dirname, '../../src/lib/account-nav-collapse.ts'),
    'utf8'
);
// HOS-2413 T-017: the nav DATA moved into the model; the layout only renders it.
const modelSource = readFileSync(resolve(__dirname, '../../src/lib/account-nav-model.ts'), 'utf8');

describe('AccountLayout collapsible groups (HOS-2124)', () => {
    it('renders headed areas as native <details> with a <summary> label', () => {
        expect(sidebarSource).toContain('if (group.suppressHeader) {');
        expect(sidebarSource).toContain('<details');
        expect(sidebarSource).toContain('<summary className={styles.summary}>');
        expect(sidebarSource).toContain('open={group.open}');
    });

    it('derives the server default from the shared pure predicate', () => {
        expect(modelSource).toContain('resolveGroupDefaultOpen');
        expect(modelSource).toContain('placeProviderGroup');
        expect(source).toContain('buildAccountNavModel');
    });

    it('marks the area holding the current page so the script never closes it', () => {
        expect(sidebarSource).toContain(
            "data-contains-active={group.containsActive ? 'true' : undefined}"
        );
        expect(collapseSource).toContain("details.dataset.containsActive !== 'true'");
    });

    it('wraps every localStorage access in try/catch', () => {
        const uses = collapseSource.match(/(localStorage|store|storage\(\))\.(get|set)Item/g) ?? [];
        const tries = collapseSource.match(/try \{/g) ?? [];
        expect(uses.length).toBeGreaterThan(0);
        expect(tries.length).toBeGreaterThanOrEqual(uses.length - 1);
    });

    it('leaves no nav script in the layout itself', () => {
        expect(source).not.toContain('<script');
    });
});
