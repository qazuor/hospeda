# Cutover script (U3, HOS-1426)

Standalone script that cancels, at the payment provider, everything the old billing
system left alive, verifies it by re-reading each id, and checks that its walk of the
provider was complete. It runs steps **1a, 1b and 2** of the cutover order.

- Imports **no code** from the old system, the new system or any payment SDK. It talks to
  the provider with native `fetch`.
- Reads the old database **read-only, for known ids only** (ids, never rows of people).
- Steps 1a, 1b and 2 write **nothing** into any database. Step 4b calls the provider directly for
  its delivery probe and small payment/refund; its only database connection is read-only.
- Not deployed: no image carries it. It is run from a copy of the repository and is
  archived by deleting this folder in a commit after the cutover.
- It also runs the **abort inverses (b) and (c)** (AC:U3:9, HOS-1427) in a separate mode, on the
  ids of a manifest only (see "Abort inverses").
- The unit exit is in the section "Unit exit (U3.4, AC:U3:10)" below. Step 4b is documented below.

## Run

```bash
# census and completeness only, sends no cancellation call
corepack pnpm exec tsx scripts/cutover/cli.ts --dry-run

# the real run (irreversible for preapprovals; step 1a plans are reversible)
corepack pnpm exec tsx scripts/cutover/cli.ts --confirm-cancel-all

# abort branch: inverses (b) and (c) on the ids of a run's manifest (partial or finished)
corepack pnpm exec tsx scripts/cutover/cli.ts --abort-inverse <manifest.json> --confirm-abort-inverse

# step 4b: live provider payment and refund; owner approval of the amount is required
corepack pnpm exec tsx scripts/cutover/cli.ts --step-4b --confirm-step-4b --payment-amount <ARS>
```

### V6 step 3 staging rehearsal

`hops --target=staging cutover-step-3 --dry-run --owner-ids=<uuid>[,<uuid>...]`
limits the rehearsal to the selected owners. The API script validates each UUID
and rejects empty or repeated values. `--owner-ids` is rejected on production
before any container or database lookup. Without the option, step 3 keeps its
existing unfiltered behavior.

The `hops` command runs the API script from the repository root with
`pnpm --dir apps/api exec tsx scripts/cutover-v6-step-3.ts`. This keeps the
API tsconfig and workspace `tsx` while preserving the script's exit code through
`hops` (0 success, 1 no work/error, 2 refused arguments).

| Flag | Default | Meaning |
|---|---|---|
| `--probes <path>` | `packages/payments/src/probes/probes.json` | Probe manifest, `{ "ids": string[] }`, read by file path (a JSON read, never an import) and validated by a local schema. |
| `--manifest-out <path>` | `scripts/cutover/out/cutover-manifest-<timestamp>.json` | Where the run manifest is written. Never overwrites an existing file (a free name is picked) and is written through a temp file plus rename. `scripts/cutover/out/` is git-ignored. |
| `--dry-run` | off | Census, re-read and completeness gate; no `PUT` is sent. |
| `--confirm-cancel-all` | off | Required for a real run. Without it (and without `--dry-run`) the script refuses to start. |
| `--abort-inverse <path>` | none | Runs ONLY the abort inverses (b) and (c) on the ids of that manifest. Cannot be combined with `--dry-run` or `--confirm-cancel-all`. |
| `--confirm-abort-inverse` | off | Required by `--abort-inverse`. Without it the mode refuses to start (exit 2). |
| `--step-4b` | off | Runs only the delivery probe and small payment/refund step. Cannot be combined with `--dry-run`, `--confirm-cancel-all` or `--abort-inverse`. |
| `--confirm-step-4b` | off | Required by `--step-4b`; without it the mode refuses to start (exit 2). |
| `--payment-amount <ARS>` | none | Required by `--step-4b`; integer pesos from 15 through 1000. The owner approves the actual amount before the rehearsal. |

### V6 step 4c cache purge

`pnpm --dir apps/api exec tsx scripts/cutover-v6-step-4c.ts --dry-run` (or
`--confirm-purge` for the real run). It purges, in order, attempting every
group even if one fails: `listings`, `collections`, `destinations`,
`legacy-tags` (the retired collection tag and the per-entity tags of the old
vertical, built from the slugs and ids in the passage table and the live
`venues`; the words live in `step-4c.legacy.ts`, assembled from parts because the
retired-word guard forbids them as literals) and `legacy-prefixes`
(URL prefixes: hosts x 3 locales x 9 routes, from
`apps/api/src/services/cutover-v6/step-4c.legacy.ts`, pinned by a test. The hosts
derive from `HOSPEDA_SITE_URL` of the environment the step runs in: production gives
`hospeda.com.ar` and `www.hospeda.com.ar`, 54 prefixes; staging gives
`staging.hospeda.com.ar` alone, 27, because staging has no `www` alias and the web
endpoint refuses production hosts on any other deployment). The
legacy tags go in `revalidateMany` batches of 100 and the prefixes in one
request to `/api/revalidate/` (`{ "prefixes": [...] }`), so the whole run is
about 5 Cloudflare requests (Free plan: 5 per minute, bucket shared with the live
API). Every response is checked: a 429 is a purge that did not happen and the
run exits 1 and the result names the failed group and tags. The write-block rule of
step 0b must keep `/api/revalidate/` open
([`write-block-rule.md`](../../infra/cloudflare/rules/write-block-rule.md)).

