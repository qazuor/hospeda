import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** Resolved path to the package root */
const PACKAGE_ROOT = path.resolve(__dirname, '..');

describe('tailwind-config package structure', () => {
    it('shared-styles.css exists', () => {
        const cssPath = path.join(PACKAGE_ROOT, 'shared-styles.css');
        expect(fs.existsSync(cssPath), `Expected ${cssPath} to exist`).toBe(true);
    });

    it('shared-styles.css is non-empty', () => {
        const cssPath = path.join(PACKAGE_ROOT, 'shared-styles.css');
        const content = fs.readFileSync(cssPath, 'utf-8');
        expect(content.trim().length).toBeGreaterThan(0);
    });

    it('postcss.config.js exists', () => {
        const configPath = path.join(PACKAGE_ROOT, 'postcss.config.js');
        expect(fs.existsSync(configPath), `Expected ${configPath} to exist`).toBe(true);
    });

    it('package.json exists and contains the correct package name', () => {
        const pkgPath = path.join(PACKAGE_ROOT, 'package.json');
        expect(fs.existsSync(pkgPath)).toBe(true);

        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { name: string };
        expect(pkg.name).toBe('@repo/tailwind-config');
    });
});

describe('shared-styles.css content', () => {
    let cssContent: string;

    it('loads CSS content without error', () => {
        const cssPath = path.join(PACKAGE_ROOT, 'shared-styles.css');
        cssContent = fs.readFileSync(cssPath, 'utf-8');
        expect(typeof cssContent).toBe('string');
    });

    it('includes a Tailwind import or @import directive', () => {
        const cssPath = path.join(PACKAGE_ROOT, 'shared-styles.css');
        const content = fs.readFileSync(cssPath, 'utf-8');
        // shared-styles.css should reference tailwindcss
        expect(content).toMatch(/tailwindcss|@theme|--/);
    });

    it('contains at least one CSS custom property (design token)', () => {
        const cssPath = path.join(PACKAGE_ROOT, 'shared-styles.css');
        const content = fs.readFileSync(cssPath, 'utf-8');
        // Design tokens are defined as CSS custom properties (--variable-name)
        expect(content).toMatch(/--[\w-]+:/);
    });

    it('does not contain syntax errors (basic check: balanced braces)', () => {
        const cssPath = path.join(PACKAGE_ROOT, 'shared-styles.css');
        const content = fs.readFileSync(cssPath, 'utf-8');
        const openBraces = (content.match(/\{/g) ?? []).length;
        const closeBraces = (content.match(/\}/g) ?? []).length;
        expect(openBraces).toBe(closeBraces);
    });
});

describe('postcss.config.js content', () => {
    it('exports a postcssConfig object', async () => {
        const { postcssConfig } = await import('../postcss.config.js');

        expect(postcssConfig).toBeDefined();
        expect(typeof postcssConfig).toBe('object');
        expect(postcssConfig).not.toBeNull();
    });

    it('exported postcssConfig has a plugins property', async () => {
        const { postcssConfig } = await import('../postcss.config.js');

        expect(postcssConfig).toHaveProperty('plugins');
        expect(typeof postcssConfig.plugins).toBe('object');
    });

    it('postcssConfig.plugins includes @tailwindcss/postcss', async () => {
        const { postcssConfig } = await import('../postcss.config.js');

        expect(postcssConfig.plugins).toHaveProperty('@tailwindcss/postcss');
    });
});
