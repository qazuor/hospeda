# HOS-376 — Local smoke checklist

What can be verified on a laptop, with no MercadoPago and no real mail. Covers
the role gates, the ownership rules, and the two self-* refusals — everything
whose truth is decided by a `WHERE` clause or an `if`, rather than by a third
party or by the passage of time.

Run `pnpm db:fresh-dev` first. Every account below is `<slug>@local.test` with
password `Password123!`, seeded ready to use (no onboarding friction).

---

## READ THIS FIRST — the mails will not arrive, and nothing is broken

`sendNotification` is **fire-and-forget and swallows its errors** (spec R-10),
and its retry queue is a no-op without `HOSPEDA_REDIS_URL`. So on a default
local environment:

- The host's confirmation request never lands in an inbox.
- The reminder cron reports having sent mail that went nowhere.
- **No error appears anywhere** — not in the API log, not in the response.

That is the designed behaviour, not a failure to reproduce. A declaration whose
mail silently vanished is still a correct declaration: the row exists, the
badge counts it, and the counterpart can resolve it from `/mi-cuenta`. Verify
the FLOW through the UI and the database; verify the MAIL on staging.

Do not "fix" a missing local mail by making `sendNotification` throw. It is
fire-and-forget on purpose — a benefit usage must not fail because a mail
server did.

---

## The accounts

| Account | Why it exists here |
|---|---|
| `host-basico@local.test` | An ordinary host. Declares by QR, confirms, reviews. |
| `host-provider@local.test` | **The dual-role account** — owns accommodations AND the `plomeria-litoral` listing. The only account that can exercise AC-16 and AC-17. |
| `tourist-free@local.test` | Holds no `HOST_TRADE_VIEW`. The negative case for every host gate. |
| `admin@hospeda.com` | The moderation and suspension queues. |

---

## 1 · Role gates

- [ ] **1.1** As `tourist-free`, open a provider's page and scan/visit its QR
      landing. Declaring is refused (403). A tourist is not a host, and the QR
      is the weakly-verified channel — this gate is the only thing standing
      between a passer-by who saw a sticker on a van and a benefit usage.
- [ ] **1.2** As `host-basico`, the same declaration succeeds and the row lands
      `PENDING`.
- [ ] **1.3** As `tourist-free`, attempt to write a review on a provider.
      Refused — reviewing requires `HOST_TRADE_REVIEW_CREATE`, which only the
      `HOST` role carries.

## 2 · Ownership

- [ ] **2.1** As `host-basico` (who owns no listing), open
      `/mi-cuenta` → the provider panel. There is no provider section, and
      hitting its URL directly answers 404 rather than an empty panel.
- [ ] **2.2** As `host-provider`, the provider panel loads with the
      `plomeria-litoral` listing.
- [ ] **2.3** As `host-provider`, the linked-hosts selector lists **only** hosts
      with a CONFIRMED usage on that listing. A host with a merely PENDING usage
      must not appear — the selector must never expose somebody the provider has
      not already served.
- [ ] **2.4** Confirm the selector shows a display name and **no email address**,
      including for a host who has one on file.

## 3 · The two self-* refusals

These are the pair the dual-role account exists for. Both must be checked with
`host-provider@local.test`, and neither can be reproduced with any other seeded
account.

- [ ] **3.1 (AC-17)** As `host-provider`, try to review **your own**
      `plomeria-litoral` listing. Refused with `SELF_REVIEW_FORBIDDEN` — and it
      stays refused even after arranging a CONFIRMED usage on that pair, which
      is the whole point: the refusal is about identity, not about eligibility.
- [ ] **3.2 (AC-16)** As the same account, review a **different** provider.
      Succeeds. Being a provider does not cost you your voice as a host.
- [ ] **3.3 (AC-6)** Declare a usage as `host-provider` through your own
      listing's selector, then try to confirm it yourself. Answers **404, not
      403** — the declarant may never confirm their own declaration, and the
      answer must not admit that the row exists.
- [ ] **3.4** As `host-provider`, try to declare a usage naming **yourself** as
      the host. Refused with `SELF_USAGE_FORBIDDEN`. Left open, this creates a
      row NEITHER side can resolve.

## 4 · The state machine

- [ ] **4.1** Declare (provider side) → confirm (host side). The provider's
      public counters move: `confirmedUsesCount` and `distinctHostsCount`.
- [ ] **4.2** Declare a second usage for the **same** pair while one is still
      PENDING. Refused with 409 — one open declaration per pair.
- [ ] **4.3** Reject a usage **without a note**. Accepted. Refusing has to stay
      cheap; it is the only control keeping the public counters honest.
- [ ] **4.4** After that rejection, the provider cannot re-declare on that host.
- [ ] **4.5** Undo the rejection **as the rejector**. It returns to PENDING and
      the block lifts.
- [ ] **4.6** Try the undo as the OTHER party. Answers 404 — reversal belongs to
      whoever said no.
- [ ] **4.7** Confirm an already-CONFIRMED usage. Refused (400), and no counter
      moves.

## 5 · Reviews and the reply

- [ ] **5.1** A review is impossible without a CONFIRMED usage on that pair
      (`NO_CONFIRMED_USAGE`).
- [ ] **5.2** With one, the review publishes immediately (APPROVED by default).
- [ ] **5.3** As the provider, reply to it. The reply does **not** appear
      publicly — it is PENDING until a human approves it. This is the asymmetry;
      it is not a bug.
- [ ] **5.4** As `admin`, approve the reply. It becomes visible.
- [ ] **5.5 (AC-22)** As the host, **edit** the review. The reply SURVIVES, and
      is now marked as answering an earlier version. Confirm the provider has no
      way to clear that mark.
- [ ] **5.6 (AC-19)** Write a review whose text trips the moderation gate. It is
      held PENDING despite the APPROVED default, and does not count towards the
      public average until approved.

## 6 · Admin

- [ ] **6.1** As `admin`, the usage audit list names **both** parties — provider
      and host — not two uuids. "40 usos, 2 anfitriones" is only a pattern if
      the hosts are legible as hosts.
- [ ] **6.2** Suspend a provider's ability to declare. A reason is **required**.
- [ ] **6.3** The suspended provider can no longer declare through **any**
      channel, the host's QR included.
- [ ] **6.4** Lift the suspension. **No reason is asked for** — the endpoint
      does not accept one. Confirm the lift records which admin did it.
- [ ] **6.5** Moderate a review to REJECTED. The provider's `reviewsCount` and
      `averageRating` drop accordingly, in the same operation.

## 7 · Accessibility (T-067 — browser only, not vitest)

jsdom cannot test any of these. They need a real browser and a keyboard.

- [ ] **7.1** The star rating is operable entirely by keyboard, and announces the
      selected value to a screen reader.
- [ ] **7.2** The confirmation dialog traps focus, and Escape closes it and
      returns focus to whatever opened it.
- [ ] **7.3** The pending-count badge announces its number, rather than reading
      as a bare decoration.
- [ ] **7.4** The four usage-status badges meet AA contrast in both themes.

---

## Sign-off

| Date | Executor | Result | Notes |
|---|---|---|---|
| | | | |
