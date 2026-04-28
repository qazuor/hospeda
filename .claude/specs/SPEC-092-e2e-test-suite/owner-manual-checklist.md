# Owner Manual Beta Checklist

> **Companion to**: `p0-execution-spec.md` and `p1-execution-spec.md`.
> **Scope**: only the items that **you** (qazuor) must execute by hand. Tildable, single source of truth for owner-driven validation.
> **Created**: 2026-04-27
> **Total items**: 50 (30 P0 + 20 P1)

---

## How to use

- Tildá cada item al completarlo. Cada item lleva 2-5 sub-checkboxes con los criterios de aceptación más críticos.
- **P0** son bloqueantes para abrir beta. **P1** son tolerables pero deseables; si fallás en prod, hay mitigación documentada en el spec correspondiente.
- Para steps detallados, preconditions, acceptance criteria completos, mitigation y escalation triggers, abrí el archivo correspondiente:
  - P0 details → `p0-execution-spec.md`
  - P1 details → `p1-execution-spec.md`
- El campo `[~Xmin]` es la estimación para una pasada del item.

## Recommended session split

Total estimated: ~14-18 hours of focused execution. Split into sessions so you don't burn out:

| Session | Duration | Focus |
|---------|---------:|-------|
| **S1: Setup + smoke** | ~3h | Q items (deploy, env, backup), legal pages, onboarding journey #96 |
| **S2: Billing lifecycle** | ~3h | F items + journey #97 with MP sandbox (5 scenarios) |
| **S3: Mobile** | ~2h | P76, P77 on real iOS + Android devices |
| **S4: Email validation** | ~2h | M items (signup verify, mailers SPEC-085, billing) — needs real inbox |
| **S5: Admin operations** | ~2h | H items + journey #100 (admin day) |
| **S6: Tourist contact + a11y** | ~2h | Journey #99, P1 a11y items |
| **S7: Resilience + cleanup** | ~2h | Journey #101 (failure recovery), P1 leftovers |

---

## P0 (30 items) — must complete before opening beta

### A. Auth & session

#### P0 #64: Signup email verification [~10min]

- [ ] Real Resend email arrives in test inbox (not spam)
- [ ] Verification link works once, replay rejected
- [ ] Account becomes active post-verification

#### P0 #49: Reflected and stored XSS (manual leg) [~15min]

- [ ] CSP browser DevTools shows no `unsafe-inline` in prod
- [ ] Inserted `<script>` payload in description renders as text, not executed

### C. Host onboarding (LA categoría más sensible)

#### P0 #11: End-to-end publication [~60min]

- [ ] Full 8-section form completable in one sitting from a fresh user
- [ ] Photos uploaded to Cloudinary (5+ pieces) without rate-limit issues
- [ ] HOST role auto-assigned, accommodation `lifecycleState=ACTIVE`
- [ ] Detail page renders publicly with JSON-LD valid
- [ ] Welcome + publication-success emails received

#### P0 #12: Autosave and draft persistence [~15min]

- [ ] Close tab mid-form, reopen 24h later, "Continue draft" banner appears with intact data
- [ ] Autosave indicator shows idle → saving → saved transitions

#### P0 #14: Photo upload Cloudinary (manual mobile leg) [~20min]

- [ ] Upload 5+ photos from real mobile device (camera + gallery)
- [ ] Thumbnails appear immediately
- [ ] Reorder works on touch
- [ ] Rate limit doesn't block normal use (<8 uploads/min)

#### P0 #15: Editing published property [~15min]

- [ ] Price change PATCHes successfully
- [ ] Detail page reflects change in <60s (ISR revalidation)
- [ ] Audit log captures the edit

### D. Public browsing

#### P0 #19: Accommodation detail page (manual leg) [~15min]

- [ ] Gallery, map, breadcrumbs, "other from host" carousel (SPEC-089), nearby events all render
- [ ] JSON-LD validates in Google Rich Results test
- [ ] Reviews block renders (or empty state if none)

### E. User account

#### P0 #26: Guest-owner messaging SPEC-085 (manual leg) [~30min]

- [ ] GUEST clicks "Contactar host" → conversation opens
- [ ] Host receives email notification within ~30s
- [ ] Host replies → guest receives email notification
- [ ] Both read and reply across devices

#### P0 #27: Conversation permissions [~15min]

