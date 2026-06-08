# ADR-032: Markdown as Canonical Storage Format for Entity Rich Text

## Status

Accepted

## Date

2026-06-08

## Context

The Hospeda platform manages multiple entity types with rich-text descriptions:

- `accommodation.richDescription` — host-authored premium content
- `destination.description` — editorial destination content
- `event.description` — editorial event content
- `post.content` — blog/post content

Note: `accommodation.description` is deliberately PLAIN TEXT (FR-2) and NOT a rich-text field.

We need a single canonical storage format that:

1. Works across admin editing, admin preview, and web rendering
2. Is human-diffable and storage-portable
3. Renders identically across all surfaces
4. Avoids vendor lock-in to a specific editor's JSON format

Previous consideration was given to Tiptap/ProseMirror JSON (used by the newsletter subsystem), but this creates a separate domain that does not align with entity description requirements.

## Decision

**Markdown (CommonMark + GFM) is the canonical storage format for all entity rich-text fields.**

### Rationale

| Criterion | Markdown (Chosen) | Tiptap JSON (Rejected for Entities) |
|-----------|-------------------|-------------------------------------|
| Human-diffable | ✅ Yes — line-based, readable diffs | ❌ No — opaque JSON structure |
| Storage-portable | ✅ Plain text column, any DB | ❌ Requires JSON/JSONB column |
| Editor-agnostic | ✅ Any Markdown editor works | ❌ Tied to TipTap/ProseMirror |
| Admin-edit | `tiptap-markdown` extension (`html: false`) round-trips | Native but locks us in |
| Admin-view | Regex + DOMPurify (`RichTextViewField.tsx`) | Not used |
| Web-render | `marked` + `sanitize-html` (`renderContent.ts`) | N/A |
| Newsletter/email | N/A — different domain | ✅ `tiptap-renderer.ts` (Tiptap JSON → HTML) |

The three markdown touchpoints are:

1. **Admin-edit**: TipTap with `tiptap-markdown` extension (`html: false`) — stores Markdown
2. **Admin-view**: `RichTextViewField.tsx` — regex-based parser + DOMPurify for preview (known divergence from `marked`, flagged as acceptable)
3. **Web-render**: `apps/web/src/lib/render-content.ts` — `marked.parse()` + `sanitizeHtml()` pipeline

### Affected Fields

| Entity | Field | Type | Toolbar Policy |
|--------|-------|------|----------------|
| Accommodation | `richDescription` | Rich text | Linkless (no `LINK` feature) — host content |
| Destination | `description` | Rich text | Full toolbar including `LINK` — editorial |
| Event | `description` | Rich text | Full toolbar including `LINK` — editorial |
| Post | `content` | Rich text | Full toolbar including `LINK` — editorial |

### Newsletter Boundary

`packages/utils/src/tiptap-renderer.ts` serves the **newsletter/email** domain (Tiptap JSON → HTML). It is NOT used for entity descriptions. The two domains are intentionally separate:

- **Entity descriptions**: Markdown → `marked` → `sanitize-html` → HTML
- **Newsletter/email**: TipTap JSON → `renderTiptapContent()` → HTML

Consumers of `tiptap-renderer.ts`:

- `packages/notifications/src/templates/newsletter/newsletter-campaign.tsx`
- `packages/notifications/src/utils/` (email body rendering)
- `apps/admin/src/components/newsletter/RichTextEditor.tsx`

This file is NOT deleted — it serves a different, valid purpose.

### New-Field Recipe

To add a new rich-text field to an entity:

1. **Admin config** (`apps/admin/src/features/*/config/sections/*.ts`):

   ```typescript
   type: FieldTypeEnum.RICH_TEXT,
   typeConfig: {
       allowedFeatures: [ /* per FR-5 matrix */ ],
   },
   ```

2. **Zod schema** (`packages/schemas/src/entities/*/*.schema.ts`):

   ```typescript
   richDescription: z.string().max(5000).optional()
   ```

3. **Database** (versioned migration per SPEC-178):

   ```sql
   ALTER TABLE entity ADD COLUMN rich_description text;
   ```

4. **Web render** (`apps/web/src/lib/api/transforms.ts` + page):
   - Add field to transform type
   - Use `renderContent({ raw: field, siteOrigin })` in page
   - NEVER use `set:html` on a raw API field

## Consequences

### Positive

- Single source of truth for rich-text storage across all entities
- Human-readable diffs in PRs and database inspections
- Editor-agnostic — can swap TipTap for another Markdown editor
- Consistent rendering pipeline on web (`marked` + `sanitize-html`)
- Newsletter subsystem unaffected — keeps its optimized JSON pipeline

### Negative

- Admin-view preview uses a different parser (regex + DOMPurify) than web-render (`marked`) — known divergence, acceptable for preview
- Must maintain `STRIP_MARKDOWN_REGEX_SET` parity between API (`entitlement-filter.ts`) and web (`render-plain.ts`) for the plain-text fallback path

### Risks

- Markdown parser differences between `marked` (web) and admin-view regex — mitigated by test coverage in `sanitize-html.test.ts` and `render-plain.test.ts`
- Divergence between API strip logic and web plain-text render — mitigated by shared `STRIP_MARKDOWN_REGEX_SET` constant

## Alternatives Considered

### Tiptap/ProseMirror JSON as canonical format

Rejected: Creates vendor lock-in, opaque diffs, requires JSONB column, and duplicates the newsletter domain's format without the newsletter's structural needs (email client compatibility, complex nesting).

### HTML as canonical format

Rejected: XSS surface area too large, not human-diffable, requires rigorous sanitization at every write path, not portable.

### Separate format per entity

Rejected: Increases cognitive load, duplicate rendering logic, inconsistent authoring experience.

## Related Decisions

- ADR-027: Newsletter Dispatch Architecture (documents the newsletter JSON domain)
- SPEC-187: Rich Text Entity Descriptions (this feature's specification)
