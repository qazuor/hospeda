---
specId: SPEC-302
title: Visual Email Template Editor
type: feat
complexity: high
status: draft
created: 2026-06-27
tags: [email, notifications, newsletter, react-email, admin, templates]
---

# SPEC-302 — Visual Email Template Editor

> A templating system where emails — both transactional notifications and newsletter
> campaigns — can be authored, previewed, and ideally edited visually. Whether to
> build on React Email (dev-authored, code-as-template) or a true visual drag-drop
> editor for non-devs is an **open question** that drives the entire scope of this spec.

## 1. Summary

Hospeda currently has two separate email pipelines:

1. **`packages/email`** — authentication emails (`verify-email`, `reset-password`)
   rendered as hardcoded React Email TSX components, sent via Brevo.
2. **`packages/notifications`** — 35+ transactional templates (billing, subscription,
   trial, commerce, conversation, newsletter) also built with React Email TSX; sent
   via Brevo (`brevo-batch.ts` for newsletter bulk, `resend-transport.ts` for
   transactional).

Newsletter campaigns already have an **admin authoring surface**: the `CampaignEditor`
in `apps/admin/src/routes/_authed/newsletter/campaigns/-components/CampaignEditor.tsx`
uses a TipTap rich-text editor. Campaign body is stored as a TipTap JSON document and
rendered to email-safe HTML at delivery time via
`packages/notifications/src/utils/tiptap-email-renderer.ts` (sanitise → inline-style
pipeline). The structural email wrapper (`NewsletterCampaign.tsx`) is still hardcoded
React Email.

For transactional notifications **nothing is editable at runtime** — every template is
a `.tsx` file; changing copy, adding a variable, or tweaking layout requires a code
change and a deploy.

The owner asks: **can we have a system of editable, visually authorable templates for
both newsletter and notification emails?** The answer depends heavily on who the target
editor is and what "visual" means — questions that must be resolved before any
architecture is chosen.

## 2. Current State — Key Files

| Concern | File(s) |
|---------|---------|
| Auth email templates | `packages/email/src/templates/verify-email.tsx`, `reset-password.tsx`, `base-layout.tsx` |
| Transactional templates (35+) | `packages/notifications/src/templates/**/*.tsx` (addon, billing, subscription, trial, commerce, conversation, newsletter, contact, feedback) |
| Shared layout + components | `packages/notifications/src/templates/components/layout.tsx`, `button.tsx`, `heading.tsx`, `info-row.tsx` |
| Newsletter campaign wrapper | `packages/notifications/src/templates/newsletter/newsletter-campaign.tsx` |
| TipTap → email-HTML renderer | `packages/notifications/src/utils/tiptap-email-renderer.ts` |
| Subject line builder | `packages/notifications/src/utils/subject-builder.ts` |
| Brevo provider (shared) | `packages/notifications/src/config/resend.config.ts` (`createEmailClient`, Brevo base URL) |
| Brevo batch helper | `packages/notifications/src/transports/email/brevo-batch.ts` |
| Transactional transport | `packages/notifications/src/transports/email/resend-transport.ts` |
| Admin newsletter editor | `apps/admin/src/routes/_authed/newsletter/campaigns/-components/CampaignEditor.tsx` |
| Admin campaign preview | `apps/admin/src/routes/_authed/newsletter/campaigns/-components/CampaignPreview.tsx` |
| Newsletter delivery service | `packages/service-core/src/services/newsletter/newsletter-delivery.service.ts` |
| Notification service entry | `packages/notifications/src/services/notification.service.ts` |

The email provider was **migrated from Resend to Brevo**; `createResendClient` is
a deprecated re-export in `resend.config.ts`. The `packages/email` CLAUDE.md still
references Resend — it trails the migration.

## 3. Problem Statement

### 3.1 Transactional templates are code-locked

All 35+ notification templates in `packages/notifications/src/templates/` are `.tsx`
React Email components. Changing a single line of copy, adjusting a CTA label, or
adding a new merge variable requires a code change, CI run, and deploy. There is no
admin surface to preview, edit, or test-send a transactional notification without dev
involvement.

### 3.2 Newsletter campaigns have content editing but no template editing

The TipTap-based `CampaignEditor` lets admins author campaign *content* (the body of
the email), but the wrapping template — branding header, footer, unsubscribe link,
color palette — is hardcoded in `newsletter-campaign.tsx`. An admin cannot change the
template structure without a code change.

### 3.3 No merge-tag / variable management surface

Transactional templates receive typed props (e.g., `{ userName, planName, renewalDate
}`). There is no admin UI to see what variables a template accepts, nor to test a
template with sample data.

