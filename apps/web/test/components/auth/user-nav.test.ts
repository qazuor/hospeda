import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const filePath = resolve(__dirname, '../../../src/components/auth/UserNav.client.tsx');
const content = readFileSync(filePath, 'utf8');

describe('UserNav.client.tsx', () => {
    it('should use ChevronDownIcon from @repo/icons (not inline SVG)', () => {
        expect(content).toContain("import { ChevronDownIcon } from '@repo/icons'");
        expect(content).toContain('<ChevronDownIcon');
        expect(content).not.toContain('<svg');
    });

    it('should use buildUrl for all account links', () => {
        expect(content).toContain("import { buildUrl } from '../../lib/urls'");
        expect(content).toContain("path: 'mi-cuenta'");
        expect(content).toContain("path: 'mi-cuenta/favoritos'");
        expect(content).toContain("path: 'mi-cuenta/resenas'");
        expect(content).toContain("path: 'mi-cuenta/preferencias'");
    });

    it('should not use hardcoded locale paths', () => {
        expect(content).not.toMatch(/href="\/es\//);
        expect(content).not.toMatch(/href="\/en\//);
    });

    it('should include all four account menu links', () => {
        expect(content).toContain('Mi cuenta');
        expect(content).toContain('Favoritos');
        expect(content).toContain('Mis resenas');
        expect(content).toContain('Preferencias');
    });

    it('should use text-destructive for sign-out (not hardcoded red)', () => {
        expect(content).toContain('text-destructive');
        expect(content).not.toContain('text-red-');
    });

    it('should have proper ARIA attributes', () => {
        expect(content).toContain('aria-expanded');
        expect(content).toContain('aria-haspopup="menu"');
        expect(content).toContain('role="menu"');
        expect(content).toContain('role="menuitem"');
    });

    it('should handle click-outside and escape key', () => {
        expect(content).toContain('handleClickOutside');
        expect(content).toContain("event.key === 'Escape'");
    });

    it('should support hero and scrolled variants', () => {
        expect(content).toContain("'hero' | 'scrolled'");
        expect(content).toContain("activeVariant === 'scrolled'");
    });

    it('should use design system tokens only (no hardcoded colors)', () => {
        // Should use token-based colors
        expect(content).toContain('bg-accent');
        expect(content).toContain('text-accent-foreground');
        expect(content).toContain('text-foreground');
        expect(content).toContain('bg-card');
        expect(content).toContain('border-border');
        // Should not have arbitrary Tailwind palette colors (numbered scale variants).
        // text-white / bg-white with opacity modifiers are permitted for the hero variant
        // where text and backgrounds render over a dark image overlay.
        expect(content).not.toMatch(/text-(black|gray-\d+|red-\d+|blue-\d+)/);
        expect(content).not.toMatch(/bg-(black|gray-\d+|red-\d+|blue-\d+)/);
    });

    it('should export UserNavUser and UserNavProps interfaces', () => {
        expect(content).toContain('export interface UserNavUser');
        expect(content).toContain('export interface UserNavProps');
    });

    it('should listen for navbar:scroll custom event', () => {
        expect(content).toContain('navbar:scroll');
        expect(content).toContain('navbar.addEventListener');
    });
});
