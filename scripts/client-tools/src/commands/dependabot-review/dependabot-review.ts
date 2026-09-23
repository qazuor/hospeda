import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { run } from '../../lib/exec.ts';
import { gh } from '../../lib/github.ts';

type DependabotPr = {
    readonly number: number;
    readonly title: string;
    readonly url?: string;
    readonly baseRefName?: string;
    readonly headRefName?: string;
    readonly isDraft?: boolean;
    readonly mergeStateStatus?: string;
    readonly updatedAt?: string;
    readonly author?: { readonly login?: string };
    readonly labels?: readonly { readonly name?: string }[];
};

export type VersionImpact = 'major' | 'minor' | 'patch' | 'unknown';

export function packageFromTitle(title: string): string | null {
    const match = title.match(/bump\s+(.+?)\s+from\s+v?\d/i);
    return match?.[1]?.trim() ?? null;
}

async function localUsage(
    repoRoot: string,
    title: string
): Promise<{ package: string | null; files: readonly string[]; status: 'ok' | 'unknown' }> {
    const packageName = packageFromTitle(title);
    if (!packageName) return { package: null, files: [], status: 'unknown' };
    const result = await run({
        command: 'rg',
        args: [
            '-l',
            '--hidden',
            '--fixed-strings',
            '--glob',
            '!.git/**',
            '--glob',
            '!node_modules/**',
            '--glob',
            '!dist/**',
            '--glob',
            '!build/**',
            '--glob',
            '!**/*lock*',
            '--glob',
            '!**/.specs/**',
            '--glob',
            '!**/docs/**',
            packageName,
            '.'
        ],
        cwd: repoRoot,
        timeoutMs: 30_000
    });
    if (!result.ok) return { package: packageName, files: [], status: 'unknown' };
    return {
        package: packageName,
        files: result.stdout
            .split('\n')
            .map((file) => file.trim())
            .filter(Boolean)
            .slice(0, 100),
        status: 'ok'
    };
}

export function versionImpact(title: string): VersionImpact {
    const match = title.match(/from\s+v?(\d+)\.(\d+)\.(\d+)[^ ]*\s+to\s+v?(\d+)\.(\d+)\.(\d+)/i);
    if (!match) return 'unknown';
    const [, fromMajor, fromMinor, fromPatch, toMajor, toMinor, toPatch] = match.map(Number);
    if (toMajor !== fromMajor) return 'major';
    if (toMinor !== fromMinor) return 'minor';
    if (toPatch !== fromPatch) return 'patch';
    return 'unknown';
}

