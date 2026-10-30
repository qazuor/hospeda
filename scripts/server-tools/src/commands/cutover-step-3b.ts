/**
 * `hops cutover-step-3b` — run the B9a step 3b tool (the two `permanent_grant`)
 * against the target database from the VPS host (HOS-1957 G7).
 *
 * Same reason and same safety as `hops cutover-step-3`: the api image has no
 * `tsx`, so the script runs from the `~/hospeda` checkout with the api
 * container's environment and a host-reachable database URL. Dry-run by
 * default; `--confirm` writes; on prod the write asks for the typed phrase
 * `grant-permanent-prod`, which `--yes` never skips.
 */

import type { CommandArgvSpec } from '../lib/cli-flags.ts';
import { runCutoverWrapperCommand } from '../lib/cutover-wrapper-command.ts';
import { cutoverWrapperArgvSpec } from '../lib/cutover-wrapper-core.ts';
import { CUTOVER_STEP_3B_SPEC } from '../lib/cutover-wrapper-specs.ts';

/** Declared argv surface of this command, used by the central flag validator. */
export const CUTOVER_STEP_3B_ARGV: CommandArgvSpec = cutoverWrapperArgvSpec(CUTOVER_STEP_3B_SPEC);

const HELP = `
hops cutover-step-3b --target=prod|staging [--dry-run | --confirm]
                     --actor-user-id=<uuid>
                     --beneficiary=<uuid> --beneficiary=<uuid>
                     --plan-id=<uuid> --floor-plan-version-id=<uuid>
                     --includes-addons=true|false
                     [--allow-sha-mismatch] [--yes]

Run the B9a cutover step 3b tool (the two permanent grants) against the
target database, from the VPS host. The script runs as:
  pnpm --dir apps/api exec tsx scripts/cutover-b9a-step-3b.ts <mode> <flags...>
with the api container's environment (never printed) and a host-reachable
HOSPEDA_DATABASE_URL. The script validates the UUIDs, the two DISTINCT
beneficiaries and --includes-addons itself (exit 2 on refusal).

Modes:
  --dry-run   Plan only, write nothing. THE DEFAULT.
  --confirm   Write both grants. On prod this requires typing
              '${CUTOVER_STEP_3B_SPEC.prodPhrase}'. Both mode flags at once is refused.

Flags:
  --allow-sha-mismatch  Run a checkout that is not the deployed commit. On
                        prod this also requires the typed phrase on a dry-run.
  --yes                 Accepted; does NOT skip the typed prod guard.
  --help, -h            Show this help.

Exit codes: the script's own, unchanged (0 ok, 1 failed, 2 refused arguments).
Wrapper refusals exit 2; the SHA guard and a rejected confirmation exit 1.
`.trim();

/**
 * Command entrypoint.
 *
 * @param argv - Command argv, with the command name and global `--target` stripped.
 */
export async function cutoverStep3b(argv: ReadonlyArray<string>): Promise<void> {
    await runCutoverWrapperCommand({ spec: CUTOVER_STEP_3B_SPEC, help: HELP, argv });
}
