/**
 * @file theme-toggle.test.ts
 * @description Focused tests for ThemeToggle.astro.
 *
 * Covers: Props interface, button semantics, inline SVG icon structure,
 * localStorage persistence pattern, data-theme attribute manipulation,
 * icon visibility toggling, view-transition support, and Tailwind token usage.
 *
 * Strategy: source-file reading via readFileSync (Astro has no DOM renderer
 * in Vitest). All assertions are string/regex matches against the raw source.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const src = readFileSync(
    resolve(__dirname, '../../../src/components/ui/ThemeToggle.astro'),
    'utf8'
);

// ---------------------------------------------------------------------------
// Props interface
// ---------------------------------------------------------------------------

describe('ThemeToggle.astro - Props interface', () => {
    it('should define a Props interface', () => {
        // Arrange / Act / Assert
        expect(src).toContain('interface Props');
    });

    it('should expose an optional class prop for external styling', () => {
        expect(src).toContain('class?: string');
    });

    it('should destructure class as className with empty-string default', () => {
        expect(src).toContain('class: className = ""');
    });
});

// ---------------------------------------------------------------------------
// Button element semantics
// ---------------------------------------------------------------------------

describe('ThemeToggle.astro - Button element', () => {
    it('should render a <button> element (not a <div> or <span>)', () => {
        expect(src).toContain('<button');
    });

    it('should have id="theme-toggle" for JS targeting', () => {
        expect(src).toContain('id="theme-toggle"');
    });

    it('should set type="button" to prevent accidental form submission', () => {
        expect(src).toContain('type="button"');
    });

    it('should have a non-empty aria-label for screen-reader users', () => {
        expect(src).toContain('aria-label="Toggle dark mode"');
    });

    it('should have a matching title attribute for sighted users with pointer', () => {
        expect(src).toContain('title="Toggle dark mode"');
    });

    it('should apply cursor-pointer utility for correct cursor feedback', () => {
        expect(src).toContain('cursor-pointer');
    });

    it('should use class:list for conditional class merging', () => {
        expect(src).toContain('class:list={[');
    });

    it('should include the custom className prop in class:list', () => {
        expect(src).toContain('className,');
    });
});

// ---------------------------------------------------------------------------
// Semantic color tokens on the button
// ---------------------------------------------------------------------------

describe('ThemeToggle.astro - Semantic token usage', () => {
    it('should use bg-hero-surface token (not a hardcoded bg-white or bg-gray)', () => {
        expect(src).toContain('bg-hero-surface');
        expect(src).not.toContain('bg-white');
        expect(src).not.toContain('bg-gray-');
    });

    it('should use text-hero-text token for icon color', () => {
        expect(src).toContain('text-hero-text');
    });

    it('should use border-hero-border semantic token for the ring outline', () => {
        expect(src).toContain('border-hero-border');
    });

    it('should use focus-visible:ring-ring for focus indicator', () => {
        expect(src).toContain('focus-visible:ring-ring');
    });

    it('should apply transition-colors for smooth theme switch', () => {
        expect(src).toContain('transition-colors');
    });
});

// ---------------------------------------------------------------------------
// SVG icon structure
// ---------------------------------------------------------------------------

describe('ThemeToggle.astro - SVG icons', () => {
    it('should include a sun SVG icon with the theme-toggle__sun class', () => {
        expect(src).toContain('theme-toggle__sun');
    });

    it('should include a moon SVG icon with the theme-toggle__moon class', () => {
        expect(src).toContain('theme-toggle__moon');
    });

    it('should start the sun icon hidden (shown only in dark mode)', () => {
        // The sun SVG must start with the "hidden" class applied
        expect(src).toContain('theme-toggle__sun hidden');
    });

    it('should mark SVG icons as aria-hidden to avoid duplicate announcements', () => {
        // There must be at least one aria-hidden="true" for the decorative icons
        expect(src).toContain('aria-hidden="true"');
    });

    it('should size both icons consistently at h-4 w-4', () => {
        expect(src).toContain('h-4 w-4');
    });

    it('should use inline SVG with stroke-based icons (no external image)', () => {
        expect(src).toContain('stroke="currentColor"');
    });

    it('should set viewBox="0 0 24 24" on both SVG icons', () => {
        // Both SVGs share the same viewBox
        expect(src).toMatch(/viewBox="0 0 24 24"/);
    });

    it('should use fill="none" to keep icons outline-only', () => {
        expect(src).toContain('fill="none"');
    });

    it('should set stroke-width="2" for consistent weight', () => {
        expect(src).toContain('stroke-width="2"');
    });
});

// ---------------------------------------------------------------------------
// syncIcon function
// ---------------------------------------------------------------------------

describe('ThemeToggle.astro - syncIcon function', () => {
    it('should define syncIcon to synchronise icon visibility with theme', () => {
        expect(src).toContain('function syncIcon');
    });

    it('should accept an isDark boolean parameter', () => {
        expect(src).toContain('isDark: boolean');
    });

    it('should query the sun element by class selector', () => {
        expect(src).toContain('.theme-toggle__sun');
    });

    it('should query the moon element by class selector', () => {
        expect(src).toContain('.theme-toggle__moon');
    });

    it('should remove "hidden" from sun when isDark is true', () => {
        expect(src).toContain('sun.classList.remove("hidden")');
    });

    it('should add "hidden" to moon when isDark is true', () => {
        expect(src).toContain('moon.classList.add("hidden")');
    });

    it('should add "hidden" to sun when isDark is false', () => {
        expect(src).toContain('sun.classList.add("hidden")');
    });

    it('should guard against missing elements (early return if no sun/moon)', () => {
        expect(src).toContain('if (!sun || !moon) return');
    });
});

// ---------------------------------------------------------------------------
// applyTheme function
// ---------------------------------------------------------------------------

describe('ThemeToggle.astro - applyTheme function', () => {
    it('should define applyTheme to apply a specific theme', () => {
        expect(src).toContain('function applyTheme');
    });

    it('should accept a literal union "light" | "dark" parameter', () => {
        expect(src).toContain('"light" | "dark"');
    });

    it('should set data-theme="dark" on document.documentElement', () => {
        expect(src).toContain('setAttribute("data-theme", "dark")');
    });

    it('should remove the data-theme attribute when switching to light mode', () => {
        expect(src).toContain('removeAttribute("data-theme")');
    });

    it('should persist the chosen theme to localStorage', () => {
        expect(src).toContain('localStorage.setItem("theme", theme)');
    });

    it('should call syncIcon after applying the theme', () => {
        expect(src).toContain('syncIcon(theme === "dark")');
    });
});

// ---------------------------------------------------------------------------
// initToggle function
// ---------------------------------------------------------------------------

describe('ThemeToggle.astro - initToggle function', () => {
    it('should define initToggle to wire up the click handler', () => {
        expect(src).toContain('function initToggle');
    });

    it('should look up the button by id "theme-toggle"', () => {
        expect(src).toContain('getElementById("theme-toggle")');
    });

    it('should guard against a missing button element', () => {
        expect(src).toContain('if (!button) return');
    });

    it('should read the current data-theme attribute for initial sync', () => {
        expect(src).toContain('getAttribute("data-theme") === "dark"');
    });

    it('should call syncIcon on initialisation with the current isDark state', () => {
        expect(src).toContain('syncIcon(isDark)');
    });

    it('should add a click event listener to the button', () => {
        expect(src).toContain('button.addEventListener("click"');
    });

    it('should toggle from dark to light on click when currently dark', () => {
        expect(src).toContain('applyTheme(currentlyDark ? "light" : "dark")');
    });
});

// ---------------------------------------------------------------------------
// Script block and view-transition support
// ---------------------------------------------------------------------------

describe('ThemeToggle.astro - Script block', () => {
    it('should contain an inline <script> block', () => {
        expect(src).toContain('<script>');
    });

    it('should call initToggle on first load', () => {
        expect(src).toContain('initToggle();');
    });

    it('should re-run initToggle on astro:page-load for view-transition support', () => {
        expect(src).toContain('document.addEventListener("astro:page-load", initToggle)');
    });
});
