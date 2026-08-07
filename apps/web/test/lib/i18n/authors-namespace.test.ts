/**
 * @file authors-namespace.test.ts
 * @description The `authors` i18n namespace exists for exactly one page, so it
 * is small enough to hold to a rule the rest of the catalogue cannot follow:
 * every key in it is READ by that page.
 *
 * It shipped with six that nothing read (`posts.empty`, `events.empty` and four
 * `pagination.*` — the page uses the shared `Pagination` component, which has
 * its own namespace, and its two empty states are one `authors.empty.*` pair).
 * Dead copy is worse than missing copy: a translator localises it into three
 * locales, a reviewer assumes it is on screen somewhere, and nobody can tell
 * from the file which of the two it is.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES = ['es', 'en', 'pt'] as const;
const SRC_DIR = resolve(__dirname, '../../../src');
const SOURCE_EXTENSIONS = new Set(['.astro', '.ts', '.tsx']);

/** Read one locale's `authors` namespace. */
function readNamespace(locale: (typeof LOCALES)[number]): Record<string, unknown> {
    const path = resolve(
        __dirname,
        `../../../../../packages/i18n/src/locales/${locale}/authors.json`
    );
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

/** Flatten a nested locale object into dotted `authors.`-prefixed keys. */
function flatten(value: Record<string, unknown>, prefix: string): readonly string[] {
    return Object.entries(value).flatMap(([key, child]) =>
        typeof child === 'object' && child !== null
            ? flatten(child as Record<string, unknown>, `${prefix}.${key}`)
            : [`${prefix}.${key}`]
    );
}

/** Every source file under `src/`, so the scan cannot miss a new consumer. */
function collectSourceFiles(dir: string): readonly string[] {
    return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) return collectSourceFiles(path);
        return SOURCE_EXTENSIONS.has(extname(path)) ? [path] : [];
    });
}

const sourceText = collectSourceFiles(SRC_DIR)
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');

describe('the authors i18n namespace', () => {
    it('reads at least one key from the app — the scan is not empty', () => {
        // Non-vacuity guard: a broken walk would make every assertion below
        // pass by finding nothing to check.
        expect(sourceText).toContain("t('authors.posts.heading'");
    });

    it.each(flatten(readNamespace('es'), 'authors'))('%s is read by the app', (key) => {
        expect(sourceText).toContain(key);
    });

    it.each(LOCALES)('%s carries the same key set as es — no locale keeps a dead key', (locale) => {
        expect(flatten(readNamespace(locale), 'authors').sort()).toEqual(
            flatten(readNamespace('es'), 'authors').sort()
        );
    });

    it('no longer ships the six keys nothing read', () => {
        const es = flatten(readNamespace('es'), 'authors');

        for (const dead of [
            'authors.posts.empty',
            'authors.events.empty',
            'authors.pagination.label',
            'authors.pagination.previous',
            'authors.pagination.next',
            'authors.pagination.page'
        ]) {
            expect(es).not.toContain(dead);
        }
    });
});
