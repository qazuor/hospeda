import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
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

export function versionImpact(title: string): VersionImpact {
    const match = title.match(/from\s+v?(\d+)\.(\d+)\.(\d+)[^ ]*\s+to\s+v?(\d+)\.(\d+)\.(\d+)/i);
    if (!match) return 'unknown';
    const [, fromMajor, fromMinor, fromPatch, toMajor, toMinor, toPatch] = match.map(Number);
    if (toMajor !== fromMajor) return 'major';
    if (toMinor !== fromMinor) return 'minor';
    if (toPatch !== fromPatch) return 'patch';
    return 'unknown';
}

type PrEvidence = {
    readonly files: readonly string[];
    readonly reviewDecision: string | null;
    readonly bodyPresent: boolean;
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
    if (pr.baseRefName !== 'staging' && pr.baseRefName !== 'main') return 'blocked';
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
            let evidence: PrEvidence = { files: [], reviewDecision: null, bodyPresent: false };
            if (detail.ok) {
                try {
                    const parsed = JSON.parse(detail.stdout) as {
                        files?: readonly { path?: string }[];
                        body?: string;
                        reviewDecision?: string | null;
                    };
                    evidence = {
                        files: (parsed.files ?? []).map((file) => file.path ?? '').filter(Boolean),
                        reviewDecision: parsed.reviewDecision ?? null,
                        bodyPresent: Boolean(parsed.body?.trim())
                    };
                } catch {
                    evidence = {
                        files: [],
                        reviewDecision: null,
                        bodyPresent: false,
                        error: 'respuesta de detalle inválida'
                    };
                }
            } else {
                evidence = {
                    files: [],
                    reviewDecision: null,
                    bodyPresent: false,
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
