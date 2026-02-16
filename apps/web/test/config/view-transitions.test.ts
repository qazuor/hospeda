import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const layoutPath = resolve(__dirname, '../../src/layouts/BaseLayout.astro');
const content = readFileSync(layoutPath, 'utf8');

describe('View Transitions Configuration', () => {
    describe('Import', () => {
        it('should import ViewTransitions from astro:transitions', () => {
            expect(content).toContain("import { ViewTransitions } from 'astro:transitions'");
        });
    });

    describe('Component', () => {
        it('should have ViewTransitions component in head', () => {
            expect(content).toContain('<ViewTransitions');
        });

        it('should have fallback="swap" attribute', () => {
            expect(content).toContain('fallback="swap"');
        });
    });

    describe('Custom Transitions', () => {
        it('should have custom view transition CSS', () => {
            expect(content).toContain('/* Custom view transitions */');
        });

        it('should have ::view-transition-old(root) rule', () => {
            expect(content).toContain('::view-transition-old(root)');
        });

        it('should have ::view-transition-new(root) rule', () => {
            expect(content).toContain('::view-transition-new(root)');
        });

        it('should have fade animation keyframes', () => {
            expect(content).toContain('@keyframes fade-out');
            expect(content).toContain('@keyframes fade-in');
        });

        it('should have entity-image transition group for card-to-detail morph', () => {
            expect(content).toContain('::view-transition-group(entity-image)');
        });

        it('should have entity-image old/new transition rules', () => {
            expect(content).toContain('::view-transition-old(entity-image)');
            expect(content).toContain('::view-transition-new(entity-image)');
        });

        it('should have default transition duration of 0.3s', () => {
            const rootOldMatch = content.match(
                /::view-transition-old\(root\)\s*{[^}]*animation:\s*fade-out\s+([\d.]+s)/
            );
            const rootNewMatch = content.match(
                /::view-transition-new\(root\)\s*{[^}]*animation:\s*fade-in\s+([\d.]+s)/
            );

            expect(rootOldMatch).toBeTruthy();
            expect(rootNewMatch).toBeTruthy();
            expect(rootOldMatch?.[1]).toBe('0.3s');
            expect(rootNewMatch?.[1]).toBe('0.3s');
        });

        it('should have entity-image transition duration of 0.4s', () => {
            const entityOldMatch = content.match(
                /::view-transition-old\(entity-image\)\s*{[^}]*animation:\s*fade-out\s+([\d.]+s)/
            );
            const entityNewMatch = content.match(
                /::view-transition-new\(entity-image\)\s*{[^}]*animation:\s*fade-in\s+([\d.]+s)/
            );

            expect(entityOldMatch).toBeTruthy();
            expect(entityNewMatch).toBeTruthy();
            expect(entityOldMatch?.[1]).toBe('0.4s');
            expect(entityNewMatch?.[1]).toBe('0.4s');
        });

        it('should use ease-in-out for entity-image group', () => {
            expect(content).toContain('animation-timing-function: ease-in-out');
        });
    });

    describe('Dark Mode FOUC Prevention', () => {
        it('should have inline script for dark mode initialization', () => {
            expect(content).toContain('<script is:inline>');
        });

        it('should read theme from localStorage', () => {
            expect(content).toContain("localStorage.getItem('hospeda-theme')");
        });

        it('should check prefers-color-scheme media query', () => {
            expect(content).toContain('prefers-color-scheme:dark');
        });

        it('should set data-theme attribute on document element', () => {
            expect(content).toContain("document.documentElement.setAttribute('data-theme'");
        });
    });
});
