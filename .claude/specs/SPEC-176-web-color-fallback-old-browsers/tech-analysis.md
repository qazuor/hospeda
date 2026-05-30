# Technical Analysis: SPEC-176 — Web color-system fallback for older browsers + admin browser gate

## 1. Overview

### Feature Summary

The web application's color system relies on CSS relative color syntax
(`oklch(from var(--token) ...)`) which requires Chrome 119+. A real user
("Marta") on Chrome 109 experienced an invisible login button because the
entire color layer was invalidated. This spec adds sRGB fallbacks so the
web app degrades gracefully on Chrome 109-118, adds an informational browser
gate to the admin panel (which cannot support pre-111 browsers without dropping
Tailwind v4), and installs CI guards to prevent regression.

### Hard Technical Constraint (CSS Variables spec, non-negotiable)

The naive two-declaration fallback pattern does NOT work:

```css
/* THIS IS BROKEN — do not use */
color: rgb(232 116 59 / 0.3);
color: oklch(from var(--brand-primary) l c h / 0.3);
```

When a `var()` substitutes to an invalid value, CSS marks the entire
declaration "invalid at computed-value time" and falls back to `inherit` or
the property's initial value. The previous valid declaration is NOT restored.
This is mandated by the CSS Custom Properties Level 1 specification, section 3.

The only correct solution is to move the relative-color computation into a
named CSS custom property and gate its definition inside
`@supports (color: oklch(from white l c h))`.

### Technical Complexity

**Rating:** High
**Justification:** Multiple moving parts: a build-time conversion library
(new devDependency), an extension to the design-tokens generator, a codemod
over 679 call sites across 132 files, a JS runtime fallback decision for
`@repo/icons`, a new admin UI component with i18n, and new CI guard scripts.
Each piece is individually moderate but they compose into a high-complexity
coordinated change.

### Estimated Effort

**Total:** 28-38 hours

#### Breakdown

- Design-tokens generator extension (formatSRGB + emitVariantTokens): 4-5 h
- Token mapping table derivation and Zod schema: 2-3 h
- Codemod script + manual review workflow: 6-8 h
- `@repo/icons` JS fallback helper: 2-3 h
- Admin browser gate (component + i18n + mount): 3-4 h
- Regression guard scripts + CI wiring: 4-5 h
- Tests (unit + integration): 5-6 h
- Visual parity verification (Playwright): 2-4 h

---

## 2. Architecture Analysis

### Affected Layers

- [x] Database (schemas, migrations) — NO
- [x] Model/Repository (data access) — NO
- [x] Service (business logic) — NO
- [x] API (routes/controllers) — NO
- [x] Frontend (components, pages) — YES
- [x] Build tooling (`packages/design-tokens`) — YES
- [x] Shared packages (`@repo/icons`) — YES
- [x] CI scripts (`apps/web/scripts/`) — YES

### New vs Existing

- **New entities:** `formatSRGB()` function in `packages/design-tokens/src/tokens/colors.ts`;
  `emitVariantTokens()` + `emitVariantTokensSupports()` in `generate-css.ts`;
  `VARIANT_TOKEN_MAP` constant; `check-css-relative-colors.cjs` guard script;
  `oklch-to-srgb-helper.ts` shared helper in `@repo/icons`; `BrowserGateBanner`
  React component in `apps/admin`.
- **Modified entities:** `packages/design-tokens/src/generators/generate-css.ts`
  (primary extension point); `apps/web/src/styles/components.css` (generalize
  the existing `@supports` block at line 539); `apps/web/src/styles/global.css`
  (outline-color at line 29); `packages/icons/src/domain/*.ts` (6 files);
  `apps/admin/src/routes/__root.tsx` (mount gate banner).
- **Reusable components:** The `VARIANT_TOKEN_MAP` derivation pattern reused in
  the codemod and in the CI guard; the `formatSRGB()` helper reused by both the
  generator and optionally by `@repo/icons`.

### Architecture Diagram

```mermaid
graph TD
    subgraph BUILD TIME
        A[packages/design-tokens/src/tokens/colors.ts<br/>OKLCH SSOT] -->|formatSRGB| B[generate-css.ts<br/>emitVariantTokens]
        B -->|42 fallback + @supports blocks| C[dist/tokens.css]
    end

    subgraph WEB RUNTIME
        C -->|@import| D[apps/web/src/styles/global.css]
        D --> E[components.css — 679 call sites swapped to var tokens]
    end

    subgraph ICONS RUNTIME
        F[packages/icons/src/domain/*.ts<br/>6 files × 3 variants] -->|runtime JS| G[inline style strings<br/>oklch fallback helper]
    end

    subgraph CI GUARDS
        H[check-css-tokens.cjs<br/>existing] -->|extend| I[check-css-relative-colors.cjs<br/>new sibling]
        C -->|parsed| J[variant-token-coverage.test.ts<br/>new unit test]
    end

    subgraph ADMIN
        K[apps/admin/src/routes/__root.tsx] --> L[BrowserGateBanner.tsx<br/>CSS.supports probe]
    end
```

---

## 3. Token Design — The 42 Variant Token System

### Two families, unified pattern

Every variant token follows the same dual-declaration structure:

