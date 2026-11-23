/**
 * account-css-scope.ts — the ACCOUNT SURFACE shared by the two Mi Cuenta CSS
 * guards (HOS-2413 T-008/T-009: `check:account-breakpoints`, HOS-2469, and
 * `check:account-css-literals`, HOS-2470).
 *
 * ---------------------------------------------------------------------------
 * HOW THE SCOPE WAS PRODUCED (frozen 2026-11-20, branch
 * spec/HOS-2413-pr1-tokens-kit-base over staging `617c77ea1d`)
 * ---------------------------------------------------------------------------
 *
 * Spec §6.7 defines the scope as the account folders plus "every component
 * directory the account pages import from". That set was traced ONCE, by
 * collecting every `from '…components/…'` import in the 81 files under
 * `apps/web/src/pages/[lang]/mi-cuenta/**` and the account layouts
 * (`layouts/{Account,Editor,ListingEditor}*.astro`), then checking who ELSE
 * imports each directory:
 *
 *   - A directory imported only by the account area enters WHOLE
 *     (`ACCOUNT_SCOPE_DIRS`): the editor folders, host trades, and the two
 *     billing add-on folders.
 *   - A directory the public site shares (`listing/`, `venue/`, `host/`,
 *     `billing/`, `newsletter/`, `auth/`) enters FILE BY FILE
 *     (`ACCOUNT_SCOPE_COMPONENT_FILES`): only the components an account page
 *     imports, plus their colocated `<Name>.module.css`. Taking those
 *     directories whole would put public pages (`/comer-y-salir/`, the plan
 *     price pages) under an account-only rule, which OD-9 rules out.
 *   - Site-wide chrome is left OUT even though account pages import it:
 *     `components/shared/**` (Breadcrumbs, EmptyState, WhatsNewCountPill) and
 *     `components/seo/**`. They render on every page of the site, and the
 *     public site is out of scope (spec NG-6).
 *
 * The list is frozen: re-running the trace is not part of the guards. A file
 * that becomes account-only later is added here by hand, in its own PR.
 *
 * ---------------------------------------------------------------------------
 * ZONES
 * ---------------------------------------------------------------------------
 *
 *   - STRICT (`isInStrictZone`): `components/account/ui/**`,
 *     `layouts/AccountShell.astro`, `layouts/AccountHeader.astro`. Zero
 *     tolerance: both guards refuse any exceptions-list entry here.
 *   - LEGACY: the rest of the scope. Count-pinned per file and per rule in a
 *     frozen exceptions list that can only shrink (OD-9).
 *
 * ---------------------------------------------------------------------------
 * WHAT THE SCOPE DOES NOT SEE
 * ---------------------------------------------------------------------------
 *
 *   - Components an account page reaches only TRANSITIVELY (a child imported
 *     by an in-scope component that lives in a shared directory).
 *   - Global stylesheets (`src/styles/**`) and anything outside `apps/web/src`.
 *   - Test files and `.d.ts` files.
 *
 * @module scripts/lib/account-css-scope
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** The web app source root, relative to the repo root. */
export const WEB_SRC = 'apps/web/src';

/** Directories that are in scope whole (repo-relative, trailing slash). */
export const ACCOUNT_SCOPE_DIRS: readonly string[] = [
    'apps/web/src/components/account/',
    'apps/web/src/pages/[lang]/mi-cuenta/',
    'apps/web/src/components/host/editor/',
    'apps/web/src/components/host/external-reputation/',
    'apps/web/src/components/host/host-trades/',
    'apps/web/src/components/listing/editor/',
    'apps/web/src/components/listing/ai-questions/',
    'apps/web/src/components/post/editor/',
    'apps/web/src/components/event/editor/',
    'apps/web/src/components/billing/recurring-addons/',
    'apps/web/src/components/billing/addon-purchase/'
];

/** Account layouts (spec §6.7): `layouts/{Account,Editor,ListingEditor}*.astro`. */
const ACCOUNT_LAYOUT = /^apps\/web\/src\/layouts\/(?:Account|Editor|ListingEditor)[^/]*\.astro$/;

/**
 * Components in shared directories that an account page imports directly.
 * Each entry also brings in its colocated `<Name>.module.css`.
 */
