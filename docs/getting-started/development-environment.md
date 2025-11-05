# Development Environment

This guide will help you configure your development environment for maximum productivity when working on Hospeda.

---

## Prerequisites

Before starting, ensure you've completed:

- [Prerequisites](prerequisites.md) - Tools installation
- [Installation](installation.md) - Project setup

---

## VSCode Configuration

### Workspace Settings

The project includes preconfigured VSCode settings in `.vscode/settings.json`. These settings are automatically applied when you open the project.

**Key configurations:**

- File watchers exclude generated files
- Search excludes node_modules and dist
- Comment highlighting for TODO, FIXME, WARN
- TypeScript and Biome integration
- Markdown linting

### Recommended Extensions

The project includes a curated list of extensions in `.vscode/extensions.json`. VSCode will prompt you to install them when you open the project.

#### Essential Extensions (Required)

**Biome** (`biomejs.biome`)

- All-in-one linter and formatter
- Faster than ESLint + Prettier
- Configured via `biome.json`

**Astro** (`astro-build.astro-vscode`)

- Syntax highlighting for Astro files
- IntelliSense and diagnostics
- Required for web app development

**Pretty TypeScript Errors** (`yoavbls.pretty-ts-errors`)

- Makes TypeScript errors readable
- Improves error messages with formatting

**Error Lens** (`usernamehw.errorlens`)

- Shows errors inline in code
- Highlights issues as you type

#### Markdown Extensions

**Markdown All in One** (`yzhang.markdown-all-in-one`)

- Shortcuts, table of contents, formatting
- Preview and editing enhancements

**markdownlint** (`davidanson.vscode-markdownlint`)

- Lints markdown files
- Ensures consistent formatting
- Configured via `.markdownlint-cli2.jsonc`

#### Quality of Life Extensions

**Better Comments** (`aaron-bond.better-comments`)

- Colorizes comments (TODO, FIXME, IMPORTANT)
- Improves code readability

**Highlight Matching Tag** (`vincaslt.highlight-matching-tag`)

- Highlights matching HTML/JSX tags
- Useful for React components

**Indent Rainbow** (`oderwat.indent-rainbow`)

- Colorizes indentation levels
- Helps visualize nesting

**Trailing Spaces** (`shardulm94.trailing-spaces`)

- Highlights trailing whitespace
- Auto-removes on save

### Install All Extensions

#### Via VSCode UI

1. Open Command Palette (`Cmd/Ctrl + Shift + P`)
2. Type "Extensions: Show Recommended Extensions"
3. Click "Install All"

#### Via Command Line

```bash
# Install all at once
code --install-extension biomejs.biome
code --install-extension yoavbls.pretty-ts-errors
code --install-extension astro-build.astro-vscode
code --install-extension yzhang.markdown-all-in-one
code --install-extension davidanson.vscode-markdownlint
code --install-extension aaron-bond.better-comments
code --install-extension vincaslt.highlight-matching-tag
code --install-extension oderwat.indent-rainbow
code --install-extension shardulm94.trailing-spaces
code --install-extension usernamehw.errorlens
```

---

## Code Formatting & Linting

### Biome Configuration

The project uses Biome for linting and formatting TypeScript/JavaScript files.

**Configuration file:** `biome.json`

**Run manually:**

```bash
# Format all files
pnpm check

# Format specific app/package
pnpm --filter=api check
```

**VSCode integration:**

- Format on save: Enabled automatically
- Format on paste: Enabled automatically
- Linting: Real-time as you type

### Markdown Formatting

**Configuration file:** `.markdownlint-cli2.jsonc`

**Run manually:**

```bash
# Format all markdown
pnpm format:md

# Format only .claude docs
pnpm format:md:claude

# Check without fixing
pnpm lint:md
```

**VSCode integration:**

- markdownlint extension shows errors inline
- Auto-fix on save via lint-staged

### Git Hooks (Husky + lint-staged)

Pre-commit hooks automatically run on `git commit`:

1. **Biome** checks TypeScript/JavaScript files
2. **markdownlint** formats Markdown files
3. **TODO sync** syncs TODO comments to GitHub

