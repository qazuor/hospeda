/**
 * @fileoverview HOS-424 guard: a revalidation event that names an entity by
 * `slug` must also carry its `id`.
 *
 * Every detail page tags itself with BOTH identifiers — `post-<slug>` AND
 * `post-<id>` (see `buildEntityCacheTags`, and the `applyCacheHeaders` call in
 * `apps/web/src/pages/[lang]/publicaciones/[slug].astro`). A call site that
 * forwards only the slug therefore purges half of what the page is addressed
 * by, and does so in total silence: the purge still reports success for the
 * tags it did carry, and `revalidation_log` records that success.
 *
 * That is not hypothetical. Until HOS-424, `post`, `event` and `destination`
 * forwarded only `slug` across all 21 of their call sites, so `post-<id>` was
 * never purged by any write — while `extractEntityId`'s own comment asserted
 * the opposite. The side effect was a NULL `revalidation_log.entity_id` on
 * every content write, which is what made the audit trail unable to answer
 * "which entity triggered this purge".
 *
 * A GUARD rather than per-hook tests, deliberately. The existing hook tests in
 * `service-hooks.test.ts` assert with `expect.objectContaining({ entityType,
 * slug })`, which passes whether or not `id` is present — they were green
 * throughout the bug. And the failure mode here is a call site someone ADDS
 * later, which no fixed list of per-hook tests would cover.
 *
 * Scope: the four content services whose entities have a cached detail page.
 * Types with no per-entity page (`tag`, `amenity`) legitimately carry neither
 * identifier and are not scanned.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

/** Services whose entities have a detail page addressed by slug AND id. */
const SCANNED_SERVICES = [
    'packages/service-core/src/services/post/post.service.ts',
    'packages/service-core/src/services/event/event.service.ts',
    'packages/service-core/src/services/destination/destination.service.ts',
    'packages/service-core/src/services/accommodation/accommodation.service.ts'
] as const;

/**
 * One `scheduleRevalidation({ ... })` call site, as written in the source.
 */
interface CallSite {
    readonly file: string;
    /** 1-indexed line where the call starts, for a clickable failure message. */
    readonly line: number;
    /** The verbatim object-literal argument, braces excluded. */
    readonly argument: string;
}

/**
 * Extract every `scheduleRevalidation({ ... })` argument from a source file.
 *
 * Matches the object literal non-greedily up to the first `})`. Every call site
 * in these files passes a FLAT literal, so there is no nested brace to balance;
 * a nested one would end the match early and is asserted against below, so the
 * guard fails loudly rather than skipping a call site it cannot parse.
 *
 * @param params.file - Repo-relative path of the file to scan.
 * @returns Every call site found, in source order.
 */
function extractCallSites({ file }: { readonly file: string }): readonly CallSite[] {
    const source = readFileSync(path.join(REPO_ROOT, file), 'utf8');
    const pattern = /scheduleRevalidation\(\{([\s\S]*?)\}\)/g;

    const sites: CallSite[] = [];
    for (const match of source.matchAll(pattern)) {
        const argument = match[1] ?? '';
        const line = source.slice(0, match.index).split('\n').length;
        sites.push({ file, line, argument });
    }
    return sites;
}

describe('HOS-424 guard: revalidation events carry both identifiers', () => {
    it('finds call sites in every scanned service', () => {
        // Guards the guard: a rename or a refactor that moves these calls
        // elsewhere would otherwise make this file pass by scanning nothing.
        for (const file of SCANNED_SERVICES) {
            expect(
                extractCallSites({ file }).length,
                `no call site found in ${file}`
            ).toBeGreaterThan(0);
        }
    });

    it('never forwards `slug` without `id`', () => {
        const offenders = SCANNED_SERVICES.flatMap((file) => extractCallSites({ file }))
            .filter((site) => /\bslug\b/.test(site.argument))
            .filter((site) => !/\bid:/.test(site.argument))
            .map((site) => `${site.file}:${site.line} → { ${site.argument.trim()} }`);

        expect(
            offenders,
            `These scheduleRevalidation call sites name the entity by slug but omit its id, so the detail page's \`<entity>-<id>\` cache tag is never purged — silently, because the purge still succeeds for the tags it does carry:\n${offenders.join('\n')}`
        ).toEqual([]);
    });

    it('parses each call site as a flat object literal', () => {
        // The regex stops at the first `})`. A nested object would truncate the
        // captured argument and could hide a missing `id` from the assertion
        // above, so an unbalanced capture fails here instead of passing quietly.
        const unbalanced = SCANNED_SERVICES.flatMap((file) => extractCallSites({ file }))
            .filter((site) => site.argument.includes('{'))
            .map((site) => `${site.file}:${site.line}`);

        expect(
            unbalanced,
            `These call sites pass a nested object literal, which this guard cannot parse — extend the extractor before landing them:\n${unbalanced.join('\n')}`
        ).toEqual([]);
    });
});
