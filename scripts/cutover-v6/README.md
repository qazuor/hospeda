# V6 cutover tools

Standalone tools for the V6 cut. Run from a reviewed cutover checkout, never from a development worktree against production.

## Step 3: cutover trials (`hops cutover-step-3`)

Step 3 writes the five cutover trials to the target database. Run it from the VPS host through `hops` (not `pnpm` by hand inside the api image, which ships no `tsx` and no `pnpm`):

```bash
hops --target=staging cutover-step-3                # dry-run: plans the five rows, writes nothing
hops --target=staging cutover-step-3 --confirm-write-trials
```

Order of operations:

1. Run the **dry-run** (the default when no mode flag is passed).
2. Inspect the five planned rows by hand.
3. Only then run again with `--confirm-write-trials`.

On `--target=prod`, `--confirm-write-trials` requires typing `write-trials-prod`. `--yes` does not skip that typed confirmation. A rerun that finds the rows already written writes nothing and reports `already_done`.

The command runs `pnpm --dir apps/api exec tsx scripts/cutover-v6-step-3.ts …` in `$HOPS_REPO_ROOT` with the target api container's `NODE_ENV`, `PORT`, `API_*` and `HOSPEDA_*`, plus `PATH`, `HOME` and `LANG` from the host, and a `HOSPEDA_DATABASE_URL` reachable from the host (built like `hops db-migrate`). The `API_*` half is required because the api rejects its default `API_CORS_ORIGINS` (localhost) in production. That environment stays in memory: it is never printed or written to disk.

Version guard: before running, the command compares the checkout's `HEAD` with the deployed `HOSPEDA_COMMIT_SHA` (10-char prefix). When that variable is empty or `unknown`, the guard falls back to Coolify's `SOURCE_COMMIT` from the api container. A mismatch stops with exit 1 and prints both SHAs. The command never runs `git pull`; align the checkout to the deployed commit first. `--allow-sha-mismatch` overrides the guard, and on prod that override also requires the typed confirmation even for a dry-run.

Exit codes are the script's, unchanged:

| Exit | Meaning |
|---|---|
| `0` | `dry_run`, `completed` or `already_done` |
| `1` | `nothing_planned`, a guard failure, or an error |
| `2` | refused arguments |

## Step 6 order

Run the staging rehearsal first. On cutover day, prepare and commit the repository baseline and rewrite both database ledgers as one coordinated operation. No migration may run between those two actions.

| Staging rehearsal | Cutover day |
|---|---|
| 1. Run steps 4c, 5, and 5b in order against the staging cut copy. | 1. Run steps 4c, 5, and 5b in order against production. |
| 2. Take and retain the full database backup and both ledger table backups. | 2. The operator takes and retains the full database backup (`pg_dump`); the tool checks that its supplied file exists, is readable, and is non-empty. |
| 3. Generate the baseline and reference rows with `prepare-repo --source-url <cut-database> --dry-run`; inspect the plan, then rehearse the baseline plus extras on a scratch database. | 3. Run `rewrite-ledgers --target-url <cut-database> --built-url <rehearsal-database> --migrations-dir <baseline-dir> --confirm-full-backup <pg-dump-file> --dry-run`. Differences or a missing backup stop before any write. |
| 4. Run `rewrite-ledgers` with the same arguments and `--dry-run`; it compares the full schema and writes nothing. Rehearse the write and restore on disposable databases. | 4. Run `prepare-repo --source-url <cut-database>` and commit the repository baseline. As part of this same cutover operation, run `rewrite-ledgers` without `--dry-run`; retain the backup names and counts it prints. Nobody runs migrations between repository commit and ledger rewrite. |
| 5. Exercise `restore-ledgers --target-url <scratch-database> --backups '<json-from-rewrite>'` and verify the original ledgers are restored. | 5. If a later verification fails, the rewrite restores automatically; if operator intervention is needed, use `restore-ledgers --target-url <cut-database> --backups '<json-from-rewrite>'`. |

The baseline keeps reference rows and every deadline version of the cut database, so a new database retains later deadlines such as key 20. Production catalog rows are loaded by their separate cutover step. The seed ledger is emptied because its migration modules are removed, avoiding orphaned ledger rows.

`compare` reads two database URLs and changes neither database. `prepare-repo` changes only the repository histories; its dry run prints the removal plan. `rewrite-ledgers --dry-run` checks the backup file and compares schemas without writing. The actual rewrite makes its own table backups in the target database. Never run these tools outside the reviewed cutover process.
