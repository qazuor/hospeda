/**
 * Public web hosts that always count as "our web domain" for attribution, whatever
 * the configured site URL is. Admin and API hosts are deliberately NOT here: links to
 * them never get UTMs (HOS-2359 §6.A.2).
 */
const FIXED_OWN_WEB_ORIGINS = [
    'https://hospeda.com.ar',
    'https://www.hospeda.com.ar',
    'https://staging.hospeda.com.ar'
] as const;

/**
 * Builds the list of origins whose links receive UTMs: the configured site origin plus
 * the fixed public hosts, deduped. An unparseable `siteUrl` is ignored.
 *
 * @param input - `siteUrl`: the web app's public URL
 * @returns The own web origins, site origin first
 */
export function buildOwnWebOrigins({ siteUrl }: { readonly siteUrl: string }): readonly string[] {
    const origins: string[] = [];
    try {
        origins.push(new URL(siteUrl).origin);
    } catch {
        // An invalid site URL contributes nothing; the fixed hosts still apply.
    }
    for (const origin of FIXED_OWN_WEB_ORIGINS) {
        if (!origins.includes(origin)) {
            origins.push(origin);
        }
    }
    return origins;
}

/**
 * True when `url` is an absolute `http(s)` URL whose origin is in `ownOrigins`.
 * Relative URLs, `mailto:`, `tel:`, anchors and every other host answer false.
 *
 * @param input - `url` to test and the `ownOrigins` from {@link buildOwnWebOrigins}
 * @returns Whether the link points at our web domain
 */
export function isOwnWebUrl({
    url,
    ownOrigins
}: {
    readonly url: string;
    readonly ownOrigins: readonly string[];
}): boolean {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return false;
    }
    return ownOrigins.includes(parsed.origin);
}