### 3.4 No multi-locale template differentiation

`@repo/i18n` exists with `es`/`en`/`pt` locales. Email templates currently contain
hardcoded Spanish (`¿No querés recibir más...`). There is no mechanism to serve a
locale-appropriate transactional email or to author per-locale campaign content beyond
the audience filter.

## 4. Goals (Provisional — subject to owner alignment)

- **G-1** Define the **editor persona and editing depth**: dev-only code templates vs
  admin-editable content vs non-dev drag-drop layout editor. This gates the entire
  architecture.
- **G-2** Establish a **template registry**: a catalog of all notification types with
  their required variables, current template file, description, and category.
- **G-3** Deliver an **admin preview + test-send surface** for transactional templates
  (at minimum): admins can preview a template filled with sample data and send a
  test email, without needing to touch code.
- **G-4** Define a **template storage model**: in-code `.tsx` (dev-authored, no
  runtime edit), DB-backed content blocks (partial runtime edit), or DB-backed full
  HTML/JSON (full runtime edit). The choice drives data model and delivery pipeline.
- **G-5** Integrate with the existing `@repo/i18n` and `@repo/notifications` pipeline
  so any new template mechanism is a consumer of the current notification service, not
  a parallel system.
- **G-6** Define the **variable / merge-tag system**: typed props, a named-placeholder
  syntax (`{{user_name}}`), or both. Variables must be validated before send to prevent
  sending broken emails.
- **G-7** Evaluate **React Email** vs visual drag-drop alternatives (Maily, Unlayer,
  GrapesJS). Produce a comparison matrix with integration cost, output format, and
  relevance to Hospeda's actual editing personas.

## 5. Non-Goals

- **Not** migrating the existing 35+ templates all at once (phased rollout).
- **Not** replacing the existing Brevo transport or changing the email provider.
- **Not** a full email marketing platform (analytics, A/B testing, contact list
  management) — that scope belongs to SPEC-226 (admin Brevo dashboard) and SPEC-160
  (newsletter engagement tracking).
- **Not** building a drag-drop block editor if the owner decides dev-only templates
  with an admin preview-and-test surface is sufficient (OQ-1).
- **Not** a no-code authoring tool for non-technical users unless OQ-1 explicitly
  decides that is the target persona.

## 6. Technical Landscape (Discovery Context)

### 6.1 React Email — what the codebase already uses

