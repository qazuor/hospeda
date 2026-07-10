/**
 * @file endpoints-categories-param.test.ts
 * @description Regression guard for the "URL changes but the grid doesn't
 * filter" bug found during HOS-96 T-011/12/13 integration review:
 * `eventsApi.list` / `postsApi.list` did not accept a `categories` array
 * param, so a multi-select quick-filter chip writing `?categories=A,B` to the
 * URL had no way to actually reach the API. This asserts both list() method
 * signatures declare `categories?: string` alongside the existing singular
 * `category?: string` (backend precedence: array wins when both are present
 * — HOS-96 US-2/US-9/US-10). `accommodationsApi.list` already has `types?:
 * string` (the pre-existing blueprint) — asserted here too as a baseline.
 *
 * Source-based: Astro/TS signatures aren't renderable, so we assert on the
 * source text, scoped per API export to avoid cross-contamination between
 * `eventsApi` and `postsApi`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../../src/lib/api/endpoints.ts'), 'utf8');

/** Slice the source between two `export const <name> = {` markers (exclusive end). */
function sliceApiSection(startMarker: string, endMarker: string): string {
    const start = src.indexOf(startMarker);
    const end = src.indexOf(endMarker, start);
    if (start === -1 || end === -1) {
        throw new Error(`Could not locate section between "${startMarker}" and "${endMarker}"`);
    }
    return src.slice(start, end);
}

const eventsApiSection = sliceApiSection('export const eventsApi = {', 'export const postsApi = {');
const postsApiSection = sliceApiSection('export const postsApi = {', 'export const statsApi = {');
const accommodationsApiSection = sliceApiSection(
    'export const accommodationsApi = {',
    'export const amenitiesApi = {'
);

describe('endpoints.ts — categories array param (HOS-96 T-011/12/13)', () => {
    describe('eventsApi.list', () => {
        it('keeps the singular category param (backward compat)', () => {
            expect(eventsApiSection).toContain('category?: string;');
        });

        it('adds a categories array param', () => {
            expect(eventsApiSection).toContain('categories?: string;');
        });
    });

    describe('postsApi.list', () => {
        it('keeps the singular category param (backward compat)', () => {
            expect(postsApiSection).toContain('category?: string;');
        });

        it('adds a categories array param', () => {
            expect(postsApiSection).toContain('categories?: string;');
        });
    });

    describe('accommodationsApi.list — pre-existing blueprint (verify only, no change expected)', () => {
        it('already has both the singular type and array types params', () => {
            expect(accommodationsApiSection).toContain('type?: string;');
            expect(accommodationsApiSection).toContain('types?: string;');
        });
    });
});
