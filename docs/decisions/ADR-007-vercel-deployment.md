# ADR-007: Vercel Deployment (Migrated from Fly.io)

## Status

Accepted

## Context

The platform consists of three applications (API, Web, Admin) in a TurboRepo monorepo. Initially deployed on Fly.io, the team evaluated deployment options based on:

- Developer experience and deployment friction.
- Preview environment support for pull request reviews.
- Monorepo-aware build and deployment pipelines.
- Edge function support for optimal latency.
- Cost predictability at the expected traffic scale.
- Compatibility with the existing stack (Astro SSR, Hono API, TanStack Start admin).

## Decision

We migrated all three applications to **Vercel**, using the `@astrojs/vercel` adapter for the web app, Vercel Serverless Functions for the API, and Vercel for the admin dashboard.

## Consequences

### Positive

- **Zero-config deploys** .. Vercel auto-detects the monorepo structure and builds each app with minimal configuration.
- **Preview environments** .. Every pull request gets a unique preview URL, enabling stakeholders and QA to review changes before merging.
- **Edge functions** .. Vercel's edge runtime provides low-latency responses for geographically distributed users.
- **Good monorepo support** .. Vercel integrates with TurboRepo's dependency graph to build only affected packages on each deploy.
- **Simple DX** .. `git push` triggers deployment. No Dockerfiles, no infrastructure management, no SSH.
- **Built-in analytics** .. Web Vitals, function execution times, and error tracking available out of the box.

### Negative

- **Vendor lock-in** .. Vercel-specific adapters and configuration tie the deployment pipeline to Vercel. Moving to another provider requires rework.
- **Cold starts** .. Serverless functions experience cold starts, which can add latency to the first request after an idle period. This affects the API app in particular.
- **Cost at scale** .. Vercel's pricing can become expensive at high traffic volumes compared to self-managed infrastructure or container-based platforms.
- **Limited server customization** .. No access to the underlying server for advanced configuration (e.g., custom caching layers, persistent connections).

### Neutral

- Vercel's free tier is generous enough for development and early-stage production.
- The platform's PostgreSQL database remains hosted separately (not on Vercel), avoiding additional vendor coupling for data.

## Alternatives Considered

### Fly.io (previous platform)

Fly.io was the original deployment target. It was abandoned because:

- Required more operational work (Dockerfiles, health checks, scaling configuration).
- Preview environments needed manual setup.
- Monorepo support was not native and required custom build scripts.

### AWS (ECS, Lambda, or Amplify)

AWS provides maximum flexibility but was rejected because:

- Significantly more complex to set up and maintain for a small team.
- Requires managing IAM roles, VPCs, load balancers, and other infrastructure.
- The operational overhead does not justify the benefits at the current scale.

### Railway

Railway offers a good developer experience but was rejected because:

- Less mature than Vercel for frontend deployments.
- Preview environments and monorepo support were not as polished.
- Smaller community and less documentation for Astro and TanStack Start deployments.

### Self-Hosted (VPS)

Self-hosting on a VPS (e.g., Hetzner, DigitalOcean) was rejected because:

- Requires managing servers, SSL certificates, CI/CD pipelines, and monitoring infrastructure.
- No built-in preview environments.
- Operational burden is disproportionate for the team size.
