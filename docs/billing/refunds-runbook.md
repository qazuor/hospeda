# Refunds runbook: stuck `CONFIRMED` refunds

Use this note to handle a `CONFIRMED` refund by hand when it has no way out. It covers the two
cases of [HOS-2402](https://linear.app/hospeda-beta/issue/HOS-2402):

- **Case A, partial acceptance.** Mercado Pago accepted only part of the confirmed amount.
- **Case B, unanswered call.** A provider refund call was recorded but never got an answer.

This is a stopgap. The owner decided on 2026-11-20 that the code fix for HOS-2402 ships after the
sale opens. Until then, this note is the procedure. HOS-2402 stays open.

Every file reference below is `path:line` on `staging` at the time of writing.

## 1. Why these refunds get stuck

A provider refund call is recorded before its POST. `persistCall` inserts an `idempotency_key` row
(`result` NULL) and a `refund_call` row (`provider_refund_id` NULL)
(`packages/service-core/src/services/billing/refund/refund-provider-call.ts:43-77`). An answer is
written later by `completeCall`: it sets `idempotency_key.result` and `completed_at`, and on
acceptance it also sets `refund_call.provider_refund_id` (`refund-provider-call.ts:80-106`).

A call is **live** when the provider accepted it (`provider_refund_id` set) or never answered it
(`idempotency_key.result` NULL) (`refund-moved-money.ts:21-32`). A `CONFIRMED` refund with a live
call:

- **cannot be declined.** Action 13 refuses it with `REFUND_HAS_PROVIDER_CALLS`
  (`decline-refund.service.ts:40`, `:119-128`). On a held page charge it refuses earlier, with
  `REFUND_CLOSES_HELD_CHARGE` (`:99-118`).
- **cannot be settled by action 14.** RF4 only leaves `NO_ROW` or `REQUESTED`
  (`refund-machine.ts:40`). Naming a `CONFIRMED` refund in `refundId` answers `REFUND_NOT_OPEN`
  (`settle-external-refund.service.ts:202-217`).
- **is not executed automatically** unless the accepted calls add up to the confirmed amount and
  none is unanswered. The automatic execution (RF3) runs only on a charge notice for that payment
  (`notice/process-provider-notice.service.ts:272`, `notice/refund-execution-on-notice.ts:37-72`). It
  returns `AWAITING_PROVIDER_ANSWER` while any call is unanswered (`execute-refund.service.ts:107-109`,
  `:133`), and `NOT_ACCREDITED_KEPT_CONFIRMED` when the accepted ids do not add up to
  `refund.amount` (`:137-144`).
- **is resent from the admin (HOS-2516).** «Retry with MP» calls `resendUnansweredRefundCalls`
  for one refund (`refund/retry-refund-provider-calls.service.ts`), with each call's original
  idempotency key, and runs RF3 right after when every call comes back accepted. Section 8 starts
  there.

Unless noted, the service paths above are under `packages/service-core/src/services/billing/`
(`refund/` or `notice/`).

## 2. Ground rules

- **Reads are free; writes need the owner.** Any `UPDATE` in this note runs only with the billing
  owner's explicit OK, written as a comment on the Linear issue you are working from.
- **Run SQL through `hops` on the VPS.** `--target` goes before `psql`. Use `--target=staging` to
  rehearse and `--target=prod` for the real thing.
- **Empty output is not proof.** If `hops psql` prints nothing, it may have swallowed an error. It
  does not prove there are zero rows. Re-run with a query you know returns rows.
- **Money units differ.** The database stores centavos (`refund.amount`, `refund_call.amount`,
  `payment.amount`). Mercado Pago shows pesos. The adapter sends `amount / 100`
  (`packages/payments/src/adapters/mercadopago/mercadopago-mutations.ts:61-71`).
- **Order-channel refunds are out of scope.** The add-on order refund channel was retired (T-7).
  Confirming a refund on such a payment now answers 409 `REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE`
  (`confirm-refund.service.ts:138-155`, `apps/api/src/routes/billing-refund/admin/confirm.ts:44`).
  RF3 never executes a call tied to an add-on instance (`execute-refund.service.ts:122-123`). So if
  any `refund_call.addon_instance_id` of the refund is not NULL, it is a leftover order refund call
  from before T-7. This note does not cover it. Escalate.

## 3. Tables and columns

All are singular tables under `packages/db/src/schemas/vertical/`.

| Table | Columns used here | Schema |
|---|---|---|
| `refund` | `id`, `payment_id`, `manual_payment_id`, `amount`, `reason`, `status`, `confirmed_by`, `executed_via`, `settled_by`, `external_channel`, `external_ref`, `version`, `created_at` | `refund.dbschema.ts:23-80` |
| `refund_call` | `id`, `refund_id`, `idempotency_key`, `provider_refund_id`, `amount`, `addon_instance_id`, `created_at` | `refund-call.dbschema.ts:17-45` |
| `idempotency_key` | `key`, `operation`, `subject_id`, `result`, `request`, `completed_at`, `created_at` | `idempotency-key.dbschema.ts:18-48` |
| `payment` | `id`, `status`, `amount`, `refunded_amount`, `currency`, `provider_fact_id`, `provider_payment_id`, `subscription_id`, `addon_instance_id`, `fact_at` | `payment.dbschema.ts` |
| `reconciliation_mark` | `id`, `reason`, `subscription_id`, `addon_instance_id`, `placed_at`, `lifted_at`, `lifted_by`, `version` | `reconciliation-mark.dbschema.ts:23-82` |
| `reconciliation_mark_payment` | `id`, `mark_id`, `payment_id`, `hung_at`, `resolved_at`, `refund_id` | `reconciliation-mark-payment.dbschema.ts:9-58` |

Three facts the procedures rely on:

- The idempotency key of a call is `refund:<refund_id>:<n>` (`refund-provider-call.ts:60`). It is
  sent to Mercado Pago as `X-Idempotency-Key` (`mercadopago-mutations.ts:71`).
- `payment.provider_fact_id` is the Mercado Pago payment id. Refunds are posted to
  `/v1/payments/<provider_fact_id>/refunds` (`mercadopago-mutations.ts:61`).
- `refund_call.provider_refund_id` is the Mercado Pago refund id, stored as text
  (`mercadopago-mutations.ts:127`).

## 4. Find stuck refunds

### 4.1 Unanswered calls (case B)

```bash
hops --target=prod psql --stdin <<'SQL'
select r.id as refund_id, r.payment_id, r.reason, r.amount as confirmed_amount,
       rc.id as call_id, rc.idempotency_key, rc.amount as call_amount,
       rc.addon_instance_id, rc.created_at as call_created_at
from refund r
join refund_call rc on rc.refund_id = r.id
join idempotency_key k on k.key = rc.idempotency_key
where r.status = 'CONFIRMED'
  and k.result is null
  and rc.provider_refund_id is null
  and rc.created_at < now() - interval '<N> hours'
order by rc.created_at;
SQL
```

Replace `<N>` with the wait of section 8, step 1. Without that age filter, a call that is in
flight right now would look stuck.

### 4.2 Partial acceptance (case A)

```bash
hops --target=prod psql --stdin <<'SQL'
select r.id as refund_id, r.payment_id, r.reason,
       r.amount as confirmed_amount,
       coalesce(sum(rc.amount) filter (where rc.provider_refund_id is not null), 0) as accepted_amount,
       r.amount - coalesce(sum(rc.amount) filter (where rc.provider_refund_id is not null), 0) as remaining_amount,
       bool_or(k.result is null) as has_unanswered_call
from refund r
join refund_call rc on rc.refund_id = r.id
join idempotency_key k on k.key = rc.idempotency_key
where r.status = 'CONFIRMED'
group by r.id
having coalesce(sum(rc.amount) filter (where rc.provider_refund_id is not null), 0) > 0
   and coalesce(sum(rc.amount) filter (where rc.provider_refund_id is not null), 0) < r.amount
order by r.created_at;
SQL
```

A refund can be in both lists. Handle case B first, then check it again against this list.

A `CONFIRMED` refund whose accepted calls already add up to `refund.amount` is not stuck in the
HOS-2402 sense. It closes through RF3 once Mercado Pago accredits the refunds and sends a charge
notice for the payment.

## 5. Inspect one refund

Replace `<refund_id>` and run all five queries in one call. Paste the output into the Linear
comment before you change anything. That output is the "before" record.

```bash
hops --target=prod psql --stdin <<'SQL'
-- 1. The refund
select id, payment_id, manual_payment_id, amount, reason, status, confirmed_by,
       executed_via, external_channel, external_ref, version, created_at, updated_at
from refund where id = '<refund_id>';

-- 2. Its calls and their idempotency keys
select rc.id as call_id, rc.idempotency_key, rc.amount, rc.provider_refund_id,
       rc.addon_instance_id, rc.created_at, k.operation, k.result, k.completed_at
from refund_call rc
join idempotency_key k on k.key = rc.idempotency_key
where rc.refund_id = '<refund_id>'
order by rc.created_at, rc.idempotency_key;

-- 3. The payment (provider_fact_id is the Mercado Pago payment id)
select p.id, p.status, p.amount, p.refunded_amount, p.currency, p.provider,
       p.provider_fact_id, p.provider_payment_id, p.subscription_id, p.addon_instance_id, p.fact_at
from payment p
join refund r on r.payment_id = p.id
where r.id = '<refund_id>';

-- 4. Every refund of the same payment
select id, status, amount, reason, executed_via, external_channel, external_ref, created_at
from refund
where payment_id = (select payment_id from refund where id = '<refund_id>')
order by created_at;

-- 5. Reconciliation marks that hang the payment
select m.id as mark_id, m.reason, m.subscription_id, m.addon_instance_id, m.placed_at,
       m.lifted_at, m.version, mp.id as mark_payment_id, mp.hung_at, mp.resolved_at, mp.refund_id
from reconciliation_mark_payment mp
join reconciliation_mark m on m.id = mp.mark_id
where mp.payment_id = (select payment_id from refund where id = '<refund_id>')
order by m.placed_at;
SQL
```

## 6. Read the payment in Mercado Pago

Open the payment in the Mercado Pago panel of the account that collected it. Search by
`payment.provider_fact_id`. Panel menus change, so search by id and do not rely on a menu path.
The payment detail lists its refunds, each with an amount, a status and an id.

- **Refunded so far** is the total of its refunds. **Remaining** is the payment amount minus that
  total.
- A refund counts as accredited when its status is `approved`. The adapter reads it the same way
  (`packages/payments/src/adapters/mercadopago/mercadopago-charge-read.ts:126-129`).
- To match a refund to a call, use its id against `refund_call.provider_refund_id`. For an
  unanswered call, which has no id, match on the amount (`refund_call.amount / 100`) and a date at
  or after `refund_call.created_at`.
- A refund whose id is already in some `refund_call.provider_refund_id` or in a
  `refund.external_ref` with `external_channel = 'PROVIDER_PANEL'` is already recorded. Do not
  count it again.

If you have the production access token, `GET https://api.mercadopago.com/v1/payments/<provider_fact_id>`
returns the same data (`refunds[]` and `transaction_amount_refunded`). That is the read the
adapter makes (`mercadopago-charge-read.ts:74`). Never paste the token anywhere.

## 7. Case A: partial acceptance

**What it looks like.** Query 4.2 lists the refund. Mercado Pago shows refunds for less than the
confirmed amount. The provider call path ends with `PROVIDER_REJECTED_KEPT_CONFIRMED`
(`refund-provider-call.ts:292-295`).

**What to check in Mercado Pago (section 6):**

1. For each `refund_call` with a `provider_refund_id`, find that refund. Write down its amount and
   status.
2. Confirm that Mercado Pago's refunded total matches `accepted_amount` (in pesos). Confirm that no
   other refund appears that Hospeda does not know about.
3. Write down what this refund still owes the customer: `remaining_amount` from 4.2, in centavos.

**How to close it in Hospeda: there is no safe path today.** None of the existing actions closes
this refund:

| Action | What happens |
|---|---|
| Action 13, decline (`POST /api/v1/admin/billing-refunds/{refundId}/decline`, `apps/api/src/routes/billing-refund/admin/decline.ts:49`) | Refused with `REFUND_HAS_PROVIDER_CALLS`, because the accepted call is live (`decline-refund.service.ts:119-128`). |
| Action 14 naming the refund (`POST /api/v1/admin/billing-refunds/external` with `refundId`, `settle-external.ts:71-152`) | Refused with `REFUND_NOT_OPEN`. RF4 never leaves `CONFIRMED` (`settle-external-refund.service.ts:210-216`). |
| Action 14 for the remainder, without `refundId` | Usually refused with `REFUND_EXCEEDS_BALANCE`. The `CONFIRMED` row still claims its full amount (`refund-source.ts:42`, `:201-222`). When it does fit, it is still wrong. It creates a second `EXECUTED` row, the `CONFIRMED` row stays open forever, and `payment.refunded_amount` never counts the part Mercado Pago accepted. That is because only `EXECUTED` rows count (`packages/service-core/src/services/billing/payment/apply-executed-refund.service.ts:50`). |
| Automatic execution (RF3) | Returns `NOT_ACCREDITED_KEPT_CONFIRMED`, because the accepted ids do not add up to `refund.amount` (`execute-refund.service.ts:137-144`). |
| Lifting the mark (action 7, `POST /api/v1/admin/billing-reconciliation/marks/{markId}/lift`) | Refused while the payment is still hung (`MARK_HAS_UNRESOLVED_PAYMENTS`). On a held page charge it refuses to resolve the payment without a refund (`MARK_CLOSES_ONLY_BY_REFUND`, `lift-reconciliation-mark-by-admin.service.ts:134-140`). |

**What to do:**

1. Do not refund the remainder from the Mercado Pago panel on your own. Once you do, Hospeda cannot
   record it (see action 14 above). Mercado Pago and the database then disagree until the HOS-2402
   fix ships. Whether the customer gets the remainder now, and by which channel, is the owner's
   decision.
2. Escalate to the billing owner, with a comment on HOS-2402 (section 9) that carries the section 5
   output, the Mercado Pago refund ids and amounts, and the remaining amount.
3. Leave the refund `CONFIRMED`. Do not edit `refund`, `refund_call` or `idempotency_key` by hand
   for this case.

**The only conceivable path, for the owner to weigh. It is NOT safe, and this note does not ask
you to run it.** It is listed so the owner can decide with the risks in view, not as a procedure:

1. Refund the remainder (`remaining_amount`) from the Mercado Pago panel, and wait until Mercado
   Pago shows that refund `approved`. Never use a refund that is still in process.
2. Insert by hand one `idempotency_key` row and one `refund_call` row that imitate `persistCall`
   (`refund-provider-call.ts:43-77`): key `refund:<refund_id>:<n+1>`, operation `REFUND_CREATE`,
   `subject_id` the refund, `refund_call.amount` the remainder and `provider_refund_id` the new
   Mercado Pago refund id. Then complete them as `ACCEPTED`, as `completeCall` would
   (`:80-106`).
3. Wait for a charge notice to trigger RF3. RF3 executes only if every accepted id is accredited and
   Mercado Pago's amounts add up to `refund.amount` (`execute-refund.service.ts:137-144`).

Why it is not safe:

- **It fabricates a call our code never sent.** No POST with that idempotency key ever reached
  Mercado Pago. The row claims a history that did not happen, and every later reader trusts it.
- **There is a race.** The panel refund triggers its own charge notice. If that notice is processed
  before the insert, RF3 runs on the old calls and answers `NOT_ACCREDITED_KEPT_CONFIRMED`. The
  notice does not come again, so the refund stays stuck, now with the fabricated rows.
- **A wrong amount or id makes it permanent.** The fabricated call is live (it has a
  `provider_refund_id`), so the refund can still never be declined.

**Held charge or mark.** While the refund stays `CONFIRMED`, the payment stays hung on its mark
(`reconciliation_mark_payment.resolved_at` NULL) and the mark cannot be lifted. A page-charge mark
(reasons `DIVERGENCIA_DE_MONTO`, `COBRO_DUPLICADO`, `ORDEN_PAGADA_SIN_INSTANCIA` on an add-on
instance) keeps the charge held. That is expected until the fix.

## 8. Case B: unanswered call

**What it looks like.** Query 4.1 lists the call. It happens when the process died between
`persistCall` and the POST, or when Mercado Pago never answered. A timeout is read as unavailable
(`refund-provider-call.ts:159-167`). An empty replay body is read the same way (`:124-132`). The
provider call path ends with `AWAITING_PROVIDER_ANSWER` (`refund-provider-call.ts:228`).

**Step 0. Retry with MP first (HOS-2516).** In the admin, open **Billing → Reconciliation →
Refunds**, paste the refund id in **Retry with Mercado Pago** and confirm. It is
`POST /api/v1/admin/billing-refunds/<refund_id>/retry-provider-calls` with body
`{"confirmed": true}` and permission `billing.refund`
(`apps/api/src/routes/billing-refund/admin/retry-provider-calls.ts`; rejections in
`apps/api/docs/error-contract.md`, «Action 13 provider call retry»). For each unanswered call it
first reads the charge at Mercado Pago. If the read shows exactly one refund for the call's amount
that nothing of ours cites yet, the lost call landed: it is bound to that refund and NOT sent again.
Only when no such refund shows up is the call resent, with the SAME `X-Idempotency-Key` and amount.
Wait the same `<N>` hours of query 4.1 first, so you do not race a call still in flight and the
charge read has caught up. Keep `<N>` well under 24: past 24 hours the retry no longer posts (below). Only one retry of a refund runs at a time: a second click answers 409
`REFUND_RETRY_IN_PROGRESS`; wait for the first one's result. The retry still reads the charge and binds what it finds, however old the call. Only
POSTING a call again is limited: if a call sent more than 24 hours ago would have to be posted
again (the charge shows no refund to bind it to), the retry answers 409
`REFUND_CALL_TOO_OLD_TO_RETRY`, posts nothing and writes nothing (owner decision on #4643). That
case no longer goes to 8.1/8.2: settle it with action 14 from the admin, section 8.4 (HOS-2538).
The 24-hour limit can be relaxed once matrix row `EX-73` is measured. Then read each call's answer:

| Answer for a call | What happened | Next |
|---|---|---|
| `FOUND_AT_PROVIDER` or `SENT`, and `execution: "EXECUTED"` | The refund was already at Mercado Pago (`FOUND_AT_PROVIDER`, nothing resent) or the resend was accepted (`SENT`), and the charge read shows it accredited for the full amount. The refund is `EXECUTED` | Nothing. Leave the audit trail (section 9) |
| `FOUND_AT_PROVIDER` or `SENT`, and `execution: "NOT_ACCREDITED_KEPT_CONFIRMED"` | Accepted, not accredited yet (accepted is not accredited) | Nothing to write. The next charge notice executes it, or press **Retry with Mercado Pago** again later: with every call accepted it only re-runs RF3, which reads the charge (`calls: []`). If it is still not accredited after a day, it is case A (section 7) |
| `FOUND_AT_PROVIDER` or `SENT`, and `execution: null` with `status: "CONFIRMED"` | Accepted, but the charge read after it failed | Nothing to write: the next charge notice or another retry executes it |
| `status: "FAILED"` with `execution: null` and no `PROVIDER_REJECTED_FAILED` (also with `calls: []`) | Mercado Pago had accepted the refund and now reads it `rejected` or `cancelled` (matrix row `EX-74`). The call is recorded as rejected by the provider (`REJECTED_AFTER_ACCEPTANCE`) and the refund is `FAILED` (RF5) | Section 8.1 from step 5 (check Mercado Pago, then action 14 if still owed) |
| `PROVIDER_REJECTED_FAILED` | Mercado Pago rejected the call. The refund is `FAILED` (RF5) | Section 8.1 from step 5 (check Mercado Pago, then action 14 if still owed) |
| `AWAITING_PROVIDER_ANSWER` | Still no answer; the charge read before resending failed (nothing was sent); the read showed SEVERAL uncited refunds for the amount (nothing was sent; Sentry alert `SEVERAL_UNNAMED_PAYMENT_REFUNDS`); the read showed an uncited refund for the amount while ANOTHER refund of the same payment has a call Mercado Pago has not answered, so that refund may be the other call's (nothing bound; alert `OTHER_REFUND_CALL_UNANSWERED`: retry the OTHER refund first); an answer without id that matched no single uncited refund; or an answer naming a Mercado Pago refund id that is already the panel reference of a refund or the id of another call (HOS-2517). The last two raise a Sentry alert (`AmbiguousRefundAnswerError`, with its `reason`) | Retry later. If it persists, or the alert says `PROVIDER_REFUND_ALREADY_CITED`, steps 1-2 below |
| `PROVIDER_KEY_CONFLICT` | Mercado Pago refused the key as reused | Steps 1-2 below |

A 422 `REFUND_PAST_PROVIDER_WINDOW` means the charge is more than 180 days old: a refusal from
Mercado Pago would not tell whether the lost call moved money, so the retry refuses to send. Go to
steps 1-2 below. A call of the retired order channel (`refund_call.addon_instance_id` set) is never
resent (section 2).

**How long Mercado Pago remembers the key is NOT measured** (matrix row `EX-73` in
`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md`). `RF-6` measured
an immediate replay: same key and body, `200` with an empty body and no new refund. Nobody
measured a replay days later. The read before resending covers the common case: a lost call that
landed shows up on the charge and is bound without sending anything, so a forgotten key cannot
double it. What is left is a refund Mercado Pago processed but does not show on the charge read
yet, together with a forgotten key: then the resend creates a SECOND refund. That is why the
`<N>`-hour wait comes first. If you have any reason to think the read lags (Mercado Pago incident,
a refund you can see in the panel but not in the read), check the panel before retrying, and go
to step 2 if the refund is there.

Only when the retry cannot close it does this case need one direct write, and only that write.
Everything after it goes through the existing actions.

**Step 1. Wait, then read Mercado Pago.** Do not decide minutes after the call. Give Mercado Pago
time to process a request that may have reached it (operational judgment: at least a few hours,
not a code rule). Use the same number of hours as `<N>` in query 4.1. Then look for a refund that
matches each unanswered call (section 6).

**Step 2. Branch on the state AND the amount of what Mercado Pago shows.** Whether a refund exists
is not enough. Use this table:

| What Mercado Pago shows for the call | Go to |
|---|---|
| No refund at all | 8.1, record it as rejected |
| A refund in status `rejected` or `cancelled` (no money moved) | 8.1, record it as rejected |
| One refund in status `approved` **whose amount equals `refund_call.amount / 100` exactly**, that maps to this call and no other | 8.2, record it as accepted |
| A refund Mercado Pago shows as still in process (not yet `approved`, `rejected` or `cancelled`) | Write nothing. Read Mercado Pago again later. If it does not resolve, go to 8.3 |
| Any amount difference, a refund that could belong to more than one call, a status you do not recognise, or a chargeback on the payment | 8.3, escalate |

**Why the bar for 8.2 is so high.** `completeCall` writes `ACCEPTED` whenever it has an id
(`refund-provider-call.ts:80-106`). RF3 is stricter. It executes only when every accepted id is
accredited in Mercado Pago and their Mercado Pago amounts add up to exactly `refund.amount`
(`execute-refund.service.ts:137-144`). If you write `ACCEPTED` wrongly, for the wrong amount or
for a refund that never accredits, the call stays live forever. The refund can then never be
declined (`refund-moved-money.ts:21-32`), and it turns into case A, which has no exit.

**When in doubt:** write `REJECTED` only if you are sure no money moved. Otherwise escalate. Never
write `ACCEPTED` on a doubt.

### 8.1 No money moved: no refund, or a rejected/cancelled one

The call did not move money. Record it as rejected. That makes the refund call-free in the sense
of `refund-moved-money.ts:21-32`, and then the existing actions apply.

1. **Get the owner's OK** on the Linear issue.
2. **Record the rejection.** This mirrors what `completeCall` writes for a rejection
   (`refund-provider-call.ts:80-106`, shape at `:82-90`). RF3 reads `outcome = 'REJECTED'` as
   answered (`execute-refund.service.ts:14-21`, `:101-106`).

   ```bash
   hops --target=prod psql --stdin <<'SQL'
   update idempotency_key k
   set result = jsonb_build_object(
           'outcome', 'REJECTED',
           'code', 'MANUAL_VERIFIED_NOT_SENT',
           'message', 'HOS-2402 runbook: no money moved in Mercado Pago for this call (none, or rejected/cancelled). Verified by <operator> on <YYYY-MM-DD>. Linear <ISSUE-ID>.'
       ),
       completed_at = now()
   from refund_call rc
   join refund r on r.id = rc.refund_id
   where k.key = rc.idempotency_key
     and k.key = '<idempotency_key>'
     and rc.refund_id = '<refund_id>'
     and rc.provider_refund_id is null
     and k.result is null
     and r.status = 'CONFIRMED'
   returning k.key, k.result, k.completed_at;
   SQL
   ```

   It is one statement, so it is atomic. It must return exactly one row. Zero rows means something
   changed, so stop and inspect again. Repeat the statement for each unanswered call that Mercado
   Pago shows was not sent.
3. **Inspect again** (section 5). If any call of the refund still has a `provider_refund_id`, the
   refund is now case A (section 7). Stop here and escalate.
4. **Decline it with action 13.** The refund now has no live call, so RF5 moves it to `FAILED`
   (`decline-refund.service.ts:40-151`). It works on a held page charge too (`:99-118`). The
   answer carries `warning: 'VERIFY_NO_PROVIDER_REFUND'` (`:142-148`).
   - A `MARK_PROPOSAL` refund now shows in the admin under **Billing → Reconciliation → Refunds**
     (`apps/admin/src/routes/_authed/billing/reconciliation/refunds.tsx:7`). That list includes a
     `CONFIRMED` refund only when it has no live call
     (`list-proposed-refunds.service.ts:83-88`). Use its **Decline** button.
   - Any other reason has no decline button. Call the route directly:
     `POST /api/v1/admin/billing-refunds/<refund_id>/decline` with body `{"declined": true}`
     (`apps/api/src/routes/billing-refund/admin/decline.ts:49-53`,
     `packages/schemas/src/api/billing/refund-decline.schema.ts:7`). It needs
     `billing.refund`. Section 10 shows how.
   - Declining a `REVOCATION`, `ADDON_ORPHAN` or `ONE_TIME_ADDON_REVOCATION` refund queues the staff
     notice `billing.revocation-refund-failed` (`refund-fail.ts:7-33`,
     `reconciliation/revocation-refund-failed-notice.ts:24-28`, `:89`). That is expected.
5. **Check Mercado Pago once more** before you return money (that is what the warning asks for).
6. **If the customer is still owed the money, refund it by hand and record it with action 14,
   answering the `FAILED` refund.** RF4 accepts a `refundId` that names a `FAILED` row. It writes a
   new `EXECUTED` row and leaves the `FAILED` one as it is
   (`settle-external-refund.service.ts:202-210`, `:374-375`). The `FAILED` row no longer claims
   balance (`refund-source.ts:42`).
   - Refund from the Mercado Pago panel (`channel: "PROVIDER_PANEL"`, `reference`: the new
     Mercado Pago refund id) or by bank transfer (`channel: "BANK_TRANSFER"`, `reference`: the
     transfer receipt).
   - Body (`packages/schemas/src/api/billing/external-refund-settlement.schema.ts:41-57`):

     ```json
     {
       "paymentId": "<payment_id>",
       "refundId": "<refund_id>",
       "amount": <centavos>,
       "channel": "PROVIDER_PANEL",
       "reference": "<Mercado Pago refund id or transfer receipt>",
       "reason": "OUT_OF_FLOW_REFUND",
       "note": "HOS-2402 runbook, answers FAILED refund <refund_id>. Linear <ISSUE-ID>."
     }
     ```

   - The route is `POST /api/v1/admin/billing-refunds/external` and needs
     `billing.settleExternal` (`settle-external.ts:71-78`).
   - In the admin, `ExternalRefundSettlementForm` sends a `refundId` for a `FAILED` row only from
     the revocation screen (`/billing/subscriptions/<subscriptionId>/revocation`,
     `apps/admin/src/features/billing-revocation/components/RevocationRefundSettlement.tsx:67`). The
     mark screen's action 14 form shows only for `REEMBOLSO_FUERA_DEL_FLUJO` and
     `COBRO_SIN_REGISTRAR` marks, and it never sends a `refundId`
     (`apps/admin/src/features/billing-reconciliation/components/ReconciliationMarkAction14.tsx:20-54`).
     In every other case, call the route directly (section 10).
   - A panel reference that is already recorded is refused with
     `EXTERNAL_REFERENCE_ALREADY_SETTLED` (`settle-external-refund.service.ts:168-185`), so the same
     Mercado Pago refund cannot be recorded twice.

**Held charge or mark, after step 6.** Action 14 does three things in the same transaction:

- It resolves every unresolved `reconciliation_mark_payment` of that payment with the new refund
  (`resolved_at`, `refund_id`) (`settle-external-refund.service.ts:410-415`,
  `reconciliation/hung-payment-resolution.ts:8-26`).
- It mails the buyer when a mark 23 holds a late one-time charge (`:416-417`).
- It applies P3/P4/P5 to the payment (`payment.refunded_amount`, `payment.status`, coverage release
  on a full refund) (`:316-342`).

The mark itself stays open. Lift it with action 7 (`POST /api/v1/admin/billing-reconciliation/marks/{markId}/lift`,
`apps/api/src/routes/billing-reconciliation/admin/lift-mark.ts:45-51`, permission
`billing.liftReconciliationMark`). Send `expectedVersion` (the `reconciliation_mark.version` from
query 5), an empty `resolveWithoutRefund` and a `note` that cites the Linear issue
(`packages/schemas/src/api/billing/reconciliation-marks.schema.ts:43-49`).

### 8.2 An approved refund for exactly the call's amount

Only come here through the table in step 2. The refund must be `approved` when you read it just
before the write. A refund still in process never comes here. The call moved money. Record what
Mercado Pago did. Do not decline, and do not refund again.

1. **Get the owner's OK** on the Linear issue.
2. **Record the acceptance.** This mirrors what `completeCall` writes for an acceptance
   (`refund-provider-call.ts:80-106`): `refund_call.provider_refund_id` and an `ACCEPTED` result,
   in one statement.

   ```bash
   hops --target=prod psql --stdin <<'SQL'
   with call as (
       update refund_call rc
       set provider_refund_id = '<mercado_pago_refund_id>'
       where rc.idempotency_key = '<idempotency_key>'
         and rc.refund_id = '<refund_id>'
         and rc.provider_refund_id is null
         and exists (
             select 1 from idempotency_key k
             where k.key = rc.idempotency_key and k.result is null
         )
         and exists (
             select 1 from refund r
             where r.id = rc.refund_id and r.status = 'CONFIRMED'
         )
       returning rc.idempotency_key
   )
   update idempotency_key k
   set result = jsonb_build_object('outcome', 'ACCEPTED', 'providerRefundId', '<mercado_pago_refund_id>'),
       completed_at = now()
   from call
   where k.key = call.idempotency_key
   returning k.key, k.result, k.completed_at;
   SQL
   ```

   It must return exactly one row. A unique-violation on `uq_refund_call_provider_refund_id` means
   that Mercado Pago refund is already recorded on another call. Stop and escalate.
3. **Inspect again** (section 5). Add up the **Mercado Pago** amounts of every refund now recorded
   in the refund's `provider_refund_id` values, as the panel shows them. Do not use `refund_call.amount`:
   RF3 compares Mercado Pago's amounts (`execute-refund.service.ts:137-144`).
   - **Mercado Pago's amounts add up to `refund.amount`, all are `approved`, and no call is
     unanswered.** RF3 could now execute the refund, but it runs only on a NEW charge notice for
     that payment (`refund-execution-on-notice.ts:37-72`, `process-provider-notice.service.ts:272`).
     The notice for the refund itself was most likely already processed, while the call was still
     unanswered, and RF3 answered `AWAITING_PROVIDER_ANSWER` then (`execute-refund.service.ts:133`).
     So in general the refund stays `CONFIRMED`. «Retry with MP» does not trigger the read here
     either: after this write the refund has no unanswered call, so it answers
     `REFUND_HAS_NO_UNANSWERED_CALL`. Escalate on HOS-2402. Do not settle it with action 14: it would
     refuse (`REFUND_NOT_OPEN`), and the money is already back.
   - **They add up to less than `refund.amount`, or a refund accepted earlier by our own code is
     not `approved` yet.** It is now case A (section 7), or it waits for accreditation. Escalate.

**Held charge or mark.** Nothing changes until RF3 executes the refund. Until then the payment
stays hung and the mark stays open.

### 8.3 You cannot tell

Do not write anything, and escalate (section 9), when you see any of these:

- several Mercado Pago refunds with the same amount;
- a refund that could belong to more than one call;
- a refund whose amount differs from `refund_call.amount / 100`;
- a status you do not recognise;
- a payment that shows a chargeback.

### 8.4 A call older than 24 hours that the retry will not post: action 14 (HOS-2538)

Come here when «Retry with Mercado Pago» answered `REFUND_CALL_TOO_OLD_TO_RETRY`. No direct
write and no owner OK on the database are needed: it is an admin action with its own audit record.

1. **Read Mercado Pago (section 6).** The retry already read the charge and found no refund to
   bind the lost call to. Look at the panel anyway.
   - If the panel shows an `approved` refund for the call's amount that the read did not (a lagging
     read), do NOT refund again: wait and press **Retry with Mercado Pago** later, which binds it.
   - If the panel shows nothing for the call (or a `rejected`/`cancelled` one), the customer is
     still owed the money.
2. **Refund by hand from the Mercado Pago panel** what is still owed: the whole refund amount when
   no call of the refund was accepted, or the refund amount minus what Mercado Pago credited for
   the accepted calls.
3. **Record it with action 14.** In **Billing → Reconciliation → Refunds**, use **Settle the
   remainder of a refund from the MP panel** with the refund id, that amount and the new Mercado
   Pago refund id as the reference. It is
   `POST /api/v1/admin/billing-refunds/<refund_id>/settle-remainder` with
   `{"amount": <centavos>, "reference": "<Mercado Pago refund id>"}` and permission
   `billing.settleExternal` (`apps/api/src/routes/billing-refund/admin/settle-remainder.ts`).
   The refund closes `EXECUTED` for its full amount, as a panel refund (`executed_via = 'EXTERNAL'`,
   `external_channel = 'PROVIDER_PANEL'`, `external_ref` the reference, `settled_by` you), the
   payment is updated (P3/P4/P5) and the hung mark attachments resolve, exactly as after a normal
   execution. Every stale call is answered `SETTLED_EXTERNALLY` (result
   `{"outcome": "SETTLED_EXTERNALLY", "code": "SETTLED_EXTERNALLY", "panelReference": ...}`, no
   `provider_refund_id`): it is never resent and never bound to a Mercado Pago refund afterwards,
   and the reference you cited counts as cited, so no other call or refund can claim it.

What it refuses (all 409 unless noted; full list in `apps/api/docs/error-contract.md`, «Action 14
remainder settlement»):

| Answer | Why | Next |
|---|---|---|
| `REFUND_CALL_UNANSWERED` | A call of this refund was sent 24 hours ago or less (exactly 24 h included) | Use **Retry with Mercado Pago**: it may still post the call under its key |
| `REFUND_RETRY_IN_PROGRESS` | A **Retry with Mercado Pago** of this refund (or another settlement) is running; its POST may be in flight | Wait for its answer, read it, then settle again only if it did not close the refund |
| `OTHER_REFUND_CALL_UNANSWERED` | Another refund of the same payment has an unanswered call: the panel refund you cite could be that call's (HOS-2517) | Close that refund first |
| `UNCITED_PROVIDER_REFUND_ON_CHARGE` | The charge shows a refund for a stale call's amount that nothing of ours records: the lost call may have landed | **Retry with Mercado Pago**, which binds it. Do not refund again |
| `EXTERNAL_REFERENCE_ALREADY_SETTLED` | The reference is already another refund's panel reference or another call's provider refund | Check the reference; escalate if it is right |
| `REMAINDER_NOT_FOUND_AT_PROVIDER` (422) | The charge read shows no `approved` refund with that reference for exactly that amount | Check the reference and the amount, or wait until Mercado Pago approves the panel refund |
| `REMAINDER_AMOUNT_MISMATCH` (422) | The amount is not what is still owed; the message says what is | Use the amount in the message |

**Detecting money the settlement could not count.** If a Mercado Pago answer for a call reaches
us after this settlement answered it `SETTLED_EXTERNALLY` and names a refund id, that refund is
money returned on top of the panel refund you recorded. We do not write it (the call keeps its
`SETTLED_EXTERNALLY` answer), and it raises a Sentry alert: `UncountedRefundAnswerError`, reason
`ANSWER_FOR_SETTLED_EXTERNALLY_CALL`, with `refundCallKey`, `refundId`, `providerRefundId` (the
extra Mercado Pago refund) and `panelReference` (the one you cited). Treat it like 8.3: check both
refunds in the panel, write nothing, and escalate on the Linear issue; recovering a double refund
from the customer is a person's call.

## 9. Audit trail

Leave all three:

1. **The action's own record.**
   - Action 13 writes the `FAILED` status and bumps `refund.version`.
   - Action 14 writes the `EXECUTED` row with `settled_by`, `external_channel` and `external_ref`,
     and resolves `reconciliation_mark_payment.refund_id`.
   - Action 7 writes `reconciliation_mark.lifted_at` and `lifted_by`.
   - «Retry with MP» writes each call's answer (`idempotency_key.result`, `completed_at`,
     `refund_call.provider_refund_id`) and logs `AUDIT:BILLING_MUTATION` with
     `administrativeAction: 'ACC_13'`, `operation: 'RETRY_PROVIDER_CALLS'`, the per-key outcomes and
     RF3's `execution`.
   - The routes also log an `AUDIT:BILLING_MUTATION` entry with the actor and the request `note`
     (`settle-external.ts:108-131`, `lift-mark.ts:96`). That entry is a log line in the API logs
     (`apps/api/src/utils/audit-logger.ts:474-481`), not a database row. Read it with
     `hops logs api`.
