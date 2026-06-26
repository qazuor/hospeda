# Web Accessibility Manual Testing

Manual verification procedure for the public web after the SPEC-270 WCAG 2.1 AA remediation pass.

This guide complements the automated `axe-core` sweep. The sweep catches structural and static issues, but it does not prove real keyboard flow, focus return, screen-reader announcements, or third-party modal behavior.

## Scope

- Public web only (`apps/web`)
- Key pages in Spanish, plus a spot-check in English and Portuguese
- Keyboard navigation
- Focus visibility
- Modal / popover behavior
- Screen-reader smoke

## Prerequisites

1. Start the local stack or the worktree stack.
2. Confirm the public web is reachable.
3. Use a desktop browser with devtools available.
4. For screen readers:
   - Windows: NVDA
   - macOS: VoiceOver

## Recommended Routes

Run the manual pass on at least these pages:

| Surface | Route |
|---|---|
| Home | `/es/` |
| Accommodations list | `/es/alojamientos/` |
| Accommodation detail | first valid `/es/alojamientos/<slug>/` |
| Destinations list | `/es/destinos/` |
| Destination detail | first valid `/es/destinos/<slug>/` |
| Events list | `/es/eventos/` |
| Event detail | first valid `/es/eventos/<slug>/` |
| Posts list | `/es/publicaciones/` |
| Post detail | first valid `/es/publicaciones/<slug>/` |
| Gastronomy list | `/es/gastronomia/` |
| Gastronomy detail | first valid `/es/gastronomia/<slug>/` |
| Experiences list | `/es/experiencias/` |
| Experience detail | first valid `/es/experiencias/<slug>/` |
| Pricing | `/es/suscriptores/precios/` |

Also do a quick smoke on:

- `/en/`
- `/pt/`

## Keyboard Checklist

Run the full pass without using the mouse.

### Global

1. Tab from the browser chrome into the page.
2. Confirm the skip link appears and works.
3. Confirm every interactive element shows a visible focus indicator.
4. Confirm focus order matches the visual reading order.
5. Confirm there are no keyboard traps.

### Header / Navigation

1. Tab through the main nav links.
2. Open the mobile menu on a narrow viewport.
3. Confirm menu items, CTA buttons, and account entries show visible focus.
4. Close the mobile menu with `Esc`.
5. Confirm focus returns to the trigger.

### Search / Filters / Forms

1. Move through search inputs, selects, chips, sliders, and textareas.
2. Confirm focus rings are visible on each control.
3. Trigger validation errors where possible.
4. Confirm invalid controls remain visibly focused and understandable.

### Dialogs / Popovers / Lightboxes

1. Open every modal, drawer, popover, and lightbox on the tested page.
2. Confirm focus lands inside the opened surface.
3. Confirm `Tab` stays trapped where a trap is expected.
4. Confirm `Esc` closes the surface.
5. Confirm focus returns to the opener.

### Share / Media / Third-Party Widgets

1. Open the share popover.
2. Navigate every share action by keyboard.
3. Open the image gallery / lightbox where available.
4. Confirm next / previous / thumbnail controls have visible focus.
5. Record any GLightbox behavior that cannot be fixed locally and needs follow-up.

## Screen Reader Smoke

Test at minimum:

- Home
- One detail page
- One form-heavy page

### What to verify

1. The page announces one clear `h1`.
2. Landmarks are present and meaningful.
3. Links and buttons have understandable names.
4. Images that carry meaning have useful alt text.
5. Decorative images are skipped.
6. Alerts / status messages are announced correctly.
7. Dialogs are announced as dialogs.
8. Form fields expose label, role, state, and error context.

## Failure Rules

Treat the pass as failed if any of these happen:

- Focus is not visible
- Focus order is confusing or jumps unpredictably
- A modal/popover traps focus incorrectly or loses focus
- `Esc` does not close a closable surface
- Focus does not return to the trigger after closing
- A control is only distinguishable by color
- A meaningful image is read with empty or redundant alt text
- A page has no SSR-visible `h1`

## Evidence to Record

Capture the result in the PR or spec follow-up notes with:

1. Date
2. Executor
3. Environment (`local`, `staging`)
4. Browser + OS
5. Screen reader used
6. Routes covered
7. Result: `PASS`, `FAIL`, or `PASS WITH NOTES`
8. Concrete defects found

## Current Status

SPEC-270 shipped the code-side remediation and automated sweep. This guide is the remaining human verification procedure for keyboard and screen-reader behavior.