```css
:root {
    /* sRGB fallback — valid on Chrome 65+ (rgb space-syntax + slash alpha). */
    --brand-primary-a15: rgb(78 100 210 / 0.15);
}
@supports (color: oklch(from white l c h)) {
    :root {
        /* Restored to the original relative-color computation. */
        --brand-primary-a15: oklch(from var(--brand-primary) l c h / 0.15);
    }
}
```

### Family A — Alpha-only (625 usages → ~27 distinct base × N alpha pairs)

Transform pattern: `oklch(from var(--BASE) l c h / ALPHA)` where ALPHA is a
decimal (0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60, 0.70,
0.80, 0.85, 0.90, 0.95).

sRGB computation: convert the base token's OKLCH value to sRGB at `l,c,h` (no
modification), then format as `rgb(R G B / ALPHA)` using the same ALPHA.

The `formatSRGB()` function (see Section 5) takes `{ l, c, h }` and returns
`rgb(RR GG BB)` (no alpha in the base function; the emitter appends `/ ALPHA`
for alpha-variant tokens).

### Family B — Lightness-math (49 usages → ~15 distinct base × factor pairs)

Transform pattern: `oklch(from var(--BASE) calc(l * FACTOR) c h)` (multiply)
or `oklch(from var(--BASE) calc(l - OFFSET) c h)` (subtract).

sRGB computation: apply the lightness transform at OKLCH level, THEN convert
to sRGB. For example, `calc(l * 0.85)` on `river[500] = {l:0.63, c:0.19, h:259}`
becomes `{l: 0.63 * 0.85, c: 0.19, h: 259}` → convert → sRGB hex.

This is where gamut mapping matters: clamping `calc(l - 0.20)` on a low-L token
can push components out of [0,1]; the conversion library must handle that
gracefully.

### Family C — Combined (oklch relative-color with BOTH lightness and alpha)

The three `contrast` variant strings in `@repo/icons` use simultaneous lightness
pinning + chroma scaling (`0.95 calc(c * 0.55) h`, `0.4 c h`, `0.88 calc(c * 0.55) h`).
These are JS-generated at runtime and are handled separately (Section 8).

### The `VARIANT_TOKEN_MAP` Constant

A compile-time map lives in the generator and drives both CSS emission and the
codemod's find-and-replace table. Structure:

```ts
/** Each entry defines one variant token. */
type VariantTokenEntry = {
    /** The CSS custom property name to emit, WITHOUT the leading '--'. */
    readonly name: string;
    /** Base token CSS var name (e.g. 'brand-primary'). */
    readonly base: string;
    /** The transform type. */
    readonly family: 'alpha' | 'lightness-multiply' | 'lightness-subtract';
    /** For alpha: decimal 0-1. For lightness-multiply: multiplier. For lightness-subtract: offset. */
    readonly param: number;
    /** The exact inline string in CSS source that this token replaces. */
    readonly replaces: string;
};

export const VARIANT_TOKEN_MAP: ReadonlyArray<VariantTokenEntry> = [
    {
        name: 'brand-primary-a15',
        base: 'brand-primary',
        family: 'alpha',
        param: 0.15,
        replaces: 'oklch(from var(--brand-primary) l c h / 0.15)'
    },
    // ... 41 more entries
] as const;
```

The `replaces` field is the EXACT string matched by the codemod regex in CSS
files, ensuring bijective mapping from inline expression to token name.

---

## 4. Schema & Type Design

### Zod schema for the VARIANT_TOKEN_MAP entries

The map is a build-time TypeScript constant (not runtime user input), so Zod
validation is only needed in the generator's self-test to assert the map is
internally consistent before emitting CSS.

```ts
// packages/design-tokens/src/generators/variant-token-schema.ts
import { z } from 'zod';

export const VariantTokenEntrySchema = z.object({
    name: z.string().regex(/^[a-z][a-z0-9-]*$/),
    base: z.string().regex(/^[a-z][a-z0-9-]*$/),
    family: z.enum(['alpha', 'lightness-multiply', 'lightness-subtract']),
    param: z.number().finite(),
    replaces: z.string().min(1)
});

export const VariantTokenMapSchema = z.array(VariantTokenEntrySchema)
    .refine(
        (entries) => new Set(entries.map((e) => e.name)).size === entries.length,
        { message: 'Duplicate variant token names detected' }
    )
    .refine(
        (entries) => new Set(entries.map((e) => e.replaces)).size === entries.length,
        { message: 'Duplicate "replaces" expressions detected — codemod would be ambiguous' }
    );
```

---

## 5. Generator Extension Design

### New function: `formatSRGB()`

Add to `packages/design-tokens/src/tokens/colors.ts` alongside the existing
`formatOKLCH()`:

```ts
/**
 * Convert an OKLCH value to a CSS `rgb(R G B)` string via sRGB gamut-mapped
 * conversion. Uses the approved oklch→sRGB library (see OQ1 decision).
 * Components are clamped to [0, 255] after gamut mapping.
 *
 * @param value - OKLCH triple to convert.
 * @returns CSS `rgb(R G B)` string with integer components.
 */
export function formatSRGB(value: OKLCH): string { ... }
```

