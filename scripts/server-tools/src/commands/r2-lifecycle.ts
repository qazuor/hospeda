/**
 * `hops r2-lifecycle [show|set]` — manage the bucket-level lifecycle rule
 * that auto-deletes manual backup objects after a fixed retention period.
 *
 * Background: the daily backup cron writes objects at the bucket root
 * (`hospeda-postgres-<ts>.dump.gpg`), while `hops db-backup-now` and
 * `hops db-restore --snapshot-first` write under the `manual/` prefix.
 * The daily cron is retained indefinitely (cheap, dev-grade volume);
 * the manual blobs accumulate over time and should self-expire so the
 * R2 bill stays predictable.
 *
 * SPEC-103 T-081. Idempotent — running `set` twice produces the same
 * resulting bucket configuration.
 */

import { getActiveTarget } from '../lib/container-lookup.ts';
import { die, log } from '../lib/log.ts';
import { confirm } from '../lib/prompt.ts';
import { createR2Client } from '../lib/r2.ts';
import type { Target } from '../lib/target.ts';

const HELP = `
hops r2-lifecycle [show|set]

Show or set the lifecycle rule on the R2 bucket for the active target.

  show           Print the current bucket lifecycle rules. (default action)
  set            Apply the rule: delete \`manual/*\` after 30 days. Idempotent.

Flags:
  --prefix <str>            Prefix to expire (default: 'manual/').
  --expiration-days <n>     Retention period in days (default: 30).
  --rule-id <str>           Rule ID used in the config (default:
                            'delete-manual-after-<N>-days').
  --yes                     Skip the confirmation prompt before applying.
  --help, -h                Show this help.

Examples:
  hops r2-lifecycle show
  hops r2-lifecycle set
  hops r2-lifecycle set --target=staging
  hops r2-lifecycle set --prefix=manual/ --expiration-days=14 --yes

Notes:
  R2 stores at most ONE lifecycle config per bucket; \`set\` replaces any
  existing rules. Run \`show\` first if you want to inspect what's there
  before overwriting.

  Both subcommands require an R2 access token scoped to "Admin Read &
  Write" — the default token used by daily backups is "Object Read &
  Write" (sufficient for PutObject / GetObject / ListObjectsV2 but not
  for bucket-level admin like Put/GetBucketLifecycleConfiguration).
  When the token lacks admin scope, both subcommands surface a clear
  "Access Denied" message and the operator can fall back to setting the
  rule manually in the Cloudflare R2 dashboard
  (R2 → bucket → Settings → Object lifecycle rules).
`.trim();

type Subcommand = 'show' | 'set';

interface ParsedArgs {
    readonly sub: Subcommand;
    readonly prefix: string;
    readonly expirationDays: number;
    readonly ruleId: string;
    readonly skipConfirm: boolean;
}

function parseArgs(argv: ReadonlyArray<string>): ParsedArgs {
    const args = [...argv];
    const positional: string[] = [];
    let prefix = 'manual/';
    let expirationDays = 30;
    let ruleId: string | undefined;
    let skipConfirm = false;

    for (let i = 0; i < args.length; i += 1) {
        const token = args[i];
        if (token === undefined) continue;
        if (token === '--yes') {
            skipConfirm = true;
            continue;
        }
        if (token === '--prefix' || token?.startsWith('--prefix=')) {
            prefix = token.startsWith('--prefix=')
                ? token.slice('--prefix='.length)
                : (args[++i] ?? prefix);
            continue;
        }
        if (token === '--expiration-days' || token?.startsWith('--expiration-days=')) {
            const raw = token.startsWith('--expiration-days=')
                ? token.slice('--expiration-days='.length)
                : args[++i];
            const n = Number(raw);
            if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
                die(`Invalid --expiration-days '${raw}': expected a positive integer.`);
            }
            expirationDays = n;
            continue;
        }
        if (token === '--rule-id' || token?.startsWith('--rule-id=')) {
            ruleId = token.startsWith('--rule-id=') ? token.slice('--rule-id='.length) : args[++i];
            continue;
        }
        if (!token.startsWith('--')) positional.push(token);
    }

    const sub = (positional[0] ?? 'show') as Subcommand;
    if (sub !== 'show' && sub !== 'set') {
        die(`Unknown subcommand '${sub}'. Expected 'show' or 'set'.`);
    }

    return {
        sub,
        prefix,
        expirationDays,
        ruleId: ruleId ?? `delete-${prefix.replace(/\W+/g, '')}-after-${expirationDays}-days`,
        skipConfirm
    };
}

