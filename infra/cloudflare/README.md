# Cloudflare configuration

Everything Hospeda relies on inside the Cloudflare zone `hospeda.com.ar`, kept
in version control.

| What | Where | Deployed by |
|---|---|---|
| PostHog first-party reverse proxy (Worker) | [`posthog-proxy/`](posthog-proxy/) | `wrangler deploy` |
| Sentry envelope tunnel (Worker) | [`sentry-tunnel/`](sentry-tunnel/) | `wrangler deploy` |
| Cache Rules | [`rules/cache-rules.md`](rules/cache-rules.md) | **Dashboard (manual)** |
| Redirect Rules | [`rules/redirect-rules.md`](rules/redirect-rules.md) | **Dashboard (manual)** |

## Why the rules are documented here even though they are applied by hand

The Workers above are config-as-code: the repo is the source of truth and
`wrangler` pushes it. The **rules are not** — they are created in the Cloudflare
dashboard, and this directory only mirrors them.

That asymmetry is deliberate but uncomfortable, so it is written down rather
than left implicit. A dashboard-only rule is invisible to code review, to
`git blame`, and to anyone reading the repo to understand why a response is
cached. This project already paid for exactly that failure mode once: a
`Cache-Control` header on the pricing pages was dead for months because nothing
in the repo described what the edge was supposed to do with it, so nobody
noticed the edge was doing nothing at all (HOS-369 §7.2).

Terraform would close the gap properly. It is deliberately **not** adopted yet:
it needs a state backend, a provider credential with ruleset-write scope, and a
decision about who may apply — three things worth deciding on purpose rather
than as a side effect of writing one cache rule. Until then the rule documents
below are the source of truth for **intent**, and the dashboard is the source of
truth for **what is actually live**.

### Rule of thumb

If you change a rule in the dashboard, change the matching document in the same
PR that motivated the change — and if the change had no PR, open one for the
document alone. A rule that exists only in the dashboard is a rule that will be
wrong within a quarter and nobody will know.

## The zone is shared by production AND staging

`hospeda.com.ar` and `staging.hospeda.com.ar` are the **same zone** on the
**free** plan. Two consequences that have already bitten:

- A zone-wide purge flushes production and staging together. This is why cache
  tags carry a deployment namespace (`prod:list-accom`, `preview:list-accom`)
  and why "flush this environment" is a purge of the `<env>:all` catch-all tag
  rather than `purge_everything` (HOS-369 §7.3.1).
- Cloudflare's 5-purges-per-minute ceiling is **per zone**, but the app-side
  rate limiter is per process. Two API processes cannot coordinate.

Every rule in this directory must therefore scope itself by `http.host`. A rule
that matches on path alone silently applies to both deployments.
