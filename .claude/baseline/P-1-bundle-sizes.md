# P-1 Bundle Size Reduction — SearchBar Calendar Lazy Split

Records the JS bundle impact of T-065 → T-068 (extract + lazy-load
`SearchBarCalendar.client.tsx`).

## Methodology

Both builds run with the same Vercel adapter (`pnpm --filter hospeda-web
build`) on the same workspace. Sizes are uncompressed bytes from
`dist/client/_astro/`. Hashes change per build; relevant chunks are
identified by file basename.

* **Baseline** = the file at `df02c428e` (parent of T-065) restored
  temporarily into the working tree, then built.
* **After** = the result of T-065 + T-066 + T-068 (T-067 was a no-op
  because T-065 already moved the imports into the new file).

## SearchBar island critical chunk

| Chunk | Baseline | After T-068 | Delta |
| --- | ---: | ---: | ---: |
| `SearchBar.*.js` | 10,053 B | 10,221 B | +168 B |
| **Statically imported** `pt-BR.*.js` (react-day-picker + locales) | **79,353 B** | not statically imported | **−79,353 B** |
| Effective hero island JS load | **89,406 B** | **10,221 B** | **−79,185 B (~77 KB)** |

The +168 B delta on `SearchBar.*.js` is the cost of the `lazy()` /
`Suspense` wiring plus the `preloadCalendar` ref guard.

## Lazy chunk

| Chunk | After T-068 |
| --- | ---: |
| `SearchBarCalendar.client.*.js` (wrapper) | 807 B |
| `pt-BR.*.js` (react-day-picker + 3 locales, shared with FilterSidebar) | 79,353 B |

The `SearchBarCalendar` wrapper imports `pt-BR.*.js`, so the user pays
~80 KB of JS only on the first hover/focus/click of the dates column.
After that the chunk is browser-cached.

## Verification

`SearchBar.*.js` after T-068 contains two `import('./SearchBarCalendar.client.*.js')`
call sites — one from `React.lazy(...)` and one from `preloadCalendar`
(hover/focus pre-warm). Confirmed via:

```
node -e "..." # see PR description
```

## Acceptance

T-069 acceptance was "hero island JS bundle reduced by ≥20 KB (target
30–80 KB)". Achieved: −77 KB (top of target range).

Hash references for traceability (current build):

* before: `SearchBar.WBkmMGt8.js`
* after: `SearchBar.DIQcV3JX.js` + `SearchBarCalendar.client.C2IQY131.js`
