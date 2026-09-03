/**
 * @file whatsapp-link-construction.test.ts
 * @description Static guard for HOS-364 — the Hospeda BRAND contact phone
 * number must never be spelled out as a literal in `apps/web/src` or the
 * shared i18n locale bundles, and every surface that renders it must resolve
 * to the SAME configured value.
 *
 * WHY A GUARD AND NOT MORE UNIT TESTS. Before this issue the number was
 * hand-typed in eighteen places across FOUR spellings that disagreed with
 * each other: five carried the AR mobile `9` (`https://wa.me/5493442453797`,
 * required for a `wa.me` link to resolve a mobile recipient) and thirteen did
 * not (`3442 453797`, correct for a plain call or display text). Neither form
 * was wrong in isolation — nothing DERIVED one from the other, so a literal
 * could drift into the wrong slot with no test catching it. The FAQ page's
 * WhatsApp CTA was exactly that: `https://wa.me/543442453797`, missing the
 * `9`, a dead button that opened no chat. A pre-existing guard
 * (`outbound-href-sanitization.test.ts`) even certified it as safe — it only
 * proves an outbound `wa.me` link is either sanitized or explicitly exempted,
 * never that its VALUE is the real, dialable, brand number.
 *
 * WHAT THIS GUARD CHECKS, and what it deliberately does not.
 *
 *   1. LITERALS — no file under `apps/web/src` or the i18n locale bundles
 *      spells out the brand's local exchange digits, in ANY grouping
 *      (spaces, dashes, or none) and with or without the country code / the
 *      AR mobile `9`. The regex anchors on the INVARIANT core — the ten local
 *      digits, `3442453797` — rather than on one particular spelling, because
 *      that is exactly the axis the four spellings disagreed on. Two files
 *      are exempted, each because the digits there are not a rendered call
 *      site: see {@link LITERAL_EXEMPTIONS}.
 *   2. VALUE AGREEMENT — every derived form (`getBrandPhoneE164`,
 *      `getBrandPhoneTelHref`, `getBrandPhoneWhatsAppUrl`,
 *      `ORGANIZATION_INFO.telephone`, `SOCIAL_PROFILES`'s `whatsapp` entry)
 *      shares the same underlying digits, and the AR mobile `9` appears in
 *      EXACTLY the WhatsApp form — never in the call/display form, which is
 *      the decision this issue's fix encodes (a `9` is required to reach a
 *      mobile over WhatsApp; it does not belong in a phone call).
 *
 * What it does NOT see: `packages/seed/**` example fixtures (out of scope —
 * an accommodation's own stored contact info, not a brand surface) and
 * `docs/**` (prose, never rendered). Anything outside `apps/web/src` and
 * `packages/i18n/src/locales` is unscanned.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    getBrandPhoneDisplay,
    getBrandPhoneE164,
    getBrandPhoneTelHref,
    getBrandPhoneWhatsAppUrl
} from '../../src/lib/brand-phone';
import { ORGANIZATION_INFO, SOCIAL_PROFILES } from '../../src/lib/constants';

/** Directories scanned for a hardcoded brand-phone literal. */
const SCANNED_ROOTS: readonly { readonly label: string; readonly dir: string }[] = [
    { label: 'apps/web/src', dir: join(__dirname, '../../src') },
    {
        label: 'packages/i18n/src/locales',
        dir: join(__dirname, '../../../../packages/i18n/src/locales')
    }
];

/** File extensions that can carry the literal in either scanned root. */
const SCANNED_EXTENSIONS = new Set(['.astro', '.ts', '.tsx', '.json']);

/**
 * Lower bound on the combined scan size. `> 0` would let a mis-resolved root
 * pass while voiding the whole guard.
 */
const MIN_SCANNED_FILES = 400;

/**
 * The invariant core of the brand's phone number: its ten local digits, with
 * no country code and no AR mobile `9`. Present, contiguous, in EVERY
 * spelling this issue found — `3442 453797`, `3442453797`,
 * `+54 3442 453797`, `+54 9 3442 453797`, `543442453797`, `5493442453797` —
 * because none of those variations touch these ten digits, only what
 * precedes them. Matched against a PER-LINE digit-only projection of the
 * source (see {@link lineHasCoreDigits}), so a phone written across two
 * unrelated tokens can never falsely concatenate into this string.
 */
const CORE_DIGITS = '3442453797';

/**
 * Files allowed to contain the literal, each because the digits there are
 * NOT a rendered call site — a stale entry (the literal no longer present)
 * is caught below, same as an unnecessary one (checked by construction: this
 * is the only escape hatch, and every user is required to justify it here).
 */
const LITERAL_EXEMPTIONS: Readonly<Record<string, string>> = Object.freeze({
    'env-schema.ts':
        'the Zod default for HOSPEDA_BRAND_PHONE — the one place the literal must ' +
        'live so an unset env var still resolves to a real, dialable number',
    'lib/whatsapp.ts':
        "documents a real, measured incident (dated in the file) against Hospeda's " +
        'own number — historical record in a doc comment, not a rendered call site'
});

