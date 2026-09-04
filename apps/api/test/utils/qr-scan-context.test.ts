/**
 * HOS-1141 — `deriveQrScanContext` and its three pieces.
 *
 * The property this file exists to pin is NEGATIVE and it is the one the owner
 * named: a hostile `User-Agent` must not be able to make anything throw. So the
 * hostile block below asserts `not.toThrow()` FIRST and only then looks at the
 * value, because a suite that only compared return values would go green on a
 * function that threw for a different reason than the one being probed — the
 * `it()` would fail, but with a message about the wrong thing.
 *
 * The second property is the one that is easy to get wrong and impossible to
 * see later: `null` and a value must not be confusable. `DESKTOP` is a positive
 * match, never a fallthrough, and `OTHER` (a UA that named neither platform) is
 * a different answer from `null` (no UA at all). Both are asserted with the
 * hostile inputs, not only with the well-formed ones, because the failure mode
 * is precisely a garbage agent being counted as a real desktop visitor.
 */

import { QrScanDeviceTypeEnum, QrScanOsEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    deriveQrScanBrowserLanguage,
    deriveQrScanContext,
    deriveQrScanDeviceType,
    deriveQrScanOs
} from '../../src/utils/qr-scan-context';

// ---------------------------------------------------------------------------
// Real agents, taken verbatim
// ---------------------------------------------------------------------------

const UA_IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_IPAD =
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_ANDROID_PHONE =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const UA_ANDROID_TABLET =
    'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_WINDOWS_DESKTOP =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_MAC_DESKTOP =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

describe('deriveQrScanDeviceType', () => {
    it.each([
        ['an iPhone', UA_IPHONE, QrScanDeviceTypeEnum.MOBILE],
        ['an Android phone', UA_ANDROID_PHONE, QrScanDeviceTypeEnum.MOBILE],
        ['an iPad', UA_IPAD, QrScanDeviceTypeEnum.TABLET],
        ['an Android tablet', UA_ANDROID_TABLET, QrScanDeviceTypeEnum.TABLET],
        ['Windows desktop Chrome', UA_WINDOWS_DESKTOP, QrScanDeviceTypeEnum.DESKTOP],
        ['macOS desktop Safari', UA_MAC_DESKTOP, QrScanDeviceTypeEnum.DESKTOP]
    ])('classifies %s', (_label, userAgent, expected) => {
        expect(deriveQrScanDeviceType({ userAgent })).toBe(expected);
    });

    it('reads an iPad as a TABLET even though its agent also says "Mobile"', () => {
        // The ordering assertion. An iPad's real agent carries `Mobile/15E148`,
        // so a matcher that ran the phone pattern first would classify every
        // iPad on earth as a phone — and the two rows would look perfectly
        // plausible in a chart, which is what makes this worth a named test.
        expect(UA_IPAD).toContain('Mobile');
        expect(deriveQrScanDeviceType({ userAgent: UA_IPAD })).toBe(QrScanDeviceTypeEnum.TABLET);
    });

    it('reads an Android WITHOUT the Mobile marker as a TABLET', () => {
        // Google's documented convention, and the reason the Android check has
        // to sit after the phone check rather than replace it.
        expect(UA_ANDROID_TABLET).not.toContain('Mobile');
        expect(deriveQrScanDeviceType({ userAgent: UA_ANDROID_TABLET })).toBe(
            QrScanDeviceTypeEnum.TABLET
        );
    });

    it.each([
        ['an Android phone', UA_ANDROID_PHONE, QrScanDeviceTypeEnum.MOBILE],
        ['an Android tablet', UA_ANDROID_TABLET, QrScanDeviceTypeEnum.TABLET]
    ])('never lets %s fall through to the desktop branch, though its agent says "Linux"', (_label, userAgent, expected) => {
        // `DESKTOP_PATTERN` contains `linux`, and EVERY Android user agent
        // contains `Linux` — so the only thing keeping Android off the
        // desktop branch is that the mobile and Android checks both run
        // BEFORE it. That is an ordering guarantee, invisible in the
        // patterns themselves, and this is what pins it.
        //
        // Measured with and without the `linux` token: both Android rows
        // are identical either way, because neither ever reaches the
        // desktop branch. Reorder the checks and this file goes red.
        expect(userAgent.toLowerCase()).toContain('linux');
        expect(deriveQrScanDeviceType({ userAgent })).toBe(expected);
    });

    it.each([
        ['an absent agent', null],
        ['an empty agent', ''],
        ['pure punctuation', '!!!!'],
        ['a bare version number', '1.0'],
        ['an SQL statement', "'; DROP TABLE qr_code_scans; --"]
    ])('answers null, NOT desktop, for %s', (_label, userAgent) => {
        // The load-bearing negative. `DESKTOP` must be a positive match: a
        // printed code is almost never scanned from a desk, so a garbage agent
        // counted as desktop would be the single most misleading row the future
        // metrics panel could show.
        expect(deriveQrScanDeviceType({ userAgent })).toBeNull();
    });
});

