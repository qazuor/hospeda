# ADR-009: Free Trial Restricted to HOST Role

## Status

Accepted

## Context

The Hospeda billing system supports multiple user roles: Guest, Host, Sponsor, and Admin. Each role has different platform capabilities and pricing models. When designing the free trial experience, the team needed to decide which roles should receive a trial period and how to manage the complexity of multi-role trials.

Offering trials for every role would require separate onboarding flows, distinct plan configurations, different success metrics, and role-specific trial expiration logic. This complexity adds development time and introduces more surface area for billing bugs during a critical launch phase.

The platform's core value proposition centers on Hosts listing their accommodations. Guests browse for free, Sponsors require a consultative sales process, and Admins are internal users. The Host role is the only role where a self-service trial directly drives platform growth.

## Decision

Offer a 14-day free trial exclusively for HOST users. All other roles follow their natural access patterns:

- **Guests**: Browse and book for free (no trial needed).
- **Hosts**: 14-day free trial with full listing capabilities.
- **Sponsors**: Onboarded through direct sales (no self-service trial).
- **Admins**: Internal users provisioned manually.

The trial includes access to a single plan tier (the default Host plan) with standard limits. At trial expiration, the Host must subscribe to continue listing accommodations.

## Consequences

### Positive

- Simple trial flow with a single onboarding path to build, test, and maintain.
- Clear value proposition .. Hosts experience the full platform before committing.
- Single plan type to manage during trial, reducing billing edge cases.
- Faster time to launch with fewer trial-related code paths.
- Trial success metrics are straightforward (Host conversion rate).

### Negative

- Sponsors cannot self-serve a trial, which may slow early sponsor adoption.
- If a new role needs a trial in the future, the billing system must be extended.

### Neutral

- Guest users are unaffected since they already have free access to browsing.
- Admin provisioning remains a manual, internal process regardless.

## Alternatives Considered

1. **Trial for all roles** .. Would require multiple onboarding flows, per-role plan configurations, and separate trial expiration logic. Significantly increases billing complexity for minimal benefit given that only the Host role benefits from self-service trial conversion.

2. **No trial at all** .. Simpler to implement but likely reduces Host conversion rates. Hosts need to experience the value of listing management tools before committing to a paid subscription. Industry data supports that trials improve conversion for SaaS-style products.

3. **Freemium model (permanent free tier)** .. A permanently free tier with limited features (e.g., one listing) would attract Hosts but makes monetization harder. It becomes difficult to convert free users to paid when they can operate indefinitely on the free tier. Also introduces ongoing support costs for non-paying users.