- [ ] Only participants see the conversation (verify with 3rd USER who knows the ID — must 403)
- [ ] SYSTEM message renders on close
- [ ] Host email NOT exposed to guest in any UI

### F. Billing — money flow

#### P0 #28: Plan selection + MP checkout [~30min]

- [ ] `/suscriptores/planes` renders with prices from `@repo/billing`
- [ ] Checkout flow completes with MP test card APRO `5031 7557 3453 0604`
- [ ] Subscription becomes ACTIVE post-webhook
- [ ] Confirmation email arrives

#### P0 #30: Automatic renewal [~30min]

- [ ] Subscription renews on expiration date (use date-injection or wait for actual cycle)
- [ ] Webhook activates new period
- [ ] No feature downtime during transition

#### P0 #31: Cancellation + refund [~30min]

- [ ] Host cancels from `/mi-cuenta/suscripcion`, retains access until period end
- [ ] Admin issues refund from MP dashboard
- [ ] Webhook fires compensating event in Hospeda
- [ ] Audit log captures refund with `actorId` + `targetSubscriptionId`

### H. Admin user/billing

#### P0 #39: User management — list, search, role assign [~15min]

- [ ] Admin can list users with filters (role, status, search)
- [ ] Role assignment HOST/ADMIN works, audit log captures change
- [ ] Suspend/unsuspend works without leaking session

#### P0 #40: Billing dashboard admin [~30min]

- [ ] Subscriptions list with filters, customer-addons, metrics, sponsorships pages all load (SPEC-049 already covered)
- [ ] No HTTP 500s in any tab

### L. i18n & SEO

#### P0 #63: Sitemap.xml and robots.txt [~10min]

- [ ] `/sitemap.xml` lists all indexable pages, excludes drafts/deleted
- [ ] `/robots.txt` blocks `/admin/` and `/api/`
- [ ] Submit sitemap to Google Search Console; validate no errors

### M. Transactional email

#### P0 #65: SPEC-085 messaging mailers [~30min]

- [ ] Notification on new message: subject + body localized in es/en/pt
- [ ] Reply notification works in both directions
- [ ] Opt-out link works (if implemented)

#### P0 #66: Billing mailers [~30min]

- [ ] Payment confirmation email after MP webhook
- [ ] Renewal reminder before expiration
- [ ] Refund-issued email with correct amounts and dates

### P. Browser / device matrix

#### P0 #76: Mobile iOS Safari [~60min]

- [ ] Home, listings, detail page render correctly on iPhone (real device)
- [ ] Publish form completable from mobile (8 sections, photo upload via camera)
- [ ] No `vh` glitches, no sticky-header overlap, no scroll-restoration bugs
- [ ] Cloudinary picture srcset serves correct sizes

#### P0 #77: Mobile Android Chrome [~60min]

- [ ] Same as #76 but on Android (real device, varied viewport)
- [ ] Native camera upload works for photos
- [ ] Touch interactions on carousels and forms work

### Q. Operations

#### P0 #80: Vercel deploy — preview vs prod [~30min]

- [ ] PR creates preview deploy with preview env vars
- [ ] Prod only deploys from `main`
- [ ] Env vars correctly scoped (Preview vs Production) for: Resend, MP, Cloudinary, Sentry, Better Auth, Redis URL
- [ ] Rollback button works

#### P0 #83: DB backup and restore [~30min]

- [ ] `pg_dump` from staging produces complete backup
- [ ] Restore to a fresh DB succeeds with table counts matching
- [ ] Restore time documented in runbook
- [ ] Frequency + retention policy decided and documented

#### P0 #84: Deploy rollback [~30min]

- [ ] Rollback to previous Vercel deploy works in <5min
- [ ] Forward-only DB migrations remain compatible (verify last 2-3 migrations)
- [ ] Runbook documented with screenshots

### R. Audit / compliance

#### P0 #90: Cookie consent [~10min]

- [ ] Banner appears on first visit
- [ ] Granular opt-in: necessary / analytics / marketing
- [ ] Preferences persist (cookie or localStorage)
- [ ] No Sentry/analytics fires until consent

#### P0 #91: Privacy + terms pages [~10min]

- [ ] `/legal/privacidad`, `/legal/terminos`, `/legal/cookies` exist
- [ ] Last-update date visible
- [ ] Translated to es/en/pt (or single source if beta only `es`)
- [ ] Linked from footer
- [ ] **CONFIRM cookie page is not missing** (qa-engineer flagged this as potentially absent)

