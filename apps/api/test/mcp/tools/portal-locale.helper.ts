/**
 * Shared assertion of the per-tool locale tests (HOS-2335 follow-up, known gap U-5).
 *
 * A missing `locale` silently falls back to `es`, so dropping it at one call
 * site keeps every other assertion green. These tests therefore walk the WHOLE
 * tool output, collect every portal URL and require each of them to carry the
 * caller's locale, so a single link built without it fails.
 *
 * @module test/mcp/tools/portal-locale.helper
 */

import { expect } from 'vitest';
import { env } from '../../../src/utils/env';

/** The locales a caller can have. */
export const PORTAL_LOCALES = ['en', 'pt'] as const;

/**
 * Every portal URL found in a tool output: the strings that start with the
 * site origin (links to other hosts, such as a maps check link, are ignored).
 *
 * @param args - The tool output (any JSON-serializable value)
 * @returns The portal URLs, in output order
 */
export function collectPortalUrls({ output }: { readonly output: unknown }): readonly string[] {
    const site = env.HOSPEDA_SITE_URL.replace(/\/+$/, '');
    const found = JSON.stringify(output).match(/https?:\/\/[^"\s\\]+/g) ?? [];
    return found.filter((url) => url.startsWith(`${site}/`));
}

/**
 * Asserts the output has at least `minUrls` portal URLs and that EVERY one of
 * them starts with `<site>/<locale>/`.
 *
 * @param args - The tool output, the expected locale and the least number of links
 */
export function expectEveryPortalUrlInLocale({
    output,
    locale,
    minUrls = 1
}: {
    readonly output: unknown;
    readonly locale: (typeof PORTAL_LOCALES)[number];
    readonly minUrls?: number;
}): void {
    const site = env.HOSPEDA_SITE_URL.replace(/\/+$/, '');
    const urls = collectPortalUrls({ output });
    // Not vacuous: a tool that stopped emitting links must fail here.
    expect(urls.length).toBeGreaterThanOrEqual(minUrls);
    const outside = urls.filter((url) => !url.startsWith(`${site}/${locale}/`));
    expect(outside).toEqual([]);
}
