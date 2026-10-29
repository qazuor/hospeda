# Write-block rule (cutover step 0b)

Mirror of the single WAF Custom Rule that blocks every write during the HOS-1352
billing cutover. See [`../README.md`](../README.md) for why Cloudflare rules are
documented rather than applied from code, and for the shared-zone constraint.

Dashboard path: **hospeda.com.ar → Security → WAF → Custom rules**.

**This rule is TEMPORARY.** It goes on at step 0b and comes off at step 5 (or,
when the cutover aborts, stays on until the retry). It is an operational act of
the cutover, dated and verified, not a switch in the code of either system
(`.specs/HOS-1352-billing-verticals-redesign/spec-consolidada/30-el-corte.md`,
paso 0b and paso 5). Current state: **not applied** (nothing is applied until
the operator does it, and the operator records the date here).

---

## `HOS-1352 cutover - block all writes`

### What it does

Rejects every request whose method is anything but `GET`, `HEAD` or `OPTIONS`,
on the production web, admin and API hosts, which serve both the old and the new
system (there is no coexistence: one deployment replaces the other in place).
Nobody can sign up, log in, edit or pay for the window, which is the point: the
step 1b census only counts what exists when it is taken.

Two exceptions, and only these two:

| Exception | Why | Protection of its own |
|---|---|---|
| `POST /api/v1/webhooks/mercadopago` (API host) | Mercado Pago notices must keep arriving for the whole window (DEC-ARCH-014, point 4). | Signature check in the route. |
| `POST /api/revalidate/` (web hosts) | Step 4c purges the cache through it, and step 4c runs BEFORE step 5 removes this rule (owner decision 3, 2026-10-29). | `?secret=` must equal `HOSPEDA_REVALIDATION_SECRET`; without it the route answers 401. The exception opens the edge, not the route. |

The `/api/revalidate/` exception is the only way the API reaches the cache
purge from the VPS (it posts to `${HOSPEDA_SITE_URL}/api/revalidate/`, which
goes through Cloudflare). If it is missing, step 4c fails with HTTP 403 on every
group and the cutover cannot advance.

### Hosts

Derived from the env registry (`packages/config/src/env-registry.client.ts`:
`HOSPEDA_API_URL` = `https://api.hospeda.com.ar`, `HOSPEDA_ADMIN_URL` =
`https://admin.hospeda.com.ar`, `HOSPEDA_SITE_URL` = `https://hospeda.com.ar`)
plus the `www` alias that step 4c also purges. **Staging hosts are NOT in the
rule**: the zone is shared, and blocking `staging.hospeda.com.ar` would stop the
rehearsals running in parallel.

### Expression

```
(
  http.host in {"hospeda.com.ar" "www.hospeda.com.ar" "admin.hospeda.com.ar" "api.hospeda.com.ar"}
  and not http.request.method in {"GET" "HEAD" "OPTIONS"}
  and not (
    http.host eq "api.hospeda.com.ar"
    and http.request.uri.path in {"/api/v1/webhooks/mercadopago" "/api/v1/webhooks/mercadopago/"}
  )
  and not (
    http.host in {"hospeda.com.ar" "www.hospeda.com.ar"}
    and starts_with(http.request.uri.path, "/api/revalidate/")
  )
)
```

One line for the dashboard's expression editor:

```
(http.host in {"hospeda.com.ar" "www.hospeda.com.ar" "admin.hospeda.com.ar" "api.hospeda.com.ar"} and not http.request.method in {"GET" "HEAD" "OPTIONS"} and not (http.host eq "api.hospeda.com.ar" and http.request.uri.path in {"/api/v1/webhooks/mercadopago" "/api/v1/webhooks/mercadopago/"}) and not (http.host in {"hospeda.com.ar" "www.hospeda.com.ar"} and starts_with(http.request.uri.path, "/api/revalidate/")))
```

### Settings

| Setting | Value |
|---|---|
| Action | **Block** (HTTP 403, default block page) |
| Order | **First**: above every other custom rule, so no earlier rule can skip it |
| Status | active only from step 0b |

### How to apply (step 0b)

1. Dashboard → **hospeda.com.ar → Security → WAF → Custom rules → Create rule**.
2. Name: `HOS-1352 cutover - block all writes`. Choose **Edit expression**, paste the
   one-line expression above, action **Block**.
3. **Place at: First**, then **Deploy**.
4. Write the date, the operator and the rule id in this file's "Applied" line below
   (a docs-only PR to `staging`).
5. Verify from outside, immediately (next section). An unverified rule is not applied.

### How to verify from outside

Run from any machine that is not the VPS. Replace `$SECRET` with the real
revalidation secret only for check 3, and never paste it into a ticket.

1. **A write is rejected** (the rule that matters):

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://hospeda.com.ar/api/auth/sign-in/email \
     -H 'content-type: application/json' -d '{}'
   curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://api.hospeda.com.ar/api/v1/protected/billing/checkout \
     -H 'content-type: application/json' -d '{}'
   ```

   Both must print `403`, with a Cloudflare block page and a `cf-ray` header. Any
   other code (401, 404, 200, 422) means the request reached the origin: the rule is
   not in force. The edge blocks before the origin can answer.
2. **A read still passes**:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' https://hospeda.com.ar/es/
   curl -sS -o /dev/null -w '%{http_code}\n' https://api.hospeda.com.ar/api/v1/public/health
   ```

   Both must print `200`.
3. **The Mercado Pago route passes the edge.** An unsigned POST must come back from
   the ORIGIN, not from Cloudflare:

   ```bash
   curl -sS -i -X POST https://api.hospeda.com.ar/api/v1/webhooks/mercadopago \
     -H 'content-type: application/json' -d '{}' | head -20
   ```

   Expect a 4xx from the route itself (signature failure), no Cloudflare block page.
   A `403` with the Cloudflare block page means the exception is wrong. Prefer
   the MP dashboard's "simulate notification" for a signed one.
4. **The purge route passes the edge** (a wrong secret keeps it harmless):

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' -X POST 'https://hospeda.com.ar/api/revalidate/?secret=wrong' \
     -H 'content-type: application/json' -d '{}'
   ```

   Must print `401` (from the route), never the Cloudflare `403`.
5. **Admin is covered**: `curl -X POST https://admin.hospeda.com.ar/` must print `403`.

### How to remove it (step 5)

Remove the rule only AFTER step 4c and its outside verification, at step 5 of
the cutover; on an aborted cutover leave it in place until the retry.

1. Dashboard → **Security → WAF → Custom rules** → the rule → **Delete** (not
   "Disable": a disabled rule left behind is a trap for the next operator).
2. Repeat verification 1 above: it must now stop returning `403` (an unauthenticated
   login attempt returns a 4xx from the origin, e.g. 400/401/422).
3. Replace the "Applied" line below with the removal date and operator.

### Applied

- Applied: _not yet_
- Removed: _not yet_
