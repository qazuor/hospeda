-- SPEC-044 Gap Remediation P8-T002: Add CHECK constraint for status column
-- Ensures only valid status values can be stored in billing_addon_purchases
ALTER TABLE billing_addon_purchases
  ADD CONSTRAINT billing_addon_purchases_status_check
  CHECK (status IN ('active', 'expired', 'canceled', 'pending'));
