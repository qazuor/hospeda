/**
 * `hops cutover-step-5b` — run the V6 step 5b tool (delete the deleted
 * listings' remote photos and revoke their calendar tokens) from the VPS host
 * (HOS-1957 G7).
 *
 * LIST-ONLY BY DEFAULT. `--execute` is the only way to delete or revoke: it is
 * refused on staging outright (the rehearsal DB is a copy of prod, so its photos
 * and tokens are prod resources) and, on prod, asks for the typed phrase
 * `delete-remote-prod`, which `--yes` never skips.
 */

import type { CommandArgvSpec } from '../lib/cli-flags.ts';
import { runCutoverWrapperCommand } from '../lib/cutover-wrapper-command.ts';
import { cutoverWrapperArgvSpec } from '../lib/cutover-wrapper-core.ts';
import { CUTOVER_STEP_5B_SPEC } from '../lib/cutover-wrapper-specs.ts';

/** Declared argv surface of this command, used by the central flag validator. */
export const CUTOVER_STEP_5B_ARGV: CommandArgvSpec = cutoverWrapperArgvSpec(CUTOVER_STEP_5B_SPEC);

const HELP = `
hops cutover-step-5b --target=prod|staging [--list-only | --dry-run | --execute]
                     [--allow-sha-mismatch] [--yes] [--confirm-phrase=<phrase>]

Run the V6 cutover step 5b tool (delete remote photos, revoke calendar tokens
of the listings step 3 deleted) from the VPS host. The script runs as:
  pnpm --dir apps/api exec tsx scripts/cutover-v6-step-5b.ts <mode>
with the api container's environment (never printed) and a host-reachable
HOSPEDA_DATABASE_URL.

Modes:
  --list-only, --dry-run  Count what would be deleted/revoked; touch nothing.
                          THE DEFAULT.
  --execute               Delete and revoke (script: --confirm-delete-remote).
                          Irreversible. REFUSED on staging. On prod this
                          requires typing '${CUTOVER_STEP_5B_SPEC.prodPhrase}'.

Flags:
  --allow-sha-mismatch  Run a checkout that is not the deployed commit. On
                        prod this also requires the typed phrase on a dry-run.
  --yes                 Accepted; does NOT skip the typed prod guard.
  --confirm-phrase=<p>  Answer the typed prod phrase without a prompt. Must equal it
                        exactly. Without a TTY the prompt is refused (exit 1).
  --help, -h            Show this help.

Exit codes: the script's own, unchanged. NOTE: the script exits 1 on a
list-only run (it maps every status but completed/already_done to 1), so read
the printed "status":"dry_run" rather than the exit code there.
Wrapper refusals exit 2; the SHA guard and a rejected confirmation exit 1.
`.trim();

/**
 * Command entrypoint.
 *
 * @param argv - Command argv, with the command name and global `--target` stripped.
 */
export async function cutoverStep5b(argv: ReadonlyArray<string>): Promise<void> {
    await runCutoverWrapperCommand({ spec: CUTOVER_STEP_5B_SPEC, help: HELP, argv });
}