| Flag | Default | Meaning |
|---|---|---|
| `--dry-run` | off | Counts the groups; calls nothing. |
| `--confirm-purge` | off | Required for a real run; without it (and without `--dry-run`) the script refuses (exit 2). |
| `--extra-tags-file <path>` | none | Optional. Text file, one bare tag per line (no `<env>:` namespace). Blank lines and lines starting with `#` are ignored. Added to the generated legacy tags and de-duplicated before grouping. |
| `--extra-prefixes-file <path>` | none | Optional. Same format, one `host/path` prefix per line (no scheme). Added to the generated prefixes and de-duplicated. |

Exit codes: 0 done (or dry run), 1 a purge failed or an error, 2 refused. The
prefix mode of `/api/revalidate/` accepts the production hosts only on a `prod`
deployment.

### Credentials (proposed names, operator's shell session only)

Never versioned, never logged, never written to the manifest. They are intentionally **not**
in the application env registry (the unit spec marks the registry as N/A for this script).

| Variable | What |
|---|---|
| `CUTOVER_MP_ACCESS_TOKEN` | Provider access token for the account being cut over. |
| `CUTOVER_OLD_DATABASE_URL` | Connection string of the OLD database. Opened read-only (`default_transaction_read_only=on` plus a `READ ONLY` transaction). Not needed by `--abort-inverse` or `--step-4b`. |
| `CUTOVER_NEW_DATABASE_URL` | Connection string of the new database. `--step-4b` opens it read-only (`default_transaction_read_only=on` plus a `READ ONLY` transaction). |
| `CUTOVER_CARD_TOKEN` | One-use card token created by the owner for this run. The card number never enters this script. |
| `CUTOVER_PAYER_EMAIL` | Owner payer email sent in the provider payment request. Never printed or written to the manifest. |
| `CUTOVER_PAYMENT_METHOD_ID` | Payment method id paired with the card token. |
| `CUTOVER_STAGING_DATABASE_URL` | Connection string of the STAGING database, used only by the staging sandbox run below. Opened read-only (`default_transaction_read_only=on` plus a `READ ONLY` transaction). |

## Staging sandbox run (step V1 of the staging window, HOS-1951)

A separate entry point, `cli-staging-sandbox.ts`, cancels in the provider **sandbox** the
preapprovals the **staging** database knows about, before the window's reset erases their
anchors. It is not the U3 cutover above: it walks no unfiltered census and cancels no plans.

```bash
# dry run (the default): reads, re-reads by id and writes the manifest; sends no cancellation
corepack pnpm exec tsx scripts/cutover/cli-staging-sandbox.ts --target=staging

# real run: cancels every live preapproval found and re-reads each until it reads cancelled
corepack pnpm exec tsx scripts/cutover/cli-staging-sandbox.ts --target=staging --apply

# retry: re-reads the ids of a previous manifest too (works after the reset, when the DB is empty)
corepack pnpm exec tsx scripts/cutover/cli-staging-sandbox.ts --target=staging --apply \
  --from-manifest scripts/cutover/out/staging-sandbox-manifest-<timestamp>.json
```

Session variables: `CUTOVER_MP_ACCESS_TOKEN` (the sandbox token) and
`CUTOVER_STAGING_DATABASE_URL`. Optional flags: `--probes <path>` (same default as above) and
`--manifest-out <path>` (default `scripts/cutover/out/staging-sandbox-manifest-<timestamp>.json`).

**Guards, fail-closed, all before any cancellation (exit 2):**

1. `--target=staging` is required; any other value, or none, refuses.
2. Both session variables must be set.
3. The token's account must carry the `test_user` tag on `GET /users/me`. That is the only
   measured signal of the sandbox: both tokens start with `APP_USR-` and `live_mode` is `true`
   in both (EX-14). A failed read refuses too.
