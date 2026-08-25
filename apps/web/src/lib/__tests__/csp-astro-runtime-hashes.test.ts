/**
 * @file csp-astro-runtime-hashes.test.ts
 * @description Guard for the Astro client-runtime CSP hashes (HOS-798).
 *
 * The failure this exists to catch is silent. `ASTRO_RUNTIME_INLINE_SCRIPTS`
 * pins byte-exact payloads that Astro MINIFIES, so any Astro upgrade can change
 * a byte, invalidate every hash, and reinstate HOS-798 without breaking the
 * build, failing a type-check, or producing a single error in CI. The bug would
 * resurface as "the Publicar button and the maps are gone again", weeks later,
 * reported by a human.
 *
 * The expected digests below were captured from the real deployed site (a
 * built, running Astro 7.1.6), NOT recomputed with the same helper the module
 * uses — hashing the pinned source with the pinned hasher would only prove the
 * module agrees with itself. Same reasoning as `csp-hash-emission.test.ts`,
 * which sources its expectations from `node:crypto` for exactly this reason.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    ASTRO_RUNTIME_INLINE_SCRIPTS,
    ASTRO_RUNTIME_SCRIPT_HASHES,
    VERIFIED_ASTRO_VERSION
} from '../csp-astro-runtime-hashes';
import { buildCspHeader } from '../middleware-helpers';

/**
 * Digests observed in the wild on Astro 7.1.6, keyed by the global the snippet
 * installs. Independent of anything this codebase computes.
 */
const OBSERVED_HASHES: Readonly<Record<string, string>> = {
    'Astro.load': 'sha256-QzWFZi+FLIx23tnm9SBU4aEgx4x8DsuASP07mfqol/c=',
    'Astro.only': 'sha256-eIXWvAmxkr251LJZkjniEK5LcPF3NkapbJepohwYRIc=',
    'Astro.idle': 'sha256-BF0290pkb3jxQsE7z00xR8Imp8X34FLC88L0lkMnrGw=',
    'Astro.visible': 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=',
    replaceServerIsland: 'sha256-0oe0j1+KVmVYcHm1N1/3tGTf3Yhpnd6heIyJsO4LZS0='
};

const REPO_ROOT = resolve(__dirname, '../../../../..');

describe('Astro runtime CSP hashes — payload integrity (HOS-798)', () => {
    it('pins every client directive that ships a runtime snippet', () => {
        const directives = ASTRO_RUNTIME_INLINE_SCRIPTS.map((entry) => entry.directive);
        expect(directives).toEqual(
            expect.arrayContaining([
                'client:load',
                'client:only',
                'client:idle',
                'client:visible',
                'server:defer'
            ])
        );
    });

    it('pins `client:only` specifically — its absence is the HOS-798 regression', () => {
        const only = ASTRO_RUNTIME_INLINE_SCRIPTS.find((e) => e.directive === 'client:only');
        expect(
            only,
            '`client:only` MUST stay pinned: it is the one directive with no SSR output, so a blocked runtime means the component never renders at all'
        ).toBeDefined();
        expect(only?.source).toContain('.only=');
    });

    it.each(
        ASTRO_RUNTIME_INLINE_SCRIPTS
    )('the pinned source for $name still hashes to the digest observed on the deployed site', ({
        name,
        source
    }) => {
        const expected = OBSERVED_HASHES[name];
        expect(expected, `no observed digest recorded for ${name}`).toBeDefined();

        const index = ASTRO_RUNTIME_INLINE_SCRIPTS.findIndex((e) => e.name === name);
        expect(
            ASTRO_RUNTIME_SCRIPT_HASHES[index],
            `The pinned payload for ${name} no longer hashes to the digest captured from a running Astro ${VERIFIED_ASTRO_VERSION}. If this followed an Astro upgrade: re-capture the inline scripts from a BUILT page, update ASTRO_RUNTIME_INLINE_SCRIPTS, refresh OBSERVED_HASHES, and bump VERIFIED_ASTRO_VERSION in the same commit. Shipping stale hashes silently reinstates HOS-798 (invisible Publicar CTA and Leaflet maps after a soft navigation).`
        ).toBe(expected);

        expect(source.length).toBeGreaterThan(0);
    });

    it('exports one hash per pinned script, all well-formed and unique', () => {
        expect(ASTRO_RUNTIME_SCRIPT_HASHES).toHaveLength(ASTRO_RUNTIME_INLINE_SCRIPTS.length);
        for (const hash of ASTRO_RUNTIME_SCRIPT_HASHES) {
            expect(hash).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/);
        }
        expect(new Set(ASTRO_RUNTIME_SCRIPT_HASHES).size).toBe(ASTRO_RUNTIME_SCRIPT_HASHES.length);
    });
});

