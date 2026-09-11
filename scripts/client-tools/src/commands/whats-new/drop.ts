import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { run } from '../../lib/exec.ts';
import { gh } from '../../lib/github.ts';
import { CATALOG_FILE_PATH } from './catalog.ts';
import { type DropPlan, dropBranchName, dropPrBody, planDrop } from './drop-core.ts';
import { WHATS_NEW_DONE_LABEL, WHATS_NEW_NONE_LABEL } from './labels.ts';

/** Base branch every drop PR targets, per the repo's branch workflow. */
const BASE_BRANCH = 'staging';

/**
 * Runs `hops whats-new drop <id>...` — the owner's "delete the ones I do not
 * want" gesture, done for them (HOS-1214 D-7).
 *
 * ## Why this command exists at all
 *
 * `staging` is protected: nobody commits to it directly, and the gate itself
 * treats a commit with no PR as a direct push and BLOCKS. So withdrawing three
 * entries by hand means opening a PR by hand — exactly the manual work the
 * owner said he does not want to do — and that PR then lands in the range the
 * gate audits, where it would be asked whether *deleting novelties* is a
 * novelty. This command absorbs both: it opens the PR, and it opens it already
 * carrying `whats-new-none`.
 *
 * That label is the answer, not an exemption: a PR that only withdraws What's
 * New entries cannot itself be a novelty for a user. Stated here, in
 * {@link dropPrBody}, and in the PR body, precisely so nobody later reads it as
 * a special case hidden in the gate and removes it.
 *
 * ## What it does NOT do
 *
 * It never touches `RETIRED_WHATS_NEW_IDS` — see {@link planDrop} for the
 * reason a never-published id stays available — and it never merges its own
 * PR. Naming ids and merging stays the owner's gesture.
 *
 * @param input.ids         - Entry ids to withdraw.
 * @param input.repoRoot    - Repository root (where the catalog is read/written).
 * @param input.cwd         - Directory to run `git`/`gh` from.
 * @returns The process exit code: `0` done, `1` refused or a write failed.
 */
export async function runWhatsNewDrop({
    ids,
    repoRoot,
    cwd
}: {
    readonly ids: readonly string[];
    readonly repoRoot: string;
    readonly cwd: string;
}): Promise<number> {
    const catalogPath = join(repoRoot, CATALOG_FILE_PATH);

    let content: string;
    try {
        content = readFileSync(catalogPath, 'utf8');
    } catch (error) {
        process.stderr.write(
            `${pc.red('No pude leer el catálogo')} ${CATALOG_FILE_PATH}: ${String(error)}\n`
        );
        return 1;
    }

    const outcome = planDrop({ content, ids });
    if (!outcome.ok) {
        process.stderr.write(`${pc.red('No retiro nada.')} ${outcome.reason}\n`);
        return 1;
    }
    const { plan } = outcome;

    // Every git write happens on a fresh branch cut from a freshly-fetched
    // origin/staging — never on whatever the operator happened to be standing
    // on, and never on `staging` itself.
    const branch = dropBranchName({ ids: plan.dropped.map((entry) => entry.id) });
    const prepared = await prepareBranch({ branch, cwd });
    if (!prepared.ok) {
        process.stderr.write(`${pc.red('No pude preparar la branch:')} ${prepared.error}\n`);
        return 1;
    }

    try {
        writeFileSync(catalogPath, plan.content, 'utf8');
    } catch (error) {
        process.stderr.write(`${pc.red('No pude escribir el catálogo:')} ${String(error)}\n`);
        return 1;
    }

    const committed = await commitAndPush({ branch, plan, cwd });
    if (!committed.ok) {
        process.stderr.write(`${pc.red('No pude commitear/pushear:')} ${committed.error}\n`);
        return 1;
    }

    const prUrl = await openPr({ branch, plan, cwd });
    if (prUrl === null) {
        process.stderr.write(
            `${pc.red('Commiteé y pusheé, pero no pude abrir el PR.')} ` +
                `Abrilo a mano desde ${branch} con la etiqueta ${WHATS_NEW_NONE_LABEL}.\n`
        );
        return 1;
    }
    process.stdout.write(`${pc.green('PR abierto:')} ${prUrl}\n`);

    // The relabel is the point of the whole command (the decision "evaluated,
    // not a novelty" gets recorded without the owner writing anything), so a
    // failure here is reported loudly rather than swallowed — but the PR is
    // already open, and saying which PRs were relabelled and which were not is
    // more useful than pretending nothing happened.
    let failures = 0;
    for (const number of plan.originPrs) {
        const relabelled = await relabelToNone({ number, cwd });
        if (relabelled.ok) {
            process.stdout.write(`  #${number} → ${WHATS_NEW_NONE_LABEL}\n`);
            continue;
        }
        failures += 1;
        process.stderr.write(
            `  ${pc.red(`#${number} NO se pudo reetiquetar`)}: ${relabelled.error.split('\n')[0]}\n`
        );
    }

    if (plan.withoutOrigin.length > 0) {
        process.stdout.write(
            `${pc.yellow('Sin `// origin:` registrado')} — no sé qué PRs originaron ` +
                `${plan.withoutOrigin.map((entry) => entry.id).join(', ')}. ` +
                'Sus PRs siguen con la etiqueta que tengan; reetiquetalos a mano si corresponde.\n'
        );
    }

    return failures === 0 ? 0 : 1;
}

