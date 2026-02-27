import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cssPath = resolve(__dirname, '../../src/styles/animations.css');
const content = readFileSync(cssPath, 'utf8');

describe('animations.css - Stagger and Glassmorphism utilities', () => {
    describe('Scroll reveal stagger', () => {
        it('should define .scroll-reveal-stagger base class', () => {
            expect(content).toContain('.scroll-reveal-stagger');
        });

        it('should start hidden with opacity 0', () => {
            expect(content).toMatch(/\.scroll-reveal-stagger\s*\{[^}]*opacity:\s*0/);
        });

        it('should become visible with .scroll-visible', () => {
            expect(content).toContain('.scroll-reveal-stagger.scroll-visible');
        });

        it('should define stagger delay classes 1 through 6', () => {
            for (let i = 1; i <= 6; i++) {
                expect(content).toContain(`.scroll-reveal-stagger-${i}`);
            }
        });

        it('should use 100ms-spaced delays starting from 0ms', () => {
            expect(content).toContain('transition-delay: 0ms');
            expect(content).toContain('transition-delay: 100ms');
            expect(content).toContain('transition-delay: 200ms');
            expect(content).toContain('transition-delay: 300ms');
            expect(content).toContain('transition-delay: 400ms');
            expect(content).toContain('transition-delay: 500ms');
        });

        it('should respect prefers-reduced-motion', () => {
            expect(content).toContain('prefers-reduced-motion');
        });
    });

    describe('Glassmorphism utilities', () => {
        it('should define .glass-bar class', () => {
            expect(content).toContain('.glass-bar');
        });

        it('should use backdrop-filter blur', () => {
            expect(content).toContain('backdrop-filter: blur(12px)');
        });

        it('should have progressive enhancement with @supports', () => {
            expect(content).toContain('@supports (backdrop-filter: blur(1px))');
        });

        it('should have dark mode variant', () => {
            expect(content).toContain('[data-theme="dark"] .glass-bar');
        });

        it('should have mobile fallback without blur', () => {
            expect(content).toContain('max-width: 639px');
            expect(content).toContain('backdrop-filter: none');
        });

        it('should include webkit prefix', () => {
            expect(content).toContain('-webkit-backdrop-filter');
        });
    });
});
