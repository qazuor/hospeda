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
- Note that `packages/seed/src/data-migrations/0058`, `0059`, `0065` and `0066`
  are **still pending in production** (the ledger's last applied entry as of
  2026-08-21 is `0057-staff-email-domain-to-com-ar`). They run *before* `0067`
  in the same batch and hard-delete 23 test accounts along with their billing
  rows. `0067` is written to tolerate that: it targets whatever is still live at
  its turn, never a fixed inventory. Do not run `0067` on its own.

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
`rominapaolavillaverde@gmail.com` (**preserved** — see the OPEN DECISION below).

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
hops --target=prod db-seed-migrate --status      # preview: 0058 … 0067 pending
hops --target=prod db-seed-migrate --allow-destructive
```

`0067` is `destructive: true`, so the runner's production gate requires
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
(`5cf22a13-…` / `qazuor@gmail.com`) and Romina's comp (`9da44403-…`) unless the
open decision below says otherwise. Any other row here is a live entitlement
that should not exist.

> **Known caveat — the account dashboard will still show a plan for one purged
> account.** `apps/api/src/routes/user/protected/stats.ts:129-133` and `:146-156`
> read `billing_customers` and `billing_subscriptions` **without filtering
> `deleted_at`**, so `GET /users/me/stats` keeps reporting a soft-deleted
> subscription whose status is in `ENTITLEMENT_GRANTING_STATUSES`. Today that
> affects two accounts (`turistatest@hospeda.com.ar` shows `tourist-plus`/"Plus"
> and `ownertest@hospeda.com.ar` shows `owner-basico`/"Basic", both with a period
> ending in **2126**). After this cleanup the purged smoke comp
> (`qazuor+smoke2@gmail.com`) becomes a third. It is a **display** divergence
> only — entitlements are correctly revoked, because `loadEntitlements` goes
> through qzpay, which does filter. Tracked as FU-1; do not treat it as a failed
> cleanup.

### 4.2 The owner's grant is intact and reachable

```sql
SELECT s.id, s.status, s.current_period_end, s.deleted_at,
       c.id AS customer_id, c.deleted_at AS customer_deleted_at, c.external_id
FROM billing_subscriptions s
JOIN billing_customers c ON c.id = s.customer_id
WHERE s.id = '5cf22a13-e353-4627-825a-e95586771ab7';
```

**Expect** both `deleted_at` columns `NULL`. A soft-deleted customer row would
strip the grant just as effectively as deleting the subscription.

### 4.3 No account was touched

```sql
SELECT count(*) FILTER (WHERE deleted_at IS NULL)  AS live_users,
       count(*) FILTER (WHERE deleted_at IS NOT NULL) AS deleted_users
FROM users;
```

Compare against the same counts taken before step 3. `0067` never touches
`users`; a difference here means `0058`/`0059` (which DO hard-delete 23 test
accounts, by explicit decision) accounted for it — check their reported counts,
and if the numbers still do not add up, stop and restore the backup.

### 4.4 Live and soft-deleted counted separately, never mixed

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

### 4.5 No live row points at a soft-deleted parent

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

### 4.6 The tables with no `deleted_at` are inert

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

### 4.7 Then re-run the MercadoPago check from step 2

The database says nothing about whether a card will be charged. Re-run the
`preapproval/search` verification and confirm `{"cancelled": 67}` again.

---

## 5. Rollback

The migration is a soft delete, so recovery does not need the backup:

```sql
-- Undo everything 0067 wrote (its writes all share one timestamp).
UPDATE billing_customers      SET deleted_at = NULL WHERE deleted_at = '<ts>';
UPDATE billing_subscriptions  SET deleted_at = NULL WHERE deleted_at = '<ts>';
UPDATE billing_payments       SET deleted_at = NULL WHERE deleted_at = '<ts>';
UPDATE billing_addon_purchases SET deleted_at = NULL WHERE deleted_at = '<ts>';
```

Find `<ts>` with
`SELECT DISTINCT deleted_at FROM billing_subscriptions WHERE deleted_at IS NOT NULL ORDER BY 1 DESC;`
— `0067` stamps a single `new Date()` across all four tables, so its whole
write set shares one timestamp and is separable from the 470ms-apart HOS-596
self-deletions and from the 2026-08-16 QA-grant script.

`0058`/`0059`/`0065` hard-delete and are **not** reversible this way. Restoring
those needs the step-0 backup.

---

## OPEN DECISION — the third `comp`

`9da44403-44c3-47b0-8254-af08e57adefd` is a complimentary subscription granted to
`rominapaolavillaverde@gmail.com` (Romina Villaverde) on 2026-08-14, twenty
minutes after she signed up. She does not read as a test account.

The migration **preserves it**, because the failure modes are asymmetric: a
stale grant left in place is visible and reversible, while a stripped grant is
invisible until the person complains. If the owner decides it was a test, add
the id to `PURGEABLE_COMP_SUBSCRIPTION_IDS` in
`packages/seed/src/data-migrations/0067-hos-749-prod-billing-cleanup.ts` **before**
the migration is applied anywhere — once it is ledgered, editing the file
corrupts that environment's checksum and a new migration is required instead.
