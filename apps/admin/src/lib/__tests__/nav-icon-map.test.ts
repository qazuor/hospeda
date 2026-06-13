import { sidebars } from '@/config/ia/sidebars';
import { resolveNavIcon } from '@/lib/nav-icon-map';
import { describe, expect, it } from 'vitest';

/**
 * Recursively collect every `icon` string declared anywhere in the IA sidebar
 * configs (links, groups, nested groups).
 */
function collectIcons(node: unknown, acc: Set<string>): void {
    if (Array.isArray(node)) {
        for (const child of node) collectIcons(child, acc);
        return;
    }
    if (node && typeof node === 'object') {
        const obj = node as Record<string, unknown>;
        if (typeof obj.icon === 'string') acc.add(obj.icon);
        for (const value of Object.values(obj)) collectIcons(value, acc);
    }
}

describe('nav-icon-map', () => {
    it('resolves every icon referenced across the IA sidebar configs', () => {
        const icons = new Set<string>();
        collectIcons(sidebars, icons);

        expect(icons.size).toBeGreaterThan(0);

        const unresolved = [...icons].filter(
            (iconName) => resolveNavIcon({ iconName }) === undefined
        );

        expect(
            unresolved,
            `Sidebar icons not registered in NAV_ICON_MAP: ${unresolved.join(', ')}`
        ).toEqual([]);
    });

    it('resolves the SparkleIcon used by the AI Playground entry', () => {
        expect(resolveNavIcon({ iconName: 'SparkleIcon' })).toBeDefined();
    });
});
