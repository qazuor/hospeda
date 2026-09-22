# Documentation Standards (Quick Reference)

> Concise rules for AI agents. Full details: [docs/guides/markdown-formatting.md](../../docs/guides/markdown-formatting.md)

## JSDoc

- Required on ALL exported functions, classes, and types
- Include: description, `@param`, `@returns`, `@throws`, `@example`
- Use TypeScript types in JSDoc (not JSDoc type annotations)

## Code Comments

- Language: English ONLY
- Explain WHY, not WHAT
- No commented-out code in production
- No TODO without a linked issue or ticket

## AGENTS.md and project instructions

- Max ~300 lines, concise format for AI agents
- Purpose: quick reference for agents working on the package
- Format: bullet points, tables, short code snippets
- Must reference `docs/` for full details
- The project root AGENTS.md is the canonical shared reference

## README.md Files

- Complete human-oriented documentation, 200-800 lines
- Standard sections: Overview, Installation, Quick Start, Architecture, API Reference, Configuration, How to Create New [X], Testing, Troubleshooting, Related Docs
- The project root AGENTS.md is the canonical shared reference

## Markdown Formatting

- No trailing whitespace
- Single blank line between sections
- Fenced code blocks with language tag
- Tables: aligned pipes, header row
- Links: relative paths within repo, descriptive text
- Never use em dash (--), use dots (..) instead

## Documentation Structure

- `docs/` - Human-oriented project documentation
- `.claude/docs/` - Concise agent cheat sheets (reference docs/ for details)
- Specialized package guidance belongs in skills or `docs/`
- `README.md` per package - Package documentation for humans
