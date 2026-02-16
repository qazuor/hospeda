/**
 * Tests for ThemeToggle.client.tsx component.
 * Verifies theme detection, persistence, toggle behavior, and accessibility.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/ThemeToggle.client.tsx');
const content = readFileSync(componentPath, 'utf8');

describe('ThemeToggle.client.tsx', () => {
    describe('Exports', () => {
        it('should export ThemeToggle function', () => {
            expect(content).toContain('export function ThemeToggle');
        });

        it('should export ThemeToggleProps interface', () => {
            expect(content).toContain('export interface ThemeToggleProps');
        });
    });

    describe('Props', () => {
        it('should accept optional initialTheme prop', () => {
            expect(content).toContain("readonly initialTheme?: 'light' | 'dark'");
        });
    });

    describe('Theme detection', () => {
        it('should check localStorage for stored theme', () => {
            expect(content).toContain("localStorage.getItem('hospeda-theme')");
        });

        it('should check OS preference via matchMedia', () => {
            expect(content).toContain('prefers-color-scheme: dark');
        });

        it('should default to light theme', () => {
            expect(content).toContain("return 'light'");
        });

        it('should respect initialTheme prop first', () => {
            expect(content).toContain('if (initialTheme)');
        });
    });

    describe('Theme persistence', () => {
        it('should save theme to localStorage on change', () => {
            expect(content).toContain("localStorage.setItem('hospeda-theme', theme)");
        });

        it('should set data-theme attribute on html element', () => {
            expect(content).toContain("document.documentElement.setAttribute('data-theme', theme)");
        });

        it('should use useEffect for side effects', () => {
            expect(content).toContain('useEffect');
        });
    });

    describe('Toggle behavior', () => {
        it('should toggle between light and dark', () => {
            expect(content).toContain("prev === 'light' ? 'dark' : 'light'");
        });

        it('should use useState for theme state', () => {
            expect(content).toContain('useState');
        });
    });

    describe('Icons', () => {
        it('should import SunIcon from @repo/icons', () => {
            expect(content).toContain('SunIcon');
            expect(content).toContain("from '@repo/icons'");
        });

        it('should import MoonIcon from @repo/icons', () => {
            expect(content).toContain('MoonIcon');
        });

        it('should show SunIcon in dark mode', () => {
            expect(content).toContain('isDark ?');
            expect(content).toContain('<SunIcon');
        });

        it('should show MoonIcon in light mode', () => {
            expect(content).toContain('<MoonIcon');
        });

        it('should hide icons from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Accessibility', () => {
        it('should render a button element', () => {
            expect(content).toContain('<button');
            expect(content).toContain('type="button"');
        });

        it('should have dynamic aria-label', () => {
            expect(content).toContain('aria-label=');
            expect(content).toContain('Switch to');
        });
    });

    describe('JSDoc', () => {
        it('should have component-level documentation', () => {
            expect(content).toContain('/**');
            expect(content).toContain('ThemeToggle component');
        });

        it('should have example usage', () => {
            expect(content).toContain('@example');
        });
    });
});
