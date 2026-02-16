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

        it('should have hero-image transition name', () => {
            expect(content).toContain('::view-transition-old(hero-image)');
            expect(content).toContain('::view-transition-new(hero-image)');
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

        it('should have hero transition duration of 0.5s', () => {
            const heroOldMatch = content.match(
                /::view-transition-old\(hero-image\)\s*{[^}]*animation:\s*fade-out\s+([\d.]+s)/
            );
            const heroNewMatch = content.match(
                /::view-transition-new\(hero-image\)\s*{[^}]*animation:\s*fade-in\s+([\d.]+s)/
            );

            expect(heroOldMatch).toBeTruthy();
            expect(heroNewMatch).toBeTruthy();
            expect(heroOldMatch?.[1]).toBe('0.5s');
            expect(heroNewMatch?.[1]).toBe('0.5s');
        });
    });
});
