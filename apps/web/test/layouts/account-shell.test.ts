/**
 * @file account-shell.test.ts
 * @description Tests for the new account shell (HOS-2413 T-020). The template
 * mapping is pure and tested directly; the Astro files are asserted at source
 * level (Astro layouts cannot be rendered under Vitest) and the rendered
 * landmarks are proven by the structural e2e sweep.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    ACCOUNT_SHELL_TEMPLATES,
    DEFAULT_ACCOUNT_SHELL_TEMPLATE,
    resolveShellTemplate
} from '../../src/components/account/ui';

const read = (file: string) => readFileSync(resolve(__dirname, '../../src', file), 'utf8');
const shell = read('layouts/AccountShell.astro');
const shellCss = read('layouts/AccountShell.module.css');
const layout = read('layouts/AccountLayout.astro');

describe('resolveShellTemplate', () => {
    it.each(ACCOUNT_SHELL_TEMPLATES)('keeps the %s template', (template) => {
        expect(resolveShellTemplate({ template })).toBe(template);
    });

    it('falls back to the default for an unknown or missing template', () => {
        expect(resolveShellTemplate({ template: 'wide' })).toBe(DEFAULT_ACCOUNT_SHELL_TEMPLATE);
        expect(resolveShellTemplate({})).toBe(DEFAULT_ACCOUNT_SHELL_TEMPLATE);
    });

    it('declares exactly the five templates of the spec', () => {
        expect([...ACCOUNT_SHELL_TEMPLATES]).toEqual([
            'list',
            'form',
            'dashboard',
            'reading',
            'editor'
        ]);
    });
});

describe('AccountShell.astro', () => {
    it('uses the account chrome and composes the kit pieces', () => {
        expect(shell).toContain('chrome="account"');
        expect(shell).toContain('<AccountBar client:media="(max-width: 63.99rem)"');
        expect(shell).toContain('<AccountSidebar');
        expect(shell).toContain('data-account-shell');
    });

    it('reads no session: the model arrives from the layout', () => {
        expect(shell).not.toContain('Astro.locals');
    });

    it('declares the content column as a named inline-size container', () => {
        expect(shellCss).toContain('container-type: inline-size;');
        expect(shellCss).toContain('container-name: account-content;');
    });

    it('shows the sidebar from 64rem and the bar below it', () => {
        expect(shellCss).toMatch(
            /@media \(min-width: 64rem\)[\s\S]*grid-template-columns: var\(--sidebar-w\)/
        );
        expect(shellCss).toMatch(/\.bar\s*{\s*display: none;/);
    });

    it('caps the form and reading templates with their layout tokens', () => {
        expect(shellCss).toContain('data-template="form"');
        expect(shellCss).toContain('var(--form-max)');
        expect(shellCss).toContain('var(--reading-max)');
    });
});

describe('AccountLayout shell switch (OD-1)', () => {
    it('defaults to the legacy shell so no page changes', () => {
        expect(layout).toContain("shell = 'legacy',");
        expect(layout).toContain("readonly shell?: 'legacy' | 'account';");
    });

    it('renders AccountShell only for shell="account"', () => {
        expect(layout).toContain("{shell === 'account' ? (");
        expect(layout).toContain('<AccountShell');
    });
});
