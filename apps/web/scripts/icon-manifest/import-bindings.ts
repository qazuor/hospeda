/**
 * @file import-bindings.ts
 * @description Parses which local identifiers a file bound from a named
 * import of `'@repo/icons'` (HOS-369 sprite-manifest).
 *
 * Handles the multi-line import blocks Biome produces once an import list
 * gets long (e.g. `eventCategoryIcon.ts`'s 13-name import) — the capturing
 * regex's `[^}]+` character class matches newlines by default in JS/TS, no
 * `s` flag needed, so a single pass covers both single-line and multi-line
 * forms.
 *
 * @module scripts/icon-manifest/import-bindings
 */

/**
 * Matches `import { ... } from '@repo/icons';` (single- or multi-line).
 * `\s*` between `import` and `{` means this does NOT match a whole-statement
 * type-only import (`import type { ... } from '@repo/icons'` has the word
 * `type` in between, breaking the whitespace-only gap) — every specifier in
 * one of those is a type by construction, so the whole block is correctly
 * out of scope for this scanner (see {@link findRepoIconsImportBindings}).
 */
const IMPORT_BLOCK_PATTERN = /import\s*\{([^}]+)\}\s*from\s*['"]@repo\/icons['"]/g;

/**
 * Finds every VALUE (never type-only) local identifier a file bound from
 * `'@repo/icons'`, mapped to the name it was actually imported as (handles
 * `X as Y` aliasing).
 *
 * A `type X` (or `import type { X }`) specifier is dropped, not just
 * unmarked: `@repo/icons` exports types that read exactly like a component
 * name once the `type` keyword is gone (`IconProps`, `SpriteWeight`, …), and
 * `ComponentType<IconProps>` is textually indistinguishable from a JSX open
 * tag to a regex scanner (`<IconProps>` — a generic type argument — matches
 * the same shape as `<IconProps />` would). Excluding type-only bindings
 * here is exact, not a heuristic: a type can never legitimately appear as a
 * rendered JSX tag, so this cannot drop a real icon usage.
 *
 * @param params.source - File contents to scan.
 * @returns Map of local binding name → imported (exported) name.
 */
export function findRepoIconsImportBindings({
    source
}: {
    readonly source: string;
}): ReadonlyMap<string, string> {
    const bindings = new Map<string, string>();

    for (const match of source.matchAll(IMPORT_BLOCK_PATTERN)) {
        const specifierList = match[1];
        if (!specifierList) continue;

        for (const rawSpecifier of specifierList.split(',')) {
            const trimmed = rawSpecifier.trim();
            if (trimmed.length === 0 || /^type\s+/.test(trimmed)) continue;

            const asParts = trimmed.split(/\s+as\s+/);
            const importedName = asParts[0]?.trim();
            const localName = (asParts[1] ?? asParts[0])?.trim();
            if (!importedName || !localName) continue;

            bindings.set(localName, importedName);
        }
    }

    return bindings;
}
