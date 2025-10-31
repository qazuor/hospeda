# Markdown Formatting Standards

**Date:** 2024-10-28

**Category:** Documentation / Formatting

## Problem

Inconsistent markdown formatting causes:
- Failed CI/CD checks (markdownlint errors)
- Difficult-to-read documentation
- Merge conflicts in documentation files
- Unprofessional appearance

## Solution

**Always format markdown before committing:**

```bash
# Format all markdown files
pnpm format:md

# Format only .claude docs
pnpm format:md:claude

# Check without fixing
pnpm lint:md
```

**Key Rules:**

1. **Add language to code blocks** - Never leave code blocks without language specification

   ```markdown
   ✅ CORRECT
   ```javascript
   const foo = 'bar';
   ```

   ❌ WRONG
   ```
   const foo = 'bar';
   ```
   ```

2. **Use 2-space indentation for lists** - Consistent nested list formatting

   ```markdown
   ✅ CORRECT
   - Item 1
     - Nested item
       - Double nested

   ❌ WRONG
   - Item 1
       - Nested (4 spaces)
   ```

3. **Add blank lines around blocks** - Headings, code blocks, lists, tables need spacing

   ```markdown
   ✅ CORRECT
   Some text.

   ## Heading

   More text.

   ❌ WRONG
   Some text.
   ## Heading
   More text.
   ```

4. **No trailing punctuation in headings**

   ```markdown
   ✅ CORRECT
   ## My Heading

   ❌ WRONG
   ## My Heading:
   ## My Heading.
   ```

## Impact

- **Severity:** Medium - Blocks CI/CD, affects readability
- **Frequency:** Common when writing documentation
- **Scope:** All documentation contributors
- **Prevention:** Run `pnpm format:md` before every commit

## Related

- **Full Documentation:** `docs/development/markdown-formatting.md`
- **CI/CD Hooks:** `.claude/hooks/` configuration
- **Related Learnings:** None yet

---

*Last updated: 2024-10-28*