`@react-email/components` is a dependency of both `packages/email` and
`packages/notifications`. Templates are `.tsx` files that render to HTML via
`renderAsync` (React Email's server-side renderer). This is a **developer authoring**
model: excellent output quality and TypeScript safety, but editing requires code.

### 6.2 TipTap — already wired for newsletter content

TipTap is the rich text editor used in `CampaignEditor`. The TipTap document (JSON) is
stored in `newsletter_campaigns.body_json` and rendered to email HTML at delivery by
`renderTiptapEmailContent`. This is already a **partial visual editing** story for
newsletter *content* — extending it to cover template *structure* is one candidate path
(see OQ-3).

### 6.3 Maily

Maily (`@maily-to/core`) is an open-source email editor built on TipTap, purpose-built
for email authoring with block-level email components (Hero, Button, Image, Divider).
It exports JSON (TipTap-compatible superset) and can render to email-safe HTML. It
could replace or augment the current `RichTextEditor` in `CampaignEditor` and extend
to a block-level template editor. Discovery required to assess integration cost and
output compatibility with the existing `tiptap-email-renderer` pipeline.

### 6.4 Unlayer / GrapesJS

Fully visual drag-drop editors that produce HTML strings. Integration is via an
`<iframe>` embed (Unlayer) or a direct React component (GrapesJS). Output is opaque
HTML, not typed props — requires a sanitisation layer before delivery and breaks the
React Email typing model. More powerful for non-dev editors; heavier integration cost
and looser type safety.

### 6.5 DB-backed template storage (if runtime editability is required)

If admins need to edit template content at runtime, templates must be stored in the DB
(likely JSONB for block-based content, or HTML string with a strict sanitise pass).
This requires new `email_templates` / `notification_templates` tables, a versioning
mechanism (draft → published), and a migration path for the existing 35+ `.tsx`
templates. Significant scope.

## 7. Discovery Plan — First Phase

Before writing tasks, the following must be answered (in order):

1. **Owner alignment on persona** (OQ-1) — who is the intended editor and how deep
   must the editing go? This is the fork that separates a 4-task spike from a
   150-task system.
2. **Maily evaluation** — add `@maily-to/core` to a local worktree, wire it into a
   test page in admin, render output through the current `tiptap-email-renderer`
   pipeline, and evaluate: does the output quality meet email deliverability needs?
   Can block-level variables be integrated cleanly? What is the JSON schema
   compatibility with the existing TipTap document store?
3. **Template registry audit** — enumerate all 35+ templates with: (a) required
   variables/props, (b) locale, (c) category, (d) approximate change frequency.
   This shapes whether full runtime editability is worth the complexity.
4. **Variable/merge-tag decision** (OQ-5) — typed React props vs named placeholders
   vs both. Drives data model and editor UI.
5. **Owner alignment on scope boundary** (OQ-6) — does "newsletter" mean the
   campaign content (already partially done via TipTap), the campaign wrapper template,
   or the subscriber management flow? Relationship to SPEC-254 social posts.

## 8. Risks

- **R-1 — Scope explosion.** "Visual email template editor" can mean a 1-week spike
  or a 6-month product. Without OQ-1 answered, the spec cannot be sized or tasked.
- **R-2 — Two email packages diverge.** `packages/email` (auth emails) and
  `packages/notifications` (everything else) currently duplicate transport logic and
  base layout. Any new template system must decide whether to unify them first or
  extend both independently.
- **R-3 — React Email SSR compatibility.** React Email uses its own renderer
  (`renderAsync`), not standard React DOM. Mixing Maily (TipTap-based JSON) with
  React Email wrappers requires a clear boundary: which parts are React Email
  components and which are rendered JSON → HTML.
- **R-4 — DB template versioning complexity.** DB-backed templates need draft/publish
  lifecycle, per-locale variants, rollback, and a migration path for existing `.tsx`
  templates. This is a significant data model risk if underestimated.
- **R-5 — Deliverability regression.** Any editor that outputs arbitrary HTML increases
  the risk of spam-trigger patterns, missing `alt` text, or broken mobile rendering.
  Automated deliverability checks (or a preview-in-email-client tool) are a mitigation
  but add scope.

## 9. Open Questions

- **OQ-1 (CRITICAL — owner, blocks all tasks)** — Who edits templates, and how
  deeply? Three very different products:
  - **A** — Dev-only. React Email `.tsx` stays. Add admin preview + test-send only.
    Smallest scope, high code quality, zero runtime risk.
  - **B** — Admin-editable content. Block-based editor (Maily or TipTap extension)
    for campaign *and* notification *content*; structural wrapper stays in code.
    Medium scope.
  - **C** — Full visual drag-drop. Non-dev can design the entire template. Largest
    scope, requires DB-backed storage + sanitisation + versioning. May be premature.
- **OQ-2** — Does this spec include **transactional templates** (billing events,
  subscription changes), **newsletter campaigns**, or both? The campaigns already have
  an editing surface; transactionals do not.
- **OQ-3** — Maily vs extending the current TipTap editor vs Unlayer/GrapesJS.
  Requires the evaluation in the Discovery Plan (section 7) before deciding.
- **OQ-4** — Template storage: in-code `.tsx` files (current) vs DB-backed JSON blobs
  vs DB-backed HTML. In-code is simplest but not runtime-editable; DB requires
  versioning + migration. Decision depends on OQ-1.
- **OQ-5** — Variable/merge-tag model: keep typed React props (dev-safe, not
  admin-accessible), introduce a `{{variable_name}}` replacement syntax in DB-stored
  content, or use a schema-validated prop injection surface in the admin preview?
- **OQ-6** — Relationship to SPEC-254 (social media publish) and potential
  SPEC-related scope for newsletter unification. Are newsletter campaign emails part
  of this spec or a separate concern? Flag for owner before allocating tasks.
- **OQ-7** — Multi-locale templates: per-locale `.tsx` variants (current zero-support),
  i18n key injection at render time (via `@repo/i18n`), or per-locale DB rows?
  Current transactional templates are Spanish-only with hardcoded strings.
- **OQ-8** — Two-package consolidation: should `packages/email` (auth) and
  `packages/notifications` (everything else) be unified before a template system is
  layered on top? Or extend independently? The split is already noted as a drift risk.

## 10. Revision History

- 2026-06-27 — Initial discovery draft (SPEC-302). Architecture not yet decided.
  Eight open questions identified; OQ-1 (editor persona) flagged as the critical
  blocker before any task can be written. Discovery plan (section 7) outlines the
  five steps required to convert this from a broad intent into a scoped implementation.
  Current system anchored: 35+ React Email templates, Brevo provider, TipTap-based
  newsletter campaign editor, `tiptap-email-renderer` pipeline already in production.
