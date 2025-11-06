# @repo/typescript-config

Shared TypeScript configuration presets for the Hospeda monorepo. Provides consistent TypeScript settings across all packages and applications with optimized configurations for different project types.

## Features

- **Multiple Presets**: Specialized configs for apps, packages, and React libraries
- **Strict Type Safety**: Enforces strict TypeScript rules across the codebase
- **Monorepo Support**: Pre-configured path mappings for internal packages
- **Modern JavaScript**: ES2022 target with ESNext modules
- **Zero Configuration**: Extends and use, no additional setup needed

## Available Configurations

### 1. `base.json` - Base Configuration

Core TypeScript settings used by all other configurations.

**Key Settings:**

- **Strict Mode**: Enabled for maximum type safety
- **Module System**: ESNext with bundler resolution
- **Target**: ES2022
- **Library**: ES2022
- **No Unchecked Index Access**: Prevents runtime errors from array/object access
- **Isolated Modules**: Required for bundlers and build tools
- **Resolve JSON**: Import JSON files with type safety
- **Skip Lib Check**: Faster builds by skipping .d.ts checks

**When to use:** Never directly - use app-base, package-base, or react-library instead

### 2. `app-base.json` - Application Configuration

Optimized for frontend applications (web, admin).

**Extends:** `base.json`

**Additional Settings:**

- **Libraries**: ES2022, DOM, DOM.Iterable
- **No Emit**: Type checking only (bundler handles output)
- **Allow Importing TS Extensions**: Support for `.ts` imports in bundler context
- **Path Mappings**: Pre-configured for all `@repo/*` packages

**When to use:** Astro apps, TanStack Start apps, any frontend application

**Example (`apps/web/tsconfig.json`):**

```json
{
  "extends": "@repo/typescript-config/app-base.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"]
}
```

### 3. `package-base.json` - Package Configuration

Optimized for shared packages that emit type declarations.

**Extends:** `base.json`

**Additional Settings:**

- **Emit Declaration Only**: Only generate `.d.ts` files
- **No Emit**: false (packages need to emit declarations)
- **Path Mappings**: Relative paths for sibling packages
- **Excludes**: Tests and specs from declaration output

**When to use:** All packages in `packages/` directory

**Example (`packages/utils/tsconfig.json`):**

