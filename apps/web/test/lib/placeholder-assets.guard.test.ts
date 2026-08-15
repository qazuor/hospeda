/**
 * @file placeholder-assets.guard.test.ts
 * @description Static guard: every placeholder image the code falls back to
 * must actually exist under `public/` (H-101).
 *
 * ## The bug this exists to catch
 *
 * The accommodation detail page fell back to
 * `/images/placeholder-accommodation.svg`. The file lives at
 * `/assets/images/placeholder-accommodation.svg`. Verified against production:
 * the first path returns **404**, the second **200**.
 *
 * So a listing with no photo did not render a tidy placeholder — it rendered a
 * broken `<img>`, `naturalWidth === 0`, on an indexable public page. The smoke
 * finding described exactly that: "src puesto que no resuelve". The fallback was
 * never missing; it pointed at nothing.
 *
 * Six call sites carried the same wrong prefix, across accommodations,
 * destinations, events, gastronomy and experiences. Six wrong call sites is not
 * six bugs to fix one by one — it is a missing guard, so this is the guard.
 *
 * ## Why a scan rather than per-call-site assertions
 *
 * A test per fallback would pass the day someone adds the seventh. This asserts
 * the property itself: no matter where a placeholder path is written, the file
 * is on disk. It also fails when it finds NOTHING to check, because a scan that
 * silently matches zero literals is the classic way a guard reports green while
 * measuring nothing.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = resolve(__dirname, '../..');
const PUBLIC_DIR = join(WEB_ROOT, 'public');

/**
 * Matches a quoted absolute path to a placeholder image asset.
 *
 * Deliberately keyed on the word `placeholder`, which is what keeps the JSDoc
 * examples elsewhere in the tree (`/images/cabin.jpg`, `/images/hero-1.jpg`)
 * out of the result without having to strip comments — stripping comments to
 * assert an absence is how a guard ends up eating the code it was meant to
 * check.
 */
const PLACEHOLDER_LITERAL = /['"`](\/[^'"`\s]*placeholder[^'"`\s]*\.(?:svg|png|jpe?g|webp))['"`]/g;

/** One referenced placeholder path and where it was written. */
interface PlaceholderReference {
    readonly path: string;
    readonly file: string;
}

/**
 * Exact `file → path` pairs that are documentation, not real references.
 *
 * `image-fallback.ts` documents the `data-fallback` attribute it implements, and
 * its JSDoc example naturally contains a placeholder path. The exemption is
 * pinned to the exact pair rather than to the file, so a REAL broken fallback
 * added to that same file is still caught — an escape hatch wide enough to hide
 * the next bug is worse than no guard.
 */
const DOCUMENTATION_EXAMPLES: ReadonlySet<string> = new Set([
    'src/scripts/image-fallback.ts → /placeholder.webp',
    'src/scripts/image-fallback.ts → /path/to/placeholder.webp'
]);

/** Source extensions worth scanning. */
const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.astro']);

/**
 * Lists every scannable source file under a directory, recursively.
 *
 * Hand-rolled rather than pulling in a glob dependency: `apps/web` does not
 * carry one, and a guard is not worth a new package.
 *
 * @param dir - Directory to walk.
 * @returns Absolute paths of the matching files.
 */
function listSourceFiles(dir: string): readonly string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...listSourceFiles(full));
            continue;
        }
        if (SCANNED_EXTENSIONS.has(extname(entry.name))) out.push(full);
    }
    return out;
}

/**
 * Collects every placeholder asset path referenced from the web source tree.
 *
 * @returns The referenced paths with their source file, deduplicated per file.
 */
function collectPlaceholderReferences(): readonly PlaceholderReference[] {
    const files = listSourceFiles(join(WEB_ROOT, 'src'));
    const found: PlaceholderReference[] = [];

    for (const file of files) {
        const source = readFileSync(file, 'utf8');
        const seen = new Set<string>();
        for (const match of source.matchAll(PLACEHOLDER_LITERAL)) {
            const path = match[1];
            if (!path || seen.has(path)) continue;
            seen.add(path);
            found.push({ path, file: file.slice(WEB_ROOT.length + 1) });
        }
    }

    return found;
}

describe('placeholder assets', () => {
    const references = collectPlaceholderReferences();

    it('should find placeholder references at all', () => {
        // A scan that matches nothing passes every other assertion in this file
        // for free. If the regex or the glob ever stops matching, this fails
        // instead of quietly certifying an empty set.
        expect(references.length).toBeGreaterThan(0);
    });

    it('should resolve every referenced placeholder to a file on disk', () => {
        // Arrange / Act
        const broken = references
            .filter(
                (reference) => !DOCUMENTATION_EXAMPLES.has(`${reference.file} → ${reference.path}`)
            )
            .filter((reference) => !existsSync(join(PUBLIC_DIR, reference.path)));

        // Assert — the message names the file and the path so the fix is
        // obvious; a bare count would send the reader hunting.
        expect(
            broken.map((b) => `${b.file} → ${b.path}`),
            'these placeholder paths do not exist under apps/web/public'
        ).toEqual([]);
    });
});
