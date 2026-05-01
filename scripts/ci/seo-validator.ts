/**
 * SEO validator for the public web app (SPEC-092 T-091 + T-092).
 *
 * Crawls a configurable list of public pages and asserts:
 *   - Title is non-empty and within length budget.
 *   - Meta description is present and within length budget.
 *   - canonical link present.
 *   - OpenGraph (og:title, og:description, og:image, og:url) present.
 *   - Twitter card metadata present.
 *   - JSON-LD scripts parse and validate against a per-page-type contract.
 *
 * Configuration:
 *   - Reads target base URL from `HOSPEDA_SEO_VALIDATOR_BASE_URL`
 *     (default `http://localhost:4321`).
 *   - Reads page list from `scripts/ci/seo-targets.json` if present, otherwise
 *     uses an embedded default list of canonical pages.
 *
 * Exit codes:
 *   0 - all targets valid
 *   1 - one or more targets failed validation
 *   2 - configuration error (e.g. unreachable base URL)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface PageTarget {
    /** URL relative to the base URL (e.g. '/', '/alojamientos/', '/destinos/'). */
    readonly path: string;
    /** Optional expected JSON-LD @type values (any one match passes). */
    readonly expectedJsonLdTypes?: ReadonlyArray<string>;
    /** Skip JSON-LD validation entirely for this page. */
    readonly skipJsonLd?: boolean;
}

interface ValidationIssue {
    readonly target: string;
    readonly severity: 'error' | 'warning';
    readonly check: string;
    readonly detail: string;
}

const DEFAULT_BASE_URL = 'http://localhost:4321';

const TITLE_MAX_LENGTH = 70;
const DESCRIPTION_MAX_LENGTH = 200;
const TITLE_MIN_LENGTH = 10;
const DESCRIPTION_MIN_LENGTH = 50;

const DEFAULT_TARGETS: ReadonlyArray<PageTarget> = [
    { path: '/', expectedJsonLdTypes: ['Organization', 'WebSite'] },
    { path: '/alojamientos/', expectedJsonLdTypes: ['ItemList', 'CollectionPage'] },
    { path: '/destinos/', expectedJsonLdTypes: ['ItemList', 'CollectionPage'] },
    { path: '/eventos/', expectedJsonLdTypes: ['ItemList'] },
    { path: '/publicaciones/', expectedJsonLdTypes: ['Blog', 'CollectionPage'] }
];

function loadTargets(): ReadonlyArray<PageTarget> {
    const configPath = resolve(process.cwd(), 'scripts/ci/seo-targets.json');
    try {
        const raw = readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw) as ReadonlyArray<PageTarget>;
        if (!Array.isArray(parsed) || parsed.length === 0) {
            console.warn(`[seo-validator] Config at ${configPath} is empty; using defaults`);
            return DEFAULT_TARGETS;
        }
        return parsed;
    } catch {
        return DEFAULT_TARGETS;
    }
}

function extract(html: string, regex: RegExp, group = 1): string | null {
    const match = html.match(regex);
    return match?.[group] ?? null;
}

function extractAllJsonLdScripts(html: string): string[] {
    const matches = html.matchAll(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );
    const out: string[] = [];
    for (const match of matches) {
        if (match[1]) out.push(match[1]);
    }
    return out;
}