describe('deriveQrScanOs', () => {
    it.each([
        ['an iPhone', UA_IPHONE, QrScanOsEnum.IOS],
        ['an iPad', UA_IPAD, QrScanOsEnum.IOS],
        ['an Android phone', UA_ANDROID_PHONE, QrScanOsEnum.ANDROID],
        ['an Android tablet', UA_ANDROID_TABLET, QrScanOsEnum.ANDROID],
        ['Windows', UA_WINDOWS_DESKTOP, QrScanOsEnum.OTHER],
        ['macOS', UA_MAC_DESKTOP, QrScanOsEnum.OTHER]
    ])('classifies %s', (_label, userAgent, expected) => {
        expect(deriveQrScanOs({ userAgent })).toBe(expected);
    });

    it('keeps OTHER and null apart', () => {
        // Two DIFFERENT facts, and the distinction is what makes a broken
        // derivation visible: it would show up as a spike in `null`, whereas
        // folded into `OTHER` it would read as an ordinary long tail.
        expect(deriveQrScanOs({ userAgent: 'curl/8.4.0' })).toBe(QrScanOsEnum.OTHER);
        expect(deriveQrScanOs({ userAgent: null })).toBeNull();
        expect(deriveQrScanOs({ userAgent: '' })).toBeNull();
    });
});

describe('deriveQrScanBrowserLanguage', () => {
    it.each([
        ['a plain supported tag', 'es', 'es'],
        ['a regional tag folded to its primary', 'pt-BR,pt;q=0.9', 'pt'],
        ['quality ordering, highest wins', 'fr;q=0.9,en;q=0.95', 'en'],
        ['stray whitespace and casing', '  EN-us , es;q=0.2 ', 'en']
    ])('matches %s', (_label, header, expected) => {
        expect(deriveQrScanBrowserLanguage({ acceptLanguage: header })).toBe(expected);
    });

    it.each([
        ['an absent header', null],
        ['an empty header', ''],
        ['only unsupported languages', 'fr-FR,de;q=0.8'],
        ['a malformed quality value', ';;;q=banana'],
        ['nothing but separators', ',,,;;;']
    ])('answers null for %s rather than defaulting to es', (_label, header) => {
        // NOT `'es'`. Falling back to the site default would report every
        // header-less scanner as a Spanish speaker and destroy the only
        // question this column was added to answer — local or visitor.
        expect(deriveQrScanBrowserLanguage({ acceptLanguage: header })).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// The property the owner asked for: hostile input cannot cost the redirect
// ---------------------------------------------------------------------------

describe('deriveQrScanContext — hostile input', () => {
    const HOSTILE: ReadonlyArray<readonly [string, string | null | undefined]> = [
        ['an absent header', null],
        ['an undefined header', undefined],
        ['an empty string', ''],
        ['whitespace only', '   \t  '],
        ['10 KB of junk', 'A'.repeat(10_240)],
        // Escapes, NOT the raw bytes. Writing the literal control characters
        // into the source made git classify this whole file as BINARY, so the
        // 10 KB of hostile-input coverage rendered as "Binary file not shown"
        // to every PR reviewer. Same value at runtime, reviewable on disk.
        ['NUL and control bytes', 'Mozilla/5.0\u0000\u0001\u001b[31m(iPhone)'],
        ['an SQL statement', "Mozilla/5.0'; DROP TABLE qr_code_scans; -- "],
        ['a percent-encoding attempt', '%00%2e%2e%2f%2e%2e%2f'],
        ['unpaired surrogates', 'UA \ud800 \udfff'],
        // Written as concatenation rather than one literal: as a single string
        // it trips biome's `noTemplateCurlyInString`, and what this fixture is
        // about is the VALUE that reaches the deriver, not how the source
        // happens to spell it.
        ['a template-injection attempt', `$${'{'}7*7}`],
        ['a handlebars-injection attempt', '{{constructor.constructor}}'],
        ['emoji and a bidi override', '\u{1f642}‮evil‬']
    ];

    it.each(HOSTILE)('does not throw on %s', (_label, userAgent) => {
        expect(() =>
            deriveQrScanContext({ userAgent, acceptLanguage: ';;;q=banana' })
        ).not.toThrow();
    });

    it.each(HOSTILE)('returns exactly the four keys for %s', (_label, userAgent) => {
        // Key equality, not `objectContaining`: the risk here is a MISSING key
        // silently becoming `undefined` at the insert, which `objectContaining`
        // is blind to.
        const context = deriveQrScanContext({ userAgent, acceptLanguage: null });

        expect(Object.keys(context).sort()).toEqual([
            'browserLanguage',
            'deviceType',
            'os',
            'userAgent'
        ]);
    });

    it('truncates a 10 KB agent to the documented bound instead of rejecting it', () => {
        const context = deriveQrScanContext({
            userAgent: 'A'.repeat(10_240),
            acceptLanguage: null
        });

        // Truncated, and NOT dropped: the row still records what was sent, and
        // a `varchar(1024)` column can accept it. A schema that REJECTED an
        // over-long value would turn a hostile header into a lost scan.
        expect(context.userAgent).toHaveLength(1024);
        expect(context.userAgent).toBe('A'.repeat(1024));
    });

    it('stores null, never the empty string, for a blank agent', () => {
        // An empty UA and a missing one are the same fact. Two spellings of
        // "nothing" in a column that gets grouped by is a chart with a phantom
        // row in it.
        for (const blank of ['', '   ', '\t\n']) {
            expect(deriveQrScanContext({ userAgent: blank, acceptLanguage: null }).userAgent).toBe(
                null
            );
        }
    });

    it('reads a real scan end to end', () => {
        expect(
            deriveQrScanContext({
                userAgent: UA_ANDROID_PHONE,
                acceptLanguage: 'pt-BR,pt;q=0.9,en;q=0.8'
            })
        ).toEqual({
            userAgent: UA_ANDROID_PHONE,
            deviceType: QrScanDeviceTypeEnum.MOBILE,
            os: QrScanOsEnum.ANDROID,
            browserLanguage: 'pt'
        });
    });
});
