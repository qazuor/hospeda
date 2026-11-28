---
title: "Direct emails from the admin: one-to-one mails with the Hospeda identity"
linear: HOS-2685
statusSource: linear
created: 2026-11-28
type: feature
smoke:
  - staging
smokeLabels:
  - status-needs-smoke-staging
areas:
  - admin
  - api
  - db
  - web
---

# Direct emails from the admin

## 1. Summary

Admins can write an email in the admin panel, type one or more recipient
addresses by hand, and send it one-to-one with the same visual identity as the
newsletter (the `@repo/email` user layout: header, blocks, buttons, footer,
dark mode). Typical uses: proposing a commercial agreement to a company, or
sending information to a prospective customer.

The module is separate from the newsletter. The newsletter sends marketing to
a subscriber audience; a direct email goes to addresses the admin types, one
message per recipient, and replies go back to the admin who sent it.

Follow-up: [HOS-2686](https://linear.app/hospeda-beta/issue/HOS-2686) brings
the same emails to the CRM. Templates must not drift between the two
projects, so templates are stored as data behind an API (section 6), not as
code that only Hospeda can render.

## 2. Owner decisions (2026-11-28)

| # | Decision |
|---|----------|
| D1 | **Sender: own subdomain.** The From address comes from a new env var (`HOSPEDA_DIRECT_EMAIL_FROM_EMAIL`), intended to be an address on a dedicated subdomain (for example `contacto@comercial.hospeda.com.ar`) so a cold email marked as spam does not hurt the reputation of transactional and newsletter mail. Until the owner registers the subdomain in Brevo and adds its SPF/DKIM records in Cloudflare, the var is unset and the module falls back to the current sender (`getEmailSender()`). |
| D2 | **Opt-out: link plus suppression list.** Every direct email carries a footer line "No quiero recibir más correos de Hospeda". The link adds the address to a suppression list, and the admin can no longer send to it (the compose form flags it as soon as it is typed). This satisfies Ley 25.326 art. 27 and helps deliverability. |
| D3 | **Who and where replies go.** New permissions `DIRECT_EMAIL_VIEW`, `DIRECT_EMAIL_SEND` and `DIRECT_EMAIL_TEMPLATE_WRITE`, seeded to SUPER_ADMIN and ADMIN only. Reply-To is the sending admin's own email, and the From name is "<admin first name> de Hospeda". |

## 3. Scope

### In scope

- Compose screen: subject, body (TipTap), recipients (one or more addresses,
  max 20 per send), optional template to start from.
- Real-layout preview (server-rendered HTML, the same render as the sent mail).
- Test send to the admin's own address (or another), marked `[PRUEBA]` like the
  newsletter test send.
- Send: one message per recipient, synchronous, with a per-recipient result.
- History: list of sent messages and a detail page with each recipient's status
  (sent, failed, delivered, opened, bounced).
- Templates: create, edit, delete (soft) and use as a starting point.
- Suppression list: public opt-out link, admin view, manual add and remove.
- i18n es/en/pt for every admin string and the public opt-out page.

### Out of scope

- Dynamic blocks (newsletter-only; the editor hides them here).
- Attachments.
- Scheduling and queues (sends are small and synchronous).
- Contacts or CRM data (HOS-2686).
- Per-recipient personalization variables (`{{name}}`). Possible follow-up.

## 4. Acceptance criteria

- **AC-1 Compose and send.** Given an admin with `DIRECT_EMAIL_SEND`, when they
  enter a subject, a body and 1 to 20 valid addresses and confirm, then each
  address receives its own message (no other recipient visible), with the user
  layout, the From and Reply-To from D1/D3, and the opt-out footer line.
- **AC-2 Per-recipient result.** The send answers with one result per
  recipient (`sent` or `failed` with a reason), and the history shows the same.
  A failure on one recipient does not stop the others.
- **AC-3 Validation.** Invalid addresses, duplicates (case-insensitive), more
  than 20 recipients, an empty subject or an empty body are rejected with 400
  before anything is sent.
- **AC-4 Suppression blocks the send.** A suppressed address is flagged in the
  compose form, and the API refuses to send to it: it is reported as
  `suppressed` and skipped, while the rest of the recipients are sent.
- **AC-5 Opt-out link.** The footer link opens a public page that, after one
  confirmation click, adds the address to the suppression list. The link is
  signed (HMAC), so it cannot be forged for another address. Visiting it twice
  is harmless.
- **AC-6 Test send.** A test send goes to one address (default: the admin's),
  with `[PRUEBA]` in the subject and the warning banner, creates no history
  row, and ignores the suppression list only for the admin's own address.
- **AC-7 Preview.** The preview shows the exact HTML the recipient will get
  (same layout, dark-mode block included), rendered by the API.
- **AC-8 Templates.** An admin with `DIRECT_EMAIL_TEMPLATE_WRITE` can create,
  edit and delete templates (name, subject, body). Composing from a template
  copies its subject and body; later edits to the template do not change mails
  already sent.
- **AC-9 Delivery tracking.** Brevo webhook events (`delivered`, `opened`,
  `hard_bounce`, `soft_bounce`) update the matching recipient row by provider
  message id. A hard bounce also adds the address to the suppression list.
- **AC-10 Permissions.** Without `DIRECT_EMAIL_VIEW` the module is hidden and
  its routes answer 403. Sending needs `DIRECT_EMAIL_SEND`; template writes need
  `DIRECT_EMAIL_TEMPLATE_WRITE`. EDITOR has none of them.
- **AC-11 Sender fallback.** With `HOSPEDA_DIRECT_EMAIL_FROM_EMAIL` unset, the
  mail goes out with the current sender (`getEmailSender()`), still with the
  admin's Reply-To and the "<name> de Hospeda" From name.
- **AC-12 Sanitized body.** The body goes through `renderTiptapEmailContent`
  (sanitize-html allowlist); `javascript:` links and raw HTML are stripped.

## 5. Data model (new tables, singular names)

- `direct_email_message`: `id`, `subject`, `body_json` (jsonb, TipTap),
  `template_id` (nullable FK), `sent_by` (FK user), `from_email`,
  `reply_to_email`, `created_at`, audit columns.
- `direct_email_recipient`: `id`, `message_id` (FK, cascade), `email`
  (lowercased), `status` (`sent` | `failed` | `suppressed` | `delivered` |
  `opened` | `bounced`), `provider_message_id` (nullable, indexed),
  `error_message`, `sent_at`, `delivered_at`, `opened_at`, `bounced_at`.
- `direct_email_template`: `id`, `name`, `subject`, `body_json`, `created_by`,
  `updated_by`, timestamps, `deleted_at` (soft delete).
- `direct_email_suppression`: `id`, `email` (unique, lowercased), `reason`
  (`opt_out` | `hard_bounce` | `manual`), `created_at`, `created_by`
  (nullable).

Permissions: three `permission_enum` values plus a `DIRECT_EMAIL` category,
through a hand-written `ALTER TYPE ... ADD VALUE` migration, and seed lines for
SUPER_ADMIN and ADMIN.

## 6. API (admin tier unless noted)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/admin/direct-emails` | VIEW (list, paginated `page`/`pageSize`) |
| GET | `/api/v1/admin/direct-emails/{id}` | VIEW (message plus recipients) |
| POST | `/api/v1/admin/direct-emails/preview` | VIEW (body: subject, bodyJson → html) |
| POST | `/api/v1/admin/direct-emails/test-send` | SEND |
| POST | `/api/v1/admin/direct-emails` | SEND (send; per-recipient results) |
| POST | `/api/v1/admin/direct-emails/check-recipients` | VIEW (which addresses are suppressed) |
| GET/POST/PATCH/DELETE | `/api/v1/admin/direct-email-templates[/{id}]` | VIEW / TEMPLATE_WRITE |
| GET/POST/DELETE | `/api/v1/admin/direct-email-suppressions[/{id}]` | VIEW / SEND |
| GET | `/api/v1/public/direct-emails/opt-out?token=` | none (token check, no write) |
| POST | `/api/v1/public/direct-emails/opt-out` | none (token in body, writes suppression) |

The template endpoints return the TipTap JSON, so HOS-2686 can consume the
same templates over the API instead of copying them.

## 7. Rendering and sending

- New template `DirectEmail` in `packages/notifications`: `EmailLayout` with
  `footerLink="none"`, the sanitized body, and the opt-out line under the body.
  `isTest` adds the `[PRUEBA]` banner like `NewsletterCampaign`.
- Body: `renderTiptapEmailContent`. Attribution: `applyEmailAttribution` with a
  transactional key `direct-email` (added to the email catalog).
- Send: one `sendEmail` call per recipient (it sends one shared message when
  given an array), with `replyTo`, the From from D1 and the Brevo tag
  `template:direct-email`. Calls run sequentially; 20 recipients stay well
  under the request budget.
- Opt-out token: HMAC-SHA256 over `direct-email-opt-out:<email>` with
  `HOSPEDA_NEWSLETTER_HMAC_SECRET` (domain-separated by the prefix, so a
  newsletter token is never valid here and no new secret is needed).

## 8. Admin UI

- Sidebar entry "Correos directos" under the communication area, gated by
  `DIRECT_EMAIL_VIEW`.
- Routes: `/direct-emails` (history), `/direct-emails/new` (compose),
  `/direct-emails/$id` (detail), `/direct-emails/templates` (list and editor),
  `/direct-emails/suppressions`.
- Editor: `RichTextEditor` gains an `enableDynamicBlocks` prop (default `true`,
  so the newsletter is unchanged); direct emails pass `false`.
- Preview: an iframe with the HTML from the preview endpoint.
- Recipients input: chips; each chip is validated on entry and checked against
  the suppression list.

## 9. Public opt-out page (web)

`/{lang}/correos/baja/?token=...`: shows the address and a "Confirmar baja"
button (a GET never writes, so link scanners cannot unsubscribe anyone). The
page stays session-blind.

## 10. Env vars

| Var | App | Required | Notes |
|---|---|---|---|
| `HOSPEDA_DIRECT_EMAIL_FROM_EMAIL` | api | no | D1 subdomain address. Unset → current sender. |

## 11. Risks

- **Deliverability before the subdomain exists.** Cold mail from the shared
  domain. Mitigation: the opt-out, the 20-recipient cap, and the owner setting
  up the subdomain (D1).
- **Brevo sender verification.** A From on an unverified domain is rejected by
  Brevo. Mitigation: the var stays unset until the owner verifies it; the send
  reports the provider error per recipient.