describe('Astro runtime CSP hashes — version pin', () => {
    it('matches the Astro version pnpm actually resolves', () => {
        const lockfile = readFileSync(resolve(REPO_ROOT, 'pnpm-lock.yaml'), 'utf8');
        const resolved = [...lockfile.matchAll(/^ {2}astro@(\d+\.\d+\.\d+):$/gm)].map((m) => m[1]);

        expect(
            resolved.length,
            'could not find a resolved astro version in pnpm-lock.yaml'
        ).toBeGreaterThan(0);
        expect(
            resolved,
            `The lockfile resolves Astro to ${resolved.join(', ')}, but the CSP runtime hashes were captured from ${VERIFIED_ASTRO_VERSION}. Astro minifies these snippets, so a bump can change a byte and silently break HOS-798's fix. Re-capture the payloads from a built page before updating this pin.`
        ).toContain(VERIFIED_ASTRO_VERSION);
    });
});

describe('buildCspHeader — always publishes the Astro runtime hashes (HOS-798)', () => {
    /** A response whose body carried no inline script at all. */
    const headerWithNoBodyHashes = (): string =>
        buildCspHeader({ scriptHashes: [], styleHashes: [] });

    const scriptSrcOf = (header: string): string =>
        header.split('; ').find((directive) => directive.startsWith('script-src ')) ?? '';

    it('emits every runtime hash even when the response body contributed none', () => {
        const scriptSrc = scriptSrcOf(headerWithNoBodyHashes());
        for (const hash of ASTRO_RUNTIME_SCRIPT_HASHES) {
            expect(
                scriptSrc,
                `script-src must carry ${hash} on every response, not only on bodies that happen to contain it`
            ).toContain(`'${hash}'`);
        }
    });

    it('authorises `client:only` from a page that has no client:only island of its own', () => {
        const onlyIndex = ASTRO_RUNTIME_INLINE_SCRIPTS.findIndex(
            (e) => e.directive === 'client:only'
        );
        const onlyHash = ASTRO_RUNTIME_SCRIPT_HASHES[onlyIndex];
        expect(scriptSrcOf(headerWithNoBodyHashes())).toContain(`'${onlyHash}'`);
    });

    it('does not duplicate a runtime hash the collector already found in the body', () => {
        const duplicated = ASTRO_RUNTIME_SCRIPT_HASHES[0] as string;
        const scriptSrc = scriptSrcOf(
            buildCspHeader({ scriptHashes: [duplicated], styleHashes: [] })
        );
        const occurrences = scriptSrc.split(`'${duplicated}'`).length - 1;
        expect(occurrences).toBe(1);
    });

    it('still publishes the hashes the collector found in the body', () => {
        const bodyHash = 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
        const scriptSrc = scriptSrcOf(
            buildCspHeader({ scriptHashes: [bodyHash], styleHashes: [] })
        );
        expect(scriptSrc).toContain(`'${bodyHash}'`);
    });

    it('keeps script-src free of unsafe-inline (hashes and unsafe-inline are mutually exclusive per CSP3)', () => {
        expect(scriptSrcOf(headerWithNoBodyHashes())).not.toContain("'unsafe-inline'");
    });
});
