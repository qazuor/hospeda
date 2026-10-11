# V6 cutover tools

Standalone tools for the V6 cut. Run from a reviewed cutover checkout, never from a development worktree against production.

## Step 6 order

1. After 5b, capture the required backups of the database and both migration ledgers. The ledger rewrite and backup restoration are added by the next cutover-tool increment.
2. Generate a baseline and reference rows in a scratch location with `prepare-repo --source-url <cut-database> --dry-run`; inspect the plan and rehearse the baseline plus extras on a scratch database.
3. Run `compare --a-url <cut-database> --b-url <scratch-database>`. Any difference stops the cutover.
4. Only after the comparison is clean and the approved backup exists, run `prepare-repo --source-url <cut-database>` to replace repository histories. Archive this folder in a commit after the cut.

The baseline keeps reference rows and deadline version 1. Production catalog rows are loaded by their separate cutover step. The tools do not write database ledgers in this increment; that is the following step 6 increment.

`compare` reads two database URLs and changes neither database. `prepare-repo` changes only the repository histories; its dry run prints the removal plan. Never run it from a development worktree against production.