export const ACCOUNT_SCOPE_COMPONENT_FILES: readonly string[] = [
    'apps/web/src/components/auth/ChangePasswordForm.client.tsx',
    'apps/web/src/components/billing/StripMercadoPagoReturnParams.astro',
    'apps/web/src/components/billing/SubscriptionReturn.client.tsx',
    'apps/web/src/components/host/ExternalReputationSection.client.tsx',
    'apps/web/src/components/host/HostDashboard.client.tsx',
    'apps/web/src/components/host/PromotionForm.client.tsx',
    'apps/web/src/components/host/PromotionList.client.tsx',
    'apps/web/src/components/host/PropertyCard.astro',
    'apps/web/src/components/listing/HiddenByBusinessLinesSummary.client.tsx',
    'apps/web/src/components/listing/ListingActions.client.tsx',
    'apps/web/src/components/listing/ListingEditor.client.tsx',
    'apps/web/src/components/listing/ListingFaqManager.client.tsx',
    'apps/web/src/components/listing/ListingNotices.astro',
    'apps/web/src/components/listing/ListingViewsWidget.client.tsx',
    'apps/web/src/components/listing/LocationDuplicateNotice.astro',
    'apps/web/src/components/listing/LocationExceptionPanel.client.tsx',
    'apps/web/src/components/listing/SectionUnpublishedNotice.astro',
    'apps/web/src/components/listing/SupportEditNotice.astro',
    'apps/web/src/components/newsletter/NewsletterPreferences.client.tsx',
    'apps/web/src/components/newsletter/WhatsAppCTA.astro',
    'apps/web/src/components/venue/VenueDailySpecialsManager.client.tsx',
    'apps/web/src/components/venue/VenueEventsManager.client.tsx',
    'apps/web/src/components/venue/VenueListingStatsPanel.client.tsx',
    'apps/web/src/components/venue/VenueMenuManager.client.tsx',
    'apps/web/src/components/venue/VenueMenuQrWidget.client.tsx',
    'apps/web/src/components/venue/VenuePromotionsManager.client.tsx'
];

/** Zero-tolerance zone: the kit folder and the two new shell layouts. */
const STRICT_DIR = 'apps/web/src/components/account/ui/';
const STRICT_FILES: readonly string[] = [
    'apps/web/src/layouts/AccountShell.astro',
    'apps/web/src/layouts/AccountHeader.astro'
];

/** Extensions both guards read. */
export const SCANNED_EXTENSIONS: readonly string[] = ['.css', '.astro', '.tsx', '.ts'];

/** Strips `.client.tsx` / `.tsx` / `.ts` / `.astro` to get a component stem. */
function stemOf(file: string): string {
    return file.replace(/(?:\.client)?\.(?:tsx|ts|astro)$/, '');
}

/** The colocated CSS module of every explicit component file. */
const COMPONENT_CSS_MODULES: ReadonlySet<string> = new Set(
    ACCOUNT_SCOPE_COMPONENT_FILES.map((file) => `${stemOf(file)}.module.css`)
);
const COMPONENT_FILES: ReadonlySet<string> = new Set(ACCOUNT_SCOPE_COMPONENT_FILES);

/** Normalises a path to forward slashes. */
export function toPosix({ path }: { readonly path: string }): string {
    return path.split(sep).join('/');
}

/**
 * Tells whether a repo-relative file belongs to the account surface.
 *
 * @param input.file - Repo-relative path, forward slashes.
 * @returns `true` when the file is in scope.
 */
export function isInAccountScope({ file }: { readonly file: string }): boolean {
    if (!SCANNED_EXTENSIONS.some((ext) => file.endsWith(ext))) return false;
    if (/\.(?:test|spec)\.[tj]sx?$/.test(file) || file.endsWith('.d.ts')) return false;
    if (isInStrictZone({ file })) return true;
    if (ACCOUNT_SCOPE_DIRS.some((dir) => file.startsWith(dir))) return true;
    if (ACCOUNT_LAYOUT.test(file)) return true;
    return COMPONENT_FILES.has(file) || COMPONENT_CSS_MODULES.has(file);
}

/**
 * Tells whether a repo-relative path is in the zero-tolerance zone.
 *
 * @param input.file - Repo-relative path, forward slashes.
 * @returns `true` for the kit folder and the two shell layouts.
 */
export function isInStrictZone({ file }: { readonly file: string }): boolean {
    return file.startsWith(STRICT_DIR) || STRICT_FILES.includes(file);
}

function walk(dir: string, acc: string[]): void {
    let names: string[];
    try {
        names = readdirSync(dir);
    } catch {
        return;
    }
    for (const name of names) {
        if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, acc);
        else acc.push(full);
    }
}

/**
 * Lists every in-scope file under `apps/web/src`, repo-relative and sorted.
 *
 * @param input.root - Repo root.
 * @returns Repo-relative paths with forward slashes.
 */
export function listAccountScopeFiles({ root }: { readonly root: string }): string[] {
    const all: string[] = [];
    walk(join(root, WEB_SRC), all);
    return all
        .map((abs) => toPosix({ path: relative(root, abs) }))
        .filter((file) => isInAccountScope({ file }))
        .sort();
}

// ============================================================================
// Text helpers shared by both guards
// ============================================================================

