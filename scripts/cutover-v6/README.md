# V6 cutover tools

Standalone tools for the V6 cut. Run from a reviewed cutover checkout, never from a development worktree against production.

## Step 6 order

Run the staging rehearsal first. On cutover day, prepare and commit the repository baseline and rewrite both database ledgers as one coordinated operation. No migration may run between those two actions.

| Staging rehearsal | Cutover day |
|---|---|
| 1. Run steps 4c, 5, and 5b in order against the staging cut copy. | 1. Run steps 4c, 5, and 5b in order against production. |
| 2. Take and retain the full database backup and both ledger table backups. | 2. The operator takes and retains the full database backup (`pg_dump`); the tool checks that its supplied file exists, is readable, and is non-empty. |
| 3. Generate the baseline and reference rows with `prepare-repo --source-url <cut-database> --dry-run`; inspect the plan, then rehearse the baseline plus extras on a scratch database. | 3. Run `rewrite-ledgers --target-url <cut-database> --built-url <rehearsal-database> --migrations-dir <baseline-dir> --confirm-full-backup <pg-dump-file> --dry-run`. Differences or a missing backup stop before any write. |
| 4. Run `rewrite-ledgers` with the same arguments and `--dry-run`; it compares the full schema and writes nothing. Rehearse the write and restore on disposable databases. | 4. Run `prepare-repo --source-url <cut-database>` and commit the repository baseline. As part of this same cutover operation, run `rewrite-ledgers` without `--dry-run`; retain the backup names and counts it prints. Nobody runs migrations between repository commit and ledger rewrite. |
| 5. Exercise `restore-ledgers --target-url <scratch-database> --backups '<json-from-rewrite>'` and verify the original ledgers are restored. | 5. If a later verification fails, the rewrite restores automatically; if operator intervention is needed, use `restore-ledgers --target-url <cut-database> --backups '<json-from-rewrite>'`. |

The baseline keeps reference rows and deadline version 1. Production catalog rows are loaded by their separate cutover step. The seed ledger is emptied because its migration modules are removed, avoiding orphaned ledger rows.

`compare` reads two database URLs and changes neither database. `prepare-repo` changes only the repository histories; its dry run prints the removal plan. `rewrite-ledgers --dry-run` checks the backup file and compares schemas without writing. The actual rewrite makes its own table backups in the target database. Never run these tools outside the reviewed cutover process.
