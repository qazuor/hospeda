/**
 * @file VenueFilterOptionsDegradation.test.ts
 * @description Source-read regression for the venue filter-options degradation
 * component (HOS-1870, AC:6:11).
 *
 * Astro components cannot be rendered in Vitest in this repo, so the assertions
 * read the component source and use the SAME detectors that police the
 * `cacheable-pages-demote-error-responses` guard. That keeps this test honest:
 * it fails for the same reasons the guard would stop seeing the marker.
 *
 * Why a component and not a helper function: the guard follows RENDERED
 * components, not functions called from a page. A page-side wrapper hid the
 * failure from the guard and from every test (review measured: making it a
 * no-op left 119 tests green).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    marksDegradedResponse,
    marksDegradedResponseUnconditionally
} from '../../static-guards/cacheable-pages-demote-error-responses';
import { stripComments } from '../../static-guards/cacheable-responses-declare-tags';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/venue/VenueFilterOptionsDegradation.astro'),
    'utf8'
);

/** The comment-stripped frontmatter, i.e. the executable part of the source. */
const code = stripComments({ source: src });

/**
 * Everything after the closing `---` of the frontmatter. The component must
 * render no markup, so this is where that is checked.
 */
function templateBody(source: string): string {
    const lines = source.split('\n');
    const closing = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    expect(closing, 'frontmatter closing --- not found').toBeGreaterThan(0);
    return stripComments({ source: lines.slice(closing + 1).join('\n') });
}

describe('VenueFilterOptionsDegradation.astro', () => {
    it('calls markResponseDegraded with the request locals', () => {
        expect(code).toContain('markResponseDegraded({ locals: Astro.locals })');
        expect(marksDegradedResponse({ source: src })).toBe(true);
    });

    it('conditions the marker call on `failed`, so it is never unconditional', () => {
        // `marksDegradedResponseUnconditionally` is the guard detector for a
        // marker that runs on EVERY render. A component that always demoted
        // would punish the healthy render, so this must stay false.
        expect(marksDegradedResponseUnconditionally({ source: src })).toBe(false);

        const callAt = code.indexOf('markResponseDegraded({');
        expect(callAt).toBeGreaterThan(-1);
        expect(code.lastIndexOf('if (failed)', callAt)).toBeGreaterThan(-1);
    });

    it('renders no markup', () => {
        expect(templateBody(src).trim()).toBe('');
    });

    it('receives the failure flag through a named prop', () => {
        expect(code).toContain('readonly failed: boolean');
        expect(code).toContain('Astro.props');
    });
});
