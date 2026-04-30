# Lighthouse Audit Playbook

> Tracks SPEC-096 / REQ-096-38 (T-069).

## Goal

Before merging the SPEC-096 close-out PR, every page in the audit
target list must score >= 80 in each of the four Lighthouse
categories: Performance, SEO, Accessibility, BestPractices. The 90+
target is explicitly out of scope for beta (see SPEC-096 §13.1).

## Pages to audit

| Path | Why |
|------|-----|
| `/{locale}/` | Homepage, biggest first impression, biggest CSS payload |
| `/{locale}/alojamientos/` | Listing page, exercises ISR + filters |
| `/{locale}/alojamientos/{representative-slug}/` | Detail page, exercises gallery + JSON-LD + reviews |
| `/{locale}/mi-cuenta/` | Authenticated page, exercises auth island + dashboard |
| `/{locale}/contacto/` | Lightweight static page, baseline |

`{locale}` is `es` for the canonical run. Re-run for `en` if the
locale-specific content/URL trees change. `{representative-slug}` is
whatever slug ranks first in `/alojamientos/` at the time of the run.

## Manual run procedure

1. Build and start the production preview locally:

   ```bash
   pnpm --filter @repo/web build
   pnpm --filter @repo/web preview
   ```

2. Open the preview URL in Chrome (incognito window). The default is
   `http://localhost:4321/`.
3. Open Chrome DevTools (F12) → Lighthouse tab.
4. Categories: select all four (Performance, Accessibility, Best
   Practices, SEO). Device: Mobile (run again with Desktop if a
   regression is suspected).
5. Click "Analyze page load" and wait ~30s.
6. Capture the four scores into a row of the table below.
7. Repeat for each page in the audit target list.

If running on staging instead of local preview, point Lighthouse at
the staging URL and skip steps 1–2.

## Lighthouse CI alternative

A `lighthouserc.json` at `apps/web/lighthouserc.json` configures
[Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) so the
same audit can run unattended:

```bash
pnpm --filter @repo/web build
pnpm --filter @repo/web preview &
PREVIEW_PID=$!
sleep 5
npx lhci autorun --config=apps/web/lighthouserc.json
kill "$PREVIEW_PID"
```

The config asserts that each category meets 0.80 (Lighthouse uses a
0–1 scale internally, so 0.80 == score 80). Failing any assertion
exits with a non-zero status, which makes the audit usable as a
quality gate.

There is also a convenience script: `pnpm --filter web lighthouse`.

## Rich Results Test (companion procedure)

Lighthouse SEO score does not validate JSON-LD schema correctness.
Pair the Lighthouse run with one Rich Results Test per detail
page family:

1. Deploy a preview to a public URL (Vercel preview or staging).
2. Visit `https://search.google.com/test/rich-results`.
3. Submit one URL per type:
   - `https://{preview-host}/es/alojamientos/{slug}/`
   - `https://{preview-host}/es/eventos/{slug}/`
   - `https://{preview-host}/es/destinos/{slug}/`
   - `https://{preview-host}/es/publicaciones/{slug}/`
4. Capture the result: type detected, items found, errors, warnings.
   Errors block merge. Warnings on optional fields are acceptable.

## Latest results

Fill in after each run. Keep one row per audit; do not delete history.

| Date | Branch / Preview | Page | Performance | Accessibility | Best Practices | SEO | Notes |
|------|-------------------|------|-------------|---------------|----------------|-----|-------|
| TBD  | (SPEC-096 close-out) | `/es/` | TBD | TBD | TBD | TBD | run before merge |
| TBD  | (SPEC-096 close-out) | `/es/alojamientos/` | TBD | TBD | TBD | TBD | run before merge |
| TBD  | (SPEC-096 close-out) | `/es/alojamientos/{slug}/` | TBD | TBD | TBD | TBD | run before merge |
| TBD  | (SPEC-096 close-out) | `/es/mi-cuenta/` | TBD | TBD | TBD | TBD | run before merge |
| TBD  | (SPEC-096 close-out) | `/es/contacto/` | TBD | TBD | TBD | TBD | run before merge |

## Gap-handling protocol

If any score is below 80:

1. Open the failing audit and identify the top three impacting items.
2. Decide:
   - Fix in this PR if cheap (under ~2 hours of work).
   - Defer to SPEC-097 (post-beta) if structural (e.g., Vercel ISR
     headers, image CDN config, font self-hosting).
3. Document the deferral in this file and link a follow-up issue.
4. The SPEC-096 close-out can merge with documented deferrals as long
     as no category drops below 80 across all five pages.