/** Recursively collects scannable files under `dir`. */
function collectFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath));
            continue;
        }
        if (SCANNED_EXTENSIONS.has(extname(entry.name))) {
            files.push(fullPath);
        }
    }
    return files;
}

/**
 * Whether ANY line of `source`, reduced to just its digits, contains
 * {@link CORE_DIGITS} as a contiguous substring — catching every spacing,
 * dash, and prefix variation on a single line without matching digits that
 * merely happen to sit near each other across unrelated lines.
 */
function lineHasCoreDigits(source: string): boolean {
    return source.split('\n').some((line) => line.replace(/\D/g, '').includes(CORE_DIGITS));
}

describe('HOS-364 static guard — the brand phone number has one source, no literals', () => {
    const files = SCANNED_ROOTS.flatMap(({ label, dir }) =>
        collectFiles(dir).map((absolute) => ({
            label: `${label}/${relative(dir, absolute).split('\\').join('/')}`,
            absolute
        }))
    );

    it(`scans at least ${MIN_SCANNED_FILES} files across both roots`, () => {
        expect(files.length).toBeGreaterThan(MIN_SCANNED_FILES);
    });

    describe('rule 1 — no literal of the brand phone number, in any spelling', () => {
        it('has no file outside the exemption list containing the digits', () => {
            const offenders = files
                .filter(
                    ({ label }) => !(label.replace(/^apps\/web\/src\//, '') in LITERAL_EXEMPTIONS)
                )
                .filter(({ absolute }) => lineHasCoreDigits(readFileSync(absolute, 'utf-8')))
                .map(({ label }) => label);

            expect(
                offenders,
                'These files spell out the brand phone number as a literal. It must come from ' +
                    '@/lib/brand-phone (apps/web) instead — display via getBrandPhoneDisplay() / ' +
                    'getBrandPhoneLocalDisplay(), a call via getBrandPhoneTelHref(), WhatsApp via ' +
                    'getBrandPhoneWhatsAppUrl(). If this file has a real reason to hold the literal, ' +
                    'add it to LITERAL_EXEMPTIONS with that reason.'
            ).toEqual([]);
        });

        it('keeps every exemption pointing at a file that still contains the literal', () => {
            // A stale entry silently widens the allow-list to a file that no
            // longer needs it — the same failure mode outbound-href-sanitization
            // guards against for its own allow-list.
            const stale = Object.keys(LITERAL_EXEMPTIONS).filter((relPath) => {
                const absolute = join(__dirname, '../../src', relPath);
                try {
                    return !lineHasCoreDigits(readFileSync(absolute, 'utf-8'));
                } catch {
                    return true;
                }
            });

            expect(
                stale,
                'These LITERAL_EXEMPTIONS entries no longer match a file containing the literal ' +
                    '(deleted, moved, or the literal was already removed). Delete the entry.'
            ).toEqual([]);
        });
    });

    describe('rule 2 — every surface resolves to the same underlying number', () => {
        it('ORGANIZATION_INFO.telephone matches getBrandPhoneE164()', () => {
            expect(ORGANIZATION_INFO.telephone).toBe(getBrandPhoneE164());
        });

        it("SOCIAL_PROFILES' whatsapp entry matches getBrandPhoneWhatsAppUrl()", () => {
            const whatsapp = SOCIAL_PROFILES.find((profile) => profile.platform === 'whatsapp');
            expect(whatsapp?.url).toBe(getBrandPhoneWhatsAppUrl());
        });

        it('the call/display and WhatsApp forms share the same core digits', () => {
            const callDigits = getBrandPhoneE164().replace(/\D/g, '');
            const waUrl = getBrandPhoneWhatsAppUrl();
            expect(waUrl).not.toBeNull();
            const waDigits = (waUrl ?? '').replace('https://wa.me/', '').split('?')[0] ?? '';

            expect(callDigits).toContain(CORE_DIGITS);
            expect(waDigits).toContain(CORE_DIGITS);
        });

        it('the AR mobile 9 is present ONLY in the WhatsApp form, never in the call form', () => {
            const callDigits = getBrandPhoneE164().replace(/\D/g, ''); // e.g. 543442453797
            const waUrl = getBrandPhoneWhatsAppUrl();
            const waDigits = (waUrl ?? '').replace('https://wa.me/', '').split('?')[0] ?? '';

            expect(callDigits.startsWith('549')).toBe(false);
            expect(waDigits.startsWith('549')).toBe(true);
        });

        it('getBrandPhoneTelHref() is a tel: URI built from the call form', () => {
            expect(getBrandPhoneTelHref()).toBe(`tel:${getBrandPhoneE164()}`);
            expect(getBrandPhoneTelHref()).not.toContain(' ');
        });

        it('getBrandPhoneDisplay() carries the same core digits as every derived form', () => {
            const displayDigits = getBrandPhoneDisplay().replace(/\D/g, '');
            expect(displayDigits).toContain(CORE_DIGITS);
        });
    });
});
