/**
 * @file destinos-single-events-call.test.ts
 * @description Regression test: destination detail page must issue exactly ONE
 * events-list API call and derive eventsCount from its pagination.total (rate-limit fix).
 *
 * Previously the page fired two `eventsApi.list` calls:
 *   1. pageSize:3 — to populate the event preview cards.
 *   2. pageSize:1 — purely to read `pagination.total` for `eventsCount`.
 * The second call was redundant because the first response already exposes
 * `pagination.total` via the `extractTotal()` helper.
 *
 * Astro components cannot be rendered in Vitest — assertions are source-based.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src');
const src = readFileSync(resolve(SRC_DIR, 'pages/[lang]/destinos/[...path].astro'), 'utf8');

describe('destinos/[...path].astro — single events list call (rate-limit fix)', () => {
    it('calls eventsApi.list exactly once', () => {
        const occurrences = (src.match(/eventsApi\.list\(/g) ?? []).length;
        expect(occurrences).toBe(1);
    });

    it('derives eventsCount via extractTotal from the preview-cards result', () => {
        // The merged code must use extractTotal(eventsResult), NOT a separate count result.
        expect(src).toContain('extractTotal(eventsResult)');
    });

    it('does not have a separate pageSize:1 events call for counting', () => {
        // The old redundant call had { pageSize: 1, destinationId }.
        // The regex matches "eventsApi.list(" followed eventually by "pageSize: 1"
        // within the same argument object (no closing paren between them).
        expect(src).not.toMatch(/eventsApi\.list\(\{\s*pageSize:\s*1/);
    });

    it('does not reference eventsCountResult', () => {
        // The now-removed destructured variable must be gone entirely.
        expect(src).not.toContain('eventsCountResult');
    });
});
