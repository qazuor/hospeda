# Billing Documentation

> Decision records and operational guides for the Hospeda billing system.

## Operational Runbooks

| Document | Description |
|----------|-------------|
| [Billing Runbooks](billing-runbooks.md) | 7 incident-response procedures for oncall: failed-webhook triage, MP signature failure, cron recovery, dunning stuck, refund, dispute, manual subscription rescue |
| [Staging Smoke Checklist](../../.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md) | Pre-merge manual smoke for billing-touching PRs (SPEC-143) |
| [Prod Smoke + Rollback](../../.qtm/specs/SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md) | Post-deploy production smoke and rollback procedures for billing-CORE changes |
| [MP Test Cards Reference](../../.qtm/specs/SPEC-143-billing-testing-coverage/docs/mp-test-cards-reference.md) | MercadoPago sandbox card numbers and outcome codes |

## Decision Records

| Document | Description |
|----------|-------------|
| [AFIP Research](../../.qtm/specs/SPEC-028-iva-tax-handling/afip-research.md) | Research on AFIP integration options and requirements (moved to SPEC-028) |
| [Dispute Handling v1](dispute-handling-v1.md) | Manual dispute resolution strategy |
| [Grace Period Source of Truth](grace-period-source-of-truth.md) | Where grace period logic lives |
| [v1 Launch Strategy](v1-launch-strategy.md) | What's in v1 vs v2, known limitations, launch checklist |

## Package Documentation

For billing package implementation details, API reference, and integration guides, see the package-level docs:

- [Billing Package Docs](../../packages/billing/docs/README.md)

## Related ADRs

- [ADR-005: MercadoPago Payments](../decisions/ADR-005-mercadopago-payments.md)
- [ADR-006: Integer Monetary Values](../decisions/ADR-006-integer-monetary-values.md)
- [ADR-008: AFIP Deferred to v2](../decisions/ADR-008-afip-deferred-v2.md)
- [ADR-009: Trial Host-Only](../decisions/ADR-009-trial-host-only.md)
- [ADR-013: Deferred Limit Enforcement](../decisions/ADR-013-deferred-limit-enforcement.md)
- [ADR-014: Manual Dispute Handling v1](../decisions/ADR-014-manual-dispute-handling-v1.md)

## Related Documentation

- [Billing Deployment Checklist](../deployment/billing-checklist.md)
- [QA E2E Checklist](../testing/billing-e2e-checklist.md)
- [QA Manual Testing](../testing/billing-manual-testing.md)
- [Security Audit](../security/billing-audit-2026-02.md)