**Configuration:** `.husky/pre-commit` + `package.json` lint-staged

**Bypass hooks** (not recommended):

```bash
git commit --no-verify
```

---

## Debugging

### VSCode Debugging Setup

#### Debug API (Hono)

1. Start API in debug mode:

   ```bash
   cd apps/api
   pnpm dev
   ```

2. In VSCode:
   - Open `apps/api/src/index.ts`
   - Press `F5` or click "Run and Debug"
   - Select "Node: Attach"
   - Set breakpoints

#### Debug Frontend (Astro/TanStack)

**Astro (Web):**

1. Start dev server:

   ```bash
   cd apps/web
   pnpm dev
   ```

2. Open browser DevTools (`F12`)
3. Use Sources tab for debugging
4. Set breakpoints in browser

**TanStack Start (Admin):**

1. Start dev server:

   ```bash
   cd apps/admin
   pnpm dev
   ```

2. Use browser DevTools for client-side
3. Use VSCode for server-side (SSR) debugging

#### Debug Tests

**Run tests with debugger:**

```bash
# Via VSCode
# Open test file → Click "Debug Test" above test

# Via CLI
pnpm test --inspect-brk
```

Then attach VSCode debugger (F5 → "Node: Attach")

### Common Breakpoint Locations

**API:**

- Route handlers: `apps/api/src/routes/**/*.ts`
- Services: `packages/service-core/src/services/**/*.ts`
- Middleware: `apps/api/src/middleware/**/*.ts`

**Database:**

- Models: `packages/db/src/models/**/*.ts`
- Queries: `packages/service-core/src/services/**/*.ts`

**Frontend:**

- Components: `apps/web/src/components/**/*.tsx`
- Pages: `apps/web/src/pages/**/*.astro`
- API calls: `apps/admin/src/routes/**/*.tsx`

---

## TypeScript Configuration

### Project TypeScript Setup

**Root:** `tsconfig.json` (base configuration)

**Per-app/package:** Extends root config

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### VSCode TypeScript Integration

**Use workspace TypeScript version:**

1. Open any `.ts` file
2. Click TypeScript version in status bar (bottom right)
3. Select "Use Workspace Version"

**TypeScript version:** See `package.json` devDependencies

**Restart TypeScript server:**

- Command Palette → "TypeScript: Restart TS Server"
- Fixes most IntelliSense issues

### Common TypeScript Issues

**Problem:** Red squiggly lines everywhere

**Solution:**

```bash
# Build all packages first
pnpm build

# Or run typecheck
pnpm typecheck
```

---

**Problem:** Import errors for `@repo/*` packages

**Solution:**

```bash
# Reinstall dependencies
pnpm install

# Restart TypeScript server
```

---

**Problem:** Can't find type definitions

**Solution:**

Check if package has types:

```bash
pnpm add -D @types/package-name
```

---

## Environment Variables

### Development Environment Files

**`.env.local`** (git-ignored)

- Your local development config
- Copy from `.env.example`
- Override defaults as needed

**`.env.example`** (committed)

- Template for all env vars
- Documents required variables
- Safe defaults where possible

### Loading Environment Variables

**Monorepo root:** Loaded by all apps/packages

**Per-app:** Additional app-specific env vars

**Validation:** `@repo/config` package validates all env vars on startup

### Common Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."

# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="..."
CLERK_SECRET_KEY="..."

