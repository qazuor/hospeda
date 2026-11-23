/**
 * @file save-bar-single-error.guard.test.ts
 * @description Owner decision 7 (Mi cuenta UI epic): in a section saved by the
 * StickySaveBar, a save failure is told by the bar ALONE. Every bar section
 * used to also render its `formError` in a form-level notice, so the same
 * failure was said twice.
 *
 * This guard reads every component that mounts the bar and fails when one
 * renders `formError` outside it (`{formError && …}`, `{form.formError ? …}`)
 * or forgets to hand it to the bar. Field-level errors are untouched: they are
 * `fieldErrors`, never `formError`.
 *
 * What it does NOT see: a failure told through another state name (the venue
 * managers return it as `SaveOutcome.message`; their tests cover that), or a
 * notice rendered by a child component the bar section imports.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../../src/components');
const EXCLUDED = ['account/ui/', 'account/kit-gallery/', 'account/editor-shell/'];

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return walk(path);
        return /\.tsx$/u.test(name) ? [path] : [];
    });
}

const barSections = walk(SRC)
    .map((path) => ({ path, rel: relative(SRC, path), source: readFileSync(path, 'utf8') }))
    .filter(({ rel }) => !EXCLUDED.some((prefix) => rel.startsWith(prefix)))
    .filter(({ source }) => /<(StickySaveBar|EditorSaveBar)\b/u.test(source));

/** Renders `formError` as JSX outside the bar: `{formError &&` or `{x.formError ?`. */
const RENDERS_FORM_ERROR = /\{\s*(?:[\w.]+\.)?formError\s*(?:&&|\?)/u;

describe('save bar sections tell a save failure once (owner decision 7)', () => {
    it('finds the bar sections (non-vacuous)', () => {
        expect(barSections.length).toBeGreaterThanOrEqual(14);
    });

    it.each(
        barSections.map(({ rel, source }) => [rel, source])
    )('%s renders no form-level save-error notice', (_rel, source) => {
        expect(source).not.toMatch(RENDERS_FORM_ERROR);
    });

    it.each(
        barSections
            .filter(({ source }) => /\bformError\b/u.test(source))
            .map(({ rel, source }) => [rel, source])
    )('%s hands its formError to the bar', (_rel, source) => {
        expect(source).toMatch(/errorMessage=\{(?:[\w.]+\.)?formError\}/u);
    });

    it('the predicate flags the old pattern', () => {
        expect('{form.formError && (<div role="alert">x</div>)}').toMatch(RENDERS_FORM_ERROR);
        expect('{formError ? (<Alert>x</Alert>) : null}').toMatch(RENDERS_FORM_ERROR);
        expect('errorMessage={form.formError}').not.toMatch(RENDERS_FORM_ERROR);
    });
});