/** Replaces a match with spaces of the same length, keeping newlines. */
function blank(match: string): string {
    return match.replace(/[^\n]/g, ' ');
}

/**
 * Blanks comments and `@supports` conditions, preserving offsets and line
 * breaks, so later matches report the right line.
 *
 * - Every file: `/* … *\/` and `<!-- … -->`.
 * - `.ts`, `.tsx`, `.astro`: `//` line comments too, except after `:` (a URL
 *   such as `https://…` is not a comment). A `//` inside a string that does
 *   not follow `:` is wrongly blanked: a known, accepted blind spot.
 * - `@supports <condition>` up to its `{`: a feature probe is not a rule.
 *
 * @param input.source - File content.
 * @param input.file - Path, used to pick the comment syntax.
 * @returns The cleaned content, same length as the input.
 */
export function cleanSource({
    source,
    file
}: {
    readonly source: string;
    readonly file: string;
}): string {
    let out = source
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/<!--[\s\S]*?-->/g, blank)
        .replace(/@supports\b[^{]*/g, blank);
    if (!file.endsWith('.css')) {
        out = out.replace(/(^|[^:\\])(\/\/[^\n]*)/g, (_m, lead: string, comment: string) => {
            return `${lead}${blank(comment)}`;
        });
    }
    return out;
}

/**
 * Returns the 1-based line of an offset.
 *
 * @param input.source - File content.
 * @param input.offset - Character offset.
 * @returns The line number.
 */
export function lineAt({
    source,
    offset
}: {
    readonly source: string;
    readonly offset: number;
}): number {
    let line = 1;
    for (let i = 0; i < offset && i < source.length; i++) if (source[i] === '\n') line++;
    return line;
}

/** A slice of a file that holds CSS, with its offset in the file. */
export interface CssRegion {
    /** `css`: rules and declarations; `decls`: a bare declaration list. */
    readonly kind: 'css' | 'decls';
    /** Offset of `text` in the file. */
    readonly offset: number;
    /** The region's text. */
    readonly text: string;
}

/**
 * Finds the CSS-bearing regions of a cleaned file:
 * a `.css` file whole, an `.astro` file's `<style>` bodies and `style="…"`
 * attributes. (`style={{…}}` objects are read separately, see
 * `findStyleObjects`.)
 *
 * @param input.source - Cleaned file content.
 * @param input.file - Path, used to pick the file type.
 * @returns The regions in file order.
 */
export function findCssRegions({
    source,
    file
}: {
    readonly source: string;
    readonly file: string;
}): CssRegion[] {
    if (file.endsWith('.css')) return [{ kind: 'css', offset: 0, text: source }];
    if (!file.endsWith('.astro')) return [];
    const regions: CssRegion[] = [];
    for (const m of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
        const body = m[1] ?? '';
        regions.push({ kind: 'css', offset: (m.index ?? 0) + m[0].indexOf(body), text: body });
    }
    for (const m of source.matchAll(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/g)) {
        const body = m[2] ?? '';
        regions.push({ kind: 'decls', offset: (m.index ?? 0) + m[0].indexOf(body), text: body });
    }
    return regions;
}

/** One property of a `style={{…}}` object, already converted to CSS. */
export interface StyleObjectEntry {
    /** CSS property name (kebab-case, or a `--custom` property). */
    readonly property: string;
    /** CSS value (a bare number for a length property gets `px`, as React does). */
    readonly value: string;
    /** Offset of the entry in the file. */
    readonly offset: number;
}

/** React properties whose bare numbers are px lengths. */
const PX_NUMBER_PROPS = /^(?:font-size|border(?:-[a-z]+)*-radius)$/;

/**
 * Reads literal entries of `style={{ … }}` objects in `.tsx`, `.ts` and
 * `.astro` files. Only string and number literals are seen; a value built
 * from a variable or a template with `${…}` is a blind spot.
 *
 * @param input.source - Cleaned file content.
 * @returns The entries, in file order.
 */
