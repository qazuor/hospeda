# CLAUDE.md - Biome Config Package

> Main docs: See [README.md](./README.md)
> Project docs: See [root CLAUDE.md](../../CLAUDE.md)

## Overview

Shared Biome configuration for linting and formatting across the entire monorepo. All packages and apps extend this base configuration via their local `biome.json` files.

## Key Files

```
├── biome.json     # Base Biome configuration (linting + formatting rules)
├── package.json   # Package metadata
└── README.md      # Usage documentation
```

## Usage

In any package or app `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "extends": ["@repo/biome-config/biome.json"],
  "files": {
    "include": ["src/**/*.ts", "src/**/*.tsx"]
  }
}
```

## Patterns

- This is the single source of truth for linting and formatting rules
- Never override rules in local `biome.json` unless absolutely necessary
- Pre-commit hooks (husky + lint-staged) run Biome on all staged files

### Common Gotchas

These rules frequently cause commit failures:

- **`useDefaultParameterLast`**: Parameters with default values MUST come after required parameters. `fn(a, b = 'x', c)` fails.. use `fn(a, c, b = 'x')`
- **`noExplicitAny`**: `biome-ignore` comments on interface/type properties do NOT work.. use proper types instead of `any`
- **`useExhaustiveDependencies`**: `useMemo`/`useEffect` must list ALL dependencies. Pass whole objects (e.g., `[config]`) instead of individual properties
- **`noUnusedVariables`**: Prefix unused parameters with `_` (e.g., `_ctx` instead of `ctx`)

## Related Documentation

- `docs/contributing/README.md` - Contributing guidelines and code standards
