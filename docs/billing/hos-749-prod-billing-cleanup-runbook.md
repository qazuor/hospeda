# HOS-749 — Production billing cleanup runbook

> **Nothing in this runbook has been executed.** It is written to be run by the
> owner, in order, after reading it. Every step names what to verify afterwards,
> and every verification is a read that does **not** go through the thing that
> did the work.

**Why the order matters.** Deleting the local row does not cancel the
MercadoPago preapproval. A live preapproval keeps charging the card next month,
now with no local row to explain the charge. MercadoPago comes first, always.

---

## 0. Preconditions

- SSH access to the VPS (`ssh -p 2222 qazuor@216.238.103.219`), `hops` on PATH
  (`~/.local/bin/hops`).
- A fresh Postgres backup: `hops --target=prod db-backup-now`. Verify it
  finished before continuing — this is the rollback.
- **Confirmed 2026-08-21: production has NO unique constraint on
  `billing_customers.external_id`** — only the plain, non-unique
  `idx_customers_external_id`. HOS-596's
  `UNIQUE (external_id, livemode) WHERE deleted_at IS NULL` is still only on
  `staging`. Two consequences, both favourable:
  1. A soft-deleted customer row cannot block a fresh signup today under ANY
     circumstance, so the HOS-202 failure mode ("the user can never re-subscribe")
     is out of reach here.
  2. When HOS-596 is eventually promoted, its index will apply cleanly: a check
     for duplicate LIVE `(external_id, livemode)` pairs returns **zero rows**
     (the 13 duplicates that exist are all already soft-deleted by the F-47 bug).
     Running this cleanup first only reduces the live set further, so the two
     changes do not conflict in either order.
- Note that `packages/seed/src/data-migrations/0058`, `0059`, `0065`, `0066` and `0067`
  are **still pending in production** (the ledger's last applied entry as of
  2026-08-21 is `0057-staff-email-domain-to-com-ar`). They run *before* `0068`
  in the same batch and hard-delete 23 test accounts along with their billing
  rows. `0068` is written to tolerate that: it targets whatever is still live at
  its turn, never a fixed inventory. Do not run `0068` on its own.

---

## 1. Inventory (read-only) — confirm the picture still holds

```bash
ssh -p 2222 qazuor@216.238.103.219 \
  "~/.local/bin/hops --target=prod psql --csv 'SELECT id, customer_id, status, mp_subscription_id, livemode, created_at, deleted_at FROM billing_subscriptions ORDER BY created_at'"
```

Expect ~20 rows, 18 live. Confirm the three `comp` rows and their owners:

```sql
SELECT s.id, s.status, c.email, pc.code
FROM billing_subscriptions s
JOIN billing_customers c ON c.id = s.customer_id
LEFT JOIN billing_promo_codes pc ON pc.id = s.promo_code_id
WHERE s.status = 'comp';
```

The owner's grant is `5cf22a13-e353-4627-825a-e95586771ab7` (`qazuor@gmail.com`).
The other two belong to `qazuor+smoke2@gmail.com` (purged) and
`rominapaolavillaverde@gmail.com` (**preserved** — owner decision resolved on 2026-08-22; see the RESOLVED note below).

---

## 2. MercadoPago FIRST — cancel every live preapproval

As of 2026-08-21 the account holds 67 preapprovals: 63 `cancelled`, 3 `pending`,
**1 `authorized`**.

