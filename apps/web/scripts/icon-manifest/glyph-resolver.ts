/**
 * @file glyph-resolver.ts
 * @description Maps `@repo/icons` wrapper export names (e.g. `"StarIcon"`) to
 * the sprite glyph name the real sprite generator
 * (`apps/web/src/lib/icon-sprite.ts`) keys `<symbol>`s by — the Phosphor raw
 * component's OWN `displayName`, not the wrapper's (HOS-369 sprite-manifest).
 *
 * ## Why this reads `index.ts`'s export list, not a directory glob
 *
 * Several wrapper names are declared in MORE than one file under
 * `packages/icons/src/icons/` (e.g. both `icons/actions/EditIcon.tsx` and
 * `icons/utilities/EditIcon.tsx` define `EditIcon`) — only one of which is
 * actually re-exported from the package barrel (`index.ts`); the other is
 * dead weight `@repo/icons` never surfaces. A directory glob has no way to
 * tell them apart and would resolve the wrapper name to whichever file the
 * walk happened to visit last — silently correct for most names, silently
 * WRONG for the handful that collide. Parsing `index.ts`'s own
 * `export { X } from './icons/…/X';` lines is authoritative: it is the exact
 * same statement `import { X } from '@repo/icons'` resolves through, so this
 * script cannot resolve a name to a file the barrel would not.
 *
 * ## Why this is built by TEXT parsing, not by importing `@repo/icons`
 *
 * `@repo/icons`'s barrel also re-exports brand-mark icons built by
 * `createBrandIcon` (`FacebookIcon`, `InstagramIcon`, …) and a couple of
 * fully hand-written components (`BridgeIcon`) — real JSX literals, not
 * `createPhosphorIcon(...)` calls. This script runs under plain `tsx`,
 * outside the Vite/Astro pipeline that normally transforms that JSX, and
 * blows up importing them. Neither kind calls `markIconSpriteGlyph`, so
 * `getIconSpriteName` returns `null` for every one of them at real runtime
 * anyway — they can NEVER appear in the sprite. Skipping them here costs
 * zero manifest coverage; it only avoids a JSX transform this script has no
 * reason to depend on.
 *
 * Instead: every sprite-eligible wrapper's file is a one-icon, JSX-free
 * module of the exact shape
 * `export const XIcon = createPhosphorIcon(Y, 'name', {...});` — parsed here
 * with a regex, never executed. The only executed import is
 * `@phosphor-icons/react` itself (a plain compiled package, safe to import),
 * used solely to read the REAL `displayName` Phosphor assigned to `Y` — the
 * exact value {@link getIconSpriteName} returns at runtime, so this script
 * cannot silently drift from the naming convention it mirrors.
 *
 * @module scripts/icon-manifest/glyph-resolver
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as phosphorIcons from '@phosphor-icons/react';

const currentDir = dirname(fileURLToPath(import.meta.url));

/** The four weights the sprite ships. Mirrors `@repo/icons`' `SPRITE_WEIGHTS`. */
const SPRITE_WEIGHTS = ['regular', 'bold', 'fill', 'duotone'] as const;
type SpriteWeight = (typeof SPRITE_WEIGHTS)[number];

function isSpriteWeight(value: string): value is SpriteWeight {
    return (SPRITE_WEIGHTS as ReadonlyArray<string>).includes(value);
}

const ICONS_PACKAGE_SRC_DIR = resolve(currentDir, '../../../../packages/icons/src');
const INDEX_FILE = resolve(ICONS_PACKAGE_SRC_DIR, 'index.ts');

/** Matches `export { A, B } from './icons/category/File';` lines in `index.ts`. */
const BARREL_EXPORT_PATTERN = /^export \{ ([^}]+) \} from '(\.\/icons\/[^']+)';$/gm;

/** Matches `export const NAME = createPhosphorIcon(Glyph, 'name', {...});`. */
const WRAPPER_DECLARATION_PATTERN =
    /export const (\w+) = createPhosphorIcon\(\s*([A-Za-z0-9_]+)\s*,\s*'[^']*'(?:\s*,\s*\{([\s\S]*?)\}\s*)?\)/g;