export function findStyleObjects({ source }: { readonly source: string }): StyleObjectEntry[] {
    const entries: StyleObjectEntry[] = [];
    for (const m of source.matchAll(/style\s*=\s*\{\{/g)) {
        const start = (m.index ?? 0) + m[0].length;
        let depth = 1;
        let end = start;
        while (end < source.length && depth > 0) {
            const ch = source[end];
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            end++;
        }
        const body = source.slice(start, end - 1);
        const entry =
            /(?:^|[,{\s])(?:(['"])(--[\w-]+)\1|([a-zA-Z]+))\s*:\s*(?:(['"`])([^'"`$]*?)\4|(-?\d+(?:\.\d+)?))(?=\s*[,}\n]|\s*$)/g;
        for (const e of body.matchAll(entry)) {
            const rawKey = e[2] ?? e[3] ?? '';
            const property = rawKey.startsWith('--')
                ? rawKey
                : rawKey.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
            const num = e[6];
            const value =
                num === undefined
                    ? (e[5] ?? '')
                    : num !== '0' && PX_NUMBER_PROPS.test(property)
                      ? `${num}px`
                      : num;
            entries.push({ property, value, offset: start + (e.index ?? 0) });
        }
    }
    return entries;
}

/** One `prop: value` declaration found in a CSS region. */
export interface CssDeclaration {
    /** Property name, lowercased (custom properties keep their case). */
    readonly property: string;
    /** Raw value text. */
    readonly value: string;
    /** Offset of the declaration in the file. */
    readonly offset: number;
}

/**
 * Lists the declarations of a CSS region. A `@media`/`@container` prelude or
 * a selector with a pseudo-class is never taken for a declaration, because a
 * declaration must end at `;` or `}`.
 *
 * @param input.region - A region from `findCssRegions`.
 * @returns The declarations in order.
 */
export function findDeclarations({ region }: { readonly region: CssRegion }): CssDeclaration[] {
    const text = region.kind === 'decls' ? `${region.text};` : region.text;
    const out: CssDeclaration[] = [];
    for (const m of text.matchAll(/(?<![\w-])(--[\w-]+|[a-zA-Z-]+)\s*:\s*([^;{}]*?)\s*(?=[;}])/g)) {
        const raw = m[1] ?? '';
        out.push({
            property: raw.startsWith('--') ? raw : raw.toLowerCase(),
            value: m[2] ?? '',
            offset: region.offset + (m.index ?? 0)
        });
    }
    return out;
}

/**
 * Per-file, per-rule counts, as stored in a frozen exceptions list:
 * `{ "<repo-relative file>": { "<rule>": <count> } }`.
 */
export type RuleCounts = Readonly<Record<string, Readonly<Record<string, number>>>>;

/** Result of comparing observed counts with a frozen exceptions list. */
export interface ExceptionsComparison {
    /** Strict-zone files with any hit. */
    readonly strictHits: readonly string[];
    /** Exceptions-list entries that point into the strict zone (refused). */
    readonly strictEntries: readonly string[];
    /** `file › rule` observed above its pinned count (new violations). */
    readonly raised: readonly string[];
    /** `file › rule` observed below its pinned count (stale entry). */
    readonly stale: readonly string[];
    /** The list holds more entries or a bigger total than its frozen ceiling. */
    readonly ceilingBreach: string | null;
}

/** Total entries (file × rule pairs with a count) and summed count of a list. */
export function summarize({ counts }: { readonly counts: RuleCounts }): {
    readonly entries: number;
    readonly total: number;
} {
    let entries = 0;
    let total = 0;
    for (const rules of Object.values(counts)) {
        for (const n of Object.values(rules)) {
            entries++;
            total += n;
        }
    }
    return { entries, total };
}

/**
 * Compares observed counts with a frozen, shrink-only exceptions list.
 *
 * @param input.observed - Counts measured now (strict-zone files included).
 * @param input.exceptions - The committed exceptions list.
 * @param input.ceiling - The frozen maximum size of the list.
 * @returns What fails, by kind.
 */
export function compareWithExceptions({
    observed,
    exceptions,
    ceiling
}: {
    readonly observed: RuleCounts;
    readonly exceptions: RuleCounts;
    readonly ceiling: { readonly entries: number; readonly total: number };
}): ExceptionsComparison {
    const strictHits: string[] = [];
    const strictEntries: string[] = [];
    const raised: string[] = [];
    const stale: string[] = [];
    for (const [file, rules] of Object.entries(observed)) {
        if (isInStrictZone({ file })) {
            strictHits.push(file);
            continue;
        }
        for (const [rule, n] of Object.entries(rules)) {
            const pinned = exceptions[file]?.[rule] ?? 0;
            if (n > pinned) raised.push(`${file} › ${rule}: ${n} found, ${pinned} pinned`);
        }
    }
    for (const [file, rules] of Object.entries(exceptions)) {
        if (isInStrictZone({ file })) {
            strictEntries.push(file);
            continue;
        }
        for (const [rule, pinned] of Object.entries(rules)) {
            const n = observed[file]?.[rule] ?? 0;
            if (n < pinned) stale.push(`${file} › ${rule}: ${n} found, ${pinned} pinned`);
        }
    }
    const size = summarize({ counts: exceptions });
    const ceilingBreach =
        size.entries > ceiling.entries || size.total > ceiling.total
            ? `the list holds ${size.entries} entries / ${size.total} hits; its frozen ceiling is ${ceiling.entries} / ${ceiling.total}`
            : null;
    return { strictHits, strictEntries, raised, stale, ceilingBreach };
}