# API
API_PORT=3000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS="http://localhost:4321,http://localhost:3001"
```

**See full list:** `.env.example`

---

## Keyboard Shortcuts

### Essential VSCode Shortcuts

**Navigation:**

- `Cmd/Ctrl + P` - Quick file open
- `Cmd/Ctrl + Shift + F` - Search in files
- `Cmd/Ctrl + Shift + P` - Command Palette
- `Cmd/Ctrl + B` - Toggle sidebar
- `Cmd/Ctrl + J` - Toggle terminal

**Editing:**

- `Cmd/Ctrl + D` - Select next occurrence
- `Alt + Up/Down` - Move line up/down
- `Alt + Shift + Up/Down` - Copy line up/down
- `Cmd/Ctrl + /` - Toggle comment
- `Cmd/Ctrl + Shift + K` - Delete line

**Code Navigation:**

- `F12` - Go to definition
- `Alt + F12` - Peek definition
- `Shift + F12` - Find all references
- `F2` - Rename symbol

**Debugging:**

- `F5` - Start/Continue debugging
- `F9` - Toggle breakpoint
- `F10` - Step over
- `F11` - Step into
- `Shift + F11` - Step out

### Terminal Shortcuts

**In VSCode terminal:**

- `Ctrl + C` - Stop running process
- `Ctrl + L` - Clear terminal
- `Ctrl + R` - Search command history

---

## Code Snippets

### TypeScript Snippets

Create `.vscode/snippets.json` for custom snippets:

```json
{
  "RO-RO Function": {
    "prefix": "roro",
    "body": [
      "export function $1(params: { $2 }): $3 {",
      "  $0",
      "  return {};",
      "}"
    ]
  },
  "Zod Schema": {
    "prefix": "zschema",
    "body": [
      "import { z } from 'zod';",
      "",
      "export const $1Schema = z.object({",
      "  $0",
      "});",
      "",
      "export type $1 = z.infer<typeof $1Schema>;"
    ]
  }
}
```

---

## Workspace Layout

### Recommended Panel Layout

**Left Sidebar:**

- File Explorer
- Search
- Source Control (Git)
- Extensions

**Main Editor:**

- Split horizontally for API + Frontend
- Split vertically for code + test

**Bottom Panel:**

- Terminal (primary)
- Problems
- Output
- Debug Console

**Right Sidebar (optional):**

- Outline
- Timeline

### Multi-Root Workspace (Optional)

For working on specific apps only:

```json
{
  "folders": [
    { "path": "apps/api" },
    { "path": "apps/web" },
    { "path": "packages/db" }
  ]
}
```

Save as `workspace.code-workspace`

---

## Performance Tips

### Faster VSCode

**Exclude from watchers:**

Already configured in `.vscode/settings.json`:

- `node_modules`
- `dist`
- `routeTree.gen.ts`
- `.git/objects`

**Disable unused extensions:**

- Disable extensions you don't use
- Use "Disable (Workspace)" for project-specific

**Increase memory:**

```bash
code --max-memory=4096
```

### Faster TypeScript Checks

**Skip lib check:**

```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

Already enabled in `tsconfig.json`

---

## Troubleshooting

### Extension Issues

**Problem:** Extension not working

**Solution:**

1. Reload VSCode window
2. Check extension is enabled
3. Check for extension conflicts
4. Update to latest version

---

### IntelliSense Not Working

**Problem:** No auto-complete, no type hints

**Solution:**

```bash
# Restart TypeScript server
# Command Palette → "TypeScript: Restart TS Server"

# Rebuild project
pnpm build

# Reinstall dependencies
rm -rf node_modules
pnpm install
```

---

### Git Issues in VSCode

**Problem:** Changes not showing in Source Control

**Solution:**

1. Check `.gitignore` doesn't exclude files
2. Reload window
3. Use `git status` in terminal to verify

---

### Formatting Not Working

**Problem:** Files not formatting on save

**Solution:**

1. Check Biome extension is installed and enabled
2. Verify `biome.json` exists
3. Check VSCode settings:
   - `editor.formatOnSave`: true
   - `editor.defaultFormatter`: "biomejs.biome"

---

## Getting Help

**VSCode Issues:**

- [VSCode Documentation](https://code.visualstudio.com/docs)
- [VSCode Extensions Marketplace](https://marketplace.visualstudio.com/)

**Extension Issues:**

- Check extension's GitHub repo
- File issues on extension repository

**Project-Specific:**

- Check [Common Issues](../resources/troubleshooting.md)
- Ask in [Discussions](https://github.com/qazuor/hospeda/discussions)

---

**Environment configured?** → Next: [First Contribution](first-contribution.md)

**Need help?** → See [Troubleshooting](../resources/troubleshooting.md)
