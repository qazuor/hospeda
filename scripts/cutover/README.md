# Cutover script (U3, HOS-1426)

Standalone script that cancels, at the payment provider, everything the old billing
system left alive, verifies it by re-reading each id, and checks that its walk of the
provider was complete. It runs steps **1a, 1b and 2** of the cutover order.

- Imports **no code** from the old system, the new system or any payment SDK. It talks to
  the provider with native `fetch`.
- Reads the old database **read-only, for known ids only** (ids, never rows of people).
- Writes **nothing** into any database and sends **nothing** to anybody.
- Not deployed: no image carries it. It is run from a copy of the repository and is
  archived by deleting this folder in a commit after the cutover.
- It also runs the **abort inverses (b) and (c)** (AC:U3:9, HOS-1427) in a separate mode, on the
  ids of a manifest only (see "Abort inverses").
- Out of scope here: the real step 4b (the delivery probe, the small payment and the read-only
  `provider_notification` query, U3.3) and the unit exit (U3.4). The provider methods for the
  payment and its refund, and the manifest fields for the 4b ids, are already here; U3.3 reuses
  them.

## Run

```bash
# census and completeness only, sends no cancellation call
corepack pnpm exec tsx scripts/cutover/cli.ts --dry-run

# the real run (irreversible for preapprovals; step 1a plans are reversible)
corepack pnpm exec tsx scripts/cutover/cli.ts --confirm-cancel-all

# abort branch: inverses (b) and (c) on the ids of a run's manifest (partial or finished)
corepack pnpm exec tsx scripts/cutover/cli.ts --abort-inverse <manifest.json> --confirm-abort-inverse
```

| Flag | Default | Meaning |
|---|---|---|
| `--probes <path>` | `packages/payments/src/probes/probes.json` | Probe manifest, `{ "ids": string[] }`, read by file path (a JSON read, never an import) and validated by a local schema. |
| `--manifest-out <path>` | `scripts/cutover/out/cutover-manifest-<timestamp>.json` | Where the run manifest is written. Never overwrites an existing file (a free name is picked) and is written through a temp file plus rename. `scripts/cutover/out/` is git-ignored. |
| `--dry-run` | off | Census, re-read and completeness gate; no `PUT` is sent. |
| `--confirm-cancel-all` | off | Required for a real run. Without it (and without `--dry-run`) the script refuses to start. |
| `--abort-inverse <path>` | none | Runs ONLY the abort inverses (b) and (c) on the ids of that manifest. Cannot be combined with `--dry-run` or `--confirm-cancel-all`. |
| `--confirm-abort-inverse` | off | Required by `--abort-inverse`. Without it the mode refuses to start (exit 2). |

### Credentials (proposed names, operator's shell session only)

Never versioned, never logged, never written to the manifest. They are intentionally **not**
in the application env registry (the unit spec marks the registry as N/A for this script).

| Variable | What |
|---|---|
| `CUTOVER_MP_ACCESS_TOKEN` | Provider access token for the account being cut over. |
| `CUTOVER_OLD_DATABASE_URL` | Connection string of the OLD database. Opened read-only (`default_transaction_read_only=on` plus a `READ ONLY` transaction). Not needed by `--abort-inverse`. |

## What it does

1. **Census** (AC:U3:1). Walks `GET /preapproval_plan/search` and `GET /preapproval/search`
   **with no filter**, paginated. Filtered search returns a subset with no signal that rows
   are missing (RC-1), and the old DB cannot see authorizations that were never linked, so
   neither is the census source. Every walked id is then **re-read by id** for its true
   status (the search listing can be minutes stale).
2. **Step 1a**. Every plan whose status is not `cancelled` is set `inactive` (the provider
   answers `cancelled`; measured in probe 50). Reversible, and it closes the public links
   that keep selling, which is why it goes first.
