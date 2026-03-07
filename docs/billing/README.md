# Billing Documentation

> Decision records and operational guides for the Hospeda billing system.

## Decision Records

| Document | Description |
|----------|-------------|
| [AFIP Research](../../.claude/specs/SPEC-028-iva-tax-handling/afip-research.md) | Research on AFIP integration options and requirements (moved to SPEC-028) |
| [Dispute Handling v1](dispute-handling-v1.md) | Manual dispute resolution strategy |
| [Grace Period Source of Truth](grace-period-source-of-truth.md) | Where grace period logic lives |

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
- [Billing Incidents Runbook](../runbooks/billing-incidents.md)
- [QA E2E Checklist](../testing/billing-e2e-checklist.md)
- [QA Manual Testing](../testing/billing-manual-testing.md)
- [Security Audit](../security/billing-audit-2026-02.md)
