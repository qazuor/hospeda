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
- Out of scope here: the formal exit manifest and the imports/G8 check (U3.2, AC:U3:5 and 6),
  the step 4b probes (U3.3) and the unit exit (U3.4). This leaf writes only a **raw run record**
  (see "Output manifest"): it is kept minimal on purpose, because losing the ids of
  already-cancelled preapprovals is worse than a record with fewer fields. U3.2 owns the formal
  manifest contract.

## Run

```bash
# census and completeness only, sends no cancellation call
corepack pnpm exec tsx scripts/cutover/cli.ts --dry-run

# the real run (irreversible for preapprovals; step 1a plans are reversible)
corepack pnpm exec tsx scripts/cutover/cli.ts --confirm-cancel-all
```

| Flag | Default | Meaning |
|---|---|---|
| `--probes <path>` | `packages/payments/src/probes/probes.json` | Probe manifest, `{ "ids": string[] }`, read by file path (a JSON read, never an import) and validated by a local schema. |
| `--manifest-out <path>` | `scripts/cutover/out/cutover-manifest-<timestamp>.json` | Where the run manifest is written. Never overwrites an existing file (a free name is picked) and is written through a temp file plus rename. `scripts/cutover/out/` is git-ignored. |
| `--dry-run` | off | Census, re-read and completeness gate; no `PUT` is sent. |
| `--confirm-cancel-all` | off | Required for a real run. Without it (and without `--dry-run`) the script refuses to start. |

### Credentials (proposed names, operator's shell session only)

Never versioned, never logged, never written to the manifest. They are intentionally **not**
in the application env registry (the unit spec marks the registry as N/A for this script).

| Variable | What |
|---|---|
| `CUTOVER_MP_ACCESS_TOKEN` | Provider access token for the account being cut over. |
| `CUTOVER_OLD_DATABASE_URL` | Connection string of the OLD database. Opened read-only (`default_transaction_read_only=on` plus a `READ ONLY` transaction). |

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

## Output manifest (raw run record)

JSON with ids and counts only: `outcome` (`ok`, `failed`, `dry-run`), timestamps, walked
versus `total` per family, `cancelledPlanIds`, `cancelledPreapprovalIds`,
`rereadCancelledIds` (verified `cancelled` by id), `preservedProbeIds` (left alive on
purpose), `unknownLiveIds` (alive at the provider, unknown to the DB and to the probe
manifest) and `failures`. Provider payloads are never copied, so no email, name or phone
can reach it. It is written also on failure. If the file cannot be written, the full JSON is
dumped to stderr and the exit code is 1, so the ids of cancellations already done are never lost.
Delete it when the cutover ends.

## Failure modes (exit code 1; the cutover does not advance)

| Code | Meaning |
|---|---|
| `WALK_COUNT_MISMATCH` | Distinct ids walked differ from the provider `total`, rows repeated across pages, or `total` changed while walking. |
| `KNOWN_ID_MISSING` | An id from the old DB or the probe manifest is absent from the unfiltered walk. |
| `UNEXPECTED_STATUS` | A preapproval is in a status other than pending, authorized, paused or cancelled. |
| `NOT_CANCELLED` | An id is still not `cancelled` after the 3 retries. |
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
  (`scripts/__tests__/cutover/`), TEST:U3:1 to 4 and 6.
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
