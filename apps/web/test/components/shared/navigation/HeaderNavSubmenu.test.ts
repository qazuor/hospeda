import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const component = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/navigation/HeaderNavSubmenu.astro'),
    'utf8'
);
const styles = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/navigation/HeaderNavSubmenu.module.css'),
    'utf8'
);
const header = readFileSync(resolve(__dirname, '../../../../src/layouts/Header.astro'), 'utf8');

describe('HeaderNavSubmenu', () => {
    it('supports keyboard disclosure and preserves the parent link semantics', () => {
        expect(styles).toContain(':focus-within');
        expect(component).toContain('href={href}');
        expect(component).toContain("aria-current={isActive ? 'page' : undefined}");
    });

    it('lets scoped header navigation styles reach links rendered by child components', () => {
        // The base rule and the active rule must both open a declaration block
        // through the anchored :global() form, not merely be mentioned somewhere.
        expect(header).toMatch(/\.header__nav\s+:global\(\.header__nav-link\)\s*\{/);
        expect(header).toMatch(/\.header__nav\s+:global\(\.header__nav-link--active\)\s*\{/);
    });

    it('keeps no scoped .header__nav-link selector that a child component cannot match', () => {
        // Astro scopes a bare `.header__nav-link` selector to Header.astro's own
        // elements, so the submenu's parent link (rendered by a child component)
        // silently loses it. Every selector for the class must go through :global().
        const withoutGlobal = header.replace(/:global\(\.header__nav-link[\w-]*\)/g, '');
        expect(withoutGlobal).not.toMatch(/\.header__nav-link/);
    });
});