The conversion library is a devDependency on `@repo/design-tokens` only.
It is NOT bundled into the consumer packages — it runs only during
`pnpm build:css` (via `tsx generate-css.ts`). Downstream consumers get the
already-converted sRGB strings in `dist/tokens.css`.

### New functions in `generate-css.ts`

```ts
/**
 * Emit all variant tokens as dual-declaration blocks:
 * first the sRGB fallback at :root, then all @supports redefinitions.
 *
 * Output shape:
 *   :root {
 *     --brand-primary-a15: rgb(78 100 210 / 0.15);
 *     ...41 more...
 *   }
 *   @supports (color: oklch(from white l c h)) {
 *     :root {
 *       --brand-primary-a15: oklch(from var(--brand-primary) l c h / 0.15);
 *       ...41 more...
 *     }
 *   }
 */
function emitVariantTokens(
    map: ReadonlyArray<VariantTokenEntry>,
    baseOklchValues: Readonly<Record<string, OKLCH>>,
    indent: string
): string { ... }
```

Integration into `buildCSS()`:

```ts
export function buildCSS(): string {
    // ... existing parts ...
    parts.push('');
    parts.push('/* SPEC-176: Variant tokens — sRGB fallback + @supports oklch override. */');
    parts.push(emitVariantTokens(VARIANT_TOKEN_MAP, BASE_TOKEN_OKLCH_VALUES, INDENT));
    // ... existing theme blocks unchanged ...
}
```

The `BASE_TOKEN_OKLCH_VALUES` record maps token names like `'brand-primary'`
to their OKLCH values resolved from the web-light theme. This is a new derived
constant built from the `webLight` theme map filtered to OKLCH entries.

### File size guard

`generate-css.ts` currently ends at 188 lines. The extension will add
approximately 80-100 lines of pure logic. The 500-line cap will not be
breached. If the `VARIANT_TOKEN_MAP` constant itself grows large, it moves to a
sibling file `variant-tokens.ts` (imported into `generate-css.ts`).

### Build step impact

The `@repo/design-tokens` build already runs `tsx generate-css.ts` as part of
`pnpm build`. Adding the conversion library call (a pure in-memory computation
over 42 entries) adds negligible time, well under 1 second. TurboRepo caches
the `dist/tokens.css` output based on source file hashes; the cache correctly
invalidates when `colors.ts` or `variant-tokens.ts` changes.

---

## 6. Codemod Design

### Input scope

- `apps/web/src/styles/global.css` — line 29 (`outline-color`)
- `apps/web/src/styles/components.css` — ~675 of the 679 usages
- Any `.astro`, `.tsx`, `.css` files in `apps/web/src/` that contain
  `oklch(from var(` (the census shows they are concentrated in the two CSS files)

### Approach: regex codemod (not AST)

CSS files do not have a production-quality Zod/AST parser in the JS ecosystem
comparable to `@babel/parser` for JS. Regex is correct here because:

1. The 42 target strings are exact literals (no ambiguity)
2. Each `replaces` field in `VARIANT_TOKEN_MAP` is the verbatim substring to match
3. The output is `var(--NAME)` — a simple replacement with no structural change

The codemod script (`scripts/codemod-relative-colors.mjs`) reads each file,
builds a regex alternation from all 42 `replaces` strings (escaped), replaces
each match with `var(--NAME)`, and writes back.

```js
// Pseudocode of the replacement loop:
for (const entry of VARIANT_TOKEN_MAP) {
    const escaped = entry.replaces.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    source = source.replaceAll(escaped, `var(--${entry.name})`);
}
```

### Non-matched case reporting

After substitution, the codemod scans the output for any remaining
`oklch(from var(` patterns. These are the "non-matched" cases — the 49
lightness-math usages not yet in the map, or edge cases. The script writes a
`codemod-report.md` listing file path, line number, and the unmatched
expression. These require manual review to either:

1. Add a new entry to `VARIANT_TOKEN_MAP` (and re-run the generator), or
2. Convert them to a different approach (e.g., a static hex value if the
   lightness math produces a value that cannot be cleanly tokenized).

### The `components.css:539` existing `@supports` block

This block is the PROTOTYPE of the pattern. It must be refactored: the
`background-color: var(--core-card)` fallback in `.navbar--scrolled` becomes
a use of the new `--core-card-a95` variant token, and the existing hand-crafted
`@supports` block is deleted (replaced by the generator's output in
`tokens.css`).

### Visual parity verification

The existing Playwright visual snapshot suite at
`apps/web/tests/visual-snapshots/capture-baseline.visual.ts` covers 8 pages ×
4 viewports × 2 themes = 64 baseline PNGs (from SPEC-153 Phase 0). After the
codemod, run the suite WITHOUT `--update-snapshots`. Any deviation indicates a
color difference introduced by the sRGB conversion (typically gamut-boundary
tokens). The acceptable threshold is 0 pixel diff (the same gate used in
SPEC-153 Phase 2).

If diffs appear, investigate the specific token: compare the sRGB fallback
value in `dist/tokens.css` against the OKLCH value, compute whether the
conversion is in-gamut, and adjust the gamut-mapping strategy (see OQ1).

---

## 7. Regression Guard Design

