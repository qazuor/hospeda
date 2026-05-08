# SPEC-099 Phase 0 — Lighthouse Mobile Baseline

Baseline captured against the running dev server at http://localhost:4321
(Astro dev mode, NOT a production build). Numbers are intentionally pessimistic
because Vite serves uncompiled modules and TBT is dominated by cold transforms.

## Capture environment

- Date: 2026-05-07
- Lighthouse version: 13.3.0
- Form factor: mobile
- Categories: performance only
- Chrome flags: --headless=new --no-sandbox --disable-gpu
- Server: dev (pnpm dev, port 4321), main branch unmodified
- Tool: pnpm dlx lighthouse@latest

## Per-locale metrics

| Locale | Perf Score | LCP | CLS | FCP | TBT | Speed Index |
|--------|-----------:|----:|----:|----:|----:|------------:|
| /es/   | 0.28       | 7.9 s | 0.044 | 7.8 s | 10,900 ms | 7.8 s |
| /en/   | 0.27       | 8.2 s | 0.044 | 8.1 s | 10,550 ms | 9.0 s |
| /pt/   | 0.26       | 139.0 s* | 0.076 | 7.9 s | 10,450 ms | 7.9 s |

* /pt/ LCP is anomalously high (139 s). Likely cause: Vite cold compile
during the first request to a previously uncached locale combined with
heavy lazy chunks not warmed by /es/ + /en/ runs. Treat as a known dev-mode
artifact.

## Raw artifacts

- .claude/baseline/lighthouse/es.json
- .claude/baseline/lighthouse/en.json
- .claude/baseline/lighthouse/pt.json
- .claude/baseline/lighthouse/metrics.json
