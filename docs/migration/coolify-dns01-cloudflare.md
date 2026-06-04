# Coolify DNS-01 Challenge via Cloudflare

Operator runbook for configuring Coolify to use Cloudflare DNS-01 challenges
for Let's Encrypt certificates. Closes SPEC-103 T-077.

## Why

The Hospeda VPS sits behind Cloudflare DNS. Coolify defaults to HTTP-01
challenges, which work today for each known subdomain (`hospeda.com.ar`,
`staging.hospeda.com.ar`, `api.hospeda.com.ar`, etc.) but require a public
HTTP listener for every new hostname. DNS-01 lets Coolify mint a single
wildcard certificate (`*.hospeda.com.ar`) by writing a TXT record via the
Cloudflare API. Three operational wins:

- New subdomains (e.g. a temporary preview / staging variant) get TLS
  immediately without provisioning a public HTTP listener first.
- The renewal flow stops depending on inbound HTTP reaching every node;
  the only Cloudflare-side dependency is the DNS TXT write.
- Reduces the surface for "I added a subdomain in Coolify but the cert is
  failing on cron" support tickets.

## What you're configuring

```
Cloudflare account                         Coolify (https://coolify.hospeda.com.ar)
─────────────────                          ──────────────────────────────────────────
API token (DNS:Edit on hospeda.com.ar) ──> Settings → Server → SSL → DNS Challenge
                                           Provider: Cloudflare
                                           Token: <paste here>
                                           Default email: <ops contact>
```

Once saved, Coolify issues / renews certs for the configured zones via the
Let's Encrypt DNS-01 flow. Existing certs keep working; DNS-01 only kicks
in on the next issue / renewal.

## Prereqs

- An operator account with admin access to:
  - Coolify (`https://coolify.hospeda.com.ar`).
  - Cloudflare account that owns the `hospeda.com.ar` zone.
- ~30 minutes of focused time. The Cloudflare side takes 5 minutes; the
  Coolify side takes 5 minutes; verification takes 20 minutes because we
  have to wait for a real cert issuance to confirm.

## Step 1 — Create the Cloudflare API token (5 min)

The token must be scoped to the minimum surface DNS-01 needs:

- **Zone**: `hospeda.com.ar` (NOT \*all zones\*; scope to this one).
- **Permission**: `Zone → DNS → Edit`.
- **Optional permission** (recommended): `Zone → Zone → Read` — Let's
  Encrypt's Cloudflare plugin reads the zone before writing the TXT
  record. Without this it falls back to a slower lookup path.
- **Resources**: include only the `hospeda.com.ar` zone.
- **TTL**: leave at "Forever" (Coolify rotates via dashboard if needed).

Steps:

1. Sign in to Cloudflare → top-right menu → **My Profile**.
2. **API Tokens** tab → **Create Token**.
3. Pick the **Custom token** template (NOT "Edit zone DNS" — that template
   grants slightly too much by default).
4. Token name: `Hospeda — Coolify DNS-01` (free-form, just so you can
   recognise it later).
5. Permissions:
   - `Zone` · `DNS` · `Edit`
   - `Zone` · `Zone` · `Read` (recommended)
6. Zone Resources:
   - Include · Specific zone · `hospeda.com.ar`
7. Client IP Address Filtering: leave empty unless the VPS has a stable
   egress IP and you want to lock the token to it. (Cloudflare lookups
   originate from the VPS for DNS-01.)
8. **Continue to summary** → **Create Token** → copy the value somewhere
   safe. **You cannot view it again** — only rotate / delete.

## Step 2 — Wire the token into Coolify (5 min)

1. Sign in to `https://coolify.hospeda.com.ar`.
2. Top sidebar → **Settings** (cog icon).
3. **Server** → pick the Hospeda VPS server entry.
4. **Configuration** → **SSL** section → enable **DNS Challenge** (the
   exact UI label is "Use DNS Challenge for SSL certificates" in v4.x).
5. **Provider**: `Cloudflare`.
6. **API Token**: paste the token from Step 1.
7. **Default email**: the ops contact you want Let's Encrypt to mail
   about expiring certs. Pick one that's monitored (e.g. the same
   address as the Sentry alerts).
8. **Save**.

Coolify validates the token on save by issuing a no-op API call. If you
get a 401 / 403, the token is wrong or scoped to the wrong zone — go back
to Step 1.

## Step 3 — Issue the first DNS-01 cert (5 min)

To prove the wiring works end-to-end, force one of the apps to renew its
cert. Easiest target is a non-critical app (e.g. `hospeda-admin-staging`)
so production stays out of the test path:

1. App → **Settings** → **Domains** → click the row for the existing
   domain (e.g. `staging-admin.hospeda.com.ar`).
2. **Renew certificate** (or **Re-issue**) — exact label depends on
   Coolify version.
3. Watch the deploy log; the line you want to see is something like:

   ```
   acme.sh detected dns_cf
   Adding TXT record _acme-challenge.staging-admin.hospeda.com.ar
   DNS check passed
   Cert issued
   ```

4. If the log shows HTTP-01 challenge, DNS-01 was not picked up — go
   back to Step 2 and confirm the toggle is on.

## Step 4 — Verify (15 min)

```bash
# From your laptop:

# 1) Confirm the new cert is signed by Let's Encrypt and not the old one.
openssl s_client -showcerts -servername staging-admin.hospeda.com.ar \
  -connect staging-admin.hospeda.com.ar:443 < /dev/null 2>/dev/null \
  | openssl x509 -noout -dates -issuer
#  Expected:
#    notBefore=<recent timestamp from Step 3>
#    notAfter =<~90 days after notBefore>
#    issuer  = ... O = Let's Encrypt ...

# 2) Cloudflare logs the TXT write — confirm via the dashboard if you
#    want a second source. Cloudflare → DNS → "_acme-challenge.*" entries
#    should briefly appear during issuance and be removed afterwards.
```

## Optional — Wildcard cert (`*.hospeda.com.ar`)

Once DNS-01 is working, you can add a single wildcard domain in any app
config:

- App → Settings → Domains → add `*.hospeda.com.ar`.
- Coolify issues one cert covering every subdomain. Saves N renewals.

Only worth doing if you have 4+ subdomains. Today's set (`hospeda.com.ar`,
`www`, `staging`, `api`, `staging-api`, `admin`, `staging-admin`, `auth`)
qualifies. Coolify handles SAN-style certs internally — same flow.

## Rollback

If anything goes wrong, switch Coolify back to HTTP-01 in the same
**SSL** panel and disable DNS Challenge. Existing certs remain valid; new
issuance falls back to the old flow.

## Cross-references

- [`docs/runbooks/sentry-setup.md`](../runbooks/sentry-setup.md) — same
  shape of "operator runbook with Cloudflare-flavoured steps".
- SPEC-103 T-077 — the tracker entry this runbook closes (spec archived; task dir removed).
- Cloudflare docs: <https://developers.cloudflare.com/api/tokens/create/>
- Coolify docs: <https://coolify.io/docs/knowledge-base/ssl> (DNS
  Challenge section).