#### P0 #92: PII in URLs / referrers [~10min]

- [ ] No email, token, or private ID exposed in query params
- [ ] Reset tokens in path are single-use
- [ ] Headers `Referrer-Policy: strict-origin-when-cross-origin` set

### T. End-to-end journeys (the highest-value tests)

#### P0 #96: Journey "Host discovers Hospeda and publishes" [~90min]

The beta star. Run end-to-end without assistance.

- [ ] Google search → Hospeda visible (validate `site:hospeda.com.ar` and target queries)
- [ ] Landing → CTA `/publicar` with LCP <2.5s mobile
- [ ] Inline signup, email verification, no friction
- [ ] 30-40min form completion in one sitting
- [ ] Trial activates without card; HOST role assigned
- [ ] Detail page public; can be shared via link
- [ ] Tourist searches and finds the property in coherent order
- [ ] 0 Sentry errors during the full flow

#### P0 #97: Journey "Host trial → pays → renews → addon → cancels" [~90min staged]

- [ ] Trial countdown email at day 25
- [ ] Plan selection + MP APRO checkout
- [ ] Auto-renewal works (with date injection or natural cycle)
- [ ] Addon purchase activates entitlement; expiration revokes
- [ ] Cancel retains access until period end
- [ ] Audit log captures every transition

#### P0 #99: Journey "Tourist searches, expresses interest, contacts, returns" [~60min]

- [ ] Google → detail page (SEO + JSON-LD)
- [ ] Bookmark with login flow (minimal friction)
- [ ] Conversation opened, host emailed, host replies, guest emailed
- [ ] Conversation auto-closes per cron policy
- [ ] 3 months later: `/mi-cuenta/conversaciones` lists archived conversation with history
- [ ] No email leak between guest and host

#### P0 #100: Journey "Admin's typical operations day" [~60min]

- [ ] Admin login (with 2FA if enabled, or flag gap)
- [ ] Dashboard shows pending moderation, day's payments, addons expiring, reported conversations, recent Sentry errors
- [ ] Moderate, refund, role-reassign, export CSV — each leaves audit log entry
- [ ] Granular permissions: non-financial admin CANNOT refund (test with restricted account)

#### P0 #101: Journey "Failure recovery — something breaks in prod" [~90min chaos light]

- [ ] MP webhook drops 5min → MP retries → no double-charge
- [ ] Cloudinary slow → upload retries → clear UX message after 3 fails
- [ ] Redis down → rate limiter falls back fail-open with warn log
- [ ] Email provider down → mailers queued + retry, no silent loss
- [ ] Vercel prod deploy fails → automatic/manual rollback documented
- [ ] No white screens or stack traces exposed to users

---

## P1 (20 items) — desirable, with documented mitigation

### A. Auth & session (P1)

#### P1 #5: Cross-app session [~10min]