/** Extract only bounded, relevant release-note links from untrusted PR text. */
export function extractReleaseNotesUrls(body: string): readonly string[] {
    const urls = new Set<string>();
    for (const match of body.matchAll(/https?:\/\/[^\s<>'"\])}]+/gi)) {
        const candidate = match[0].replace(/&amp;/gi, '&').replace(/[.,;:!?`]+$/g, '');
        try {
            const parsed = new URL(candidate);
            const haystack = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
            if (!/changelog|releases|compare|npmjs\.com/.test(haystack)) continue;
            parsed.hash = '';
            urls.add(parsed.toString());
        } catch {
            // Ignore malformed links from Markdown/HTML instead of exposing them.
        }
    }
    return [...urls].slice(0, 8);
}

type PrEvidence = {
    readonly files: readonly string[];
    readonly reviewDecision: string | null;
    readonly bodyPresent: boolean;
    readonly releaseNotesUrls: readonly string[];
    readonly error?: string;
    readonly versionImpact?: VersionImpact;
};

function riskOf(files: readonly string[]): 'low' | 'medium' | 'high' {
    if (files.some((file) => /migrations|\.github\/workflows|Dockerfile|turbo\.json/.test(file)))
        return 'high';
    if (files.some((file) => /package\.json|pnpm-lock|package-lock|yarn\.lock/.test(file)))
        return 'medium';
    return 'low';
}

export type DependabotRecommendation = 'close' | 'no-spec' | 'create-issue' | 'blocked';

export function recommend(pr: DependabotPr, evidence?: PrEvidence): DependabotRecommendation {
    if (pr.isDraft || pr.mergeStateStatus === 'DIRTY') return 'blocked';
    if (!pr.baseRefName || !['develop', 'staging', 'main'].includes(pr.baseRefName))
        return 'blocked';
    if (/revert|supersed|duplicate|obsolete/i.test(pr.title)) return 'close';
    if (
        versionImpact(pr.title) === 'major' ||
        /major|breaking|migration|deprecated/i.test(pr.title)
    )
        return 'create-issue';
    if (evidence?.files.some((file) => /migrations|\.github\/workflows|Dockerfile/.test(file)))
        return 'create-issue';
    return 'no-spec';
}

function help(): string {
    return `${pc.bold('hops dependabot-review')} — informe read-only de PRs de Dependabot\n\n  hops dependabot-review [--base <branch>] [--pr <number>] [--json]\n\nNo cierra, aprueba, etiqueta, mergea ni modifica PRs.\n`;
}

export async function runDependabotReview({
    argv
}: {
    readonly argv: readonly string[];
}): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(help());
        return 0;
    }
    const json = argv.includes('--json');
    const baseAt = argv.findIndex((arg) => arg === '--base');
    const base =
        argv.find((arg) => arg.startsWith('--base='))?.slice(7) ??
        (baseAt >= 0 ? argv[baseAt + 1] : undefined);
    const prAt = argv.findIndex((arg) => arg === '--pr');
    const prNumber =
        argv.find((arg) => arg.startsWith('--pr='))?.slice(5) ??
        (prAt >= 0 ? argv[prAt + 1] : undefined);
    const context = await resolveRunContext({ cwd: process.cwd(), target: 'local' });
    const result = await gh({
        cwd: context.repoRoot,
        args: [
            'pr',
            'list',
            '--author',
            'dependabot[bot]',
            '--state',
            'open',
            '--limit',
            '100',
            '--json',
            'number,title,url,baseRefName,headRefName,isDraft,mergeStateStatus,updatedAt,author,labels'
        ]
    });
    if (!result.ok) {
        const authUnavailable = /401|bad credentials|authentication/i.test(result.error);
        const payload = {
            readOnly: true,
            status: authUnavailable ? 'auth_unavailable' : 'query_failed',
            error: authUnavailable
                ? 'GitHub no aceptó las credenciales de gh'
                : result.error.split('\n')[0]
        };
        process.stdout.write(`${JSON.stringify(payload)}\n`);
        return 1;
    }
    let prs: DependabotPr[];
    try {
        prs = JSON.parse(result.stdout) as DependabotPr[];
    } catch {
        process.stdout.write(`${JSON.stringify({ readOnly: true, status: 'invalid_response' })}\n`);
        return 1;
    }
    prs = prs
        .filter((pr) => base === undefined || pr.baseRefName === base)
        .filter((pr) => prNumber === undefined || String(pr.number) === prNumber);
    const items = await Promise.all(
        prs.map(async (pr) => {
            const detail = await gh({
                cwd: context.repoRoot,
                args: ['pr', 'view', String(pr.number), '--json', 'files,body,reviewDecision']
            });
            let evidence: PrEvidence = {
                files: [],
                reviewDecision: null,
                bodyPresent: false,
                releaseNotesUrls: []
            };
            if (detail.ok) {
                try {
                    const parsed = JSON.parse(detail.stdout) as {
                        files?: readonly { path?: string }[];
                        body?: string;
                        reviewDecision?: string | null;
                    };
                    const releaseNotesUrls = extractReleaseNotesUrls(parsed.body ?? '');
                    evidence = {
                        files: (parsed.files ?? []).map((file) => file.path ?? '').filter(Boolean),
                        reviewDecision: parsed.reviewDecision ?? null,
                        bodyPresent: Boolean(parsed.body?.trim()),
                        releaseNotesUrls
                    };
                } catch {
                    evidence = {
                        files: [],
                        reviewDecision: null,
                        bodyPresent: false,
                        releaseNotesUrls: [],
                        error: 'respuesta de detalle inválida'
                    };
                }
            } else {
                evidence = {
                    files: [],
                    reviewDecision: null,
                    bodyPresent: false,
                    releaseNotesUrls: [],
                    error: detail.error.split('\n')[0]
                };
            }
            return {
                number: pr.number,
                title: pr.title,
                url: pr.url ?? null,
                base: pr.baseRefName ?? null,
                head: pr.headRefName ?? null,
                updatedAt: pr.updatedAt ?? null,
                recommendation: recommend(pr, evidence),
                versionImpact: versionImpact(pr.title),
                risk: riskOf(evidence.files),
                usage: await localUsage(context.repoRoot, pr.title),
                evidence,
                readOnly: true
            };
        })
    );
    const payload = { readOnly: true, status: 'ok', count: items.length, items };
    if (json) process.stdout.write(`${JSON.stringify(payload)}\n`);
    else {
        process.stdout.write(`${pc.bold('REPORTE DEPENDABOT')} · ${items.length} PR(s)\n`);
        for (const item of items)
            process.stdout.write(`  #${item.number} [${item.recommendation}] ${item.title}\n`);
    }
    return 0;
}