```json
{
  "extends": "@repo/typescript-config/package-base.json",
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

### 4. `react-library.json` - React Library Configuration

Optimized for React component libraries.

**Extends:** `base.json`

**Additional Settings:**

- **JSX**: `react-jsx` (automatic runtime)

**When to use:** UI component libraries using React

**Example (`packages/ui/tsconfig.json`):**

```json
{
  "extends": "@repo/typescript-config/react-library.json",
  "compilerOptions": {
    "emitDeclarationOnly": true,
    "noEmit": false
  },
  "include": ["src/**/*"]
}
```

## Usage

### In Applications

```json
{
  "extends": "@repo/typescript-config/app-base.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

### In Packages

```json
{
  "extends": "@repo/typescript-config/package-base.json",
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

### In React Libraries

```json
{
  "extends": "@repo/typescript-config/react-library.json",
  "compilerOptions": {
    "emitDeclarationOnly": true,
    "noEmit": false
  },
  "include": ["src/**/*"]
}
```

## Path Mappings

All configurations include pre-configured path mappings for internal packages:

```typescript
// Import from any internal package
import { logger } from '@repo/logger';
import { validateEmail } from '@repo/utils';
import type { User } from '@repo/db';
import { userSchema } from '@repo/schemas';
```

### Available Paths

- `@repo/config` → `packages/config/src`
- `@repo/db` → `packages/db/src`
- `@repo/logger` → `packages/logger/src`
- `@repo/schemas` → `packages/schemas/src`
- `@repo/ui` → `packages/ui/src`
- `@repo/utils` → `packages/utils/src`
- `@repo/service-core` → `packages/service-core/src`
- `@repo/seed` → `packages/seed/src`

**Note:** Path mappings differ between apps and packages:

- **Apps**: `../../packages/config/src/index.ts`
- **Packages**: `../config/src/index.ts`

## Strict Type Checking

All configurations enforce strict type checking:

```typescript
// ✅ Good: Type-safe code
function greet(name: string): string {
  return `Hello, ${name}!`;
}

// ❌ Bad: Implicit any
function greet(name) {
  return `Hello, ${name}!`;
}

// ✅ Good: Safe array access
const users: string[] = ['Alice', 'Bob'];
const user: string | undefined = users[0];

// ❌ Bad: Unchecked index access (disabled by noUncheckedIndexedAccess)
const users: string[] = ['Alice', 'Bob'];
const user: string = users[0]; // Type error!
```

## Configuration Reference

### Compiler Options

#### Module Resolution

```json
{
  "module": "ESNext",
  "moduleResolution": "bundler",
  "moduleDetection": "force"
}
```

**Why:**

- `ESNext`: Use modern ES modules
- `bundler`: Optimized for Vite, Turbopack, esbuild
- `force`: Treat all files as modules

#### Type Checking

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "isolatedModules": true
}
```

**Why:**

- `strict`: Enable all strict type-checking options
- `noUncheckedIndexedAccess`: Prevent runtime errors from array/object access
- `isolatedModules`: Required for fast bundlers

#### Output

```json
{
  "target": "ES2022",
  "lib": ["es2022"],
  "declaration": true,
  "declarationMap": true,
  "sourceMap": true
}
```

**Why:**

- `ES2022`: Modern JavaScript features
- `declaration`: Generate `.d.ts` files
- `sourceMap`: Enable debugging

## Best Practices

### 1. Always Extend a Preset

```json
// ✅ Good
{
  "extends": "@repo/typescript-config/app-base.json"
}

// ❌ Bad: Starting from scratch
{
  "compilerOptions": {
    "strict": true
  }
}
```

### 2. Minimal Overrides

```json
// ✅ Good: Only override what's needed
{
  "extends": "@repo/typescript-config/app-base.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}

// ❌ Bad: Duplicating base config
{
  "extends": "@repo/typescript-config/app-base.json",
  "compilerOptions": {
    "strict": true,
    "module": "ESNext",
    "jsx": "react-jsx"
  }
}
```

### 3. Proper Include/Exclude

```json
{
  "extends": "@repo/typescript-config/package-base.json",
  "include": ["src/**/*"],
  "exclude": [
    "dist",
    "node_modules",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

### 4. Use Path Mappings

```typescript
// ✅ Good: Use path mappings
import { logger } from '@repo/logger';

// ❌ Bad: Relative paths across packages
import { logger } from '../../../packages/logger/src';
```

## Type Safety Examples

### No Implicit Any

```typescript
// ❌ Error: Parameter 'x' implicitly has an 'any' type
function double(x) {
  return x * 2;
}

// ✅ Correct: Explicit type
function double(x: number): number {
  return x * 2;
}
```

### No Unchecked Index Access

```typescript
// ❌ Error: Array access returns T | undefined
const users = ['Alice', 'Bob'];
const first: string = users[0]; // Type error!

// ✅ Correct: Handle undefined
const first: string | undefined = users[0];
const firstSafe = users[0] ?? 'Anonymous';
```

### Isolated Modules

```typescript
// ❌ Error: File is not a module
const x = 10;

// ✅ Correct: Export to make it a module
export const x = 10;

// Or add export {}
const x = 10;
export {};
```

## Troubleshooting

### Issue: "Cannot find module '@repo/logger'"

**Solution:** Ensure path mappings are correct for your project type:

```json
// For apps
"@repo/logger": ["../../packages/logger/src/index.ts"]

// For packages
"@repo/logger": ["../logger/src/index.ts"]
```

### Issue: "Type error in node_modules"

**Solution:** `skipLibCheck` is already enabled in base config. If still seeing errors, check for:

- Outdated dependencies
- Incompatible type definitions
- Missing peer dependencies

### Issue: "Cannot write file because it would overwrite input file"

**Solution:** Ensure proper output directory configuration:

```json
{
  "compilerOptions": {
    "outDir": "dist"
  },
  "exclude": ["dist", "node_modules"]
}
```

### Issue: "Cannot use JSX unless '--jsx' flag is provided"

**Solution:** Use `react-library.json` for React components:

```json
{
  "extends": "@repo/typescript-config/react-library.json"
}
```

## Migration Guide

### From Custom Config to Preset

**Before:**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

**After:**

```json
{
  "extends": "@repo/typescript-config/package-base.json"
}
```

### From JavaScript to TypeScript

1. Extend appropriate config
2. Enable strict mode progressively
3. Fix type errors incrementally

```json
{
  "extends": "@repo/typescript-config/app-base.json",
  "compilerOptions": {
    "strict": false,
    "allowJs": true
  }
}
```

## Development

### Testing Config Changes

```bash
# Type check all packages
pnpm typecheck

# Type check specific package
cd packages/logger && pnpm run typecheck

# Type check specific app
cd apps/api && pnpm run typecheck
```

### Validating Path Mappings

```typescript
// Test imports from all packages
import { logger } from '@repo/logger';
import { db } from '@repo/db';
import { validateEmail } from '@repo/utils';

// TypeScript should resolve these without errors
```

## Integration with Other Tools

### With Biome

```json
{
  "extends": "@repo/typescript-config/package-base.json",
  "compilerOptions": {
    "noEmit": true
  }
}
```

Biome handles linting/formatting, TypeScript handles type checking.

### With Vite/Turbopack

```json
{
  "extends": "@repo/typescript-config/app-base.json",
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

Bundler resolution mode optimized for Vite and Turbopack.

### With Drizzle ORM

```json
{
  "extends": "@repo/typescript-config/package-base.json",
  "compilerOptions": {
    "strictNullChecks": true
  }
}
```

Strict null checks ensure type-safe database queries.

## Related Packages

- `@repo/biome-config` - Linting and formatting configuration
- `@repo/tailwind-config` - Tailwind CSS configuration

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Compiler Options](https://www.typescriptlang.org/tsconfig)
- [Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)

## License

Private - Hospeda Project