- [ ] Cookie scope between admin and web is intentional and documented
- [ ] Logout in one app invalidates session in other (or explicitly doesn't, per design)

#### P1 #6: Account deletion / GDPR [~15min walkthrough]

- [ ] Manual deletion path runbook documented
- [ ] Anonymization works on reviews and conversations
- [ ] Audit log captures `USER_DELETED` entry

### C. Host onboarding (P1)

#### P1 #16: Unpublish / republish / archive [~15min]

- [ ] `lifecycleState` transitions ACTIVE ↔ INACTIVE ↔ ARCHIVED visible to host
- [ ] Public visibility correctly toggles per state
- [ ] Archived properties are not searchable by tourists

### E. User account (P1)

#### P1 #25: Reviews / comments [~15min]

- [ ] User can leave review with rating 1-5 on visited accommodation
- [ ] Moderation queue or auto-publish policy documented
- [ ] Review count + average rating updates on detail page

### F. Billing (P1)

#### P1 #32: Addon purchase [~30min]

- [ ] Addon purchase via MP completes
- [ ] Entitlement activates immediately, visible on detail page
- [ ] Expiration cron revokes entitlement on schedule

### G. Admin moderation (P1)

#### P1 #35: Approve/reject pending accommodation [~10min]

- [ ] If publication is gated, queue + approve/reject works
- [ ] Host receives email notification on decision
- [ ] (If publication is auto, mark this gap explicitly)

#### P1 #37: Hard delete [~5min]

- [ ] Confirmation modal required
- [ ] M2M cascade (amenities, bookmarks, reviews) verified
- [ ] Restricted to SUPER_ADMIN

#### P1 #38: Batch operations [~10min]

- [ ] Bulk archive/delete from admin list works
- [ ] Atomic transaction (all-or-nothing)
- [ ] Audit log captures bulk action

### H. Admin (P1)

#### P1 #41: Sponsorships and promo codes admin [~30min]

- [ ] CRUD of sponsorships, levels, packages works
- [ ] Promo codes filter active/expired correctly
- [ ] Pages already validated post-fix; re-test E2E

#### P1 #42: Exchange rates admin [~10min]

- [ ] View/edit ARS/USD/EUR/BRL rates
- [ ] Manual refresh works
- [ ] Fallback if external source down

### I. Crons (P1)

#### P1 #45: Host onboarding reminder cron [~10min]

- [ ] User with incomplete draft receives reminder email after N days
- [ ] Reminder doesn't send to completed/abandoned users

### K. Performance (P1)

#### P1 #57: ISR cache hit/miss [~10min]

- [ ] Vercel response headers show cache HIT after first warm-up
- [ ] After admin edit, revalidation triggers, next request shows fresh data
- [ ] Hit ratio observable in Vercel dashboard

### N. Edge cases (P1)

#### P1 #68: Concurrent edit (host + admin) [~10min]

- [ ] Two tabs editing same property — last-wins / optimistic lock policy clear
- [ ] No data corruption, no silent overwrites
- [ ] User sees a coherent message, not stack trace

#### P1 #69: Network failure mid-form [~10min]

- [ ] Drop connection during autosave → retry kicks in
- [ ] No data loss visible to user
- [ ] User-facing message explains the state

### O. Accessibility (P1)

#### P1 #71: Keyboard navigation [~30min]

- [ ] Tab/Shift+Tab traverses entire app without losing focus
- [ ] Focus ring visible on all interactives
- [ ] Escape closes modals; Enter activates buttons
- [ ] Focus traps only inside modals

#### P1 #74: Accessible forms [~30min]

- [ ] Each input has associated `<label>`
- [ ] Errors with `aria-describedby` announced by screen reader
- [ ] Required marked with `aria-required`
- [ ] Validation not by color only (also text/icon)

### P. Browser matrix (P1)

#### P1 #78: Desktop Chrome / Firefox / Safari (admin) [~30min]

- [ ] Admin tables, drag-and-drop, side panels work in 3 browsers
- [ ] No Safari grid-layout breakage on accommodations list

### R. Audit / compliance (P1)

#### P1 #88: GDPR right of access [~15min]

- [ ] User can request data export via support email defined in `/legal/privacidad`
- [ ] Manual export runbook documented
- [ ] Export includes: account, accommodations, reviews, conversations, payments

#### P1 #89: GDPR right to be forgotten [~15min]

- [ ] Manual deletion runbook documented (links to #6 spec)
- [ ] Anonymization vs hard-delete policy decided per data type
- [ ] Audit log captures every deletion

### S. Seed data (P1)

#### P1 #94: Seed data makes visual sense [~30min]

- [ ] Walk the web with seed data: descriptions realistic, no broken images, prices coherent
- [ ] Events on future dates
- [ ] Home doesn't look like a "demo of test data"
- [ ] **NOTE**: qa-engineer flagged this as potential P0 reputational — broken images on first visit destroys credibility

---

## Status tracking

After each session, update the table below. Aim for 100% P0 before opening beta.

| Session | Date | Items completed | Notes |
|---------|------|-----------------|-------|
| S1 | | | |
| S2 | | | |
| S3 | | | |
| S4 | | | |
| S5 | | | |
| S6 | | | |
| S7 | | | |

## Aggregate progress

- [ ] All 30 P0 items checked → **beta opening unblocked**
- [ ] At least 15 of 20 P1 items checked → recommended baseline
- [ ] All `mitigation` runbooks documented for the P1 items NOT checked

## Final go/no-go

- [ ] DoD items 1-12 of `BEFORE_BETA_TESTING.md` all checked
- [ ] Sentry confirmed capturing prod errors with `release` tag (P0 #58 covered by agent)
- [ ] `apps/e2e` exists OR documented decision to skip CI suite for first beta wave
- [ ] Owner sign-off: Qazuor
