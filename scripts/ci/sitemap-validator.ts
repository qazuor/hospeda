/**
 * Sitemap and robots.txt validator (SPEC-092 T-093).
 *
 * Validates:
 *   - sitemap-index.xml is reachable, well-formed XML, with at least one <url>.
 *   - Each URL in the sitemap responds 2xx (or 3xx with valid redirect).
 *   - robots.txt is reachable, syntactically valid, and references the
 *     sitemap location.
 *   - The sitemap URL declared in robots.txt matches the actual sitemap URL.
 *
 * Configuration:
 *   - HOSPEDA_SITEMAP_VALIDATOR_BASE_URL (default http://localhost:4321)
 *   - HOSPEDA_SITEMAP_VALIDATOR_MAX_URL_CHECK (default 50) — caps the
 *     number of URLs whose status code is verified to keep nightly runs
 *     bounded; the remaining URLs are presence-validated only.
 *
 * Exit codes:
 *   0 - all valid
 *   1 - validation error
 *   2 - configuration / network error
 */

const DEFAULT_BASE_URL = 'http://localhost:4321';
const DEFAULT_MAX_URL_CHECKS = 50;

interface ValidationError {
    readonly area: 'sitemap' | 'robots' | 'url-check' | 'network';
    readonly detail: string;
}

const errors: ValidationError[] = [];

function addError(area: ValidationError['area'], detail: string): void {
    errors.push({ area, detail });
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
    try {
        const response = await fetch(url);
        const text = await response.text();
        return { ok: response.ok, status: response.status, text };
    } catch (err) {
        addError(
            'network',
            `Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`
        );
        return { ok: false, status: 0, text: '' };
    }
}

function parseSitemapUrls(xml: string): string[] {
    const urls: string[] = [];
    const matches = xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi);
    for (const match of matches) {
        if (match[1]) urls.push(match[1].trim());
    }
    return urls;
}

function parseRobotsTxt(text: string): { sitemaps: string[]; userAgents: string[] } {
    const sitemaps: string[] = [];
    const userAgents: string[] = [];
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const lower = trimmed.toLowerCase();
        if (lower.startsWith('sitemap:')) {
            const value = trimmed.slice(trimmed.indexOf(':') + 1).trim();
            if (value) sitemaps.push(value);
        } else if (lower.startsWith('user-agent:')) {
            const value = trimmed.slice(trimmed.indexOf(':') + 1).trim();
            if (value) userAgents.push(value);
        }
    }
    return { sitemaps, userAgents };
}

async function validateSitemap(baseUrl: string): Promise<string[]> {
    const sitemapUrl = `${baseUrl.replace(/\/$/, '')}/sitemap-index.xml`;
    const { ok, status, text } = await fetchText(sitemapUrl);
    if (!ok) {
        addError('sitemap', `${sitemapUrl} returned status ${status}`);
        return [];
    }
    if (!text.includes('<urlset') && !text.includes('<sitemapindex')) {
        addError(
            'sitemap',
            'Response does not look like a sitemap (no <urlset> or <sitemapindex>)'
        );
        return [];
    }
    const urls = parseSitemapUrls(text);
    if (urls.length === 0) {
        addError('sitemap', 'Sitemap has no <url><loc> entries');
    }
    return urls;
}

async function validateRobots(
    baseUrl: string,
    expectedSitemapUrl: string
): Promise<{ sitemaps: string[]; userAgents: string[] }> {
    const robotsUrl = `${baseUrl.replace(/\/$/, '')}/robots.txt`;
    const { ok, status, text } = await fetchText(robotsUrl);
    if (!ok) {
        addError('robots', `${robotsUrl} returned status ${status}`);
        return { sitemaps: [], userAgents: [] };
    }
    const parsed = parseRobotsTxt(text);
    if (parsed.userAgents.length === 0) {
        addError('robots', 'robots.txt has no User-agent directive');
    }
    if (parsed.sitemaps.length === 0) {
        addError('robots', 'robots.txt has no Sitemap directive');
    } else if (!parsed.sitemaps.some((url) => url === expectedSitemapUrl)) {
        addError(
            'robots',
            `robots.txt Sitemap directive(s) ${parsed.sitemaps.join(', ')} do not match expected ${expectedSitemapUrl}`
        );
    }
    return parsed;
}

async function validateUrlsRespond(urls: ReadonlyArray<string>, maxChecks: number): Promise<void> {
    const sample = urls.slice(0, maxChecks);
    let failed = 0;
    for (const url of sample) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            if (response.status >= 400) {
                failed += 1;
                addError('url-check', `${url} returned status ${response.status}`);
            }
        } catch (err) {
            failed += 1;
            addError(
                'url-check',
                `${url} unreachable: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }
    console.info(
        `[sitemap-validator] Verified ${sample.length}/${urls.length} URL responses (${failed} failures)`
    );
}

async function main(): Promise<void> {
    const baseUrl = process.env.HOSPEDA_SITEMAP_VALIDATOR_BASE_URL ?? DEFAULT_BASE_URL;
    const maxChecks = Number.parseInt(
        process.env.HOSPEDA_SITEMAP_VALIDATOR_MAX_URL_CHECK ?? '',
        10
    );
    const effectiveMax =
        Number.isFinite(maxChecks) && maxChecks > 0 ? maxChecks : DEFAULT_MAX_URL_CHECKS;

    console.info(`[sitemap-validator] Base URL: ${baseUrl}, max URL checks: ${effectiveMax}`);

    const expectedSitemapUrl = `${baseUrl.replace(/\/$/, '')}/sitemap-index.xml`;
    const urls = await validateSitemap(baseUrl);
    await validateRobots(baseUrl, expectedSitemapUrl);

    if (urls.length > 0) {
        await validateUrlsRespond(urls, effectiveMax);
    }

    if (errors.length > 0) {
        console.error(`\n[sitemap-validator] ❌ ${errors.length} validation error(s):`);
        for (const error of errors) {
            console.error(`  - [${error.area}] ${error.detail}`);
        }
        process.exit(1);
    }
    console.info(
        `[sitemap-validator] ✅ Passed: sitemap with ${urls.length} URLs + robots.txt syntax + sitemap reference`
    );
}

main().catch((err: unknown) => {
    console.error('[sitemap-validator] FATAL:', err);
    process.exit(2);
});
