import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(__dirname, '../../src');
const sharedWordmark = 'components/shared/brand/BrandWordmark.tsx';

function sourceFiles({ directory }: { readonly directory: string }): readonly string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles({ directory: path });
        return entry.isFile() && /\.(?:astro|tsx|ts)$/.test(entry.name) ? [path] : [];
    });
}

function hasHandwrittenWordmark({ source }: { readonly source: string }): boolean {
    const withoutComments = source
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
    // Match the whole text node, not prose starting or ending with the brand name.
    return />\s*Hospeda\s*<\//.test(withoutComments);
}

describe('shared brand ownership', () => {
    it('contains no standalone literal wordmark outside BrandWordmark', () => {
        const files = sourceFiles({ directory: sourceRoot });
        expect(files.length).toBeGreaterThan(300);
        expect(files.some((file) => relative(sourceRoot, file) === sharedWordmark)).toBe(true);
        const offenders = files.filter(
            (file) =>
                relative(sourceRoot, file) !== sharedWordmark &&
                hasHandwrittenWordmark({ source: readFileSync(file, 'utf8') })
        );
        expect(offenders.map((file) => relative(sourceRoot, file))).toEqual([]);
    });

    it.each([
        '<span class="brand">Hospeda</span>',
        '<span>\n  Hospeda\n</span>',
        '<a><img src="/logo.webp" /> Hospeda </a>',
        '<span className={styles.logo}>\nHospeda </span>'
    ])('detects a reintroduced wordmark: %s', (source) => {
        expect(hasHandwrittenWordmark({ source })).toBe(true);
    });

    it.each([
        '<!-- <span>Hospeda</span> -->',
        '{/* <span>Hospeda</span> */}',
        '// <span>Hospeda</span>',
        '<p>Discover Hospeda for your next trip.</p>',
        '<p>Hospeda <strong>is not a booking platform</strong>.</p>',
        '<span>Learn about Hospeda</span>',
        '<p>© {year} Hospeda. All rights reserved.</p>',
        '<summary>{t("footer.hospedaTitle")}</summary>'
    ])('ignores comments and non-brand content: %s', (source) => {
        expect(hasHandwrittenWordmark({ source })).toBe(false);
    });
});
