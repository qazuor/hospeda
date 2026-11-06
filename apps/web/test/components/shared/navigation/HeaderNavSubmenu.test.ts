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
        expect(header).toMatch(/\.header__nav\s+:global\(\.header__nav-link\)/);
        expect(header).toMatch(/\.header__nav\s+:global\(\.header__nav-link--active\)/);
    });
});