2. **A note in the action.** Put the Linear issue id in the `note` of action 14 and action 7. The
   reconciliation mark has no note column. The lift `note` is the mark's note, and it lives in that
   audit log entry.
3. **A comment on the Linear issue** (HOS-2402, or the issue you were sent from) with:
   - environment, date and operator;
   - the section 5 output from before the change;
   - what Mercado Pago showed: payment id, refund ids, amounts and statuses;
   - the exact SQL you ran and the row it returned (the direct writes leave no audit log of their
     own, so this comment IS their audit trail);
   - the owner's OK;
   - the ids returned by actions 13, 14 and 7.

## 10. Calling an admin route without a screen

Some steps above have no button. The admin's API client sends the session cookie with
`credentials: 'include'` (`apps/admin/src/lib/api/client.ts:54-64`). So a signed-in admin can call
the route from the browser console of an admin tab:

```js
await fetch('<API base URL>/api/v1/admin/billing-refunds/<refund_id>/decline', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ declined: true })
}).then((r) => r.json());
```

`<API base URL>` is the API origin the admin is configured with. It is the same origin the admin's
own requests go to, which you can see in the browser's network tab. Every route still checks its
own permission and refuses an admin acting on their own account
(`ADMINISTRATIVE_ACTION_FORBIDDEN`).

## 11. When this note stops applying

HOS-2402 asks for an exit for both cases. Case A got one in HOS-2406 (the remainder settlement on
the refunds screen, `POST /api/v1/admin/billing-refunds/<refund_id>/settle-remainder`); section 7
still describes the manual path and should be rewritten to point there. Case B got its first one in
HOS-2516 («Retry with MP», section 8, step 0), and HOS-2538 closed the call the retry will no longer
post (action 14, section 8.4); the direct writes of 8.1 and 8.2 remain only for what neither can
close. Update or retire this note when the rest merges.
