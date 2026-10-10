/**
 * HOS-1638 B13a.10, AC:B13a:24: compare literal web/admin API paths with
 * the registered Hono routes. The committed manifest lets CI run without API
 * environment or a database; its API test checks drift against initApp().
 * Dynamic paths with no literal /api/ are unverifiable and excluded. This is
 * a static path check, not a method, auth, runtime, or response check.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ApiCall {
    readonly file: string;
    readonly line: number;
    readonly route: string;
}
export interface RegisteredRoute {
    readonly method: string;
    readonly path: string;
}
export interface KnownCall {
    readonly file: string;
    readonly route: string;
    readonly owner: string;
    readonly reason: string;
}

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const WILDCARD = '${*}';
export const KNOWN_UNREGISTERED_CALLS: readonly KnownCall[] = [
    {
        file: 'apps/web/src/lib/entitlements-cache.ts',
        route: '/api/v1/protected/users/me/entitlements',
        owner: 'HOS-1646 B13a.13',
        reason: 'Web effective set reader is owned by B13a.13.'
    },
    {
        file: 'apps/web/src/lib/host/usage-badge.ts',
        route: '/api/v1/protected/users/me/entitlements',
        owner: 'HOS-1646 B13a.13',
        reason: 'Web effective set reader is owned by B13a.13.'
    },
    {
        file: 'apps/web/src/lib/host/usage-badge.ts',
        route: '/api/v1/protected/billing/usage/*',
        owner: 'HOS-1646 B13a.13',
        reason: 'Usage badge replacement is owned by B13a.13.'
    },
    {
        file: 'apps/web/src/lib/billing/fetch-plans.ts',
        route: '/api/v1/public/plans',
        owner: 'HOS-1621 B13a.5',
        reason: 'New pricing reader is owned by B13a.5.'
    },
    {
        file: 'apps/admin/src/components/entity-form/fields/entity-selects/utils/post-sponsorship-api.utils.ts',
        route: '/api/v1/admin/post-sponsorships',
        owner: 'unknown',
        reason: 'Existing client path has no registered API route; outside this cleanup.'
    },
    {
        file: 'apps/admin/src/features/accommodations/hooks/useAccommodationQuery.ts',
        route: '/api/v1/admin/accommodations/validate/unique',
        owner: 'unknown',
        reason: 'Existing client path has no registered API route; outside this cleanup.'
    },
    {
        file: 'apps/admin/src/lib/dashboard-sources/host.ts',
        route: '/api/v1/admin/reviews',
        owner: 'unknown',
        reason: 'Existing client path has no registered API route; outside this cleanup.'
    },
    {
        file: 'apps/admin/src/lib/dashboard-sources/host.ts',
        route: '/api/v1/protected/accommodation/my/favorites-breakdown',
        owner: 'unknown',
        reason: 'Existing client path has no registered API route; outside this cleanup.'
    },
    {
        file: 'apps/admin/src/lib/revalidation-http-adapter/index.ts',
        route: '/api/v1/admin/revalidation',
        owner: 'unknown',
        reason: 'Existing client path has no registered API route; outside this cleanup.'
    },
    {
        file: 'apps/admin/src/routes/_authed/analytics/debug.tsx',
        route: '/api/v1/health',
        owner: 'unknown',
        reason: 'Existing client path has no registered API route; outside this cleanup.'
    },
    {
        file: 'apps/admin/src/routes/_authed/analytics/debug.tsx',
        route: '/api/v1/health/db',
        owner: 'unknown',
        reason: 'Existing client path has no registered API route; outside this cleanup.'
    },
    {
        file: 'apps/web/src/lib/api/endpoints-protected.ts',
        route: '/api/v1/protected/users/me/change-password',
        owner: 'unknown',
        reason: 'Existing client path has no registered API route; outside this cleanup.'
    },
    {
        file: 'apps/web/src/lib/api/endpoints-protected.ts',
        route: '/api/v1/protected/reviews/${*}',
        owner: 'unknown',
        reason: 'Existing client path has no registered API route; outside this cleanup.'
    },
    {
        file: 'apps/web/src/lib/api/endpoints-protected.ts',
        route: '/api/v1/public/exchange-rates/config',
        owner: 'unknown',
        reason: 'Existing client path has no registered API route; outside this cleanup.'
    },
    {
        file: 'apps/web/src/lib/api/endpoints-protected.ts',
        route: '/api/v1/public/tags/by-slug/${*}',
        owner: 'unknown',
        reason: 'Existing client path has no registered API route; outside this cleanup.'
    },
    {
        file: 'apps/web/src/lib/api/endpoints.ts',
        route: '/api/v1/public/tags/by-slug/${*}',
        owner: 'unknown',
        reason: 'Existing client path has no registered API route; outside this cleanup.'
    }
];

export function loadRegisteredRoutes(root = ROOT): readonly RegisteredRoute[] {
    return (
        JSON.parse(readFileSync(join(root, 'apps/api/route-manifest.json'), 'utf8')) as {
            routes: RegisteredRoute[];
        }
    ).routes;
}

/** Mask comments, retaining newlines and character positions. */
function codeWithoutComments(source: string): string {
    let result = '';
    let block = false;
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        const next = source[i + 1];
        if (!block && char === '/' && next === '*') {
            block = true;
            result += '  ';
            i++;
            continue;
        }
        if (block && char === '*' && next === '/') {
            block = false;
            result += '  ';
            i++;
            continue;
        }
        if (!block && char === '/' && next === '/') {
            while (i < source.length && source[i] !== '\n') {
                result += ' ';
                i++;
            }
            if (i < source.length) result += '\n';
            continue;
        }
        result += block && char !== '\n' ? ' ' : char;
    }
    return result;
}