function validateMeta(target: string, html: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const title = extract(html, /<title[^>]*>([^<]+)<\/title>/i)?.trim() ?? '';
    if (!title) {
        issues.push({
            target,
            severity: 'error',
            check: 'title',
            detail: 'Missing or empty <title>'
        });
    } else if (title.length < TITLE_MIN_LENGTH) {
        issues.push({
            target,
            severity: 'warning',
            check: 'title-length',
            detail: `Title is too short (${title.length} chars, min ${TITLE_MIN_LENGTH}): "${title}"`
        });
    } else if (title.length > TITLE_MAX_LENGTH) {
        issues.push({
            target,
            severity: 'warning',
            check: 'title-length',
            detail: `Title is too long (${title.length} chars, max ${TITLE_MAX_LENGTH}): "${title}"`
        });
    }

    const description = extract(
        html,
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
    );
    if (!description) {
        issues.push({
            target,
            severity: 'error',
            check: 'meta-description',
            detail: 'Missing <meta name="description">'
        });
    } else if (description.length < DESCRIPTION_MIN_LENGTH) {
        issues.push({
            target,
            severity: 'warning',
            check: 'description-length',
            detail: `Description too short (${description.length} chars)`
        });
    } else if (description.length > DESCRIPTION_MAX_LENGTH) {
        issues.push({
            target,
            severity: 'warning',
            check: 'description-length',
            detail: `Description too long (${description.length} chars)`
        });
    }

    const canonical = extract(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    if (!canonical) {
        issues.push({
            target,
            severity: 'error',
            check: 'canonical',
            detail: 'Missing <link rel="canonical">'
        });
    }

    const ogChecks = [
        ['og:title', /<meta[^>]*property=["']og:title["'][^>]*content=/i],
        ['og:description', /<meta[^>]*property=["']og:description["'][^>]*content=/i],
        ['og:image', /<meta[^>]*property=["']og:image["'][^>]*content=/i],
        ['og:url', /<meta[^>]*property=["']og:url["'][^>]*content=/i]
    ] as const;
    for (const [name, pattern] of ogChecks) {
        if (!pattern.test(html)) {
            issues.push({
                target,
                severity: 'error',
                check: 'opengraph',
                detail: `Missing <meta property="${name}">`
            });
        }
    }

    if (!/<meta[^>]*name=["']twitter:card["']/i.test(html)) {
        issues.push({
            target,
            severity: 'warning',
            check: 'twitter-card',
            detail: 'Missing <meta name="twitter:card">'
        });
    }

    return issues;
}

function validateJsonLd(target: PageTarget, html: string, fullPath: string): ValidationIssue[] {
    if (target.skipJsonLd) return [];
    const scripts = extractAllJsonLdScripts(html);
    if (scripts.length === 0) {
        return [
            {
                target: fullPath,
                severity: 'error',
                check: 'json-ld',
                detail: 'No <script type="application/ld+json"> blocks found'
            }
        ];
    }

    const issues: ValidationIssue[] = [];
    const foundTypes = new Set<string>();

    for (const [idx, content] of scripts.entries()) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(content);
        } catch (err) {
            issues.push({
                target: fullPath,
                severity: 'error',
                check: 'json-ld-parse',
                detail: `Block ${idx} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
            });
            continue;
        }

        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
            if (typeof item !== 'object' || item === null) continue;
            const obj = item as Record<string, unknown>;
            const type = obj['@type'];
            if (typeof type === 'string') {
                foundTypes.add(type);
            } else if (Array.isArray(type)) {
                for (const t of type) {
                    if (typeof t === 'string') foundTypes.add(t);
                }
            }
        }
    }

    if (target.expectedJsonLdTypes && target.expectedJsonLdTypes.length > 0) {
        const matched = target.expectedJsonLdTypes.some((t) => foundTypes.has(t));
        if (!matched) {
            issues.push({
                target: fullPath,
                severity: 'error',
                check: 'json-ld-type',
                detail: `Expected one of ${target.expectedJsonLdTypes.join(', ')} but found: ${
                    Array.from(foundTypes).join(', ') || '(none)'
                }`
            });
        }
    }

    return issues;
}

async function validateTarget(
    baseUrl: string,
    target: PageTarget
): Promise<ReadonlyArray<ValidationIssue>> {
    const url = `${baseUrl.replace(/\/$/, '')}${target.path}`;
    let html: string;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return [
                {
                    target: url,
                    severity: 'error',
                    check: 'http',
                    detail: `Status ${response.status} ${response.statusText}`
                }
            ];
        }
        html = await response.text();
    } catch (err) {
        return [
            {
                target: url,
                severity: 'error',
                check: 'fetch',
                detail: err instanceof Error ? err.message : String(err)
            }
        ];
    }

    return [...validateMeta(url, html), ...validateJsonLd(target, html, url)];
}

async function main(): Promise<void> {
    const baseUrl = process.env.HOSPEDA_SEO_VALIDATOR_BASE_URL ?? DEFAULT_BASE_URL;
    const targets = loadTargets();
    console.info(`[seo-validator] Validating ${targets.length} targets against ${baseUrl}`);

    const allIssues: ValidationIssue[] = [];
    for (const target of targets) {
        const issues = await validateTarget(baseUrl, target);
        allIssues.push(...issues);
    }

    const errors = allIssues.filter((i) => i.severity === 'error');
    const warnings = allIssues.filter((i) => i.severity === 'warning');

    if (warnings.length > 0) {
        console.warn(`\n[seo-validator] ⚠️  ${warnings.length} warning(s):`);
        for (const issue of warnings) {
            console.warn(`  - ${issue.target} [${issue.check}]: ${issue.detail}`);
        }
    }
    if (errors.length > 0) {
        console.error(`\n[seo-validator] ❌ ${errors.length} error(s):`);
        for (const issue of errors) {
            console.error(`  - ${issue.target} [${issue.check}]: ${issue.detail}`);
        }
        process.exit(1);
    }

    console.info(
        `[seo-validator] ✅ All ${targets.length} targets passed (${warnings.length} warning(s))`
    );
}

main().catch((err: unknown) => {
    console.error('[seo-validator] FATAL:', err);
    process.exit(2);
});