/** Fetches `staging` and cuts the drop branch from it. */
async function prepareBranch({
    branch,
    cwd
}: {
    readonly branch: string;
    readonly cwd: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }> {
    const fetched = await run({
        command: 'git',
        args: ['fetch', 'origin', BASE_BRANCH],
        cwd,
        timeoutMs: 120_000
    });
    if (!fetched.ok) return { ok: false, error: fetched.error };

    const checkedOut = await run({
        command: 'git',
        args: ['checkout', '-B', branch, `origin/${BASE_BRANCH}`],
        cwd,
        timeoutMs: 60_000
    });
    return checkedOut.ok ? { ok: true } : { ok: false, error: checkedOut.error };
}

/** Stages exactly the catalog file, commits, and pushes the branch. */
async function commitAndPush({
    branch,
    plan,
    cwd
}: {
    readonly branch: string;
    readonly plan: DropPlan;
    readonly cwd: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }> {
    const staged = await run({
        command: 'git',
        args: ['add', CATALOG_FILE_PATH],
        cwd,
        timeoutMs: 60_000
    });
    if (!staged.ok) return { ok: false, error: staged.error };

    const ids = plan.dropped.map((entry) => entry.id);
    const committed = await run({
        command: 'git',
        args: [
            'commit',
            '-m',
            `chore(whats-new): withdraw ${ids.length} unpublished entr${ids.length === 1 ? 'y' : 'ies'}`,
            '-m',
            `${ids.join('\n')}\n\nNone of them was ever published, so no id is retired.`
        ],
        cwd,
        timeoutMs: 120_000
    });
    if (!committed.ok) return { ok: false, error: committed.error };

    const pushed = await run({
        command: 'git',
        args: ['push', '-u', 'origin', branch],
        cwd,
        timeoutMs: 120_000
    });
    return pushed.ok ? { ok: true } : { ok: false, error: pushed.error };
}

/** Opens the drop PR, already carrying its own decision label. */
async function openPr({
    branch,
    plan,
    cwd
}: {
    readonly branch: string;
    readonly plan: DropPlan;
    readonly cwd: string;
}): Promise<string | null> {
    const ids = plan.dropped.map((entry) => entry.id);
    const created = await gh({
        args: [
            'pr',
            'create',
            '--base',
            BASE_BRANCH,
            '--head',
            branch,
            '--title',
            `[HOS-1214] chore(whats-new): withdraw ${ids.length} unpublished entr${ids.length === 1 ? 'y' : 'ies'}`,
            '--body',
            dropPrBody({ dropped: ids, originPrs: plan.originPrs }),
            '--label',
            WHATS_NEW_NONE_LABEL
        ],
        cwd
    });
    if (!created.ok) return null;
    const url = created.stdout.trim().split('\n').pop() ?? '';
    return url.length > 0 ? url : null;
}

/** Moves one PR's decision from `whats-new-done` to `whats-new-none`. */
async function relabelToNone({
    number,
    cwd
}: {
    readonly number: number;
    readonly cwd: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }> {
    // Both edits in one call: a PR left carrying BOTH labels is a `conflict`
    // that blocks the promotion, so removing and adding must never be two
    // separate writes that can half-succeed.
    const result = await gh({
        args: [
            'pr',
            'edit',
            String(number),
            '--remove-label',
            WHATS_NEW_DONE_LABEL,
            '--add-label',
            WHATS_NEW_NONE_LABEL
        ],
        cwd
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
}
