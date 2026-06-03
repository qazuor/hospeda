/**
 * @file SelectSearchFilter.scrollbar.test.ts
 * @description Source-level regression guard for BETA-29.
 *
 * The searchable destination selector's option list styled its scrollbar with
 * `::-webkit-scrollbar` only. Firefox ignores those rules and rendered its
 * wide native scrollbar, which covered the right-aligned featured (star)
 * indicator on each option. The fix adds the standard `scrollbar-width: thin`
 * + `scrollbar-gutter: stable` so the bar is thin and reserves its own space.
 * (CSS-module styles can't be asserted via jsdom render, so we pin the source.)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
    resolve(
        __dirname,
        '../../../../../src/components/shared/filters/filter-types/SelectSearchFilter.module.css'
    ),
    'utf8'
);

describe('SelectSearchFilter option-list scrollbar (BETA-29)', () => {
    it('makes the scrollbar thin for non-webkit browsers (Firefox)', () => {
        expect(css).toMatch(/scrollbar-width:\s*thin/);
    });

    it('reserves a stable scrollbar gutter so it does not cover content', () => {
        expect(css).toMatch(/scrollbar-gutter:\s*stable/);
    });
});