| id | status | amount | next charge | local row |
| --- | --- | ---: | --- | --- |
| `275b27a37f6f4e94bc1ab7543c6bd092` | **authorized** | $15.000 ARS | **2026-09-19** | `fa6abdd1-…` (local status says `cancelled`) |
| `93afd75ca62148589cd9a5313189c298` | pending | $15/**day** | — | none |
| `a69b37ab95c54ce6a7fce7eb8f8c18ea` | pending | $15/**day** | — | none |
| `5bcfe7b37ea94419934814bd2865c2af` | pending | $30/month | — | none |

### Who they belong to (resolved 2026-08-21, read-only)

**The `authorized` one is the owner's own card.** `GET /v1/payments/173628776369`
returns `payer.email = qazuor@gmail.com`, `payer.id = 5860436`
(`GET /users/5860436` → nickname `QAZUOR`), cardholder **Leandro Asrilevich**,
CUIT 20274258447, Visa ****9371. Nobody else needs to be notified.

Note the cross-reference trap: the LOCAL row `fa6abdd1-…` belongs to billing
customer `727d0a5d` = **`superadmin@hospeda.com`**, while the real MP payer is
`qazuor@gmail.com` — the owner operating as superadmin during the 19/08 ZZQA
smoke. Identifying the payer from the local customer email gives the wrong
answer.

**It has already charged once.** The full `GET /preapproval/{id}` reports
`summarized.charged_quantity = 1`, `charged_amount = 15000`,
`last_charged_date = 2026-08-19T04:24:37-04:00`, `card_id 9630614559`, `visa`.
That charge **was refunded** (the MP payment is `refunded`; the local row carries
`refunded_amount = 1500000`), so no money is currently out. What remains
outstanding is the **next** debit on **2026-09-19**, which would be new money off
a real card.

**The three `pending` ones share `payer_id 1505978827`, which resolves to
`user_type: "guest"`** — an MP placeholder for a preapproval created
programmatically that no payer ever opened. No card, `summarized` entirely null,
no local row. They cannot activate on their own: a `pending` preapproval only
becomes `authorized` when a human opens its `init_point` and authorises with a
card. **But that `init_point` is still live on all three**, and two of them bill
**$15 per day**. The probability is low, not zero — cancelling takes it to zero,
which is why they are in this step rather than filed as harmless residue.

### How the divergence happened — and why it will recur

The local row reached `cancelled` through the **admin full-refund** path, which
writes `billing_subscriptions.status = 'cancelled'` directly and **never contacts
MercadoPago**. `apps/api/src/services/refund-lifecycle.service.ts:453-479` does
the local write; its import list (lines 11-18) contains no MercadoPago adapter
and no qzpay billing instance — only a `QZPayPayment` *type*. There is no
provider call to fail.

By contrast `apps/api/src/services/subscription-cancel.service.ts:271` **does**
pause the MP preapproval. So the user-facing cancel door notifies the provider
and the admin refund door does not. **Until that asymmetry is fixed, every full
refund issued from the admin panel leaves a live preapproval behind** — with a
real customer that is somebody else's card. Tracked as FU-2 in the HOS-749
report; it is not fixed by this cleanup.

Cancel each through the MercadoPago dashboard, or with an authenticated
`PUT /preapproval/{id}` carrying `{"status":"cancelled"}`. Run it **from inside
the API container** so the production token never leaves the VPS:

```bash
ssh -p 2222 qazuor@216.238.103.219
hops --target=prod exec api sh -c 'node -e "
  const id=\"275b27a37f6f4e94bc1ab7543c6bd092\";
  fetch(\"https://api.mercadopago.com/preapproval/\"+id,{method:\"PUT\",
    headers:{Authorization:\"Bearer \"+process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN,
             \"Content-Type\":\"application/json\"},
    body:JSON.stringify({status:\"cancelled\"})})
   .then(r=>r.text()).then(console.log)"'
```

### Verify step 2 against MercadoPago, not against our database

```bash
hops --target=prod exec api sh -c 'node -e "
 const t=process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
 (async()=>{let off=0;const all=[];while(true){
   const r=await fetch(\"https://api.mercadopago.com/preapproval/search?limit=50&offset=\"+off,
     {headers:{Authorization:\"Bearer \"+t}});
   const j=await r.json();const res=j.results||[];all.push(...res);
   if(res.length<50)break;off+=50}
 const h={};for(const p of all)h[p.status]=(h[p.status]||0)+1;
 console.log(\"TOTAL=\"+all.length,JSON.stringify(h));
 for(const p of all) if(p.status!==\"cancelled\")
   console.log(\"STILL LIVE:\",p.id,p.status,p.next_payment_date)})()"'
```

**Pass condition: the histogram is `{"cancelled": 67}` and no `STILL LIVE` line
is printed.** Note the search is run with **no date filter** on purpose — a
date-range search against this account returns `total: 0` even with the same
token that finds everything by id, so a date-scoped conciliation reads an empty
account and looks like a pass.

Do not proceed to step 3 until this passes.

---

## 3. Apply the migrations

```bash
hops --target=prod db-seed-migrate --status      # preview: 0058 … 0068 pending
hops --target=prod db-seed-migrate --allow-destructive
```

`0068` is `destructive: true`, so the runner's production gate requires
`--allow-destructive` (or `HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION=true`).

The run aborts, without writing anything, if it meets a state it was not written
to decide about — an unclassified table still referencing a row it is about to
soft-delete, a commerce/partner link row still in an entitlement-granting
status, an unexpired pending checkout, an FK-order violation, or a target set
above the 25-row fuse. An abort is the migration working, not failing: read the
message, resolve the case deliberately, then re-run.

---

## 4. Verify the end state — WITHOUT the script that produced it

Every query below reads the tables directly. None of them calls the migration,
its helpers, or any application code path.

### 4.1 Nothing entitlement-granting survives except the preserved grants

```sql
SELECT s.id, s.status, c.email
FROM billing_subscriptions s
LEFT JOIN billing_customers c ON c.id = s.customer_id
WHERE s.deleted_at IS NULL
  AND s.status IN ('active', 'trialing', 'comp');
```

**Expect exactly the preserved rows** — the owner's comp
(`5cf22a13-…` / `qazuor@gmail.com`) and Romina's comp (`9da44403-…`), which the
owner explicitly decided to preserve on 2026-08-22. Any other row here is a
live entitlement that should not exist.

> **FU-1 (account dashboard shows a plan for a purged account) is FIXED — do not
> expect it.** `apps/api/src/routes/user/protected/stats.ts` used to read
> `billing_customers` and `billing_subscriptions` without filtering `deleted_at`,
> so `GET /users/me/stats` kept reporting a soft-deleted subscription whose
> status is in `ENTITLEMENT_GRANTING_STATUSES`. **HOS-755 (PR #2981) added
> `isNull(...deletedAt)` to both reads and is merged to `staging`** — verified on
> `origin/staging`, where `resolveUserPlanSummary` now carries the filter on the
> customer read and on the subscription read alike. Provided the deploy running
> in production includes it, a purged account correctly reports no plan. If one
> still shows a stale plan after this cleanup, the deployed build predates
> HOS-755 — check that before filing anything new.
>
> **Two call sites are still unfiltered, and they are NOT display-only.** Neither
> is in scope for HOS-749; they are named here so the next person does not
> rediscover them as "the stats bug" and assume it regressed:
>
> - `apps/api/src/services/accommodation-publish-deps.ts:64-70` — the publish
>   eligibility check reads the customer and its ten most recent subscriptions
>   with no `deleted_at` filter, so a soft-deleted subscription can still answer
>   `has_active_sub`. This one gates a **write**, not a label.
> - `packages/service-core/src/services/billing/promo-code/promo-code.validation.ts:365,447`
>   — the `newCustomersOnly` guard and the per-customer usage counter both map a
>   user id to `billing_customers` without filtering `deleted_at`, so a
>   soft-deleted customer row can still make somebody look like a returning
>   customer, or keep a promo-usage count against them.
>
> Neither is fixed by this cleanup. Both become *more* reachable after it, since
> it creates soft-deleted rows on purpose.

### 4.2 The seven preserved customer records survived

The migration preserves seven `billing_customers` rows by explicit id
(`PRESERVED_CUSTOMER_IDS`), **without** preserving their subscriptions or
payments. Six are real people who registered and never paid — they own zero
subscriptions, so the general "a customer survives iff it owns a preserved
subscription" rule could never have saved them. The seventh is
`superadmin@hospeda.com`, the owner's staff account, whose two subscriptions and
three payments are 19/08 smoke data and DO go.

```sql
SELECT id, email, deleted_at
FROM billing_customers
WHERE id IN (
  '054d5c34-e29f-4d1f-bc26-0bf0f50894f4',  -- asrilevich.joaquin@gmail.com
  'ac2c775c-a882-48b6-a868-f1dd7876b21b',  -- jasiolga@yahoo.com.ar
  '626e7bd4-aab1-41be-a736-90b005bf01d2',  -- vivianarichard@hotmail.com
  '52faa6dd-cb8f-4228-b4a4-44e3e1f67e19',  -- julimogni08@gmail.com
  'fab75799-a003-459f-86a0-01cdeb7b0940',  -- peychauxchristian@gmail.com
  '585a3646-f717-4e6e-bc33-bf18e3c8c3f9',  -- olgafrontelli@gmail.com
  '727d0a5d-6d3e-4f75-ac51-823bb9279a3d'   -- superadmin@hospeda.com
)
ORDER BY email;
```

**Expect seven rows, every `deleted_at` NULL.** The run's own `counts` should
report `customersPreservedByList: 7` — but that number comes from the thing that
did the work, so the query above is the real check.

> The superadmin row's `email` still carries the OLD `@hospeda.com` domain, on
> purpose: `0057-staff-email-domain-to-com-ar` excluded this qzpay-owned mirror
> column by design. In `users` the same account is `superadmin@hospeda.com.ar`.
> It is **one** account, not two — do not "fix" the divergence here.

And the complement — the superadmin's own transactional rows are gone:

```sql
SELECT count(*) FILTER (WHERE deleted_at IS NULL)     AS live,
       count(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deleted
FROM billing_subscriptions
WHERE customer_id = '727d0a5d-6d3e-4f75-ac51-823bb9279a3d';
```

**Expect `live = 0`.** A preserved record with live test subscriptions under it
means the asymmetry broke in the wrong direction.

### 4.3 The owner's grant is intact and reachable

```sql
SELECT s.id, s.status, s.current_period_end, s.deleted_at,
       c.id AS customer_id, c.deleted_at AS customer_deleted_at, c.external_id
FROM billing_subscriptions s
JOIN billing_customers c ON c.id = s.customer_id
WHERE s.id = '5cf22a13-e353-4627-825a-e95586771ab7';
```

**Expect** both `deleted_at` columns `NULL`. A soft-deleted customer row would
strip the grant just as effectively as deleting the subscription.

### 4.4 No account was touched

```sql
SELECT count(*) FILTER (WHERE deleted_at IS NULL)  AS live_users,
       count(*) FILTER (WHERE deleted_at IS NOT NULL) AS deleted_users
FROM users;
```

Compare against the same counts taken before step 3. `0068` never touches
`users`; a difference here means `0058`/`0059` (which DO hard-delete 23 test
accounts, by explicit decision) accounted for it — check their reported counts,
and if the numbers still do not add up, stop and restore the backup.

### 4.5 Live and soft-deleted counted separately, never mixed

```sql
SELECT 'billing_customers' t,
       count(*) FILTER (WHERE deleted_at IS NULL) live,
       count(*) FILTER (WHERE deleted_at IS NOT NULL) soft_deleted FROM billing_customers
UNION ALL SELECT 'billing_subscriptions',
       count(*) FILTER (WHERE deleted_at IS NULL),
       count(*) FILTER (WHERE deleted_at IS NOT NULL) FROM billing_subscriptions
UNION ALL SELECT 'billing_payments',
       count(*) FILTER (WHERE deleted_at IS NULL),
       count(*) FILTER (WHERE deleted_at IS NOT NULL) FROM billing_payments
UNION ALL SELECT 'billing_addon_purchases',
       count(*) FILTER (WHERE deleted_at IS NULL),
       count(*) FILTER (WHERE deleted_at IS NOT NULL) FROM billing_addon_purchases;
```

A bare `count(*)` on any of these tables is meaningless after a soft delete and
has already manufactured false findings in this repo three times in one
afternoon. Always split the two.

### 4.6 No live row points at a soft-deleted parent

```sql
-- Subscriptions whose customer is gone.
SELECT s.id FROM billing_subscriptions s
JOIN billing_customers c ON c.id = s.customer_id
WHERE s.deleted_at IS NULL AND c.deleted_at IS NOT NULL;

-- Payments / addon purchases whose subscription is gone.
SELECT p.id FROM billing_payments p
JOIN billing_subscriptions s ON s.id = p.subscription_id
WHERE p.deleted_at IS NULL AND s.deleted_at IS NOT NULL;

SELECT a.id FROM billing_addon_purchases a
JOIN billing_subscriptions s ON s.id = a.subscription_id
WHERE a.deleted_at IS NULL AND s.deleted_at IS NOT NULL;
```

**Expect zero rows from all three.**

### 4.7 The tables with no `deleted_at` are inert

```sql
SELECT 'commerce_listing_subscriptions' t, count(*) FROM commerce_listing_subscriptions
  WHERE status IN ('active','trialing','comp')
UNION ALL SELECT 'partner_subscriptions', count(*) FROM partner_subscriptions
  WHERE status IN ('active','trialing','comp')
UNION ALL SELECT 'pending_checkouts_reusable', count(*) FROM billing_pending_checkouts
  WHERE status = 'pending' AND expires_at > now();
```

**Expect 0 for all three.** These tables have no `deleted_at` column and are
read on live-state paths *without* joining `billing_subscriptions`, so the soft
delete cannot make them inert on its own — see §4 of the HOS-749 report.

### 4.8 Then re-run the MercadoPago check from step 2

The database says nothing about whether a card will be charged. Re-run the
`preapproval/search` verification and confirm `{"cancelled": 67}` again.

---

## 5. Rollback

The migration is a soft delete, so recovery does not need the backup:

```sql
-- Undo everything 0068 wrote (its writes all share one timestamp).
UPDATE billing_customers      SET deleted_at = NULL WHERE deleted_at = '<ts>';
UPDATE billing_subscriptions  SET deleted_at = NULL WHERE deleted_at = '<ts>';
UPDATE billing_payments       SET deleted_at = NULL WHERE deleted_at = '<ts>';
UPDATE billing_addon_purchases SET deleted_at = NULL WHERE deleted_at = '<ts>';
```

Find `<ts>` with
`SELECT DISTINCT deleted_at FROM billing_subscriptions WHERE deleted_at IS NOT NULL ORDER BY 1 DESC;`
— `0068` stamps a single `new Date()` across all four tables, so its whole
write set shares one timestamp and is separable from the 470ms-apart HOS-596
self-deletions and from the 2026-08-16 QA-grant script.

`0058`/`0059`/`0065` hard-delete and are **not** reversible this way. Restoring
those needs the step-0 backup.

---

## RESOLVED — the third `comp`

`9da44403-44c3-47b0-8254-af08e57adefd` is a complimentary subscription granted to
`rominapaolavillaverde@gmail.com` (Romina Villaverde) on 2026-08-14, twenty
minutes after she signed up. She does not read as a test account.

The owner resolved this on **2026-08-22**: **preserve the subscription**. It
belongs to a real person who deliberately received the courtesy grant, so
`9da44403-44c3-47b0-8254-af08e57adefd` stays out of
`PURGEABLE_COMP_SUBSCRIPTION_IDS` and the migration keeps it.

The preserve-by-default `comp` rule remains intentional because the failure
modes are asymmetric: a stale grant left in place is visible and reversible,
while a stripped grant is invisible until the person complains. If that
decision ever changes after `0068` is ledgered anywhere, do **not** edit the
existing migration file — add a new migration instead, because rewriting a
ledgered file corrupts that environment's checksum.

---

## RESOLVED — the three unclassified FK tables do NOT abort the run

Three tables hold a foreign key to `billing_subscriptions` and are **not** listed
in `RETAINED_REFERENCING_TABLES`:

- `partners.subscription_id`
- `billing_plan_price_change_targets.subscription_id`
- `billing_plan_price_change_notices.subscription_id`

All three FKs are real (verified in the Drizzle schemas). Two independent facts
settle what they mean, and both were needed — neither alone is sufficient.

### 1. The guard is ROW-triggered, not constraint-triggered

`assertNoUnclassifiedReferrers`
(`packages/seed/src/data-migrations/helpers/billingCleanupGuards.ts`) *discovers*
referrers from `pg_constraint`, via `getInboundForeignKeys`, so it finds all
three **whether or not they hold rows**. But discovery is not the trip wire. For
each unclassified referrer it then runs a `COUNT(*)` against the targeted parent
ids and throws **only when that count is greater than zero**:

```ts
const count = Number(result.rows[0]?.count ?? 0);
if (count > 0) {
    throw new BillingCleanupAbort(/* … */);
}
```

There is also an earlier short-circuit: the outer loop `continue`s on a parent
whose target list is empty, so a run with no targeted subscriptions never issues
the catalogue query at all.

**An FK with zero matching rows is therefore silently fine.** The mere existence
of an unclassified FK cannot abort the migration.

### 2. Production holds zero such rows

Measured on prod over SSH, 2026-08-22, with a sentinel row included in the query
so an empty result could be distinguished from a query that never ran (`hops
psql` returns **empty with exit 0** on invalid SQL, and empty is not the same as
zero rows):

```
B1_partners_con_sub     | 0
B2_price_change_targets | 0
B3_price_change_notices | 0
```

Also measured, and relevant to whether the batch even reaches `0068`:
`billing_checkouts` and `billing_invoices` hold zero rows with a
`subscription_id`, so `0059` does not abort on FK either. HOS-301's 12/08
repricing run left no target and no notice behind — the scenario that worried us
most.

### Decision: they are NOT added to `RETAINED_REFERENCING_TABLES`

With the guard row-triggered and the counts at zero, adding them changes nothing
about this run. It would only change behaviour in the case where a row *appears*
before step 3 — and in that case adding them now is the **wrong** move, not a
free defence:

- Listing a table in `RETAINED_REFERENCING_TABLES` is a **classification
  decision**: an assertion that rows there pointing at a soft-deleted parent are
  safe to leave live. Nobody has analysed that for these three.
- `partners` is exactly the shape of thing the guard exists to catch. A partner
  row pointing at a swept subscription is the same failure mode as
  `commerce_listing_subscriptions` and `partner_subscriptions`, both of which
  needed a dedicated `assertRetainedTablesAreInert` probe precisely because a
  public surface reads them **without** joining `billing_subscriptions`. Note
  `partner_subscriptions` is already classified and asserted inert;
  `partners.subscription_id` is a different column on a different table and has
  had no such analysis.
- Pre-classifying blind converts a fail-closed abort into a **fail-open pass**
  for the one case the guard was built to stop.

An abort is cheap: nothing is written, the message names the table, and the run
is re-runnable after a deliberate decision. A wrong classification is not cheap
and is invisible.

**Instead, re-run the pre-flight immediately before step 3** — the counts above
are three days old by the time this runs, and that is the whole risk:

```sql
SELECT 'partners' t, count(*) FROM partners
  WHERE subscription_id IS NOT NULL
UNION ALL SELECT 'billing_plan_price_change_targets', count(*)
  FROM billing_plan_price_change_targets WHERE subscription_id IS NOT NULL
UNION ALL SELECT 'billing_plan_price_change_notices', count(*)
  FROM billing_plan_price_change_notices WHERE subscription_id IS NOT NULL;
```

All zero → proceed. Any non-zero → **stop and classify that table deliberately**
before the migration is ledgered anywhere; do not reach for the retained list to
make the abort go away.