3. **Step 1b**. Every preapproval in `pending`, `authorized` or `paused` is cancelled, probes
   included **except** the ids in the probe manifest. A status the script does not know
   (anything else but `cancelled`) is a failure and the object is left alone.
4. **Step 2** (AC:U3:3, AC:U3:4). Each cancelled id is re-read **by id**. One that is not
   `cancelled` has its cancellation re-sent up to **3 times** with increasing waits
   (2 s, 5 s, 10 s), re-reading after each. Then the completeness gate: the walked count of
   each family must equal the paginated `total`, and every known id (old DB ids plus probe
   manifest ids) must appear in the walk.

Retries: `429` and `5xx` on any call are retried with a short increasing delay inside the
client; the three step-2 retries above are about a cancellation that was accepted but did
not take.

## Output manifest (AC:U3:5)

JSON with ids and counts only (`schemaVersion: 1`): `outcome`, `startedAt`, `finishedAt`,
walked versus `total` per family (`census`), `cancelledPlanIds` and `cancelledPreapprovalIds`
(ids a cancellation call was sent for), `rereadCancelledIds` (verified `cancelled` by id),
`preservedProbeIds` (left alive on purpose), `unknownLiveIds` (alive at the provider, unknown to
the DB and to the probe manifest) and `failures`. Optional, and absent until step 4b creates
them: `probeId` (the delivery probe preapproval), `paymentId` (the small payment) and
`refundId` (its refund). Adding these three did not bump `schemaVersion`. Provider payloads are
never copied, so no email, name or phone can reach it.

**Written incrementally.** The run writes a checkpoint before its first call, once the targets
are known and after every cancellation call sent, so an abort or a crash mid-run still leaves on
disk every id already touched, which is what the abort inverses need.

- **Partial versus finished**: a checkpoint reads `outcome: "in-progress"` (its `finishedAt` is
  the time of that checkpoint); a finished record reads `ok`, `failed` or `dry-run`. A manifest
  left `in-progress` means the run did not finish.
- **Never overwrites**: the first write claims a free name (an existing file is never taken: a
  `-1`, `-2`... suffix is picked). Each later write replaces that same file through a temp file
  plus rename, and only while the file is still this run's partial manifest (same `startedAt`,
  `outcome: "in-progress"`); a finished record found there is never overwritten (the write takes
  a new free name instead), and once the finished record is written no further write lands.
- **Never lost**: if the first checkpoint cannot be written the run stops before any call
  (`MANIFEST_WRITE_FAILED`). A later write that fails dumps the full JSON to stderr and the run
  goes on; if the finished record cannot be written the exit code is 1.

Delete the manifest (and any abort-inverse report next to it) when the cutover ends.

## Abort inverses (AC:U3:9)

`--abort-inverse <manifest> --confirm-abort-inverse` acts **only on the ids of that manifest**,
partial or finished. Ids that are absent (an abort before step 4b) are not a failure: there is
nothing to undo.

- **(b) delivery probe**: re-reads `probeId` by id; if it is not `cancelled`, cancels it and
  verifies by re-reading, with the same 3 retries as step 2. The probe is a preapproval at the
  provider, so this is the same read and cancel as step 1b.
- **(c) small payment**: if `refundId` is in the manifest, only re-reads it. Otherwise reads
  `paymentId`: a refund the payment already lists is re-read (never refunded twice); a payment
  that never charged (`rejected`, `cancelled`) needs nothing; an `approved` one is refunded in
  full (`POST /v1/payments/{id}/refunds` with a deterministic idempotency key) and the refund is
  re-read by id until it reads `approved` (re-read only, the refund is never re-sent). Any other
  payment status is a failure and nothing is refunded.

The two inverses are independent: a failure in (b) does not skip (c). The mode never touches
the run's manifest; it writes its own report, ids and actions only, next to it as
`<manifest>-abort-inverse.json` (same no-overwrite and stderr fallback). Exit 0 when both
inverses ended clean, 1 otherwise, 2 on a usage error.