4. The database must answer `current_database() = 'hospeda_staging'` and
   `current_user = 'hospeda_staging_user'` (the staging name and role, see
   `scripts/server-tools/src/lib/target.ts`; production's are both `postgres`). Asked to the
   server, never parsed from the URL. A failed query refuses too.

**Sources**, read inside a `READ ONLY` transaction:

- **Anchored**: every `provider_link.provider_id`, cancelled or not (whether it is alive is
  decided by re-reading it by id, never by `cancelled_seen_at`), plus the `authorizationId` of
  every completed `PREAPPROVAL_CREATE` row of `idempotency_key` (earlier attempts a retry
  replaced, which no longer have a link).
- **Loose**: the email each subscription sent as `payer_email`,
  `coalesce(declared_payer_email, users.email)` as in the creations sweep
  (`creation-sweep.model.ts`); the fallback covers rows from before migration 0177 and
  successors created with no declared email. Each one is searched with
  `GET /preapproval/search?payer_email=`. The search
  filters by that field in the sandbox (RC-1), but its listing status is stale (RC-4), so every
  id found is re-read by id. A search whose walked count is not its `total` is a
  `SEARCH_INCOMPLETE` failure. The old `billing_pending_checkouts` and `billing_checkouts` tables
  are not read: migration `0125` dropped them.
- **Previous manifest** (`--from-manifest`): its `foundIds`, `liveIds` and failed ids.

Probe ids in the probe manifest are left alone (`preservedProbeIds`). A preapproval re-read as
`cancelled` is never sent again (`alreadyCancelledIds`); a 404 is `notFoundIds`; a status that is
neither live nor `cancelled` is a failure and the object is left alone. With `--apply`, each live
id is cancelled and then re-read with the 3 retries of step 2 (2 s, 5 s, 10 s); one that never
reads `cancelled` is `NOT_CANCELLED`.

**Manifest**: `kind: "staging-sandbox-preapprovals"`, ids and counts only (payer emails are
counted, never written or printed): `foundIds`, `liveIds`, `cancelRequestedIds`, `cancelledIds`,
`alreadyCancelledIds`, `notFoundIds`, `preservedProbeIds`, `failures`. Written incrementally,
with the same no-overwrite rules as the cutover manifest.

Exit 0 clean (`ok` or `dry-run`), 1 any failure (**do not go on to V4**), 2 usage error or guard
refusal. Not covered: a sandbox preapproval with no anchored id whose payer email is no longer
in the database. That is the case of a closed account: the closure pseudonymizes `users.email`
and clears `declared_payer_email`, so its loose preapprovals are found only if a creation
attempt recorded their id. A preapproval created for an email the database never stored is not
found either.

## Preparing the rehearsal copy (HOS-1957, E0.4 and E0.7 of the runbook)

Two tools that run against the **restored copy of production on the staging Postgres**, after
the restore and **before** any process (the old image, a cron, the U3 run) touches the copy. They
are not part of the cutover: the real cutover runs on production with neither of them.

Both run like the other tools of this folder, from the root of a checkout of `origin/staging`
(not `~/hospeda`, which is on `main` and has no `scripts/cutover/`), with the session variables
set in the operator's shell:

```bash
# G2: rewrite every email of the copy (dry run first, the default; then --confirm)
corepack pnpm exec tsx scripts/cutover/cli-rehearsal-emails.ts --target=staging
corepack pnpm exec tsx scripts/cutover/cli-rehearsal-emails.ts --target=staging --confirm

# owner decision 1: mirror the copy's provider ids in the sandbox and rewrite them
corepack pnpm exec tsx scripts/cutover/cli-rehearsal-sandbox-ids.ts --target=staging
corepack pnpm exec tsx scripts/cutover/cli-rehearsal-sandbox-ids.ts --target=staging --confirm
```

`CUTOVER_STAGING_DATABASE_URL` must reach the staging Postgres from where the command runs:
see "Where U3 runs and how it reaches Postgres (G12)" below.

## Where U3 runs and how it reaches Postgres (G12, resolved)

U3 and the rehearsal tools run from the **operator's local machine**, on a checkout of
`origin/staging` with its dependencies installed (the VPS `~/hospeda` is on `main` the day
of the cutover and has no `scripts/cutover/`). The database is reached through an ssh
tunnel; the connection strings live in shell variables of that session only.

- **Secrets**: read the credentials from the container over ssh straight into shell
  variables. Never `echo` them, never write them to a file, never paste them in a ticket.
- **Staging**: the Coolify proxy publishes the staging Postgres on the VPS loopback, port
  `15432`. Tunnel it: `ssh -N -L 25432:127.0.0.1:15432 <vps>`, and point
  `CUTOVER_STAGING_DATABASE_URL` at `127.0.0.1:25432`.
- **Production**: there is no published port. Tunnel to the database container's address
  on the Docker network, resolved at the moment of use and **never written down** (it
  changes every time the container is recreated):

  ```bash
  DB_IP=$(ssh <vps> "docker inspect yhhqnorqbtw2aslbxy64kjzd --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'")
  ssh -N -L 25433:"$DB_IP":5432 <vps>
  ```

  Then `CUTOVER_OLD_DATABASE_URL` points at `127.0.0.1:25433`.
- **Read-only**: the production URL carries `options=-c default_transaction_read_only=on`
  (URL-encoded in the query string), in addition to U3's own `READ ONLY` transaction.

## The `hops` of the cutover on the VPS (G17)

`~/hospeda` is on `main` and the cutover commands live on `staging`. `hops update --branch
staging` does `git pull origin staging` **on the current branch**, so it would merge
`staging` into that `main` checkout: do not use it for this. Do not touch `~/hospeda`.
Use a separate checkout on the exact cutover SHA, and run the `hops` that comes out of it.

```bash
# On the VPS. CUTOVER_SHA is the full SHA of the commit being cut over.
cd ~/hospeda && git fetch origin
git worktree add ~/hospeda-corte "$CUTOVER_SHA"   # detached HEAD on that exact commit
cd ~/hospeda-corte && git rev-parse HEAD           # must print CUTOVER_SHA

# server-tools runs on bun (bin/hops is `#!/usr/bin/env bun`): install its own deps
cd ~/hospeda-corte/scripts/server-tools && bun install

# run THIS checkout's hops, and tell it which checkout is the repo root
HOPS_REPO_ROOT=~/hospeda-corte bun ~/hospeda-corte/scripts/server-tools/bin/hops --help
```

`HOPS_REPO_ROOT` (see `scripts/server-tools/src/lib/repo-root.ts`) makes the commands that
read the repo (the step 3 wrapper, the migrations, the registry) use the cutover checkout
instead of `~/hospeda`. Do not run `install.sh` for this: it compiles and installs a
binary on `PATH`, replacing the operator's usual `hops`. When the cutover is over:
`git worktree remove ~/hospeda-corte`. The recipe is rehearsed in the rehearsal, before
the cutover.

**Guards, shared by both, fail-closed and before any write (exit 2):**

1. `--target=staging` is required; any other value, or none, refuses.
2. The session variables must be set: `CUTOVER_STAGING_DATABASE_URL` (both), plus
   `CUTOVER_MP_ACCESS_TOKEN` (sandbox ids) and, with `--confirm`, `CUTOVER_PAYER_EMAIL` (the
   sandbox payer of the mirrors; the same variable step 4b uses).
3. Sandbox ids only: the token's account must carry the `test_user` tag on `GET /users/me`
   (`assertSandboxAccount`, the guard of the staging sandbox run). A production token refuses.
4. The database must answer `current_database() = 'hospeda_staging'` and
   `current_user = 'hospeda_staging_user'` (`assertStagingDatabase`, same guard). Production's
   are both `postgres`. The session that answers is the one that writes.

Without `--confirm` neither tool writes anything, anywhere. Exit 0 clean, 1 failure, 2 refusal.

### `cli-rehearsal-emails.ts` (G2)

Finds every column that can hold text in every user schema **from the catalog, at run time**
(`text`, `varchar`, `char`, `citext`, `json`, `jsonb` and text arrays; views, partitions,
generated columns and the `drizzle` schema left out), so the mailbox columns of the old schema
and of the new one are covered by their values, not by a list of names that can go stale. Then:

- a value that **is** one email becomes `rehearsal+<uuid>@example.invalid`, where the uuid is a
  hash of the lower-cased address salted with a per-run secret (never printed). The same mailbox
  gets the same address in every table, so `users.email` and `billing_customers.email` still
  match, and unique columns stay unique;
- every email **embedded** in a longer value (a JSON document, an array, free text) becomes
  `rehearsal@example.invalid`.

`.invalid` is reserved (RFC 2606) and never resolves, so nothing addressed to it is delivered.
`--confirm` rewrites every column in **one transaction** and re-counts inside it: a row left
with a deliverable address, a count that does not match, or a column the database refuses (a
trigger, a length limit, a unique collision) rolls everything back and names the column only.
The report prints counts per column (`whole`, `embedded`) and the rows left; never an address.
A second run finds nothing to do.

Declared consequence: the rewrite **changes the pseudonym** step 3 computes from the email
(`computeTrialEmailPseudonym`), so the rehearsal does not prove the real pseudonyms.

### `cli-rehearsal-sandbox-ids.ts` (owner decision 1)

The copy holds production provider ids, which the sandbox walk never returns, so step 2 of the
rehearsal would fail with `KNOWN_ID_MISSING` by construction. This tool:

1. reads the ids U3 cross-checks (`readKnownIds`, the same six columns);
2. reads each one by id with the sandbox token: 200 means it is already a sandbox id and is left
   alone (so a re-run is a no-op), 404 means it is to mirror, anything else stops the run
   before anything is created;
3. with `--confirm`: creates one sandbox mirror per id, with a deterministic idempotency key per
   production id (`hospeda-rehearsal-<kind>-<id>`), re-reads it by id, and then rewrites, in ONE
   transaction, the six columns plus two that hold the same ids
   (`billing_subscription_polling_jobs.provider_resource_id` and `billing_prices.mp_price_id`,
   only where their value is a mapped id). Inside that transaction it re-reads the known ids: any
   id that is neither a mirror nor already a sandbox id rolls the rewrite back
   (`REWRITE_INCOMPLETE`).

The mirrors are not faithful copies, and that is declared: plans are created `active`, and every
preapproval is created `pending` and bound to **no** plan (a plan-bound preapproval needs a card
token, and an `authorized` one a checkout). Production statuses are not reproduced. The U3 run
of the rehearsal then cancels them like any other live object, together with whatever else is
alive in the sandbox account (`unknownLiveIds`).

**Manifest** (`kind: "rehearsal-sandbox-ids"`, default
`scripts/cutover/out/rehearsal-sandbox-ids-manifest-<timestamp>.json`, or `--manifest-out`):
ids and counts only, written incrementally with the same no-overwrite rules as the cutover
manifest: `knownIds`, `alreadySandboxIds`, `toMirrorIds`, `mappings` (production id to sandbox
id), `rewrittenRows` per `table.column` and `failures` (`PROVIDER_ERROR`, `CREATE_FAILED`,
`MIRROR_NOT_READABLE`, `COPY_DB_ERROR`, `REWRITE_INCOMPLETE`). Production provider ids are not
personal data; no email or provider payload is written. Delete it with the copy at E-FIN.

Not measured: what the sandbox answers to `GET` of an id that belongs to the production account.
The tool assumes 404, as the staging sandbox run does (`notFoundIds`); any other answer stops it
with `PROVIDER_ERROR`, so a wrong assumption fails closed and creates nothing.

Tests: `scripts/__tests__/cutover/rehearsal-*.test.ts` (guards, modes, rollback; no network, no
database) and `scripts/__tests__/cutover-db/rehearsal-copy.test.ts` (both tools on a real
Postgres built from `main`'s migrations, ending with a U3 run over the rewritten copy that finds
every known id).

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

## Step 4b (AC:U3:7 and AC:U3:8)

Run with `--step-4b --confirm-step-4b --payment-amount <ARS>` and the five operator-session
variables `CUTOVER_MP_ACCESS_TOKEN`, `CUTOVER_NEW_DATABASE_URL`, `CUTOVER_CARD_TOKEN`,
`CUTOVER_PAYER_EMAIL` and `CUTOVER_PAYMENT_METHOD_ID`. The amount is an integer from ARS 15 to
ARS 1000 and must be approved by the owner before the rehearsal. The mode does not ask for the old
database URL.

The run order is fixed:

1. Creates the pending delivery probe directly through the provider API.
2. Waits for its `WEBHOOKS` delivery to appear in `provider_notification`, then cancels the probe
   and re-reads it by id until `cancelled`. If this probe part fails, the small payment is not made.
3. Creates the small payment directly through `/v1/payments`, without `notification_url` and not
   as an order. It re-reads the payment by id until `approved`.
4. Waits for the payment's `IPN` delivery in `provider_notification`, refunds the payment, and
   re-reads the refund by id. If the IPN delivery is not seen, the run fails but still returns and
   re-reads the payment; the probe is also cancelled and re-read if its delivery was missing.

**Provider panel URLs.** Set the Webhooks URL to
`<HOSPEDA_API_URL>/api/v1/webhooks/mercadopago?source_news=webhooks` and the IPN URL to
`<HOSPEDA_API_URL>/api/v1/webhooks/mercadopago`; both use the same receiver. Webhooks delivers
`payment`, `subscription_preapproval`, and `subscription_authorized_payment` with `data.id` and
`type` query parameters, signed with the application's secret
(`HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`). IPN delivers only `payment` with `id` and `topic` query
parameters. Since HOS-1726, the receiver recognizes Webhooks from the marker or the `data.id` plus
`type` query shape, so losing the marker in the panel no longer leaves notices unprocessed. The old
system still requires the marker until cutover, so keep it in place.

The query in `scripts/cutover/notification-reader.ts` runs only from this folder, under a
read-only session and `READ ONLY` transaction. It selects no `url` or `body` and returns only a
boolean. Its location is exempt from G17(c) by path (U3.3).

The 4b writes its own manifest to
`scripts/cutover/out/cutover-4b-manifest-<timestamp>.json` by default, or to `--manifest-out`.
Use `--abort-inverse <that manifest> --confirm-abort-inverse` to run the abort inverses for its
probe and payment ids.

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
| `PROBE_PLAN_BOUND` | A probe in the probe manifest hangs from a plan that step 1a would cancel; nothing was cancelled. Remove the probe from the manifest or return to the owner. |
| `NOT_CANCELLED` | An id is still not `cancelled` after the 3 retries. |
| `REFUND_NOT_CONFIRMED` | Abort inverse (c): the refund never read `approved`, or the refund call got no refund. |
| `MANIFEST_WRITE_FAILED` | The first manifest checkpoint could not be written; nothing was called. |
| `PROVIDER_ERROR` | The provider could not be read or answered something unusable (status and path only; the body is dropped). |
| `OLD_DB_ERROR` | The old database could not be read (SQLSTATE or error code plus message). Raised before any provider call. |
| `DELIVERY_NOT_SEEN` | The expected `WEBHOOKS` probe or `IPN` payment delivery did not appear before its wait schedule ended. |
| `PAYMENT_NOT_APPROVED` | The payment did not read `approved` after its re-reads. |
| `NEW_DB_ERROR` | The read-only delivery lookup failed. |
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

## Unit exit (U3.4, AC:U3:10)

The unit is ready when the four points of its "Lista cuando" (LISTA:U3) hold. Evidence per point:

| # | LISTA:U3 point | Automated evidence | Closed by |
|---|---|---|---|
| 1 | Runs whole against the provider test account: unfiltered census, cancel, re-read by id, walk count equals the `total`, every known id in the walk, manifest of ids without personal data. | TEST:U3:1 to 4 and 6 (`run-cutover.test.ts`), TEST:U3:5 and 13 (`cutover-db/old-db.test.ts`) | Manual smoke TEST:U3:11 |
| 2 | Merged into the umbrella branch before the rehearsal (step 0). | History: merged into the epic branch; the rehearsal has not run yet (gate M3). | Merge order |
| 3 | Entered after U1, in parallel with V1, B1 and U2. | History: U1.6 (HOS-1421) merged by #3481 (`371127eec1`) before U3.1 (#3483 `43d97e0150`), U3.2 (#3486 `1632472bcd`) and U3.3 (#3573 `3d5ac3a6ce`). | Merge order |
| 4 | Against the test account, step 4b creates the probe and leaves it re-read `cancelled`, makes the small payment and leaves it refunded with the refund re-read, writes the three ids in the manifest, and fails when the lookup does not find the delivery. | TEST:U3:8 (`run-step-4b.test.ts`), TEST:U3:9 (`cutover-db/step-4b-notification.test.ts`), TEST:U3:10 (`abort-inverse.test.ts`) | Manual smoke TEST:U3:12 |

The automated half of the exit is `scripts/__tests__/cutover/exit.test.ts`. It pins three things:

- the 11 automated TEST ids (TEST:U3:1 to 10 and 13) are present as `describe` titles and each names its AC;
- no image copies `scripts/` (no `COPY` from the build context brings the repository root or the folder);
- no `check:*` guard names this folder (the unit adds no guards).

The two smokes (TEST:U3:11 and TEST:U3:12) are run by the owner, NOT by automation. Their sign-off goes
on HOS-1352: the unit carries no `status-needs-smoke-*` label.

Before the rehearsal the owner approves:

- the amount of the small payment (integer ARS 15 to 1000);
- the names of the six session variables listed under "Credentials".

## TEST:U3:11, manual smoke for the owner (NOT run by automation)

Whole run of steps 1a, 1b and 2 against the provider **test account** (sandbox), with
the staging old DB. Never against production.

0. Confirm the token belongs to the test account: `GET /users/me` with it, and look ONLY at
   `tags`, which must contain `test_user`. Copy no other field of the response. If it does not
   contain `test_user`, stop: this is not the test account.
1. In a shell session set `CUTOVER_MP_ACCESS_TOKEN` (sandbox token) and
   `CUTOVER_OLD_DATABASE_URL` (a copy or the staging old DB; the script only reads it).
2. Make sure `packages/payments/src/probes/probes.json` exists (or pass `--probes`). A missing file stops the script at startup with an error naming the path (exit 2).
3. Dry run first: `corepack pnpm exec tsx scripts/cutover/cli.ts --dry-run`. Check that the
   walked counts equal the totals, that `unknownLiveIds` makes sense, and that the
   manifest has only ids.
3b. The measurement is no longer required before the real run. If the run (or `--dry-run`) stops
    with `PROBE_PLAN_BOUND`, remove that probe from `packages/payments/src/probes/probes.json` (it
    will be cancelled with the rest) or return to the owner. NEVER exclude its plan from step 1a:
    that would leave its public link selling (AC:U3:2).
4. Real run: `corepack pnpm exec tsx scripts/cutover/cli.ts --confirm-cancel-all`.
5. Expect exit 0 and `outcome: ok`. Then confirm in the provider dashboard (or by
   `GET /preapproval/{id}` on a few ids from the manifest) that all of
   `cancelledPlanIds` and `cancelledPreapprovalIds` read `cancelled`, that the probes in
   `preservedProbeIds` are still alive, and that the manifest has no personal data.
6. Record the sign-off on the Linear issue and delete the manifest and the shell variables.

## TEST:U3:12, manual smoke for the owner (NOT run by automation)

Runs in the cutover rehearsal on `staging`, with the epic deployed and the B3 receiver on its route.
Not before: the receiver that stores the deliveries must exist there.

Session steps:

1. In the owner's own shell session set `CUTOVER_MP_ACCESS_TOKEN`, `CUTOVER_NEW_DATABASE_URL` (the
   new database of the environment), `CUTOVER_PAYER_EMAIL` and `CUTOVER_PAYMENT_METHOD_ID`.
2. Create a one-use card token with the provider's public key in that private session and set it as
   `CUTOVER_CARD_TOKEN`. The card number must not pass through chat or a file; never reuse the
   token (EX-12).
3. Confirm the provider account and the owner-approved ARS amount (15 to 1000).

Run:

```bash
corepack pnpm exec tsx scripts/cutover/cli.ts --step-4b --confirm-step-4b --payment-amount <ARS>
```

Two outcomes are acceptable, each with its own sign-off:

1. **`outcome=ok` with `probe`, `payment` and `refund` ids in the manifest.** Verify that the probe
   reads `cancelled`, the payment reads `approved` before its refund, the refund reads `approved`,
   and the probe and payment deliveries were stored in `provider_notification` by the B3 receiver.
   Sign off the whole smoke.
2. **The probe half finished, the payment half did not.** The probe was created, its `WEBHOOKS`
   delivery was seen and it re-reads `cancelled`; the run ends with `PROVIDER_ERROR` (HTTP 401) at the
   payment creation and the manifest has NO `paymentId`. Sign off the probe half only, and write down
   that the payment half could NOT be exercised in sandbox (measured, see below). The owner decides
   where and when that half is verified; record that decision on HOS-1352.

Any other result (for example `DELIVERY_NOT_SEEN` on the probe) is a failure: stop and return to
the owner.

Measured notices:

- Sandbox answers `401 Unauthorized use of live credentials` to `POST /v1/payments`, three times on
  2026-09-29. The cause measured is that the test seller account does not write on the Payments API at
  all (neither creating a payment nor refunding one); in production the same authorization passes
  (a refund with an invalid amount got `400`, not `401`). Staging uses the same token as the
  sandbox probes.
- Creating a payment through `POST /v1/payments` **is measured as successful in production** (owner,
  2026-10-19, HOS-1402 D-1a): with the exact body this script sends, ARS 15 answered `201` and
  `approved`/`accredited` (payment `184995919950`); the full refund answered `201` and `approved`
  (refund `3395845463`); re-reading the refund by id (`GET /v1/payments/{id}/refunds/{rid}`) answered
  `200` and `approved`; and the payment then read `refunded` for 15. The old production system got
  that payment's notices and ignored them: every delivery was answered `200` and the only trace was a
  `WARN` («local payment not found»). It is still not measured in sandbox, where the `401` above
  applies, so the rehearsal on staging can still end in outcome 2. The provider warned that Orders
  replaces that path, and orders do not notify through any channel.
- The `WEBHOOKS` delivery of a `pending` probe is **not measured**. If the run does not see it, step
  4b fails with `DELIVERY_NOT_SEEN`.

Delete the manifest and clear the session variables after the rehearsal.

## Cutover smoke: the Sentry cron monitors (Coord-93, owner only)

Checklist for the owner. No agent runs any part of it, there are no new environment variables and
nothing here needs a redeploy.

1. **Plan.** Confirm the Sentry plan includes Crons (not verified).
2. **Sweep monitor, `billing-reconciliation-sweep`.** From `apps/api/src/utils/cron-monitor-ping.ts`:
   `interval 1 day`, check-in margin 120 minutes (26 h in total). The job runs daily at 06:00
   (`0 6 * * *`, zone `America/Argentina/Buenos_Aires`). The monitor does not exist until the first
   check-in of a COMPLETE sweep in that environment creates it (Sentry upserts the monitor from the
   check-in config), and the sweep pings only after a complete run.
   - **Staging, during the rehearsal**, after the first complete sweep: the monitor exists with that
     schedule and margin, under the staging `HOSPEDA_SENTRY_ENVIRONMENT`, and has an `ok` check-in.
     If it does not appear, the sweep did not finish or there is no DSN (the check-in fails silently).
3. **The alert arrives.** A missed check-in must open an issue and notify the owner. Channel: the
   monitor's own notification to the owner's email unless the owner decides otherwise (not decided).
   To force it without waiting 26 h, lower the staging monitor by hand to `interval 1 hour` with a
   1 minute margin and wait for the "missed"; the next check-in restores the code's configuration.
   Not measured.
4. **Second monitor, `listing-coverage-reconciler`.** From `apps/api/src/utils/cron-heartbeat.ts`:
   slug equal to the job name, `crontab 0 5 * * *`, same timezone, and NO `checkinMargin` (Sentry's
   default applies). Run the same checks as in step 2. Whether a run longer than that default margin
   would be flagged "missed" every day is not measured; if it happens, the fix is in
   `cron-heartbeat.ts` (not U3): tell the coordinator.
5. **Production**, the day after step 5 of the cutover (crons on): repeat steps 2 to 4 with the
   production environment.
6. Sign off on HOS-1352.

### Healthchecks.io (free plan, owner only)

HOS-1742 replaces the paid Sentry Crons slots for these three jobs with Healthchecks.io's free
plan. No agent runs any part of this; the API only sends the pings once the two env vars below
exist. Sentry check-ins (`cron-monitor-ping.ts`, `cron-heartbeat.ts`) stay exactly as they are.

1. **One project.** Create a single project on the Healthchecks.io free plan. The free plan allows
   one project, so staging and prod share it. Copy its **Ping Key** (Project Settings → Ping Key);
   this is the value of `HOSPEDA_HEALTHCHECKS_PING_KEY` in both environments.
2. **Six checks, by slug.** Create one check per slug: `staging-<job>` and `prod-<job>` for the
   three monitored jobs. Use the schedule from `apps/api/src/cron/schedules.manifest.ts`:
   - `listing-coverage-reconciler` → `0 5 * * *`
   - `listing-remote-deletion-retry` → `45 5 * * *`
   - `billing-reconciliation-sweep` → `0 6 * * *`

   Time zone for all six: `America/Argentina/Buenos_Aires`. Pick a grace period you are
   comfortable with; suggested: **2 h** for `billing-reconciliation-sweep` (Sentry used a 120 min
   margin) and **1 h** for the other two.
3. **Notification.** Add your email as the project's integration so a late ping, a `/fail`, or a
   missed check-in reaches you.
4. **Env vars per environment.** On the VPS, set both vars for the API resource — the same ping
   key in both, and the matching prefix — then redeploy:
   - staging: `hops --target=staging env-set api HOSPEDA_HEALTHCHECKS_PING_KEY --secret` (masked
     prompt) and `hops --target=staging env-set api HOSPEDA_HEALTHCHECKS_SLUG_PREFIX staging`,
     then `hops --target=staging redeploy api`.
   - prod: the same commands with `--target=prod` and `HOSPEDA_HEALTHCHECKS_SLUG_PREFIX=prod`.

The ping URL always carries `?create=0`, so a slug that does not exist is **not** created:
Healthchecks answers `404 not found` and the helper only logs a warning. Create the six checks
**before** setting the env vars, or the first pings are lost (the checks stay "new" until their
first ping). With either env var missing the helper is a deliberate no-op: no prefix, no ping, so
staging can never feed the prod checks.

## Read-only verifiers: journal (G5) and step 3a catalog (G8) — HOS-1957

Two checks that write nothing, run on the VPS after `hops db-migrate`, against the target database:

```bash
hops --target=prod cutover-verify --journal             # AC:CORTE:7
hops --target=prod cutover-verify --catalog             # AC:CORTE:8, paso 3a
hops --target=staging cutover-verify --journal --catalog  # the rehearsal runs both
```

`hops cutover-verify` follows `hops cutover-step-3`: api container environment, host-reachable Postgres URL,
and the deployed-SHA guard (the checkout must be the deployed commit, so the journal it reads is the image's;
`--allow-sha-mismatch` overrides). It never writes, so it asks for no typed confirmation, even on prod. It wraps
`apps/api/scripts/cutover-v6-verify.ts`, whose connections are opened with `default_transaction_read_only=on`.

Exit codes: `0` every requested check passed, `1` a check failed (the cut does not continue and the abort branch
applies) or an error, `2` refused arguments. One JSON line per check goes to stdout.

### `--journal` (AC:CORTE:7)

Every migration in `packages/db/src/migrations/meta/_journal.json` must appear in `drizzle.__drizzle_migrations`.
Drizzle records `hash = sha256(<tag>.sql)` and `created_at = journal.when`, and applies an entry only if the newest
`created_at` in the table is lower than its `when`. A freeze hotfix dated before an umbrella migration is therefore
skipped without an error. The check matches by hash, one lookup per journal entry (never by count), and lists the
missing `idx`/`tag`/`hash`. A hash present with a different `created_at` is reported under `whenMismatch` as a
warning only; table hashes absent from the journal are `unknownHashes`, informational.

### `--catalog` (AC:CORTE:8, paso 3a)

Checks, each with its own failure list:

| id | What it verifies |
|---|---|
| `enum-mirror` | `vertical` rows equal `VerticalEnum` both ways, with the activation event each vertical declares |
| `plan-structure` | per vertical: one `trial`, one `pre_trial`, one `floor` plan, a sellable current plan, and exactly one current version per plan |
| `g-r3` | the panel validation of "publish a plan version" (G-R3 a-d, rank, current version, grace vs shortest cycle...), re-run on each plan's current version through `previewPlanVersion` (preview: writes nothing), so the rule keeps one home |
| `prices` | every sellable current version has `billing_option` rows with positive integer ARS amounts |
| `addons` | each add-on has a version and a product; prices positive; compatible verticals known; charge kind and cycle coherent |
| `promo-codes` | promo codes in force (not closed, inside the window) have a coherent effect and known verticals |
| `deadlines` | `vertical_deadline_version` and `billing_deadline_version` have version 1 and every version satisfies the deadline validations (including the archive-before-delete rule) |

The output also carries the price table (`report.prices`). The tool proves structure and the validations, not that the
amounts are the right ones: compare that table by eye with the pre-cut commercial catalog (as `smoke-b2-billing-deadlines.sql` already asks).
