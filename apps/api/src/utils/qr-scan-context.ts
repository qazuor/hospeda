/**
 * Reading a QR scan's "where from" out of request headers (HOS-1141).
 *
 * Four pure functions and one aggregator. Nothing here does I/O, nothing here
 * throws, and every one of them accepts the header exactly as a stranger may
 * send it: absent, empty, megabytes long, full of control bytes, or carrying an
 * SQL statement. The single hard rule this module exists to keep is
 *
 *   **a hostile User-Agent must never cost the redirect.**
 *
 * Somebody standing in front of a printed sign has to reach their destination.
 * A scan whose device could not be read is a scan with three nulls in it, which
 * is a fact worth recording; a redirect that failed is a visit lost for good.
 * So every function below returns `null` where it cannot tell, and none of them
 * has a path that raises.
 *
 * ## Why this lives in `apps/api` and not in `@repo/service-core`
 *
 * Because it reads HTTP headers, and that is the API layer's subject. The
 * sibling `browser-detection.ts` does the same job for the feedback widget and
 * sits here for the same reason. It also keeps `matchAcceptLanguage` reachable:
 * `@repo/service-core` does not depend on `@repo/i18n`, and re-deriving
 * `Accept-Language` matching inside it would put a second, drifting copy of the
 * platform's locale negotiation next to the real one.
 *
 * ## Why not a user-agent parsing library
 *
 * `ua-parser-js` is already in the tree (`@repo/feedback`). It is not used here
 * on purpose: it answers a much finer question than three buckets, and every
 * answer it gives is a string this table would then have to bound and validate.
 * Three positive substring matches over a lowercased string are decidable by
 * reading them, cost nothing on a redirect's critical path, and — the part that
 * matters — cannot throw on input a stranger chose.
 *
 * @module qr-scan-context
 */

import { defaultLocale, matchAcceptLanguage, locales as SUPPORTED_LOCALES } from '@repo/i18n';
import { QR_SCAN_USER_AGENT_MAX_LENGTH, QrScanDeviceTypeEnum, QrScanOsEnum } from '@repo/schemas';

/** What one scan can be told about the client that made it. */
export interface QrScanContext {
    /** The raw header, truncated; `null` when absent or blank. */
    readonly userAgent: string | null;
    /** Phone / tablet / desktop; `null` when nothing was positively matched. */
    readonly deviceType: QrScanDeviceTypeEnum | null;
    /** iOS / Android / other; `null` when there was no agent to read. */
    readonly os: QrScanOsEnum | null;
    /** A supported locale, or `null` when the header named none. */
    readonly browserLanguage: string | null;
}

/**
 * Normalises a header value to something the matchers can be reasoned about.
 *
 * Three things happen and each answers a specific hostile input:
 *
 * 1. **Truncate first, before anything else touches the string.** A 10 KB
 *    header should cost one slice, not a regex sweep over 10 KB. Slicing ahead
 *    of `toLowerCase()` also caps the work every matcher below can be made to
 *    do, which is what keeps a junk agent off the redirect's latency budget.
 * 2. **Trim, and treat the result's emptiness as absence.** A `User-Agent: `
 *    header and no header at all are the same fact, and storing `''` for one
 *    and `NULL` for the other would put two spellings of "nothing" in a column
 *    that gets grouped by.
 * 3. **Nothing is unescaped, decoded or interpreted.** The value is stored
 *    through a parameterised insert and rendered by nobody; `'; DROP TABLE` is
 *    just a string of that length.
 *
 * @param value - The raw header value, or whatever the framework handed over.
 * @returns The bounded, trimmed value, or `null` when there is nothing in it.
 */
function normalizeUserAgent(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;

    const bounded = value.slice(0, QR_SCAN_USER_AGENT_MAX_LENGTH).trim();

    return bounded.length > 0 ? bounded : null;
}

/**
 * Phones and everything that reports itself as one.
 *
 * `mobile` alone catches Android phones (which say `Android ... Mobile`),
 * Firefox mobile and most in-app browsers; the explicit Apple handhelds catch
 * iPhone and iPod, which do NOT carry the word "mobile" in every version.
 */
