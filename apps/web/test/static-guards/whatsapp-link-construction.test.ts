/**
 * @file whatsapp-link-construction.test.ts
 * @description Static guard (HOS-289): every `wa.me` deep link built from a
 * phone number must go through `buildWhatsAppLink` in `@/lib/whatsapp`.
 *
 * WHY A GUARD AND NOT N COMPONENT TESTS: before HOS-289 the web app had three
 * independent wa.me constructors with three different sanitizing rules, two of
 * which kept the leading `+` — a form wa.me rejects outright. Per-component
 * tests only cover the components that exist today; this guard fails on the
 * NEXT hand-rolled one.
 *
 * The rule is expressed on the SHAPE of the link, not on the buggy literal: a
 * wa.me URL whose phone segment is anything other than literal digits is a
 * violation, whatever sanitizing (or none) precedes it.
 *
 * WHAT THIS GUARD DOES NOT SEE (declared, not hidden):
 *   - `apps/admin` — the admin panel deliberately prepends the Argentinian `549`
 *     (`WhatsAppLinkCell.tsx`), a different product decision, out of scope here.
 *   - A `buildWhatsAppLink` result that the caller post-processes.
 *   - A link assembled from a variable that already holds the string `'wa.me/'`.
 *
 * Mirrors the fs-based scanning style of `commerce-lead-isolation.test.ts` — no
 * new tooling required.
 *
 * @module test/static-guards/whatsapp-link-construction
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** Source extensions that can render or build a link. */
const EXTENSIONS = ['.astro', '.ts', '.tsx'] as const;

/**
 * Legitimate, non-dynamic uses of the `wa.me` host. Anything containing
 * `wa.me` that matches none of these is reported.
 */
const ALLOWED_SHAPES: readonly { readonly label: string; readonly pattern: RegExp }[] = [
    {
        // A fully literal brand link: https://wa.me/5493442453797
        label: 'literal digits-only URL',
        pattern: /wa\.me\/\d+(?![\w$])/
    },
    {
        // Share intent with no recipient: https://wa.me/?text=...
        label: 'recipient-less share link',
        pattern: /wa\.me\/\?/
    },
    {
        // Scheme-completion for a user-supplied bare wa.me path (TradeCard).
        label: 'bare-path detection',
        pattern: /startsWith\('wa\.me[/?]'\)/
    }
];

/** Files exempt from the rule because they ARE the single source of truth. */
const SOURCE_OF_TRUTH = ['lib/whatsapp.ts'];

/**
 * Strips comments so prose mentioning `wa.me` (JSDoc, inline notes) is not
 * mistaken for a constructor. The `[^:]` lookbehind keeps `https://` intact.
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Recursively collects source files under `dir`. */
function collectSourceFiles(dir: string, found: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectSourceFiles(full, found);
        } else if (EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
            found.push(full);
        }
    }
    return found;
}

interface Violation {
    readonly file: string;
    readonly line: number;
    readonly code: string;
}

function findViolations(): Violation[] {
    const violations: Violation[] = [];

    for (const file of collectSourceFiles(WEB_SRC)) {
        const relativePath = path.relative(WEB_SRC, file);
        if (SOURCE_OF_TRUTH.includes(relativePath)) continue;

        const lines = stripComments(fs.readFileSync(file, 'utf-8')).split('\n');
        lines.forEach((code, index) => {
            if (!code.includes('wa.me')) return;
            if (ALLOWED_SHAPES.some(({ pattern }) => pattern.test(code))) return;
            violations.push({ file: relativePath, line: index + 1, code: code.trim() });
        });
    }

    return violations;
}

describe('wa.me link construction (HOS-289)', () => {
    it('routes every dynamic wa.me link through buildWhatsAppLink', () => {
        const report = findViolations().map((v) => `${v.file}:${v.line} → ${v.code}`);

        expect(report).toEqual([]);
    });

    it('actually inspects the web source tree', () => {
        // Guard-the-guard: an empty crawl would make the assertion above vacuous.
        const files = collectSourceFiles(WEB_SRC);

        expect(files.length).toBeGreaterThan(100);
        expect(files.some((file) => file.endsWith('.astro'))).toBe(true);
    });

    it('recognises the brand link and the share intent as legitimate', () => {
        // Pins the allowlist: these two shapes must NOT be reported, or the guard
        // would report noise and get muted.
        const brand = "{ platform: 'whatsapp', url: 'https://wa.me/5493442453797' }";
        const share = 'href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,';

        expect(ALLOWED_SHAPES.some(({ pattern }) => pattern.test(brand))).toBe(true);
        expect(ALLOWED_SHAPES.some(({ pattern }) => pattern.test(share))).toBe(true);
    });

    it('does not accept an interpolated phone as a literal link', () => {
        // The exact shape HOS-289 fixed: a template hole where digits belong.
        const interpolated =
            'waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;';

        expect(ALLOWED_SHAPES.some(({ pattern }) => pattern.test(interpolated))).toBe(false);
    });
});
