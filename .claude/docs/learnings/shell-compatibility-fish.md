# Shell Compatibility - Fish Shell

**Date:** 2024-10-28

**Category:** Shell / Terminal / DevOps

## Problem

Using `for` loops directly in the terminal causes Fish shell to hang indefinitely, blocking the entire development workflow.

## Solution

- **DON'T use `for` loops in terminal** - Fish shell hangs
- Use alternatives like `find -exec` for batch operations
- Use `xargs` for processing multiple items
- Write shell scripts for complex loops instead of running directly in terminal

**Example:**

```bash
# ❌ BAD - Hangs in Fish
for file in *.md; do echo $file; done

# ✅ GOOD - Works in Fish
find . -name "*.md" -exec echo {} \;

# ✅ GOOD - Alternative with xargs
ls *.md | xargs -I {} echo {}
```

## Impact

- **Severity:** High - Blocks development workflow
- **Frequency:** Common when doing batch operations
- **Scope:** All developers using Fish shell
- **Prevention:** Use alternative commands documented above

## Related

- **Documentation:** Fish shell documentation on loops
- **Best Practices:** [.claude/docs/standards/code-standards.md](../standards/code-standards.md)
- **Related Learnings:** None yet

---

*Last updated: 2024-10-28*