const MOBILE_PATTERN = /iphone|ipod|windows phone|\bmobile\b|blackberry|iemobile|opera mini/;

/**
 * Tablets.
 *
 * Checked BEFORE {@link MOBILE_PATTERN} in {@link deriveQrScanDeviceType},
 * because an Android tablet's agent contains neither `Mobile` nor anything else
 * distinguishing — the convention Google documents is that a tablet is an
 * `Android` agent WITHOUT `Mobile` — and an iPad's contains `Safari` and
 * historically `Mobile`. Running mobile first would classify every iPad as a
 * phone.
 */
const TABLET_PATTERN = /ipad|tablet|kindle|playbook|silk/;

/**
 * Desktops and laptops, matched POSITIVELY.
 *
 * This is the part that is easy to get wrong by making `DESKTOP` the
 * fallthrough. An agent nothing recognises is not a person at a desk — it is a
 * bot, a broken client, or a scanner app with its own string — and counting it
 * as desktop invents the single most misleading row a QR metrics panel could
 * show, since a printed code is almost never scanned from a desktop.
 *
 * ## `linux` is DELIBERATELY absent — do not add it back
 *
 * It was here, and it was removed (HOS-1141 review) because it violated the
 * very rule stated just above. `linux` is not a desktop signal; it is a kernel
 * that also runs televisions, set-top boxes and crawlers. Measured over the
 * same corpus, with and without the token:
 *
 * ```
 * case                    with linux  without linux
 * Android phone               MOBILE         MOBILE
 * Android tablet              TABLET         TABLET
 * Desktop Linux X11          DESKTOP        DESKTOP
 * Desktop Linux no X11       DESKTOP           null   <- the cost
 * Smart TV (Tizen/Linux)     DESKTOP           null   <- the reason
 * Bot on Linux               DESKTOP           null   <- the reason
 * ```
 *
 * It bought exactly ONE honest case — desktop Linux that does not announce
 * `X11`, e.g. Firefox on Wayland (`Mozilla/5.0 (Linux x86_64; rv:128.0)`) —
 * and paid for it with two dishonest ones. A Tizen TV is not somebody at a
 * desk, and a crawler is not anybody at all.
 *
 * So a Wayland Firefox now derives `null`, and that is the INTENDED answer, not
 * a gap to close by restoring the token. `null` means "we could not tell",
 * which is true, and it stays distinguishable from the buckets we did read —
 * the same rule that keeps `QrScanOsEnum.OTHER` separate from `NULL`. Trading a
 * fabricated `DESKTOP` row for an honest empty one is the entire point.
 *
 * Note this token was never what protected Android: EVERY Android user agent
 * contains `Linux`, and what keeps Android off this branch is the ORDER of the
 * checks in {@link deriveQrScanDeviceType}, pinned by its own test.
 */
const DESKTOP_PATTERN = /windows nt|macintosh|mac os x|x11|cros/;

/** Android WITHOUT the phone marker, i.e. the documented tablet convention. */
const ANDROID_PATTERN = /android/;

/** Apple handhelds and anything self-reporting iOS. */
const IOS_PATTERN = /iphone|ipad|ipod|\bios\b|ipados/;

/**
 * Classifies the device that sent a user agent.
 *
 * Order matters and is asserted by the tests: tablet, then mobile, then the
 * Android-without-`Mobile` tablet convention, then desktop. Anything else is
 * `null`.
 *
 * @param input - Options object (RO-RO).
 * @param input.userAgent - Already normalised by {@link normalizeUserAgent}.
 * @returns The device type, or `null` when nothing matched positively.
 */
