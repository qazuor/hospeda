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

**Executed 2026-08-12 against the worktree environment (web :4423), as
`host-basico@local.test`. Two defects were found, fixed, and re-measured in
the browser. All four now pass.**

- [x] **7.1 PASS** The star rating is operable entirely by keyboard, and
      announces the selected value to a screen reader.
      *Measured*: five native radios sharing one `name` inside
      `<fieldset>`/`<legend>`. Focusing the first and pressing `→` three times
      moved the selection to 4 and focus followed it; the checked radio's
      accessible name is "4 estrellas". All FIVE groups in the dialog (overall,
      benefit yes/no, and the three breakdown dimensions) are well-formed, and
      all 22 radios have an accessible name — the two that carry no `aria-label`
      get theirs from the wrapping `<label>` ("Sí" / "No").
- [x] **7.2 PASS** (after the fix) The confirmation dialog traps focus, Escape
      closes it, and focus returns to whatever opened it.
      *Measured*: the dialog is a genuine `:modal` (opened with `showModal()`),
      so the trap is browser-enforced: after five Tabs — more than its three
      focusable elements — focus was still inside, cycled back to "Volver".
      Escape closes it. Focus originally landed on `<body>`; **fixed** in
      `5e2be60a2`, and re-verified through the real keyboard path (focus the
      trigger → Enter → Escape → focus is back on the trigger) on BOTH dialogs.
      The trap was re-checked after the change and still holds. See finding A.
- [x] **7.3 PASS** The pending-count badge announces its number, rather than
      reading as a bare decoration.
      *Measured*: `role="status"` (a live region, so it announces when the count
      changes) plus an `aria-label` carrying the meaning while the glyph is a
      bare numeral. Both grammatical numbers were exercised: with one row
      pending it reads "1 uso espera tu confirmación", with two "2 usos esperan
      tu confirmación" — the `tPlural` wiring the component's own comment says
      matters is real.
- [x] **7.4 PASS** (after the fix) The four usage-status badges meet AA contrast
      in both themes.
      *Measured* (composited, since every badge background is semi-transparent —
      the ratio cannot be read off the CSS):
      | Badge | Light | Dark (before) | Dark (after `ce5bdf0a9`) |
      |---|---|---|---|
      | Pendiente | 6.51 ✅ | **1.45 ❌** | 7.35 ✅ |
      | Confirmado | 5.96 ✅ | **1.56 ❌** | 7.80 ✅ |
      | Rechazado | 5.36 ✅ | **2.20 ❌** | 6.95 ✅ |
      | Vencido | 6.33 ✅ | **4.19 ❌** | 6.97 ✅ |
      At 12px/600 these are normal text, so the bar is 4.5. All four originally
      failed in dark theme, three of them unreadably. Light is unchanged by the
      fix — the theme that already passed did not move. See finding B.

### Finding A — the dialogs do not restore focus on close

Both `BenefitUsagesPanel.client.tsx` and `ReviewFormDialog.client.tsx` hand-roll
a native `<dialog>` + `showModal()`. That choice buys a better trap than a JS one
(the browser makes the background inert), so it is not simply wrong — but it also
bypasses `components/shared/ui/Dialog.client.tsx`, which already solves the other
half:

```ts
const previouslyFocused = document.activeElement as HTMLElement | null;
// …
return () => { previouslyFocused?.focus?.(); };
```

A keyboard user who opens a dialog and presses Escape is dropped at the top of
the document and has to Tab all the way back. WCAG 2.4.3.

**Fixed** by saving `document.activeElement` before `showModal()` and restoring
it from the effect's cleanup, guarded on `isConnected` for the case the
trigger's own row re-rendered away while the dialog was open.

### Finding B — the status badges have no dark-theme colours

`BenefitUsagesPanel.module.css` and `ProviderPanels.module.css` hard-code
`color: oklch(0.45 …)` — a dark foreground chosen for a light surface — with no
`[data-theme="dark"]` override. `.badgeExpired` is the only one built from tokens
(`--core-muted-foreground`), which is why it scores highest (4.19) and still
fails.

The file header claims "every value is a design token", and for these four it is
not true.

**Fixed** by giving each badge a `[data-theme="dark"]` pair that inverts the
lightness and keeps the hue, so a badge still reads as the same colour to
somebody who learned it in the other theme.

---

## Sign-off

| Date | Executor | Result | Notes |
|---|---|---|---|
| 2026-08-12 | agent (worktree :4423) | §7 only — 4/4 pass after 2 fixes | Findings A and B found, fixed and re-measured. Sections 1-6 NOT executed. |

> Only section 7 was run. Sections 1-6 remain open: they need a seeded
> environment with real providers, and the worktree database ships with users
> only. The rows behind §7 were inserted by hand for the audit and deleted
> afterwards.