/** Resolves a `defaultWeight` override out of a `createPhosphorIcon` options block. */
function readDefaultWeight(optionsBlock: string | undefined): SpriteWeight {
    const match = optionsBlock ? /defaultWeight:\s*['"]([a-z]+)['"]/.exec(optionsBlock) : null;
    return match?.[1] && isSpriteWeight(match[1]) ? match[1] : 'duotone';
}

/** Resolves the real Phosphor `displayName` for a `@phosphor-icons/react` export. */
function readPhosphorDisplayName(phosphorImportName: string): string | null {
    const component = (phosphorIcons as Record<string, unknown>)[phosphorImportName];
    const displayName =
        component !== null && (typeof component === 'function' || typeof component === 'object')
            ? (component as { displayName?: unknown }).displayName
            : undefined;
    return typeof displayName === 'string' && displayName.length > 0 ? displayName : null;
}

/** One resolved wrapper: its sprite name and the weight it defaults to. */
export interface WrapperGlyphInfo {
    /** Sprite name of the glyph — the Phosphor component's own `displayName`. */
    readonly spriteName: string;
    /** Weight `createPhosphorIcon` resolves to when a call site passes none. */
    readonly defaultWeight: SpriteWeight;
}

/**
 * Builds the wrapper-export-name → {@link WrapperGlyphInfo} index by walking
 * `packages/icons/src/index.ts`'s own re-export list — the exact set of
 * names `import { X } from '@repo/icons'` can produce — and, for each one
 * backed by a `createPhosphorIcon(...)` declaration, resolving its glyph via
 * `@phosphor-icons/react`.
 *
 * @returns Map keyed by wrapper export name (e.g. `"StarIcon"`, `"AddIcon"`).
 *   A name backed by a brand icon, a hand-written component, or a Phosphor
 *   import this function cannot resolve a `displayName` for is simply absent
 *   — see the module doc for why that is correct, not a gap.
 */
export function buildWrapperGlyphIndex(): ReadonlyMap<string, WrapperGlyphInfo> {
    const barrelSource = readFileSync(INDEX_FILE, 'utf8');
    const index = new Map<string, WrapperGlyphInfo>();
    const fileSourceCache = new Map<string, string>();

    for (const match of barrelSource.matchAll(BARREL_EXPORT_PATTERN)) {
        const [, namesText, relativePath] = match;
        if (!namesText || !relativePath) continue;

        const filePath = resolve(ICONS_PACKAGE_SRC_DIR, `${relativePath}.tsx`);
        let fileSource = fileSourceCache.get(filePath);
        if (fileSource === undefined) {
            try {
                fileSource = readFileSync(filePath, 'utf8');
            } catch {
                fileSource = '';
            }
            fileSourceCache.set(filePath, fileSource);
        }
        if (fileSource.length === 0) continue;

        // One file can declare more than one `createPhosphorIcon` const (rare,
        // but `index.ts` sometimes re-exports two names off one file) — read
        // every declaration once and keep the ones this barrel line names.
        const declared = new Map<string, { phosphorImportName: string; optionsBlock?: string }>();
        for (const declMatch of fileSource.matchAll(WRAPPER_DECLARATION_PATTERN)) {
            const [, declName, phosphorImportName, optionsBlock] = declMatch;
            if (declName && phosphorImportName) {
                declared.set(declName, { phosphorImportName, optionsBlock });
            }
        }

        for (const rawName of namesText.split(',')) {
            // Handle `X as Y` re-export aliasing defensively, though `index.ts`
            // does not use it for `createPhosphorIcon`-backed names today.
            const parts = rawName.trim().split(/\s+as\s+/);
            const localName = parts[0]?.trim();
            const exportedName = (parts[1] ?? parts[0])?.trim();
            if (!localName || !exportedName) continue;

            const declaration = declared.get(localName);
            if (!declaration) continue;

            const spriteName = readPhosphorDisplayName(declaration.phosphorImportName);
            if (spriteName === null) continue;

            index.set(exportedName, {
                spriteName,
                defaultWeight: readDefaultWeight(declaration.optionsBlock)
            });
        }
    }

    return index;
}