export function deriveQrScanDeviceType(input: {
    userAgent: string | null;
}): QrScanDeviceTypeEnum | null {
    if (!input.userAgent) return null;

    const ua = input.userAgent.toLowerCase();

    if (TABLET_PATTERN.test(ua)) return QrScanDeviceTypeEnum.TABLET;
    if (MOBILE_PATTERN.test(ua)) return QrScanDeviceTypeEnum.MOBILE;
    // An `Android` agent that reached here carries no `Mobile` marker, which is
    // exactly how Android tablets are documented to identify themselves.
    if (ANDROID_PATTERN.test(ua)) return QrScanDeviceTypeEnum.TABLET;
    if (DESKTOP_PATTERN.test(ua)) return QrScanDeviceTypeEnum.DESKTOP;

    return null;
}

/**
 * Classifies the operating system that sent a user agent.
 *
 * `OTHER` is returned whenever a usable agent named neither platform, and that
 * is a different answer from `null`, which means there was no agent at all. See
 * `QrScanOsEnum` for why the two are kept apart.
 *
 * @param input - Options object (RO-RO).
 * @param input.userAgent - Already normalised by {@link normalizeUserAgent}.
 * @returns The OS bucket, or `null` when there was nothing to read.
 */
export function deriveQrScanOs(input: { userAgent: string | null }): QrScanOsEnum | null {
    if (!input.userAgent) return null;

    const ua = input.userAgent.toLowerCase();

    if (IOS_PATTERN.test(ua)) return QrScanOsEnum.IOS;
    if (ANDROID_PATTERN.test(ua)) return QrScanOsEnum.ANDROID;

    return QrScanOsEnum.OTHER;
}

/**
 * Reads which of this platform's locales the scanner's browser asked for.
 *
 * Delegates to `matchAcceptLanguage`, the platform's single source of truth for
 * `Accept-Language` negotiation (HOS-617). What is NOT delegated is the
 * fallback: that function answers with `defaultLocale` when nothing matched and
 * reports it through `matched: false`, and this column must store `null` in
 * that case. Writing `es` for a header-less request would make every anonymous
 * scanner look like a Spanish speaker, which destroys the only question this
 * column was added to answer — telling a local apart from a visitor.
 *
 * A malformed header costs nothing: `parseAcceptLanguageEntries` drops entries
 * with an empty tag or a non-numeric `q` rather than defaulting them, so
 * `Accept-Language: ;;;q=banana` yields no entries and this returns `null`.
 *
 * @param input - Options object (RO-RO).
 * @param input.acceptLanguage - The raw header, or `null` when absent.
 * @returns A supported locale, or `null` when the header named none.
 */
export function deriveQrScanBrowserLanguage(input: {
    acceptLanguage: string | null | undefined;
}): string | null {
    const header = typeof input.acceptLanguage === 'string' ? input.acceptLanguage : null;
    if (!header) return null;

    const { locale, matched } = matchAcceptLanguage({
        header,
        supportedLocales: SUPPORTED_LOCALES,
        // Never actually used: the `matched` flag below discards it. Supplied
        // only because the function's contract requires one.
        defaultLocale
    });

    return matched ? locale : null;
}

/**
 * Reads everything one scan can learn from the request headers.
 *
 * Total: for every possible pair of inputs it returns an object with four keys,
 * each either a value or `null`. There is no input for which it throws, and the
 * tests probe that with an empty agent, a 10 KB one, one carrying NUL and other
 * control bytes, one carrying SQL, and a malformed `Accept-Language`.
 *
 * @param input - Options object (RO-RO).
 * @param input.userAgent - Raw `User-Agent` header, or `null`.
 * @param input.acceptLanguage - Raw `Accept-Language` header, or `null`.
 * @returns The four derived values.
 */
export function deriveQrScanContext(input: {
    userAgent: string | null | undefined;
    acceptLanguage: string | null | undefined;
}): QrScanContext {
    const userAgent = normalizeUserAgent(input.userAgent);

    return {
        userAgent,
        deviceType: deriveQrScanDeviceType({ userAgent }),
        os: deriveQrScanOs({ userAgent }),
        browserLanguage: deriveQrScanBrowserLanguage({ acceptLanguage: input.acceptLanguage })
    };
}
