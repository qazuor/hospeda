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

## Related Documentation

- `docs/contributing/README.md` - Code standards and contribution guidelines
