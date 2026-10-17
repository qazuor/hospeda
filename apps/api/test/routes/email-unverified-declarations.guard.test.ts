/** TEST:1692:4 — protected closed-list routes declare their step-2 operation. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../src/routes');
function files(dir: string, prefix = ''): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) return files(join(dir, entry.name), relative);
        return entry.name.endsWith('.ts') ? [relative] : [];
    });
}
function source(path: string) {
    return readFileSync(join(ROOT, path), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
}
const declaration =
    /^\s*emailUnverifiedOperation:\s*'(REACTIVATE_LISTING|DELETE_LISTING|READ_OWN)',?\s*$/m;
const listing = /listingAccess:\s*\{[^}]*operation:\s*'(REACTIVATE|DELETE|READ_OWN)'/s;

describe('TEST:1692:4 every protected route of the closed list declares its step-2 operation', () => {
    const protectedFiles = files(ROOT).filter((file) => file.includes('/protected/'));
    const rows = protectedFiles.map((file) => ({ file, text: source(file) }));
    it('instruments the current three REACTIVATE, three DELETE and six GET READ_OWN declarations', () => {
        expect(rows.filter(({ text }) => listing.exec(text)?.[1] === 'REACTIVATE')).toHaveLength(3);
        expect(rows.filter(({ text }) => listing.exec(text)?.[1] === 'DELETE')).toHaveLength(3);
        expect(
            rows.filter(
                ({ text }) => /method:\s*'get'/.test(text) && listing.exec(text)?.[1] === 'READ_OWN'
            )
        ).toHaveLength(6);
    });
    it.each([
        ['REACTIVATE', 'REACTIVATE_LISTING'],
        ['DELETE', 'DELETE_LISTING'],
        ['READ_OWN', 'READ_OWN']
    ])('requires %s listing access to declare %s', (access, step) => {
        for (const { text } of rows) {
            const op = listing.exec(text)?.[1];
            if (op === access && (access !== 'READ_OWN' || /method:\s*'get'/.test(text))) {
                expect(declaration.exec(text)?.[1]).toBe(step);
            }
        }
    });
    it('allows REACTIVATE_LISTING and DELETE_LISTING only with matching listing access', () => {
        for (const { text } of rows) {
            const step = declaration.exec(text)?.[1];
            const access = listing.exec(text)?.[1];
            if (step === 'REACTIVATE_LISTING') expect(access).toBe('REACTIVATE');
            if (step === 'DELETE_LISTING') expect(access).toBe('DELETE');
        }
    });
});
