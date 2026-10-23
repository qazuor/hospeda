/**
 * @file listing-faq-intro-copy.guard.test.ts
 * @description Regression guard for HOS-1763 — the listing FAQ manager's
 * channel intro shipped an ~800 px block of technical jargon to owners
 * (`JSON-LD`, `datos estructurados` / `structured data`). The copy is now a
 * short, always-visible summary plus a collapsed explanation, and none of the
 * three locales may reintroduce the jargon.
 *
 * The guard asserts two things per locale:
 *  1. `owner.editor.faqManager.channelIntro.summary` EXISTS (the short sentence
 *     the editor renders above the empty state).
 *  2. No string value anywhere under `channelIntro` matches the jargon pattern.
 */

import { describe, expect, it } from 'vitest';

/**
 * The locale files are pulled in as MODULES, not read from disk.
 *
 * `test/setup.ts` mocks `node:fs.readFileSync` package-wide to return a 51-byte
 * stub for anything under `locales/`, so an fs-based walker here would inspect
 * the stub and report a clean sweep over files it never opened. `import.meta.glob`
 * is resolved by Vite at transform time and never touches the mock.
 */
const LOCALE_MODULES = import.meta.glob<Record<string, unknown>>('../src/locales/*/listing.json', {
    eager: true,
    import: 'default'
});

/** Technical jargon the owner-facing intro must never carry again. */
const JARGON_RE = /JSON-?LD|estructurad|structured data|dados estruturados/i;

interface ChannelIntro {
    readonly locale: string;
    readonly intro: Readonly<Record<string, unknown>>;
}

/** Read a nested property defensively, returning `undefined` when it is absent. */
function readPath(node: unknown, path: readonly string[]): unknown {
    let current = node;
    for (const key of path) {
        if (current === null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}

/** Collect every string leaf of a parsed JSON value. */
function stringLeaves(node: unknown): string[] {
    if (typeof node === 'string') return [node];
    if (Array.isArray(node)) return node.flatMap((child) => stringLeaves(child));
    if (node !== null && typeof node === 'object') {
        return Object.values(node as Record<string, unknown>).flatMap((child) =>
            stringLeaves(child)
        );
    }
    return [];
}

/** `channelIntro` of every locale's `listing.json`, keyed by locale. */
function collectChannelIntros(): ChannelIntro[] {
    const intros: ChannelIntro[] = [];

    for (const [modulePath, listing] of Object.entries(LOCALE_MODULES)) {
        const match = /\/locales\/([^/]+)\/listing\.json$/.exec(modulePath);
        if (!match) continue;
        const locale = match[1] ?? '';

        const intro = readPath(listing, ['owner', 'editor', 'faqManager', 'channelIntro']);
        if (intro === null || typeof intro !== 'object') continue;

        intros.push({ locale, intro: intro as Record<string, unknown> });
    }

    return intros;
}

describe('listing FAQ channel intro (HOS-1763)', () => {
    const channelIntros = collectChannelIntros();

    it('defines channelIntro.summary in es, en and pt (TEST:1763:4d)', () => {
        // Without this the suite could pass by scanning nothing.
        expect(channelIntros.map(({ locale }) => locale).sort()).toEqual(['en', 'es', 'pt']);

        for (const { locale, intro } of channelIntros) {
            expect(typeof intro.summary, `${locale} channelIntro.summary is missing`).toBe(
                'string'
            );
        }
    });

    it('serves no technical jargon in any channelIntro value (TEST:1763:4d)', () => {
        const offending = channelIntros.flatMap(({ locale, intro }) =>
            stringLeaves(intro)
                .filter((value) => JARGON_RE.test(value))
                .map((value) => `${locale}: ${value}`)
        );

        expect(offending).toEqual([]);
    });
});
