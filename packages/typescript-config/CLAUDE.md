# CLAUDE.md - TypeScript Config Package

> Main docs: See [README.md](./README.md)
> Project docs: See [root CLAUDE.md](../../CLAUDE.md)

## Overview

Shared TypeScript configuration bases for the entire monorepo. Provides strict, consistent compiler settings that all packages and apps extend via their local `tsconfig.json` files.

## Key Files

```
├── base.json            # Base tsconfig (strict mode, ESM, modern target)
├── app-base.json        # Extended config for applications (apps/)
├── package-base.json    # Extended config for library packages (packages/)
├── react-library.json   # Extended config for React-based packages
└── package.json         # Package metadata
```

## Usage

In any package `tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/package-base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

For React libraries:

```json
{
  "extends": "@repo/typescript-config/react-library.json"
}
```

## Patterns

- **Strict mode is enforced**.. `strict: true` in base config, never disable it
- **No `any` types**.. use `unknown`, generics, or proper type definitions
- Use `import type` for type-only imports (enforced by `verbatimModuleSyntax`)
- All packages target ESM (`"module": "ESNext"`)
- Never override `strict`, `noUncheckedIndexedAccess`, or `noImplicitReturns` in local configs
- Add path aliases in the relevant base config, not in individual packages
- When adding a new package, choose the appropriate base: `package-base.json` for libraries, `app-base.json` for apps, `react-library.json` for React packages

## TypeScript 6 notes (HOS-4)

The shared bases deliberately set **no** emit-shaping options: no `declaration`,
`declarationMap`, `outDir`, or `sourceMap`. Declarations and sourcemaps are emitted per
package by tsup (its own `dts` + `sourcemap`), so `tsc` is only ever used for `--noEmit`
type checking. If any of those options is added back here (or in a package's local tsconfig),
TS6 starts validating `rootDir`, which rejects the monorepo's cross-package `paths` -> sibling
`src` mappings with TS6059 ("not under rootDir"). Keeping them out lets typecheck resolve
`@repo/*` straight from source (fast DX). Do not reintroduce them.

`ignoreDeprecations: "6.0"` in `base.json` tolerates a `baseUrl` that tsup hardcodes into its
DTS pass (TS5101 under TS6). We removed `baseUrl` from every tsconfig we control, but tsup's
injected one is out of our hands. It is inherited tree-wide; today the only 6.0-deprecated
option present is that injected `baseUrl`. It is scoped to the `"6.0"` window, so it does not
mask options removed later in TS7. Drop it once tsup stops injecting `baseUrl` (or at the TS7
migration).

These base files must stay **strict JSON** with no comments: `test/smoke.test.ts` parses them
with `JSON.parse`. That is why this rationale lives here rather than inline.

## Related Documentation

- `docs/contributing/README.md` - Code standards and contribution guidelines