function isAccessDeniedError(err: unknown): boolean {
    const name = err instanceof Error ? err.name : '';
    const msg = err instanceof Error ? err.message : String(err);
    return name === 'AccessDenied' || msg.includes('Access Denied');
}

function accessDeniedHint(bucket: string, op: 'reading' | 'writing'): string {
    const trailer =
        op === 'writing'
            ? 'Workaround: apply the rule manually via the Cloudflare R2 dashboard (R2 → bucket → Settings → Object lifecycle rules → Add rule).'
            : 'The rule may still be applied server-side; verify in the Cloudflare R2 dashboard → bucket → Settings → Object lifecycle rules.';
    return `Access Denied ${op} lifecycle on s3://${bucket}/. This R2 access token is scoped to "Object Read & Write" — bucket-level admin ops (GetBucketLifecycleConfiguration, PutBucketLifecycleConfiguration) require the "Admin Read & Write" scope. ${trailer}`;
}

async function showLifecycle(target: Target): Promise<void> {
    const r2 = createR2Client(target);
    let rules: ReadonlyArray<{ id: string; prefix: string; expirationDays: number }> | undefined;
    try {
        rules = await r2.getLifecycle();
    } catch (err) {
        if (isAccessDeniedError(err)) {
            log.warn(accessDeniedHint(r2.bucket, 'reading'));
            return;
        }
        throw err;
    }
    if (rules === undefined || rules.length === 0) {
        log.info(`No lifecycle rules on s3://${r2.bucket}/.`);
        return;
    }
    log.info(`Lifecycle rules on s3://${r2.bucket}/:`);
    for (const rule of rules) {
        log.info(`  - ${rule.id}: delete '${rule.prefix}*' after ${rule.expirationDays} day(s)`);
    }
}

async function setLifecycle(args: ParsedArgs, target: Target): Promise<void> {
    const r2 = createR2Client(target);
    log.info(
        `Will apply lifecycle rule on s3://${r2.bucket}/: delete '${args.prefix}*' after ${args.expirationDays} day(s) (rule id: ${args.ruleId}).`
    );

    // Surface what's currently there so the operator knows what's being replaced.
    // If the token is object-scoped, this read fails with AccessDenied — surface
    // the scope hint here too instead of letting it propagate as a bare error.
    let existing: ReadonlyArray<{ id: string; prefix: string; expirationDays: number }> | undefined;
    try {
        existing = await r2.getLifecycle();
    } catch (err) {
        if (isAccessDeniedError(err)) {
            log.warn(accessDeniedHint(r2.bucket, 'writing'));
            return;
        }
        throw err;
    }
    if (existing && existing.length > 0) {
        log.warn(
            `Bucket already has ${existing.length} rule(s); this call REPLACES the entire config.`
        );
        for (const rule of existing) {
            log.warn(
                `  current: ${rule.id} -> delete '${rule.prefix}*' after ${rule.expirationDays} day(s)`
            );
        }
    }

    if (!args.skipConfirm) {
        const ok = await confirm(`Apply lifecycle rule to s3://${r2.bucket}/?`);
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    try {
        await r2.setLifecycleRule({
            ruleId: args.ruleId,
            prefix: args.prefix,
            expirationDays: args.expirationDays
        });
    } catch (err) {
        if (isAccessDeniedError(err)) {
            log.warn(accessDeniedHint(r2.bucket, 'writing'));
            return;
        }
        throw err;
    }
    log.ok(
        `Lifecycle rule applied on s3://${r2.bucket}/. Objects under '${args.prefix}' will be deleted after ${args.expirationDays} day(s).`
    );
}

export async function r2Lifecycle(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }
    const parsed = parseArgs(argv);
    const target = getActiveTarget();
    if (parsed.sub === 'show') {
        await showLifecycle(target);
    } else {
        await setLifecycle(parsed, target);
    }
}
