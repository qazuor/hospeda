/**
 * `hops cutover-step-4c` — run the V6 step 4c tool (revalidate the public pages
 * of the listings step 3 deleted) against the target from the VPS host
 * (HOS-1957 G7).
 *
 * Wraps `apps/api/scripts/cutover-v6-step-4c.ts` unchanged; the batching
 * through `revalidateMany` lives in its service. Same safety as
 * `hops cutover-step-3`: dry-run by default; `--confirm-purge` purges; on prod
 * the purge asks for the typed phrase `purge-prod`, which `--yes` never skips.
 */

import type { CommandArgvSpec } from '../lib/cli-flags.ts';
import { runCutoverWrapperCommand } from '../lib/cutover-wrapper-command.ts';
import { cutoverWrapperArgvSpec } from '../lib/cutover-wrapper-core.ts';
import { CUTOVER_STEP_4C_SPEC } from '../lib/cutover-wrapper-specs.ts';

/** Declared argv surface of this command, used by the central flag validator. */
export const CUTOVER_STEP_4C_ARGV: CommandArgvSpec = cutoverWrapperArgvSpec(CUTOVER_STEP_4C_SPEC);

const HELP = `
hops cutover-step-4c --target=prod|staging [--dry-run | --confirm-purge]
                     [--extra-tags-file=<path>] [--extra-prefixes-file=<path>]
                     [--allow-sha-mismatch] [--yes] [--confirm-phrase=<phrase>]

Run the V6 cutover step 4c tool (revalidate the public pages of the listings
the step 3 migration deleted) from the VPS host. The script runs as:
  pnpm --dir apps/api exec tsx scripts/cutover-v6-step-4c.ts <mode> [extra files]
with the api container's environment (never printed) and a host-reachable
HOSPEDA_DATABASE_URL.

Modes:
  --dry-run        Report what would be purged; purge nothing. THE DEFAULT.
  --confirm-purge  Purge. On prod this requires typing '${CUTOVER_STEP_4C_SPEC.prodPhrase}'.

Extra purge input (forwarded to the script as an ABSOLUTE path; a missing
file is refused before anything runs; the script must support the flag):
  --extra-tags-file=<path>      One tag per line.
  --extra-prefixes-file=<path>  One URL prefix per line.

Flags:
  --allow-sha-mismatch  Run a checkout that is not the deployed commit. On
                        prod this also requires the typed phrase on a dry-run.
  --yes                 Accepted; does NOT skip the typed prod guard.
  --confirm-phrase=<p>  Answer the typed prod phrase without a prompt. Must equal it
                        exactly. Without a TTY the prompt is refused (exit 1).
  --help, -h            Show this help.

Exit codes: the script's own, unchanged (0 ok, 1 failed, 2 refused).
Wrapper refusals exit 2; the SHA guard and a rejected confirmation exit 1.
`.trim();

/**
 * Command entrypoint.
 *
 * @param argv - Command argv, with the command name and global `--target` stripped.
 */
export async function cutoverStep4c(argv: ReadonlyArray<string>): Promise<void> {
    await runCutoverWrapperCommand({ spec: CUTOVER_STEP_4C_SPEC, help: HELP, argv });
}