export function extractApiCalls({
    file,
    source
}: {
    readonly file: string;
    readonly source: string;
}): readonly ApiCall[] {
    const code = codeWithoutComments(source);
    const constants = new Map<string, string>();
    for (const match of code.matchAll(/\bconst\s+(\w+)\s*=\s*(['"`])(\/api\/[^'"`\s]+)\2/g))
        constants.set(match[1] as string, match[3] as string);
    const calls: ApiCall[] = [];
    const literal = /(['"`])((?:\\.|(?!\1)[^'"`])*)\1/g;
    for (const match of code.matchAll(literal)) {
        let value = match[2] as string;
        const lineStart = code.lastIndexOf('\n', match.index) + 1;
        const before = code.slice(lineStart, match.index);
        if (/^\s*(?:import|export\s+(?:type\s+)?\{?|from\b)/.test(before)) continue;
        value = value.replace(
            /\$\{([^}]+)\}/g,
            (_full, name: string) => constants.get(name) ?? WILDCARD
        );
        const start = value.search(/\/api\/(?:v1\/|auth\/)/);
        if (start < 0) continue;
        let route = value.slice(start).split('?')[0] as string;
        route = route.replace(/(?<!\/)\$\{[^/]*$/, '');
        route = route.replace(/\$\{[^}]+\}/g, WILDCARD).replace(/\/$/, '') || '/';
        if (
            !/^\/api\/(?:v1\/|auth\/)/.test(route) ||
            /^\/api\/v1\/(?:public|protected|admin)$/.test(route)
        )
            continue;
        calls.push({ file, line: code.slice(0, match.index).split('\n').length, route });
    }
    return calls;
}

export function isRegistered({
    route,
    routes
}: {
    readonly route: string;
    readonly routes: readonly RegisteredRoute[];
}): boolean {
    const path = route.split('?')[0] as string;
    const parts = path.split('/');
    return routes.some(({ path: registered }) => {
        const target = registered.split('/');
        if (target.at(-1) === '*')
            return (
                parts.length >= target.length - 1 &&
                target.slice(0, -1).every((part, index) => part === parts[index])
            );
        return (
            parts.length === target.length &&
            target.every(
                (part, index) =>
                    part === parts[index] || part.startsWith(':') || parts[index] === WILDCARD
            )
        );
    });
}

function matchesKnown(call: ApiCall, known: KnownCall): boolean {
    if (call.file !== known.file) return false;
    if (known.route.endsWith('/*')) return call.route.startsWith(known.route.slice(0, -1));
    return call.route === known.route;
}

export function findViolations({
    calls,
    routes,
    known = KNOWN_UNREGISTERED_CALLS
}: {
    readonly calls: readonly ApiCall[];
    readonly routes: readonly RegisteredRoute[];
    readonly known?: readonly KnownCall[];
}): readonly ApiCall[] {
    return calls.filter(
        (call) =>
            !isRegistered({ route: call.route, routes }) &&
            !known.some((entry) => matchesKnown(call, entry))
    );
}
export function findStaleExceptions({
    calls,
    known = KNOWN_UNREGISTERED_CALLS
}: {
    readonly calls: readonly ApiCall[];
    readonly known?: readonly KnownCall[];
}): readonly KnownCall[] {
    return known.filter((entry) => !calls.some((call) => matchesKnown(call, entry)));
}

export function scanRepository(root = ROOT): {
    readonly files: readonly string[];
    readonly calls: readonly ApiCall[];
} {
    const files = execFileSync('git', ['ls-files', '-z', 'apps/web/src', 'apps/admin/src'], {
        cwd: root,
        encoding: 'utf8'
    })
        .split('\0')
        .filter(
            (file) => /\.(?:ts|tsx|astro)$/.test(file) && !/(?:\.test\.|\/__tests__\/)/.test(file)
        );
    const calls = files.flatMap((file) =>
        extractApiCalls({ file, source: readFileSync(join(root, file), 'utf8') })
    );
    return { files, calls };
}

export function run(root = ROOT): { readonly exitCode: number; readonly output: string } {
    const { files, calls } = scanRepository(root);
    const routes = loadRegisteredRoutes(root);
    const violations = findViolations({ calls, routes });
    const stale = findStaleExceptions({ calls });
    const lines = violations.map(({ file, line, route }) => `${file}:${line} — ${route}`);
    lines.push(...stale.map(({ file, route }) => `stale exception: ${file} — ${route}`));
    lines.push(`Scanned ${files.length} files and ${calls.length} API calls.`);
    if (!files.length || !calls.length) lines.push('Scan is empty.');
    return {
        exitCode: violations.length || stale.length || !files.length || !calls.length ? 1 : 0,
        output: lines.join('\n')
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode ? console.error : console.log)(result.output);
    process.exit(result.exitCode);
}
