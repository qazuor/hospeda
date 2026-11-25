/**
 * HOS-2627 × HOS-2622: the account layout resolves `hasSubscription` once and
 * the mobile account sheet must receive the same fact as the sidebar, so the
 * Complementos entry never appears in one menu and not the other.
 *
 * @module test/layouts/account-sheet-subscription-wiring
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
    readFileSync(resolve(import.meta.dirname, '../../src/layouts', file), 'utf8');

describe('account sheet receives the subscription fact', () => {
    it('AccountLayout hands it to the shell', () => {
        expect(read('AccountLayout.astro')).toContain('hasSubscription={hasSubscription}');
    });

    it('AccountShell hands it to the account header', () => {
        expect(read('AccountShell.astro')).toMatch(
            /<AccountHeader[^>]*hasSubscription=\{hasSubscription\}/
        );
    });

    it('AccountHeader hands it to the sheet', () => {
        const header = read('AccountHeader.astro');
        const sheet = header.slice(
            header.indexOf('<AccountSheet'),
            header.indexOf('/>', header.indexOf('<AccountSheet'))
        );
        expect(sheet).toContain('hasSubscription={hasSubscription}');
    });

    it('the public header leaves it out, so the sheet fails closed there', () => {
        const header = read('Header.astro');
        const sheet = header.slice(
            header.indexOf('<AccountSheet'),
            header.indexOf('/>', header.indexOf('<AccountSheet'))
        );
        expect(sheet).not.toContain('hasSubscription');
    });
});
