# ADR-010: Explicit CORS Origins Without Wildcards

## Status

Accepted

## Context

The Hospeda API serves multiple frontend applications (web, admin) and must handle cross-origin requests securely. OWASP best practices for CORS configuration recommend explicit origin allowlisting rather than wildcard patterns. A misconfigured CORS policy can enable subdomain takeover attacks, cross-site request forgery, and unauthorized data access.

The platform handles sensitive user data, authentication tokens, and payment information through MercadoPago. Any CORS misconfiguration could expose these to malicious origins.

The API is deployed on Vercel with multiple environments (development, staging, production), each with different frontend URLs.

## Decision

Use an `API_CORS_ORIGINS` environment variable containing a comma-separated list of explicitly allowed origin URLs. No wildcard (`*`) patterns are permitted in any environment, including development.

Example configuration:

```
# Production
API_CORS_ORIGINS=https://hospeda.com,https://admin.hospeda.com

# Development
API_CORS_ORIGINS=http://localhost:4321,http://localhost:3000
```

The API validates the `Origin` header against this allowlist on every cross-origin request. Requests from unlisted origins receive no CORS headers and are blocked by the browser.

## Consequences

### Positive

- Prevents subdomain takeover attacks by rejecting requests from unexpected origins.
- Provides strong CSRF protection since only known frontends can make credentialed requests.
- Creates a clear security boundary between the API and its consumers.
- Makes the list of authorized consumers auditable and explicit.
- Aligns with OWASP CORS security recommendations.

### Negative

- Every new frontend deployment requires updating the `API_CORS_ORIGINS` configuration.
- Development setup requires explicit localhost entries for each app port.
- Preview/staging URLs (e.g., Vercel preview deployments) need separate handling or must be added to the allowlist.

### Neutral

- Environment-specific configuration is already standard practice for the project.
- Vercel environment variables support per-environment values natively.

## Alternatives Considered

1. **Wildcard `*` for all origins** .. Simplest to configure but fundamentally insecure. Allows any website to make requests to the API, exposing authentication cookies and user data. Incompatible with credentialed requests (`Access-Control-Allow-Credentials: true`). Not acceptable for a platform handling payments and personal data.

2. **Regex-based origin matching** (e.g., `/\.hospeda\.com$/`) .. More flexible than explicit lists but error-prone. A poorly written regex can accidentally match malicious domains (e.g., `evil-hospeda.com`). Harder to audit and reason about. The flexibility is not needed given the small number of known frontends.

3. **Reverse proxy with same-origin requests** .. Placing all frontends behind the same domain via a reverse proxy eliminates CORS entirely. However, this adds infrastructure complexity, introduces latency through the proxy layer, and conflicts with the current Vercel deployment architecture where each app has its own deployment.
