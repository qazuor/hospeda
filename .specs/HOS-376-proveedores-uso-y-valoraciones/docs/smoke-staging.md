# HOS-376 — Staging smoke checklist

Only what a laptop cannot answer. Two things qualify: **mail that actually
leaves** (Brevo, real templates, real inboxes) and **time actually passing**
(the three crons, on their real schedule, against rows that really aged).

Everything else — role gates, ownership, the state machine, the self-*
refusals — belongs in [`smoke-local.md`](./smoke-local.md) and should already
be signed off there. Do not re-run it here.

Target: `https://staging.hospeda.com.ar`.

---

## Before starting

- [ ] **0.1** Confirm the web and API deployments are on the SAME commit. This
      bit us once already on this spec: staging served a UI whose endpoints did
      not exist in the API it was talking to, and the smoke could not start
      until both were redeployed.
- [ ] **0.2** Confirm `HOSPEDA_REDIS_URL` is set on `hospeda-api-staging`.
      Without it the notification retry queue is a no-op, so a transient Brevo
      failure is lost silently and section 1 measures nothing.
- [ ] **0.3** Have two real mailboxes ready, one per side of a pair.

---

## 1 · Mail that actually leaves (Brevo)

`sendNotification` swallows its errors by design, so **a mail that never
arrives produces no error anywhere**. The only way to know it left is to look
in the inbox. That is the entire reason this section is not local.

- [ ] **1.1** Declare a usage provider-side. The host receives the confirmation
      request. Check it in a real client, not just the Brevo dashboard:
      - [ ] The provider's name renders (not a uuid, not an empty string).
      - [ ] The date of service renders in the reader's locale.
      - [ ] The confirmation link resolves to the right usage, while logged out,
            and lands on a login that returns to it afterwards.
- [ ] **1.2** Declare through the **email channel** naming a host by address.
      Confirm the host receives it and that the provider's view never shows the
      email back to them.
- [ ] **1.3** Reject a usage. Confirm what the declarant receives — and confirm
      that a rejection WITHOUT a note does not produce a mail with an empty
      quoted section.
- [ ] **1.4** Publish a review, then have the provider reply. Confirm the host
      is told once the reply is APPROVED — and **not** at the moment the
      provider wrote it, which would leak an unmoderated reply by mail.
- [ ] **1.5** Check the Brevo suppression list afterwards. A bounce here is a
      wrong-address bug, not a mail-server problem.

## 2 · The three crons, on real time

Local runs can only invoke these by hand, which proves the body and nothing
about the schedule. Here they must fire on their own.

### 2.1 Expiry (30 days)

- [ ] **2.1.a** Age a PENDING usage past its window (adjust `expires_at`
      directly on staging — the point is the cron's reaction, not how the row
      got old). After the cron's next run, the row is `EXPIRED`.
- [ ] **2.1.b** **NOBODY IS NOTIFIED.** Verify no mail went to either party.
      Expiry is the outcome of silence, and silence is not an accusation — a
      mail announcing that nothing happened turns a neutral timeout into a
      reproach.
- [ ] **2.1.c** The provider's public counters do **not** move. Only CONFIRMED
      rows count, so an expiry cannot change a number.
- [ ] **2.1.d** A row one day short of its window is still `PENDING` after the
      same run.

### 2.2 Reminder (idempotency — AC-8)

- [ ] **2.2.a** Age a PENDING usage into the reminder window. The next run sends
      exactly one nudge, and stamps `reminder_sent_at`.
- [ ] **2.2.b** **Let it run again the following day.** No second mail. This is
      the one that cannot be faked locally: the row stays old enough forever, so
      without the stamp the same usage is chased every morning until it expires.
      One nudge quietly becomes twenty, and only real elapsed time shows it.
- [ ] **2.2.c** A usage confirmed or rejected before the window is never chased.

### 2.3 Reconciliation (AC-29)

- [ ] **2.3.a** Corrupt one provider's `confirmed_uses_count` by hand on
      staging.
- [ ] **2.3.b** After the weekly run, the counter is corrected **and the run
      reported it**. A silent correction is the failure mode here: the report is
      the evidence that some write path has a hole, which is the only reason
      this cron exists.
- [ ] **2.3.c** A healthy week corrects nothing and warns about nothing.

## 3 · Rate limits under a real proxy

Local requests do not traverse Cloudflare, so the per-user keying is worth
re-checking where the real headers are.

- [ ] **3.1** Exceed the email-channel budget. 429, with the retry hint.
- [ ] **3.2** Immediately afterwards, the **selector** channel still works for
      the same provider. The email fallback is the spray vector and is budgeted
      far more tightly on purpose; a single shared budget would have to be set
      for the attacker and would punish a plumber catching up on his week.
- [ ] **3.3** A second provider is unaffected by the first one's exhaustion.

## 4 · Public surface and caching

- [ ] **4.1** A newly confirmed usage moves the provider's public numbers on the
      directory card and the detail page. If it does not, check whether the page
      is being served from edge cache before filing a bug.
- [ ] **4.2** An APPROVED review appears publicly; a PENDING one does not, and
      does not contribute to the average.
- [ ] **4.3** A revoked provider's page answers correctly rather than 500ing,
      and declaring against it answers 422 `PROVIDER_REVOKED`.

---

## Known findings

File anything found here in Linear with a dated `SMOKE-DD-MM` label, in batch,
rather than fixing it inline mid-run.

| Date | Finding | Linear |
|---|---|---|
| | | |

---

## Sign-off

| Date | Executor | PR | Result | Notes |
|---|---|---|---|---|
| | | | | |