## Failure modes (exit code 1; the cutover does not advance)

| Code | Meaning |
|---|---|
| `WALK_COUNT_MISMATCH` | Distinct ids walked differ from the provider `total`, rows repeated across pages, or `total` changed while walking. |
| `KNOWN_ID_MISSING` | An id from the old DB or the probe manifest is absent from the unfiltered walk. |
| `UNEXPECTED_STATUS` | A preapproval is in a status other than pending, authorized, paused or cancelled. |
| `NOT_CANCELLED` | An id is still not `cancelled` after the 3 retries. |
| `REFUND_NOT_CONFIRMED` | Abort inverse (c): the refund never read `approved`, or the refund call got no refund. |
| `MANIFEST_WRITE_FAILED` | The first manifest checkpoint could not be written; nothing was called. |
| `PROVIDER_ERROR` | The provider could not be read or answered something unusable (status and path only; the body is dropped). |
| `OLD_DB_ERROR` | The old database could not be read (SQLSTATE or error code plus message). Raised before any provider call. |
| `UNEXPECTED_ERROR` | Anything else that threw during the run. |

Exit code 2 means a usage error (missing flag or credentials). A failed run goes to the
cutover abort branch. The script itself never restores anything.

A premise stays declared, not proven: an unknown authorization that the unfiltered walk
omits is not seen by any control of the cutover (DEC-MIG-003 pin 2); the completeness gate
only covers the ids we already know.

## Tests

- Unit, against a simulated provider (no network): `corepack pnpm test:scripts`
  (`scripts/__tests__/cutover/`), TEST:U3:1 to 4, 6 (`run-cutover.test.ts` and, for the
  inverse path, `abort-inverse.test.ts`), 7 (`standalone.test.ts`: imports are only this
  folder, `node:` built-ins and `zod`, plus the declared `pg` driver load in `known-ids.ts`;
  and G8 passes without this folder in its list) and 10 (`abort-inverse.test.ts`). The
  incremental manifest is covered by `manifest-writer.test.ts`.
- Real Postgres: `HOSPEDA_TEST_DATABASE_URL=<server admin url> corepack pnpm test:cutover-db`
  (`scripts/__tests__/cutover-db/`), TEST:U3:5 and 13. They create their own scratch
  databases, build the old schema from `main`'s migrations (`CUTOVER_OLD_SCHEMA_REF`,
  default `origin/main`), seed live rows, and drop only what they created. A missing
  `HOSPEDA_TEST_DATABASE_URL` is a failure, not a skip.

## TEST:U3:11, manual smoke for the owner (NOT run by automation)

Whole run of steps 1a, 1b and 2 against the provider **test account** (sandbox), with
the staging old DB. Never against production.

1. In a shell session set `CUTOVER_MP_ACCESS_TOKEN` (sandbox token) and
   `CUTOVER_OLD_DATABASE_URL` (a copy or the staging old DB; the script only reads it).
2. Make sure `packages/payments/src/probes/probes.json` exists (or pass `--probes`). A missing file stops the script at startup with an error naming the path (exit 2).
3. Dry run first: `corepack pnpm exec tsx scripts/cutover/cli.ts --dry-run`. Check that the
   walked counts equal the totals, that `unknownLiveIds` makes sense, and that the
   manifest has only ids.
4. Real run: `corepack pnpm exec tsx scripts/cutover/cli.ts --confirm-cancel-all`.
5. Expect exit 0 and `outcome: ok`. Then confirm in the provider dashboard (or by
   `GET /preapproval/{id}` on a few ids from the manifest) that all of
   `cancelledPlanIds` and `cancelledPreapprovalIds` read `cancelled`, that the probes in
   `preservedProbeIds` are still alive, and that the manifest has no personal data.
6. Record the sign-off on the Linear issue and delete the manifest and the shell variables.
