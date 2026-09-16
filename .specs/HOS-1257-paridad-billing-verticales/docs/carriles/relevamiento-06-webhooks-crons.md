# Relevamiento 06 — Webhooks MercadoPago, cron jobs y reconciliación

Ver respuesta final para tabla completa y hallazgos con evidencia archivo:línea.
Áreas cubiertas: dunning.job.ts, subscription-poll/abandoned-pending-subs/
finalize-cancelled-subs/preapproval-less-expiry (todos symmetric via
excludeAddonDomainCondition), entity-subscription-cache-reconcile (ACCOMMODATION-only
by design), featured-by-entitlement-reconcile (ACCOMMODATION-only, product-scoped),
subscription-linked-entities.service.ts (bridge, 9 call sites found vs 6 documented),
commerce-downgrade-remediation vs accommodation plan-downgrade-remediation (mirrored),
webhook subscription-logic.ts (no domain branch except FEATURED_LISTING sync),
notifications (generic, DB-sourced plan names, not ALL_PLANS-scoped),
reactivation-supersession-complete.ts (domain-agnostic, no reconcile call for
superseded subscription — flagged NO-VERIFICADO/open question).
