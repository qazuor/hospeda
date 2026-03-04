# ADR-014: Manual Payment Dispute Handling in v1

## Status

Accepted

## Context

MercadoPago, the payment processor used by Hospeda for the Argentine market, supports dispute flows including chargebacks, claims, and mediation requests. When a buyer disputes a payment, MercadoPago sends webhook notifications that can trigger automated responses such as submitting evidence, issuing refunds, or suspending services.

Building a fully automated dispute handling system requires:

- Webhook handlers for multiple dispute event types (opened, changed, closed).
- Evidence submission logic with document assembly.
- Automated service suspension and reinstatement based on dispute outcomes.
- Dispute tracking UI in the admin panel.
- Integration with Host notification workflows.

Payment disputes are statistically rare, especially at launch volumes. Industry data suggests dispute rates below 1% for accommodation platforms. The complexity of automated dispute handling is disproportionate to the expected volume during the platform's initial phase.

## Decision

Handle payment disputes manually in v1:

- **Log** all dispute-related webhooks to the database for audit purposes.
- **Notify** admins via the existing notification system when a dispute webhook arrives.
- **Resolve** disputes manually through the MercadoPago merchant dashboard.
- **Track** dispute outcomes in the admin panel for record-keeping.

No automated evidence submission, service suspension, or refund processing for disputes in v1.

## Consequences

### Positive

- Faster launch without building a complex dispute automation system.
- Manual handling allows the team to learn dispute patterns and common causes before automating.
- Edge cases and unusual scenarios can be handled with human judgment rather than brittle automation.
- Reduces the risk of automated systems making incorrect decisions on sensitive financial matters.

### Negative

- Manual resolution requires admin time for each dispute.
- Does not scale if dispute volume increases significantly.
- Response time depends on admin availability, which may miss MercadoPago's response deadlines during off-hours.

### Neutral

- Dispute webhooks are still received and logged, so no data is lost.
- The admin panel dispute tracking provides the foundation for future automation.

## Alternatives Considered

1. **Fully automated dispute flow** .. Handles all dispute events programmatically, including evidence submission and service management. Robust at scale but overengineered for v1 volume. The risk of automated misjudgment on financial disputes outweighs the time saved at low volumes. Better built after understanding real dispute patterns.

2. **Ignore disputes entirely** .. No logging, no notification, no handling. Creates legal and financial risk. MercadoPago disputes have response deadlines, and missing them results in automatic resolution in the buyer's favor. Unacceptable for a platform handling real money.

3. **Third-party dispute management service** .. Outsources dispute handling to a specialized provider. Adds cost and a vendor dependency for a problem that does not yet exist at meaningful volume. More appropriate to evaluate once dispute patterns are understood and volume justifies the expense.