### Guard 1: Variant token coverage (unit test, Vitest)

**File:** `packages/design-tokens/src/generators/variant-token-coverage.test.ts`

```ts
describe('variant token coverage', () => {
    const css = buildCSS();

    it('every variant token has a non-oklch sRGB declaration at :root', () => {
        for (const entry of VARIANT_TOKEN_MAP) {
            // Regex: matches `--name: rgb(...)` NOT inside @supports
            const rootPattern = new RegExp(
                `--${entry.name}:\\s*rgb\\(`
            );
            expect(css).toMatch(rootPattern);
        }
    });

    it('every variant token has an oklch declaration inside @supports', () => {
        const supportsBlock = css.match(
            /@supports \(color: oklch\(from white l c h\)\)\s*\{[^}]+\}/s
        )?.[0] ?? '';
        for (const entry of VARIANT_TOKEN_MAP) {
            expect(supportsBlock).toContain(`--${entry.name}:`);
            expect(supportsBlock).toContain('oklch(from var(');
        }
    });

    it('no variant token name collides with an existing palette or theme token', () => {
        const allExistingTokens = [...css.matchAll(/--([a-z][a-z0-9-]+):/g)]
            .map((m) => m[1])
            .filter((name) => !VARIANT_TOKEN_MAP.some((e) => e.name === name));
        const variantNames = VARIANT_TOKEN_MAP.map((e) => e.name);
        for (const name of variantNames) {
            expect(allExistingTokens).not.toContain(name);
        }
    });
});
```

### Guard 2: No raw relative colors in web source (CI lint script)

**File:** `apps/web/scripts/check-css-relative-colors.cjs` (new sibling to
the existing `check-css-tokens.cjs`)

**Decision: add a sibling, do NOT extend the existing script.**

Reasoning: the existing script checks for undefined token REFERENCES
(var(--undefined-name)). The new guard checks for illegal EXPRESSIONS
(`oklch(from` outside the designated token definition file). These are
orthogonal checks with different scan logic, different allowlists, and
different error messages. Merging them would violate SRP and make both
harder to maintain. The sibling follows the same Node.js CJS pattern and
is added to the same CI step.

Logic:

1. Walk `apps/web/src/` collecting `.astro`, `.css`, `.tsx`, `.ts` files.
2. Strip block comments.
3. Scan for the pattern `oklch(from`.
4. ALLOWLIST: skip the file `apps/web/src/styles/global.css` only if the
   match is inside a comment (the spec says the token definition file is
   `dist/tokens.css` — a generated artifact — so the web source should
   have ZERO occurrences of `oklch(from` after the codemod).
5. Report all findings as errors. Exit 1 if any found, 0 if clean.

The script is added to the web app's `package.json` lint step and to the
root `turbo.json` pipeline so it runs in CI.

---

## 8. `@repo/icons` Fallback Strategy

### Current state (confirmed from code audit)

All 8 domain files in `packages/icons/src/domain/` contain `getXxxColorScheme()`
functions that return template literal strings with `oklch(from var(--token) ...)`
expressions. Two variants per function:

- `subtle` (default): `oklch(from var(--TOKEN) l c h / 0.15)` / `0.3`
- `contrast` (admin): `oklch(from var(--TOKEN) 0.95 calc(c * 0.55) h)`, etc.

These strings are set as inline `style` attributes on React elements and are
NOT in CSS files — they bypass the token fallback system entirely.

### Recommendation: Compute sRGB fallback inline at runtime via shared helper

This is chosen over "documented degradation" for the following reason: the
`subtle` variant's bg/border are used on accommodation-type and event-category
badges on the WEB side, which is where Chrome 109 users are affected. Accepting
degradation on badges means the badges render without background color on the
broken browser, which undermines the fix's completeness.

### Design: `oklch-color-helper.ts` in `@repo/icons/src/`

```ts
/**
 * @file oklch-color-helper.ts
 * @description Runtime CSS color string helpers for domains that need dynamic
 * per-token color variants. Provides `@supports`-aware inline style values
 * by returning a CSS string that EITHER uses the precomputed variant token
 * (if it exists in the VARIANT_TOKEN_MAP) OR falls back to a pre-baked sRGB
 * string for the most common alpha variants.
 */

/**
 * Returns a CSS color value for a token at a given alpha.
 * Prefers the variant token (--base-aNN) if available; falls back to
 * the sRGB precomputed string.
 */
export function tokenAlpha(
    { base, alpha, srgbFallback }: { base: string; alpha: number; srgbFallback: string }
): string { ... }
```

The `srgbFallback` values for the domain tokens are inlined as constants derived
from the SAME `formatSRGB()` conversion used in the generator — keeping the
SSOT relationship intact. The icons package adds `@repo/design-tokens` as a
peer (or references its conversion output via a shared constant file that is
imported at build time).

Importantly, for inline styles the browser does NOT cascade like CSS — there is
no `@supports` hook for inline styles. The correct approach is:

- For the `subtle` variant: use `var(--base-aNN)` CSS custom property reference
  directly as the inline style value. Modern browsers resolve the token
  (which inside `@supports` is the oklch value); Chrome 109 resolves the sRGB
  fallback declared at `:root`. This works because inline style values that
  reference CSS custom properties DO participate in the cascade.

- For the `contrast` variant (admin-only): the admin has a Chrome 111 hard floor.
  No fallback is needed. The contrast variant can stay as-is. This should be
  documented explicitly.

**Updated recommendation:** Instead of computing sRGB at runtime in JS, switch
the `subtle` variant in all 6 affected domain files from emitting a raw
`oklch(from var(...) ...)` string to emitting `var(--base-aNNN)` (the variant
token name). This is the correct fix: it removes the inline oklch expression and
replaces it with a token reference that the CSS fallback system handles.

The `contrast` variant (admin-only) is intentionally left with raw oklch
expressions and documented as admin-only (Chrome 111+ floor).

This approach requires:
1. The domain files to know the variant token names for alpha 0.15 and 0.30.
2. A lightweight `alphaTokenName(base, alpha)` helper that constructs the
   token name by convention (e.g. `brand-primary` + `0.15` → `brand-primary-a15`).

---

## 9. Admin Browser Gate

### Detection method

CSS feature detection via `CSS.supports()` is the approved approach (not UA
sniffing, per D4).

```ts
// Probe: does the browser support relative color syntax?
const supportsRelativeColor =
    typeof CSS !== 'undefined' &&
    CSS.supports('color', 'oklch(from white l c h)');

// Tailwind v4 also requires color-mix:
const supportsColorMix =
    typeof CSS !== 'undefined' &&
    CSS.supports('color', 'color-mix(in srgb, red 50%, blue)');

// Gate condition: unsupported if EITHER probe fails.
const browserSupported = supportsRelativeColor && supportsColorMix;
```

### Component: `BrowserGateBanner`

New file: `apps/admin/src/components/BrowserGateBanner.tsx`

Renders a fixed-top warning strip (not a modal — does not block) when
`browserSupported` is false. Uses only Tailwind utility classes (no CSS Modules —
this is the admin app). Uses the `useTranslations` hook for i18n copy.

```tsx
export function BrowserGateBanner(): React.JSX.Element | null {
    const [unsupported, setUnsupported] = useState(false);
    const { t } = useTranslations();

    useEffect(() => {
        const supported =
            typeof CSS !== 'undefined' &&
            CSS.supports('color', 'oklch(from white l c h)') &&
            CSS.supports('color', 'color-mix(in srgb, red 50%, blue)');
        setUnsupported(!supported);
    }, []);

    if (!unsupported) return null;

    return (
        <div
            role="alert"
            aria-live="polite"
            className="fixed top-0 left-0 right-0 z-[9999] bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-900"
        >
            {t('admin.browserGate.message')}
            {' '}
            <a
                href="https://www.google.com/chrome/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
            >
                {t('admin.browserGate.upgradeLink')}
            </a>
        </div>
    );
}
```

The banner renders AFTER Tailwind loads (it is a client-side React component
mounted inside the root layout). Since Tailwind itself will be partially broken
on sub-111 browsers, the banner uses only basic Tailwind utilities that have
been supported since Chrome 80+ (bg-color, border, padding, text, fixed
positioning). The amber palette in Tailwind v4 does NOT use oklch relative color
syntax — it uses plain oklch() which works on Chrome 111+. On Chrome 109 the
colors degrade (the banner may look unstyled) but the text content remains
readable.

### Mount location: `apps/admin/src/routes/__root.tsx`

Add `<BrowserGateBanner />` immediately after the opening of the root component
body, before any other layout structure. This ensures it mounts regardless of
which sub-route the user is on.

### i18n keys to add

In `packages/i18n/src/locales/es/admin.json` (and `en.json`, `pt.json`):

```json
{
  "admin": {
    "browserGate": {
      "message": "Tu navegador no es compatible con el panel de administración. Por favor, actualizá a Chrome 111 o superior.",
      "upgradeLink": "Descargar Chrome"
    }
  }
}
```

---

## 10. Dependencies & Order of Implementation

### Implementation Order

1. **OQ1 Decision** (Est: 0 h — user decision gate)
   - Approve the oklch→sRGB conversion library
   - This unblocks everything else

2. **VARIANT_TOKEN_MAP derivation** (Est: 3-4 h)
   - Run the census script to extract the 42 exact `(base, transform)` pairs
   - Define the full `VARIANT_TOKEN_MAP` constant in `variant-tokens.ts`
   - Add Zod schema validation for the map (self-test)
   - OQ2 decision: naming convention

3. **Generator extension** (Est: 4-5 h)
   - Add `formatSRGB()` to `colors.ts` using the approved library
   - Add `emitVariantTokens()` to `generate-css.ts`
   - Integrate into `buildCSS()`
   - Run `pnpm build:css`, inspect `dist/tokens.css`

4. **Unit tests for generator** (Est: 2-3 h)
   - `variant-token-coverage.test.ts` (Guard 1)
   - Assert `formatSRGB` roundtrips match expected values

5. **Codemod** (Est: 4-5 h)
   - Write `scripts/codemod-relative-colors.mjs`
   - Run against `apps/web/src/styles/`
   - Review `codemod-report.md` for non-matched cases
   - Handle non-matched cases (add to map or convert manually)

6. **Generalize `components.css:539`** (Est: 1 h)
   - Delete the hand-crafted `@supports` block
   - Verify `--core-card-a95` token covers it

7. **`@repo/icons` subtle variant fix** (Est: 2-3 h)
   - Add `alphaTokenName()` helper
   - Update all 6 domain files to emit `var(--base-aNNN)` for subtle variant
   - Update tests

8. **CI guard script** (Est: 2-3 h)
   - Write `check-css-relative-colors.cjs`
   - Add to CI pipeline
   - Verify it catches the pre-codemod source and passes post-codemod

9. **Admin browser gate** (Est: 3-4 h)
   - `BrowserGateBanner.tsx`
   - i18n keys (es/en/pt)
   - Mount in `__root.tsx`
   - Playwright smoke test (manual, since Chrome 109 is not a standard Playwright browser)

10. **Visual parity verification** (Est: 2-4 h)
    - Run Playwright visual suite against local dev server post-codemod
    - Investigate and remediate any diffs (gamut issues)
    - Update baselines if diffs are acceptable (e.g., design-approved corrections)

### External Dependencies

- **New devDependency:** oklch→sRGB conversion library (see OQ1 — one of:
  `culori`, `colorjs.io`, or hand-rolled). Lives only in
  `packages/design-tokens/devDependencies`.

### Internal Dependencies

- `@repo/design-tokens` build must complete before any web/admin app build
  (already true in `turbo.json` dependency graph via `@repo/design-tokens` being
  listed in web's `package.json` dependencies)
- OQ2 naming decision must be settled before the generator is written
- OQ1 library decision must be settled before `formatSRGB()` is written

---

## 11. Open Decisions — Present to User

### OQ1: oklch → sRGB Conversion Library

**Context:** 42 token values must be converted at build time from OKLCH to
sRGB. Some OKLCH values (particularly high-chroma tokens like
`danger[500] = {l:0.577, c:0.245, h:27}` and `brand-primary = {l:0.63, c:0.19, h:259}`)
may fall outside the sRGB gamut and require clipping or gamut mapping. Incorrect
clamping produces a grey cast; correct gamut mapping (CSS Color 4 spec defines
the "CSS gamut mapping" algorithm) produces a visually closest in-gamut color.

---

**Option 1: `culori` (npm, 77 kB install, 0 runtime deps)**

1. What it does: A full CSS Color Level 4 implementation in TypeScript/JS.
   The `clampChroma()` function implements CSS-spec gamut mapping. Usage:
   `import { oklch, formatRgb } from 'culori'; formatRgb(clampChroma({mode:'oklch', l, c, h}))`.
2. Pros: Correct CSS-spec gamut mapping. Active maintenance (last commit < 30d
   as of May 2026). TypeScript types included. Widely used (Tailwind CSS v4 and
   Radix UI use it internally). Zero runtime overhead (devDep only).
3. Cons: 77 kB on disk install (devDep — irrelevant to bundle size). Adds one
   dependency to `packages/design-tokens` devDeps.
4. Impact: `formatSRGB()` becomes a 3-line wrapper around culori. All 42
   conversions run in under 10 ms. No impact on consumer bundle.

**Recommendation: Option 1 (`culori`)**

---

**Option 2: `colorjs.io` (npm, ~150 kB install)**

1. What it does: Lea Verou's full-featured color library. Supports CSS Color 4
   gamut mapping and many color spaces.
2. Pros: More color spaces covered (irrelevant here — we only need oklch→sRGB).
   Browser-usable (irrelevant — this is build-time only).
3. Cons: Larger install footprint. Heavier API surface. Less adopted in the
   design-systems toolchain than culori.
4. Impact: Same functional result as culori, more overhead.

---

**Option 3: Hand-rolled (no new dep)**

1. What it does: Implement the oklch→linear-sRGB→sRGB matrix transform directly
   in `formatSRGB()` (the math is about 20 lines: two matrix multiplications).
   Gamut clamp by clamping R/G/B components to [0, 255].
2. Pros: Zero new dependencies. Fully transparent.
3. Cons: Simple clamping is NOT CSS-spec gamut mapping — it produces grey casts
   on high-chroma colors. Implementing the CSS Color 4 gamut mapping algorithm
   correctly is ~80 lines and error-prone to test. The resulting colors may
   differ from what modern browsers display, defeating the "visual parity"
   goal. Requires ongoing maintenance if CSS Color spec updates.
4. Impact: Risk of perceptual mismatch on the danger/brand-accent tokens (the
   highest-chroma values in the palette). Playwright diffs may fail.

---

### OQ2: Exact naming convention for the 42 tokens

**Context:** Token names must be valid CSS custom property names, must clearly
communicate the transform applied, and must not collide with existing tokens.

---

**Option 1: `--{base}-a{NN}` for alpha, `--{base}-l{±NN}` for lightness**

- Alpha: `--brand-primary-a15` (15% = 0.15), `--brand-primary-a30` (30% = 0.30)
- Lightness multiply: `--brand-primary-l85` (l * 0.85 → lighter by 15%)
- Lightness subtract: `--brand-primary-lm20` (l - 0.20 → dark offset 0.20,
  `m` for "minus")
- Combined alpha+lightness (if any): `--brand-primary-l85-a15`

Pros: Short, readable, sortable. The alpha percentage integer is unambiguous.
Cons: `lm` prefix for subtract may be confusing. Integer representation of
alpha requires rounding (0.05 → `a05`, 0.95 → `a95`). Needs a convention
for sub-1% alpha values (none found in the census).

**Recommendation: Option 1.** Rationale: alpha variants make up 92% of usages;
the short `aNN` form is immediately scannable in devtools.

---

**Option 2: `--{base}-opacity-{NN}` for alpha, `--{base}-lightness-{op}{NN}` for lightness**

- Alpha: `--brand-primary-opacity-15`
- Lightness: `--brand-primary-lightness-minus-20`

Pros: More verbose, self-documenting.
Cons: Very long names (e.g. `--core-muted-foreground-opacity-15` = 32 chars).
Adds noise to devtools auto-complete.

---

**Option 3: `--{base}/{NN}` using CSS custom property slash syntax**

CSS custom properties cannot contain `/` in the name. This option is invalid
and is listed only to explicitly exclude it.

---

### OQ3: Explicit `browserslist` / `vite build.target` for hygiene

**Context:** The JS bundle already parses on Chrome 109 (verified in the BETA-44
investigation). No build target change is strictly needed for correctness.
The question is whether to add one for explicitness and future-proofing.

---

**Option 1: Set `build.target = ['chrome109', 'safari16', 'firefox108']` in `apps/web/vite.config.ts`**

1. What it does: Vite/Rollup will explicitly target these browsers for syntax
   transforms. Currently Vite 8 defaults to `chrome111` which already passes
   the JS audit; setting 109 is more conservative.
2. Pros: Matches the stated support floor. Makes the intent explicit in config.
   Prevents future regressions if someone adds newer JS syntax.
3. Cons: Minor: may produce slightly larger JS output (additional transforms for
   Chrome 109-110 syntax gaps — likely zero given the clean audit). Adds config
   maintenance overhead.
4. Impact: Likely zero functional change. Pure hygiene.

**Recommendation: Option 1.** The diff is trivial and the explicitness is worth it.

---

**Option 2: Leave as-is (Vite 8 default `chrome111` effectively)**

1. What it does: Nothing changes.
2. Pros: Zero risk, zero change.
3. Cons: Intent is implicit. Future developers won't know what the support floor is.

---

**Option 3: Add `browserslist` field to `apps/web/package.json`**

1. What it does: Uses the browserslist ecosystem (used by many tools including
   PostCSS, Babel). Vite does not read `browserslist` directly for `build.target`
   but does for CSS autoprefixing if PostCSS is configured.
2. Pros: Standard toolchain integration.
3. Cons: Web uses no PostCSS/Autoprefixer. Browserslist has no effect on
   Vite's JS target without explicit configuration. Creates misleading appearance
   of coverage. Not worth it.

---

## 12. Technical Risks & Challenges

### Risk 1: Gamut mapping produces visually different colors from oklch originals

**Probability:** Medium
**Impact:** Medium
**Description:** High-chroma tokens (`--destructive`, `--brand-accent`,
`--brand-primary`) may fall outside the sRGB gamut. The conversion library's
gamut-mapping algorithm produces a perceptually closest in-gamut color, but the
result may be noticeably different from the oklch value on modern browsers.
The Playwright visual diff gate will flag this if the difference exceeds
the threshold.
**Mitigation:** Use culori's `clampChroma()` (CSS-spec gamut mapping) rather
than simple component clamping. Inspect the 5-10 highest-chroma tokens manually
after the first build. Accept documented visual differences where the in-gamut
color is a reasonable approximation. Update Playwright baselines if diffs are
intentional design decisions.

### Risk 2: Codemod misses some call sites

**Probability:** Low-Medium (the 49 lightness-math cases are not in the initial map)
**Impact:** Medium
**Description:** The `codemod-report.md` will surface all unmatched
`oklch(from var(` patterns. If any are accidentally left in CSS files after
the codemod, the CI guard `check-css-relative-colors.cjs` will catch them and
fail the build.
**Mitigation:** The codemod report + CI guard provide a two-layer safety net.
The lightness-math cases require manual review; they can be added to the
`VARIANT_TOKEN_MAP` iteratively over multiple PRs if needed. A fallback: for
the ~49 cases that are hard to tokenize cleanly, evaluate whether a plain
sRGB hex approximation (not derived from the CSS var) is acceptable for
Chrome 109. If so, inlining a safe hex fallback in the CSS (not via a token)
is a valid workaround for edge cases.

### Risk 3: `@repo/icons` inline styles not covered by the token system

**Probability:** High (this is a known gap, not a risk)
**Impact:** Low (badges are secondary UI; login path does not use them)
**Description:** The inline style strings in domain files bypass CSS entirely.
Switching `subtle` variant to emit `var(--base-aNNN)` is the fix, but it
requires the domain files to know the token naming convention.
**Mitigation:** The `alphaTokenName()` helper enforces the convention.
Ensure the convention (OQ2 decision) is settled before implementing
the icons fix. The `contrast` variant (admin-only) is explicitly
not in scope.

### Risk 4: Admin gate banner uses Tailwind utilities that may themselves break on Chrome 109

**Probability:** Medium
**Impact:** Low (the banner is cosmetic; its text content remains readable)
**Description:** Tailwind v4 emits oklch color values. On Chrome 109, the
banner's background/border colors may not render, but the text is plain
(black on white initial value) and still readable.
**Mitigation:** The banner's primary function is to deliver text content.
Use inline styles for the most critical color values in the banner
(`background-color: #fef3c7; border-color: #d97706; color: #78350f` as direct
inline styles, not Tailwind classes) to guarantee legibility on Chrome 109.
Tailwind classes serve as the modern-browser progressive enhancement layer.

### Performance Considerations

- Build-time conversion: 42 OKLCH→sRGB computations in the generator.
  Negligible (< 10 ms with culori).
- Generated CSS file size increase: 42 tokens × 2 declarations × ~50 chars ≈
  ~4 kB raw, ~1.5 kB gzipped. Acceptable.
- No runtime performance impact (pure CSS cascade).
- TurboRepo cache: the `@repo/design-tokens` build output is cached. The cache
  invalidates only when `colors.ts` or `variant-tokens.ts` changes.

### Security Considerations

No security surface changes. This is a pure CSS/build change. The conversion
library is a devDependency with zero runtime code in the browser.

---

## 13. Migration & Rollback

### Database Migrations

None required.

### Rollback Plan

The entire change is additive (new CSS declarations) + a codemod (CSS text
substitution). Rollback:

1. Revert `packages/design-tokens/src/` changes → regenerate `dist/tokens.css`
2. Revert codemod changes to `apps/web/src/styles/` (via `git revert`)
3. Delete the CI guard script

The `@supports` blocks in `dist/tokens.css` are inert on modern browsers
(they simply redefine the tokens to their oklch values, same as the current
inline usage). There is no data loss and no breaking change to the API.

---

## 14. Technical Debt

### Known Trade-offs

- Decision: handle the 49 lightness-math cases in a second PR rather than
  all at once. Reduces PR size and review burden. Risk: the CI guard must
  initially allow a transitional period where some lightness-math usages
  remain in CSS. Mitigation: use a `--todo-oklch-relative` comment marker
  on non-yet-migrated cases so the guard can be set to WARN rather than ERROR
  during the transition window.

- Decision: `contrast` variant in `@repo/icons` is not fixed (admin-only, Chrome
  111 floor). Documented debt. If admin ever needs to support Chrome 109, this
  must be revisited.

### Future Improvements

- Once all 42 tokens are confirmed and the lightness-math cases are handled,
  consider using the `VARIANT_TOKEN_MAP` as input to an automated pixel-parity
  test that verifies the sRGB fallback matches the oklch value at P3-intersection
  (rather than relying solely on Playwright screenshots).
- SPEC-176 only fixes the `:root` / light-theme tokens. The dark-theme tokens
  (`[data-theme="dark"]`) inherit the same variant tokens if the base token is
  overridden in the dark theme. Verify that dark-theme base tokens produce
  correct sRGB fallbacks (this is automatically correct IF the dark-theme
  overrides the base token, not the variant token — which is the current design).

### Monitoring Needs

- After deploy, monitor Sentry for any CSS-related crashes on Chrome 109.
  The BETA-44 user "Marta" should be asked to re-test after the fix.
- Log browser version distribution in PostHog to understand the size of the
  sub-119 Chrome audience on web.

---

## 15. Documentation Requirements

### Code Documentation

- `formatSRGB()` in `colors.ts`: JSDoc explaining gamut mapping behavior,
  link to CSS Color 4 spec.
- `emitVariantTokens()` in `generate-css.ts`: JSDoc with the dual-declaration
  pattern, link to SPEC-176.
- `VARIANT_TOKEN_MAP` constant: JSDoc explaining the `replaces` field and its
  relationship to the codemod.
- `check-css-relative-colors.cjs`: explain the allowlist and the intentional
  exception for the token definition file.

### Architecture Documentation

- Update `packages/design-tokens/src/generators/generate-css.ts` header comment
  to include the SPEC-176 variant token block in the output layout description.
- Add a comment in `apps/web/src/styles/global.css` at the top explaining
  that the variant tokens (fallback + @supports) are in `dist/tokens.css`
  (generated by SPEC-176), NOT in this file.

---

## 16. Approval Checklist

- [x] All PDR requirements addressable (web token fallback, codemod, icons, admin gate, CI guard)
- [x] Architecture follows project patterns (generator extension, sibling script, RO-RO)
- [x] Database design is normalized — N/A (no DB)
- [x] API design is RESTful — N/A (no API changes)
- [x] Frontend approach is clear (dual-declaration tokens, `@supports` gate)
- [x] Testing strategy is comprehensive (unit: generator + coverage test; integration: Playwright)
- [x] Dependencies identified (one new devDep, library TBD via OQ1)
- [x] Risks assessed and mitigated (gamut mapping, codemod coverage, inline styles)
- [x] Effort estimated (28-38 h)
- [x] Three open decisions presented for user approval (OQ1, OQ2, OQ3)
- [ ] Ready for task breakdown — pending user approval of tech-analysis
