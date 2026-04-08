# SPEC-028: IVA/Tax Handling and ARCA Electronic Invoicing

## Status: Draft

## Priority: High

## Estimated Complexity: 9/10

## Epic: Billing & Tax Compliance

---

## 1. Executive Summary

This specification defines the complete implementation of Argentina's tax compliance system for the Hospeda platform, including IVA (Value Added Tax) handling, electronic invoicing via ARCA (formerly AFIP), credit notes for refunds, and tax-related UI changes across all apps.

The system MUST support two tax regimes (Monotributo and Responsable Inscripto) because Hospeda will start as Monotributista and transition to Responsable Inscripto when billing volumes grow. A single configuration flag controls the active regime, and the system adapts invoice types, IVA breakdown, and display behavior accordingly.

### Key Business Decisions (Pre-Approved)

1. **Dual regime support**: Monotributo (Factura C, no IVA breakdown) at launch, Responsable Inscripto (Factura B with IVA breakdown) when volumes exceed Monotributo caps
2. **Auto-invoice model**: Every successful payment automatically generates a fiscal invoice via ARCA. No manual invoicing
3. **Consumidor Final by default**: Users are treated as Consumidor Final unless they provide CUIT/CUIL and request Factura A
4. **CUIT/CUIL optional for consumers**: Not required for Factura B/C under the ARS threshold (~$75,760 per operation as of 2025). Required for Factura A
5. **Prices are IVA-inclusive**: Current plan prices already include IVA. The system reverse-calculates the net amount for invoice purposes
6. **Integration library**: `@afipsdk/afip.js` (primary, MIT, 100k+ downloads) with `@nicoo01x/arca-sdk` as evaluated alternative
7. **Free plans excluded**: Plans with price $0 (tourist-free) do NOT generate fiscal invoices. ARCA does not accept zero-amount invoices
8. **Add-on purchases included**: Paid add-on purchases also generate fiscal invoices, following the same flow as subscription payments
9. **Kill switch**: A `fiscal_invoicing_enabled` setting allows disabling auto-invoicing without code changes

### References

- [Tax System Research](./tax-system-research.md) .. Exhaustive investigation of Argentina's tax system
- [AFIP Research](./afip-research.md) .. Initial AFIP integration research from SPEC-021
- [ADR-006: Integer Monetary Values](../../docs/decisions/ADR-006-integer-monetary-values.md)
- [ADR-008: AFIP Deferred to v2](../../docs/decisions/ADR-008-afip-deferred-v2.md) .. Superseded by this spec

---

## 2. Glossary

Every term used in this spec is defined here. A developer with zero knowledge of Argentina's tax system should be able to implement this spec using only this glossary and the instructions below.

| Term | Definition |
|------|-----------|
| **ARCA** | Agencia de Recaudacion y Control Aduanero. Argentina's federal tax authority. Formerly called AFIP (renamed October 2024). Same APIs, new domain (`arca.gob.ar`) |
| **IVA** | Impuesto al Valor Agregado. Argentina's Value Added Tax. Standard rate: 21% for SaaS/digital services |
| **CAE** | Codigo de Autorizacion Electronico. A 14-digit unique code that ARCA assigns to each approved invoice. Without a CAE, an invoice is NOT legally valid |
| **CUIT** | Clave Unica de Identificacion Tributaria. An 11-digit tax ID for businesses and individuals in Argentina. Format: `XX-XXXXXXXX-X` |
| **CUIL** | Clave Unica de Identificacion Laboral. Same format as CUIT but used for employees/workers. For invoicing purposes, CUIT and CUIL are interchangeable |
| **DNI** | Documento Nacional de Identidad. National ID card number. Required for Consumidor Final when invoice total exceeds the document threshold (~$75,760 ARS). 7-8 digits |
| **WSFEv1** | Web Service de Factura Electronica v1. ARCA's SOAP web service for creating and querying electronic invoices |
| **WSAA** | Web Service de Autenticacion y Autorizacion. ARCA's authentication service. Returns a Token+Sign pair valid for ~12 hours |
| **Factura A** | Invoice type issued by a Responsable Inscripto to another Responsable Inscripto. IVA is fully discriminated (shown as a separate line). Code: 1 |
| **Factura B** | Invoice type issued by a Responsable Inscripto to a Consumidor Final, Monotributista, or IVA Exento. Since Ley 27.743 (2025), IVA MUST be shown as a breakdown. Code: 6 |
| **Factura C** | Invoice type issued by a Monotributista to anyone. No IVA breakdown. Code: 11 |
| **Nota de Credito** | Credit note. Required for refunds, corrections, and cancellations. Has its own CAE. Must reference the original invoice. Must be issued within 15 calendar days |
| **NC A / NC B / NC C** | Credit notes corresponding to Factura A (code 3), Factura B (code 8), Factura C (code 13) |
| **Punto de Venta** | Point of sale. A numeric identifier (e.g., `0002`) pre-registered in ARCA's portal. Each Punto de Venta has independent sequential invoice numbering |
| **Consumidor Final** | End consumer who is not registered as a taxpayer. The default assumption for Hospeda users |
| **Responsable Inscripto (RI)** | A business or individual registered in the IVA system. Must charge, collect, and declare IVA monthly |
| **Monotributista** | A taxpayer under the simplified Monotributo regime. Pays a fixed monthly fee that includes IVA. Cannot issue invoices with IVA breakdown |
| **Concepto** | The type of thing being invoiced. Code 2 = Services (always used by Hospeda). Requires service period dates |
| **Libro IVA Digital** | Digital IVA ledger. Monthly record of all invoices issued and received. Maintained automatically by ARCA from electronic invoices |
| **Ley 27.743** | Tax transparency law effective April 2025. Requires ALL Factura B to show IVA breakdown (subtotal + IVA + total), even for Consumidores Finales |
| **Clave Fiscal** | Digital credential issued by ARCA for accessing online services. Level 3 required for web service certificates |
| **Homologacion** | ARCA's testing environment. Uses separate endpoints and certificates. Invoices are not real |
| **QR Code** | Mandatory on all electronic invoices since 2020. Encodes a URL to ARCA's verification service with invoice data in base64 JSON |
| **Ingresos Brutos (IIBB)** | Provincial gross revenue tax. Separate from IVA. For Entre Rios: ~5% for IT/business services. Declared monthly to ATER |
| **ATER** | Administradora Tributaria de Entre Rios. Provincial tax authority for Entre Rios |

---

## 3. Current State Analysis

### What Exists

| Component | Current State | Gap |
|-----------|--------------|-----|
| Plan prices | Stored as integer centavos in `packages/billing/src/config/plans.config.ts`. 9 plans across 3 categories (owner, complex, tourist) | No tax fields, no net/gross distinction |
| `billing_invoices` table | Exists via QZPay schemas. Columns: `id`, `customer_id`, `subscription_id`, `number`, `status`, `subtotal`, `discount`, `tax`, `total`, `amount_paid`, `amount_remaining`, `currency`, `due_date`, `paid_at`, `voided_at`, `period_start`, `period_end`, `stripe_invoice_id`, `mp_invoice_id`, `livemode`, `metadata`, `version`, `created_at`, `updated_at`, `deleted_at` | No ARCA-specific fields (CAE, CbteTipo, PtoVta, etc.) |
| `billing_invoice_lines` table | Exists. Columns: `id`, `invoice_id`, `description`, `quantity`, `unit_amount`, `amount`, `currency`, `price_id`, `period_start`, `period_end`, `proration`, `metadata` | No IVA rate, no IVA amount per line |
| `billing_settings` table | Key-value store. Schema: `id` (UUID), `key` (varchar 100, unique), `value` (JSONB), `updatedBy` (UUID), `createdAt`, `updatedAt`. File: `packages/db/src/schemas/billing/billing_settings.dbschema.ts` | No tax configuration entries |
| `billing_payments` table | Columns: `id`, `customer_id`, `subscription_id`, `invoice_id`, `amount`, `currency`, `base_amount`, `base_currency`, `exchange_rate`, `status`, `provider`, `provider_payment_ids`, `payment_method_id`, `refunded_amount`, `failure_code`, `failure_message`, `idempotency_key`, `livemode`, `metadata`, `version`, `created_at`, `updated_at`, `deleted_at` | No link to fiscal invoice |
| `billing_refunds` table | Columns: `id`, `payment_id`, `amount`, `currency`, `status`, `reason`, `provider_refund_id`, `livemode`, `metadata`, `created_at`. **NOTE**: Does NOT have `customer_id` .. must JOIN through `billing_payments` to get it | No link to credit note |
| `@repo/utils/currency.ts` | Has `calculateTax(amount, taxRate)` and `calculateTotalWithTax(amount, taxRate)`. These calculate tax FROM a base amount (amount * rate/100). Does NOT follow RO-RO pattern | Does NOT do reverse-calculation from IVA-inclusive prices (which is what we need) |
| `PricingCard` component | `apps/web/src/components/shared/PricingCard.astro` shows prices with `plan.price.toLocaleString('es-AR')` | No "(IVA incluido)" text, no IVA breakdown |
| `InvoiceHistory` component | `apps/web/src/components/account/InvoiceHistory.client.tsx` shows date, description, amount, status | No fiscal invoice data, no PDF download |
| `InvoiceStatusEnum` | File: `packages/schemas/src/enums/invoice-status.enum.ts`. Values: `DRAFT`, `ISSUED`, `SENT`, `PAID`, `PARTIAL_PAID`, `OVERDUE`, `CANCELLED`, `VOIDED` | This is for QZPay billing invoices, NOT fiscal invoices. Fiscal invoices use a separate `ArcaStatusEnum` |
| User profile | 28 columns + 4 JSONB nested objects (contactInfo, location, socialNetworks, profile). Web edit form: only name + bio. File: `packages/db/src/schemas/user/user.dbschema.ts` | No CUIT/CUIL field, no DNI field, no `condicionIva` field |
| Environment variables | `HOSPEDA_` prefix pattern for server-side | No ARCA certificate or credential variables |
| Email system | Resend provider with React Email templates in `packages/email/`. NotificationService in `packages/notifications/` with retry support | No fiscal invoice email template |
| Cloud storage | **Does NOT exist**. No S3, R2, or any file storage integration | Required for PDF storage and serving |
| MercadoPago webhook | Handler at `apps/api/src/routes/webhooks/mercadopago/`. `processPaymentUpdated()` in `payment-logic.ts` sends notifications and confirms add-ons | No fiscal invoice trigger |
| Cron jobs | 7 existing jobs in `apps/api/src/cron/jobs/`: dunning, notification-schedule, trial-expiry, addon-expiry, exchange-rate-fetch, search-index-refresh, webhook-retry | No fiscal invoice retry job |
| Admin billing pages | 14 existing routes under `apps/admin/src/routes/_authed/billing/`. Permissions use `PermissionEnum` (e.g., `invoice.view`, `payment.refund`, `billing.readAll`) | No fiscal invoice pages, no tax config page, billing menu not in admin navigation |
| Admin permissions | `PermissionEnum` in `packages/schemas/src/enums/permission.enum.ts`. Categories: INVOICE, INVOICE_LINE, PAYMENT, PAYMENT_METHOD, SUBSCRIPTION, SUBSCRIPTION_ITEM, BILLING | No FISCAL_INVOICE, CREDIT_NOTE, or TAX_CONFIG categories |

### What Does NOT Exist

- ARCA integration package or adapter
- Tax regime configuration
- CUIT/CUIL/DNI validation logic
- Invoice PDF generation
- QR code generation for invoices
- Credit note creation flow
- Tax breakdown in any UI
- Fiscal invoice email sending
- Certificate management for ARCA
- Cloud storage for PDF files (S3/R2)
- Public endpoint for tax regime info (for web price display)

---

## 4. Architecture Overview

### System Components

```
+-------------------+     +-------------------+     +-------------------+
|   apps/web        |     |   apps/admin      |     |   apps/api        |
|                   |     |                   |     |                   |
| - Price display   |     | - Tax config UI   |     | - Invoice routes  |
|   with IVA text   |     | - Invoice list    |     | - Tax config      |
| - CUIT/DNI in     |     | - Credit note mgmt|     |   routes          |
|   user profile    |     | - Certificate mgmt|     | - Webhook handler |
| - Invoice         |     |                   |     |   (payment ->     |
|   download        |     |                   |     |    invoice)       |
+--------+----------+     +--------+----------+     +--------+----------+
         |                         |                         |
         +-------------------------+-------------------------+
                                   |
                    +--------------v--------------+
                    |   packages/billing          |
                    |                             |
                    | - Tax calculation service   |
                    | - ARCA adapter (afip.js)    |
                    | - Invoice PDF generator     |
                    | - Credit note service       |
                    | - QR code generator         |
                    | - CUIT/CUIL/DNI validator   |
                    +--------------+--------------+
                                   |
              +--------------------+--------------------+
              |                                         |
+--------------v--------------+          +--------------v--------------+
|   packages/db               |          |   Cloud Storage (R2/S3)    |
|                             |          |                             |
| - fiscal_invoices table     |          | - Invoice PDFs              |
| - fiscal_credit_notes table |          | - Credit note PDFs          |
| - Updated user schema       |          |                             |
| - billing_settings entries  |          +-----------------------------+
+--------------+--------------+
              |
    +---------v---------+
    |   ARCA (external) |
    |                   |
    | - WSAA (auth)     |
    | - WSFEv1 (invoices|
    +-------------------+
```

### Data Flow: Payment to Fiscal Invoice

```
1. MercadoPago webhook -> payment confirmed
2. API webhook handler (payment-logic.ts) calls billing service
3. Billing service records payment in billing_payments
4. Billing service checks fiscal_invoicing_enabled flag
5. If enabled AND payment.amount > 0:
   a. Read tax_regime from billing_settings
   b. Determine invoice type (C if Monotributo, B if RI, A if recipient is RI)
   c. Calculate IVA breakdown from IVA-inclusive price
   d. Acquire invoice creation mutex (serialize concurrent requests)
   e. Call ARCA adapter -> WSFEv1 -> FECAESolicitar
   f. Receive CAE from ARCA
   g. Store fiscal invoice in fiscal_invoices table
   h. Generate PDF with QR code
   i. Upload PDF to cloud storage (R2/S3)
   j. Send PDF to customer via email (using NotificationService)
   k. Link fiscal_invoice to billing_payment
6. If disabled or amount = 0: skip fiscal invoice creation
```

### Data Flow: Refund to Credit Note

```
1. Refund initiated (admin action, subscription cancellation, dispute)
2. API refund handler calls billing service
3. Billing service processes MercadoPago refund
4. Billing service triggers credit note creation:
   a. Look up original fiscal_invoice via billing_payment_id
   b. Validate: invoice is 'authorized', within 15-day window, amount valid
   c. Determine credit note type (NC C if Monotributo, NC B if RI, NC A if original was Factura A)
   d. Calculate IVA breakdown (same rates as original invoice)
   e. Acquire invoice creation mutex
   f. Call ARCA adapter -> WSFEv1 -> FECAESolicitar with credit note data
   g. Include CbtesAsoc referencing original invoice
   h. Receive CAE for credit note
   i. Store in fiscal_credit_notes table
   j. Generate credit note PDF
   k. Upload to cloud storage
   l. Send PDF to customer via email
```

---

## 5. Prerequisites (Phase 0)

These MUST be completed before starting Phase 1. They are external setup steps, not code tasks.

### 5.1 Cloud Storage Setup

The platform currently has NO cloud storage. Choose one:

**Option A: Cloudflare R2 (Recommended)**
- Free egress, S3-compatible API
- Already on Cloudflare ecosystem (if using Cloudflare DNS)
- Use `@aws-sdk/client-s3` with R2 endpoint

**Option B: AWS S3**
- Use `@aws-sdk/client-s3`
- Standard approach, well-documented

**Required implementation:**
- Create a `packages/storage/` package (or add to `packages/utils/`)
- Expose: `uploadFile({ bucket, key, body, contentType })`, `getSignedUrl({ bucket, key, expiresIn })`, `deleteFile({ bucket, key })`
- PDF bucket name: `hospeda-fiscal-invoices`
- Key pattern: `invoices/{year}/{month}/{fiscal_invoice_id}.pdf` or `credit-notes/{year}/{month}/{credit_note_id}.pdf`
- Signed URLs expire after 1 hour (for security, as invoices contain financial data)

### 5.2 ARCA Certificate Generation

Step-by-step process (done by the business owner, not a developer):

1. Log in to ARCA portal with Clave Fiscal nivel 3+: `https://auth.arca.gob.ar/`
2. Go to "Administracion de Certificados Digitales"
3. Create a new certificate for "Web Services"
4. Download the `.crt` (certificate) and `.key` (private key) files
5. For **homologacion** (testing): Use the ARCA testing portal
6. For **production**: Use the ARCA production portal
7. Store certificate files securely (NEVER commit to git)

For Vercel deployment:
```bash
# Convert certificate files to base64
cat cert.crt | base64 -w 0 > cert.b64
cat key.key | base64 -w 0 > key.b64
# Add as Vercel environment variables:
# HOSPEDA_ARCA_CERT_BASE64=<contents of cert.b64>
# HOSPEDA_ARCA_KEY_BASE64=<contents of key.b64>
```

### 5.3 Punto de Venta Registration

1. In ARCA portal, go to "ABM Puntos de Venta"
2. Register a new Punto de Venta with type "Web Services"
3. Assign a number (e.g., `2`) .. this will be `HOSPEDA_ARCA_PUNTO_VENTA`
4. Must be done for BOTH homologacion and production environments

### 5.4 Admin Navigation Setup

The billing menu is NOT yet in the admin navigation. Before adding fiscal invoice pages, add the billing section to `apps/admin/src/lib/menu.ts` following the existing menu pattern.

---

## 6. Database Schema Changes

### 6.1 New Table: `fiscal_invoices`

This table stores ARCA-authorized fiscal invoices. It is separate from `billing_invoices` (which is QZPay's internal invoice) to avoid modifying the QZPay adapter schema.

**Drizzle Schema** (create file: `packages/db/src/schemas/billing/fiscal_invoices.dbschema.ts`):

```typescript
import { boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.js';

/**
 * Fiscal invoices authorized by ARCA (Argentina's tax authority).
 * Each record represents an electronic invoice with a CAE.
 * Separate from billing_invoices (QZPay internal) to avoid schema coupling.
 */
export const fiscalInvoices = pgTable('fiscal_invoices', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Link to billing system (QZPay tables use varchar IDs in some cases)
    billingInvoiceId: uuid('billing_invoice_id'),
    billingPaymentId: uuid('billing_payment_id'),
    billingCustomerId: uuid('billing_customer_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),

    // ARCA invoice identification
    puntoVenta: integer('punto_venta').notNull(),
    cbteTipo: integer('cbte_tipo').notNull(),
    cbteNumero: integer('cbte_numero').notNull(),
    cbteFecha: date('cbte_fecha').notNull(),

    // ARCA authorization
    cae: varchar('cae', { length: 14 }),
    caeVencimiento: date('cae_vencimiento'),
    arcaStatus: varchar('arca_status', { length: 20 }).notNull().default('pending'),
    arcaResult: jsonb('arca_result'),
    arcaErrors: jsonb('arca_errors'),

    // Amounts (all in integer centavos, ARS)
    impTotal: integer('imp_total').notNull(),
    impNeto: integer('imp_neto').notNull(),
    impIva: integer('imp_iva').notNull(),
    impTotConc: integer('imp_tot_conc').notNull().default(0),
    impOpEx: integer('imp_op_ex').notNull().default(0),
    impTrib: integer('imp_trib').notNull().default(0),

    // IVA detail
    ivaRateId: integer('iva_rate_id').notNull().default(5),
    // NOTE: numeric() returns string in JS. Parse with Number() when reading.
    ivaRatePercent: numeric('iva_rate_percent', { precision: 5, scale: 2 }).notNull().default('21.00'),

    // Currency
    monId: varchar('mon_id', { length: 3 }).notNull().default('PES'),
    // NOTE: numeric() returns string in JS. Parse with Number() when reading.
    monCotiz: numeric('mon_cotiz', { precision: 10, scale: 4 }).notNull().default('1.0000'),

    // Service period (required for Concepto = 2)
    concepto: integer('concepto').notNull().default(2),
    fchServDesde: date('fch_serv_desde').notNull(),
    fchServHasta: date('fch_serv_hasta').notNull(),
    fchVtoPago: date('fch_vto_pago').notNull(),

    // Recipient information
    recipientDocTipo: integer('recipient_doc_tipo').notNull().default(99),
    recipientDocNro: varchar('recipient_doc_nro', { length: 20 }).notNull().default('0'),
    recipientCondicionIva: integer('recipient_condicion_iva').notNull().default(5),
    recipientName: varchar('recipient_name', { length: 255 }),
    recipientEmail: varchar('recipient_email', { length: 255 }),

    // PDF and delivery
    pdfStorageKey: text('pdf_storage_key'),
    pdfGeneratedAt: timestamp('pdf_generated_at', { withTimezone: true }),
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),

    // Metadata
    description: text('description'),
    taxRegime: varchar('tax_regime', { length: 30 }).notNull(),
    environment: varchar('environment', { length: 20 }).notNull().default('production'),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
}, (table) => [
    uniqueIndex('uq_fiscal_invoices_cbte').on(table.puntoVenta, table.cbteTipo, table.cbteNumero),
    index('idx_fiscal_invoices_user').on(table.userId),
    index('idx_fiscal_invoices_customer').on(table.billingCustomerId),
    index('idx_fiscal_invoices_cae').on(table.cae),
    index('idx_fiscal_invoices_status').on(table.arcaStatus),
    index('idx_fiscal_invoices_fecha').on(table.cbteFecha),
    index('idx_fiscal_invoices_payment').on(table.billingPaymentId),
]);
```

**Important notes:**
- `pdfStorageKey` stores the cloud storage object key (e.g., `invoices/2026/03/uuid.pdf`), NOT a full URL. The signed URL is generated on-demand.
- `ivaRatePercent` and `monCotiz` use `numeric()` which returns strings in JavaScript. Always parse with `Number()` when reading from DB.
- `arcaStatus` values: `'pending'`, `'authorized'`, `'rejected'`, `'error'`

### 6.2 New Table: `fiscal_credit_notes`

**Drizzle Schema** (create file: `packages/db/src/schemas/billing/fiscal_credit_notes.dbschema.ts`):

```typescript
import { date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { fiscalInvoices } from './fiscal_invoices.dbschema.js';
import { users } from '../user/user.dbschema.js';

/**
 * Fiscal credit notes (Notas de Credito) authorized by ARCA.
 * Each credit note references an original fiscal invoice.
 * Required for refunds, cancellations, and corrections.
 */
export const fiscalCreditNotes = pgTable('fiscal_credit_notes', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Link to original invoice
    fiscalInvoiceId: uuid('fiscal_invoice_id').notNull().references(() => fiscalInvoices.id),
    billingRefundId: uuid('billing_refund_id'),
    billingCustomerId: uuid('billing_customer_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),

    // ARCA credit note identification
    puntoVenta: integer('punto_venta').notNull(),
    cbteTipo: integer('cbte_tipo').notNull(),
    cbteNumero: integer('cbte_numero').notNull(),
    cbteFecha: date('cbte_fecha').notNull(),

    // ARCA authorization
    cae: varchar('cae', { length: 14 }),
    caeVencimiento: date('cae_vencimiento'),
    arcaStatus: varchar('arca_status', { length: 20 }).notNull().default('pending'),
    arcaResult: jsonb('arca_result'),
    arcaErrors: jsonb('arca_errors'),

    // Amounts (positive values representing the credited amount)
    impTotal: integer('imp_total').notNull(),
    impNeto: integer('imp_neto').notNull(),
    impIva: integer('imp_iva').notNull(),
    impTotConc: integer('imp_tot_conc').notNull().default(0),
    impOpEx: integer('imp_op_ex').notNull().default(0),
    impTrib: integer('imp_trib').notNull().default(0),

    // IVA detail (same as original invoice)
    ivaRateId: integer('iva_rate_id').notNull().default(5),
    ivaRatePercent: numeric('iva_rate_percent', { precision: 5, scale: 2 }).notNull().default('21.00'),

    // Currency
    monId: varchar('mon_id', { length: 3 }).notNull().default('PES'),
    monCotiz: numeric('mon_cotiz', { precision: 10, scale: 4 }).notNull().default('1.0000'),

    // Service period (same as original invoice)
    concepto: integer('concepto').notNull().default(2),
    fchServDesde: date('fch_serv_desde').notNull(),
    fchServHasta: date('fch_serv_hasta').notNull(),
    fchVtoPago: date('fch_vto_pago').notNull(),

    // Associated invoice reference (CbtesAsoc in WSFEv1)
    originalCbteTipo: integer('original_cbte_tipo').notNull(),
    originalCbtePuntoVenta: integer('original_cbte_punto_venta').notNull(),
    originalCbteNumero: integer('original_cbte_numero').notNull(),
    originalCbteFecha: date('original_cbte_fecha').notNull(),

    // Recipient (same as original invoice)
    recipientDocTipo: integer('recipient_doc_tipo').notNull(),
    recipientDocNro: varchar('recipient_doc_nro', { length: 20 }).notNull(),
    recipientCondicionIva: integer('recipient_condicion_iva').notNull(),
    recipientName: varchar('recipient_name', { length: 255 }),
    recipientEmail: varchar('recipient_email', { length: 255 }),

    // PDF and delivery
    pdfStorageKey: text('pdf_storage_key'),
    pdfGeneratedAt: timestamp('pdf_generated_at', { withTimezone: true }),
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),

    // Reason for credit note
    reason: varchar('reason', { length: 50 }).notNull(),
    reasonDescription: text('reason_description'),

    // Metadata
    taxRegime: varchar('tax_regime', { length: 30 }).notNull(),
    environment: varchar('environment', { length: 20 }).notNull().default('production'),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
}, (table) => [
    uniqueIndex('uq_fiscal_credit_notes_cbte').on(table.puntoVenta, table.cbteTipo, table.cbteNumero),
    index('idx_fiscal_credit_notes_invoice').on(table.fiscalInvoiceId),
    index('idx_fiscal_credit_notes_user').on(table.userId),
    index('idx_fiscal_credit_notes_cae').on(table.cae),
    index('idx_fiscal_credit_notes_status').on(table.arcaStatus),
]);
```

**Note on `billingCustomerId`:** The `billing_refunds` table does NOT have a `customer_id` column. To populate this field, query through the chain: `billing_refunds.payment_id` -> `billing_payments.customer_id`.

### 6.3 User Table Changes

Add these columns to the existing users table in `packages/db/src/schemas/user/user.dbschema.ts`:

```typescript
// Add these columns to the existing `users` pgTable definition:

/** CUIT/CUIL tax ID. Format: XXXXXXXXXXX (11 digits, stored without dashes). Optional for Consumidor Final. */
cuit: varchar('cuit', { length: 13 }),

/** DNI (national ID number). 7-8 digits. Required for Consumidor Final invoices above document threshold. */
dni: varchar('dni', { length: 10 }),

/** ARCA condition code: 1=RI, 4=Exento, 5=ConsumidorFinal, 6=Monotributista */
condicionIva: integer('condicion_iva'),

/** Business/legal name for invoice header (used when wants_factura_a = true) */
razonSocial: varchar('razon_social', { length: 255 }),

/** Whether user wants Factura A instead of B. When true, cuit and condicionIva=1 are required */
wantsFacturaA: boolean('wants_factura_a').notNull().default(false),
```

| Column | Purpose | When Required |
|--------|---------|---------------|
| `cuit` | Tax ID for Factura A recipients | When `wants_factura_a = true` |
| `dni` | National ID for over-threshold Consumidor Final invoices | When invoice total > threshold AND user has no CUIT |
| `condicion_iva` | Recipient's IVA condition for ARCA | When `wants_factura_a = true` (must be 1 = RI) |
| `razon_social` | Business/legal name for invoice header | When `wants_factura_a = true` |
| `wants_factura_a` | User preference for Factura A | Always available (default: false) |

### 6.4 Billing Settings Entries

Three new entries in the `billing_settings` key-value table:

**Key: `tax_regime`**
```json
{
    "type": "monotributo",
    "category": "H",
    "cuit": "20-XXXXXXXX-X",
    "razonSocial": "Hospeda SAS",
    "puntoVenta": 2,
    "ivaRate": 21,
    "ivaRateId": 5,
    "changedAt": "2026-03-06T00:00:00Z",
    "changedBy": "admin-user-uuid"
}
```

| Field | Description | Monotributo Value | RI Value |
|-------|-------------|-------------------|----------|
| `type` | Current tax regime | `"monotributo"` | `"responsable_inscripto"` |
| `category` | Monotributo category (only for Mono) | `"A"` through `"H"` | `null` |
| `cuit` | Hospeda's CUIT | `"20-XXXXXXXX-X"` | `"20-XXXXXXXX-X"` |
| `razonSocial` | Legal name | `"Hospeda SAS"` | `"Hospeda SAS"` |
| `puntoVenta` | Registered Punto de Venta number | `2` | `2` |
| `ivaRate` | IVA percentage for SaaS services | `21` | `21` |
| `ivaRateId` | ARCA IVA rate code | `5` | `5` |
| `changedAt` | When the regime was last changed | ISO date | ISO date |
| `changedBy` | Admin user who changed it | UUID | UUID |

**Key: `arca_config`**
```json
{
    "environment": "homologacion",
    "tokenCacheTtlMs": 43200000,
    "maxRetries": 3,
    "retryDelayMs": 2000,
    "consumidorFinalDocThreshold": 7576058
}
```

| Field | Description |
|-------|-------------|
| `environment` | `"homologacion"` (testing) or `"production"` |
| `tokenCacheTtlMs` | How long to cache WSAA tokens (default: 12 hours = 43200000 ms) |
| `maxRetries` | Max retries on ARCA network failures |
| `retryDelayMs` | Delay between retries (base for exponential backoff) |
| `consumidorFinalDocThreshold` | Amount in centavos above which Consumidor Final MUST provide DNI (currently ARS $75,760.58 = 7576058 centavos) |

**NOTE**: Certificate paths and credentials are NOT stored in billing_settings (they are environment variables). This prevents accidental exposure through admin APIs.

**Key: `fiscal_invoicing_config`**
```json
{
    "enabled": false,
    "enabledAt": null,
    "disabledReason": "Awaiting production ARCA certificates",
    "changedAt": "2026-03-06T00:00:00Z",
    "changedBy": "admin-user-uuid"
}
```

| Field | Description |
|-------|-------------|
| `enabled` | Master switch for fiscal invoice auto-generation. When false, payments proceed normally but no fiscal invoices are created |
| `enabledAt` | Timestamp when invoicing was first enabled (for audit) |
| `disabledReason` | Human-readable reason for disabling (for admin reference) |
| `changedAt` | When the setting was last changed |
| `changedBy` | Admin user who changed it |

### 6.5 Export New Schemas

Update `packages/db/src/schemas/billing/index.ts` to export the new schemas:

```typescript
// Add to existing exports:
export { fiscalInvoices } from './fiscal_invoices.dbschema.js';
export { fiscalCreditNotes } from './fiscal_credit_notes.dbschema.js';
```

### 6.6 Generate Migration

After adding the schemas, run:
```bash
cd packages/db
pnpm db:generate
```

This creates a new migration file in `packages/db/src/migrations/`. Review the generated SQL before applying with `pnpm db:migrate`.

---

## 7. Environment Variables

New environment variables required (following `HOSPEDA_` prefix convention):

```bash
# ARCA Integration
HOSPEDA_ARCA_ENVIRONMENT=homologacion         # 'homologacion' or 'production'
HOSPEDA_ARCA_CUIT=20409378472                  # Hospeda's CUIT (digits only)
HOSPEDA_ARCA_CERT_PATH=/secrets/arca/cert.crt  # Path to X.509 certificate (local dev)
HOSPEDA_ARCA_KEY_PATH=/secrets/arca/key.key    # Path to private key (local dev)
HOSPEDA_ARCA_CERT_BASE64=                      # Base64-encoded certificate (Vercel production)
HOSPEDA_ARCA_KEY_BASE64=                       # Base64-encoded private key (Vercel production)
HOSPEDA_ARCA_PUNTO_VENTA=2                     # Registered Punto de Venta number
HOSPEDA_ARCA_TOKEN_CACHE_TTL_MS=43200000       # WSAA token cache TTL (12h default)

# Optional overrides (defaults in code)
HOSPEDA_ARCA_MAX_RETRIES=3                     # Max retries on ARCA failures
HOSPEDA_ARCA_RETRY_DELAY_MS=2000               # Delay between retries in ms

# Cloud Storage (for PDF files)
HOSPEDA_STORAGE_PROVIDER=r2                    # 'r2' or 's3'
HOSPEDA_STORAGE_ENDPOINT=                      # R2/S3 endpoint URL
HOSPEDA_STORAGE_ACCESS_KEY_ID=                 # Access key
HOSPEDA_STORAGE_SECRET_ACCESS_KEY=             # Secret key
HOSPEDA_STORAGE_BUCKET_FISCAL=hospeda-fiscal-invoices  # Bucket for fiscal PDFs
HOSPEDA_STORAGE_REGION=auto                    # Region (use 'auto' for R2)
```

**Certificate handling**: In production (Vercel), certificates are stored as base64-encoded environment variables (`HOSPEDA_ARCA_CERT_BASE64`, `HOSPEDA_ARCA_KEY_BASE64`). The ARCA adapter checks `certBase64` first, falls back to `certPath`. To decode at runtime:

```typescript
// In arca-adapter.ts:
function loadCertificate(config: ArcaAdapterConfig): { cert: string; key: string } {
    if (config.certBase64 && config.keyBase64) {
        return {
            cert: Buffer.from(config.certBase64, 'base64').toString('utf-8'),
            key: Buffer.from(config.keyBase64, 'base64').toString('utf-8'),
        };
    }
    if (config.certPath && config.keyPath) {
        return {
            cert: fs.readFileSync(config.certPath, 'utf-8'),
            key: fs.readFileSync(config.keyPath, 'utf-8'),
        };
    }
    throw new Error('ARCA certificate not configured. Set CERT_BASE64/KEY_BASE64 or CERT_PATH/KEY_PATH');
}
```

Add ALL new variables to `apps/api/.env.example` and `apps/api/docs/ENVIRONMENT_VARIABLES.md`.

---

## 8. New Permission Definitions

### 8.1 New PermissionCategoryEnum Entries

Add to `packages/schemas/src/enums/permission.enum.ts`:

```typescript
// Add to PermissionCategoryEnum:
FISCAL_INVOICE = 'fiscalInvoice',
FISCAL_CREDIT_NOTE = 'fiscalCreditNote',
TAX_CONFIG = 'taxConfig',
```

### 8.2 New PermissionEnum Entries

```typescript
// Add to PermissionEnum:

// Fiscal Invoice permissions
FISCAL_INVOICE_VIEW = 'fiscalInvoice.view',
FISCAL_INVOICE_CREATE = 'fiscalInvoice.create',
FISCAL_INVOICE_RETRY = 'fiscalInvoice.retry',
FISCAL_INVOICE_DOWNLOAD = 'fiscalInvoice.download',

// Fiscal Credit Note permissions
FISCAL_CREDIT_NOTE_VIEW = 'fiscalCreditNote.view',
FISCAL_CREDIT_NOTE_CREATE = 'fiscalCreditNote.create',
FISCAL_CREDIT_NOTE_DOWNLOAD = 'fiscalCreditNote.download',

// Tax Configuration permissions
TAX_CONFIG_VIEW = 'taxConfig.view',
TAX_CONFIG_UPDATE = 'taxConfig.update',
TAX_CONFIG_TEST_ARCA = 'taxConfig.testArca',
```

### 8.3 Permission Usage Map

| Admin Endpoint | Required Permission |
|----------------|-------------------|
| GET `/fiscal/invoices` | `fiscalInvoice.view` |
| GET `/fiscal/invoices/:id` | `fiscalInvoice.view` |
| GET `/fiscal/invoices/:id/pdf` | `fiscalInvoice.download` |
| POST `/fiscal/invoices/:id/retry` | `fiscalInvoice.retry` |
| GET `/fiscal/credit-notes` | `fiscalCreditNote.view` |
| GET `/fiscal/credit-notes/:id` | `fiscalCreditNote.view` |
| POST `/fiscal/credit-notes` | `fiscalCreditNote.create` |
| GET `/fiscal/tax-regime` | `taxConfig.view` |
| PUT `/fiscal/tax-regime` | `taxConfig.update` |
| GET `/fiscal/arca/health` | `taxConfig.view` |
| POST `/fiscal/arca/test-invoice` | `taxConfig.testArca` |

---

## 9. Zod Schemas (`@repo/schemas`)

### 9.1 Tax Regime Schema

File: `packages/schemas/src/entities/billing/tax-regime.schema.ts`

```typescript
import { z } from 'zod';

/** Valid tax regime types */
export const TaxRegimeTypeEnum = z.enum(['monotributo', 'responsable_inscripto']);

/** Monotributo categories (services only, A through H) */
export const MonotributoCategoryEnum = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);

/** Tax regime configuration stored in billing_settings */
export const TaxRegimeSchema = z.object({
    type: TaxRegimeTypeEnum,
    category: MonotributoCategoryEnum.nullable(),
    cuit: z.string().regex(/^\d{2}-?\d{8}-?\d{1}$/, 'Invalid CUIT format'),
    razonSocial: z.string().min(1).max(255),
    puntoVenta: z.number().int().min(1).max(99999),
    ivaRate: z.number().default(21),
    ivaRateId: z.number().int().default(5),
    changedAt: z.string().datetime(),
    changedBy: z.string().uuid().nullable(),
});

export type TaxRegimeType = z.infer<typeof TaxRegimeTypeEnum>;
export type MonotributoCategory = z.infer<typeof MonotributoCategoryEnum>;
export type TaxRegime = z.infer<typeof TaxRegimeSchema>;
```

### 9.2 ARCA Config Schema

File: `packages/schemas/src/entities/billing/arca-config.schema.ts`

```typescript
import { z } from 'zod';

/** ARCA integration configuration stored in billing_settings */
export const ArcaConfigSchema = z.object({
    environment: z.enum(['homologacion', 'production']),
    tokenCacheTtlMs: z.number().int().positive().default(43200000),
    maxRetries: z.number().int().min(0).max(10).default(3),
    retryDelayMs: z.number().int().positive().default(2000),
    consumidorFinalDocThreshold: z.number().int().positive().default(7576058),
});

export type ArcaConfig = z.infer<typeof ArcaConfigSchema>;
```

### 9.3 Fiscal Invoicing Config Schema

File: `packages/schemas/src/entities/billing/fiscal-invoicing-config.schema.ts`

```typescript
import { z } from 'zod';

/** Fiscal invoicing kill switch stored in billing_settings */
export const FiscalInvoicingConfigSchema = z.object({
    enabled: z.boolean(),
    enabledAt: z.string().datetime().nullable(),
    disabledReason: z.string().max(500).nullable(),
    changedAt: z.string().datetime(),
    changedBy: z.string().uuid().nullable(),
});

export type FiscalInvoicingConfig = z.infer<typeof FiscalInvoicingConfigSchema>;
```

### 9.4 CUIT/CUIL Validation Schema

File: `packages/schemas/src/entities/billing/cuit.schema.ts`

```typescript
import { z } from 'zod';

/**
 * CUIT/CUIL validation using Modulo 11 algorithm.
 *
 * Accepts input with or without dashes (e.g., "20-40937847-2" or "20409378472").
 * The .transform() strips dashes, so the OUTPUT type is always 11 digits without dashes.
 * This means: form input shows dashes, DB stores without dashes.
 *
 * Format: XX-XXXXXXXX-X (11 digits)
 * Valid prefixes: 20 (male), 23 (male alt), 24 (male/female alt),
 *   27 (female), 28 (female alt), 30 (company), 33 (company alt), 34 (company alt)
 *
 * Algorithm:
 * 1. Multiply first 10 digits by weights [5,4,3,2,7,6,5,4,3,2]
 * 2. Sum all products
 * 3. checkDigit = 11 - (sum % 11)
 * 4. If checkDigit == 11, use 0
 * 5. If checkDigit == 10, use 9
 * 6. Last digit must equal checkDigit
 */
export const CuitSchema = z.string()
    .transform((val) => val.replace(/[-\s]/g, ''))
    .pipe(
        z.string()
            .length(11, 'CUIT/CUIL must be exactly 11 digits')
            .regex(/^\d{11}$/, 'CUIT/CUIL must contain only digits')
            .refine((val) => {
                const validPrefixes = ['20', '23', '24', '27', '28', '30', '33', '34'];
                return validPrefixes.includes(val.substring(0, 2));
            }, 'Invalid CUIT/CUIL prefix')
            .refine((val) => {
                const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
                const digits = val.split('').map(Number);
                let sum = 0;
                for (let i = 0; i < 10; i++) {
                    sum += digits[i] * weights[i];
                }
                let checkDigit = 11 - (sum % 11);
                if (checkDigit === 11) checkDigit = 0;
                if (checkDigit === 10) checkDigit = 9;
                return digits[10] === checkDigit;
            }, 'Invalid CUIT/CUIL check digit')
    );

/** Re-export for display purposes: adds dashes to an 11-digit CUIT string */
export function formatCuitDisplay(cuit: string): string {
    const clean = cuit.replace(/\D/g, '');
    if (clean.length !== 11) return cuit;
    return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
}

export type Cuit = z.infer<typeof CuitSchema>;
```

### 9.5 DNI Validation Schema

File: `packages/schemas/src/entities/billing/dni.schema.ts`

```typescript
import { z } from 'zod';

/**
 * Argentine DNI (Documento Nacional de Identidad) validation.
 * 7 or 8 digits, no dots or dashes in storage.
 * Accepts input with dots (e.g., "40.937.847") and strips them.
 */
export const DniSchema = z.string()
    .transform((val) => val.replace(/[.\s-]/g, ''))
    .pipe(
        z.string()
            .min(7, 'DNI must be at least 7 digits')
            .max(8, 'DNI must be at most 8 digits')
            .regex(/^\d{7,8}$/, 'DNI must contain only digits')
    );

export type Dni = z.infer<typeof DniSchema>;
```

### 9.6 Fiscal Invoice Schema

File: `packages/schemas/src/entities/billing/fiscal-invoice.schema.ts`

```typescript
import { z } from 'zod';

/** ARCA invoice type codes */
export const CbteTipoEnum = z.enum(['1', '3', '6', '8', '11', '13']);

/** ARCA authorization status */
export const ArcaStatusEnum = z.enum(['pending', 'authorized', 'rejected', 'error']);

/** ARCA document type codes */
export const DocTipoEnum = z.enum(['80', '86', '96', '99']);

/** ARCA recipient IVA condition codes */
export const CondicionIvaEnum = z.enum(['1', '4', '5', '6', '7', '8', '9', '10', '13', '15', '16']);

/** Credit note reason */
export const CreditNoteReasonEnum = z.enum(['refund', 'cancellation', 'correction', 'downgrade']);

/** Fiscal invoice create schema (input to the service) */
export const CreateFiscalInvoiceSchema = z.object({
    billingInvoiceId: z.string().uuid().optional(),
    billingPaymentId: z.string().uuid().optional(),
    billingCustomerId: z.string().uuid(),
    userId: z.string().uuid(),
    impTotal: z.number().int().positive('Invoice amount must be greater than 0'),
    fchServDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fchServHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fchVtoPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    recipientDocTipo: z.number().int().default(99),
    recipientDocNro: z.string().default('0'),
    recipientCondicionIva: z.number().int().default(5),
    recipientName: z.string().max(255).optional(),
    recipientEmail: z.string().email().optional(),
    description: z.string().max(500).optional(),
});

/** Create credit note schema (input to the service) */
export const CreateCreditNoteSchema = z.object({
    fiscalInvoiceId: z.string().uuid(),
    billingRefundId: z.string().uuid().optional(),
    reason: CreditNoteReasonEnum,
    reasonDescription: z.string().max(500).optional(),
    /** Amount to credit in centavos. Must be <= original invoice total. For full refunds, omit (uses original total). */
    amount: z.number().int().positive().optional(),
});

/** Fiscal invoice response schema (output from API) */
export const FiscalInvoiceSchema = z.object({
    id: z.string().uuid(),
    billingInvoiceId: z.string().uuid().nullable(),
    billingPaymentId: z.string().uuid().nullable(),
    billingCustomerId: z.string().uuid(),
    userId: z.string().uuid(),
    puntoVenta: z.number().int(),
    cbteTipo: z.number().int(),
    cbteNumero: z.number().int(),
    cbteFecha: z.string(),
    cae: z.string().nullable(),
    caeVencimiento: z.string().nullable(),
    arcaStatus: ArcaStatusEnum,
    impTotal: z.number().int(),
    impNeto: z.number().int(),
    impIva: z.number().int(),
    ivaRatePercent: z.number(),
    fchServDesde: z.string(),
    fchServHasta: z.string(),
    recipientDocTipo: z.number().int(),
    recipientDocNro: z.string(),
    recipientCondicionIva: z.number().int(),
    recipientName: z.string().nullable(),
    description: z.string().nullable(),
    taxRegime: z.string(),
    pdfStorageKey: z.string().nullable(),
    emailSentAt: z.string().nullable(),
    createdAt: z.string(),
});

export type CreateFiscalInvoice = z.infer<typeof CreateFiscalInvoiceSchema>;
export type CreateCreditNote = z.infer<typeof CreateCreditNoteSchema>;
export type FiscalInvoice = z.infer<typeof FiscalInvoiceSchema>;
export type ArcaStatus = z.infer<typeof ArcaStatusEnum>;
export type CreditNoteReason = z.infer<typeof CreditNoteReasonEnum>;
```

### 9.7 User Tax Fields Schema

Update `packages/schemas/src/entities/user/user.crud.schema.ts`:

Add these optional fields to the existing `UserUpdateInputSchema`:

```typescript
import { CuitSchema } from '../billing/cuit.schema.js';
import { DniSchema } from '../billing/dni.schema.js';

// Add to UserUpdateInputSchema:
cuit: CuitSchema.optional(),
dni: DniSchema.optional(),
condicionIva: z.number().int().optional(),
razonSocial: z.string().min(1).max(255).optional(),
wantsFacturaA: z.boolean().optional(),
```

Add validation refinement to the schema:

```typescript
.refine((data) => {
    if (data.wantsFacturaA) {
        return !!data.cuit && data.condicionIva === 1;
    }
    return true;
}, {
    message: 'CUIT and condicionIva=1 (Responsable Inscripto) are required for Factura A',
    path: ['cuit'],
})
```

---

## 10. ARCA Adapter (`packages/billing/src/adapters/arca/`)

### 10.1 File Structure

```
packages/billing/src/adapters/arca/
  index.ts                   # Public exports
  arca-adapter.ts            # Main adapter class
  arca-adapter.types.ts      # TypeScript interfaces
  arca-adapter.config.ts     # Configuration and constants
  arca-adapter.test.ts       # Unit tests (mocked ARCA responses)
  wsfe-request-builder.ts    # Builds WSFEv1 request payloads
  wsfe-response-parser.ts    # Parses WSFEv1 responses
  qr-code-generator.ts       # Generates invoice QR codes
  cae-validator.ts           # Validates CAE format and expiration
```

### 10.2 Configuration Constants

File: `arca-adapter.config.ts`

```typescript
/** ARCA WSAA endpoints */
export const WSAA_ENDPOINTS = {
    homologacion: 'https://wsaahomo.arca.gob.ar/ws/services/LoginCms',
    production: 'https://wsaa.arca.gob.ar/ws/services/LoginCms',
} as const;

/** ARCA WSFEv1 endpoints */
export const WSFE_ENDPOINTS = {
    homologacion: 'https://wswhomo.arca.gob.ar/wsfev1/service.asmx',
    production: 'https://servicios1.arca.gob.ar/wsfev1/service.asmx',
} as const;

/** Invoice type codes */
export const CBTE_TIPO = {
    FACTURA_A: 1,
    NOTA_CREDITO_A: 3,
    FACTURA_B: 6,
    NOTA_CREDITO_B: 8,
    FACTURA_C: 11,
    NOTA_CREDITO_C: 13,
} as const;

/** Document type codes */
export const DOC_TIPO = {
    CUIT: 80,
    CUIL: 86,
    DNI: 96,
    OTRO: 99,
} as const;

/** Recipient IVA condition codes */
export const CONDICION_IVA = {
    RESPONSABLE_INSCRIPTO: 1,
    IVA_EXENTO: 4,
    CONSUMIDOR_FINAL: 5,
    MONOTRIBUTISTA: 6,
} as const;

/** IVA rate codes */
export const IVA_RATE = {
    RATE_0: { id: 3, percent: 0 },
    RATE_10_5: { id: 4, percent: 10.5 },
    RATE_21: { id: 5, percent: 21 },
    RATE_27: { id: 6, percent: 27 },
} as const;

/** Concept codes */
export const CONCEPTO = {
    PRODUCTOS: 1,
    SERVICIOS: 2,
    PRODUCTOS_Y_SERVICIOS: 3,
} as const;

/** Currency codes */
export const MONEDA = {
    ARS: 'PES',
    USD: 'DOL',
    BRL: '012',
    EUR: '060',
} as const;

/** CAE validity in days for services */
export const CAE_VALIDITY_DAYS_SERVICES = 10;

/** Credit note deadline in days */
export const CREDIT_NOTE_DEADLINE_DAYS = 15;
```

### 10.3 Adapter Interface

File: `arca-adapter.types.ts`

```typescript
/** Configuration for the ARCA adapter */
export interface ArcaAdapterConfig {
    readonly environment: 'homologacion' | 'production';
    readonly cuit: string;
    readonly certPath?: string;
    readonly keyPath?: string;
    readonly certBase64?: string;
    readonly keyBase64?: string;
    readonly tokenCacheTtlMs: number;
    readonly maxRetries: number;
    readonly retryDelayMs: number;
}

/** Request to create an invoice via WSFEv1 */
export interface CreateArcaInvoiceRequest {
    readonly puntoVenta: number;
    readonly cbteTipo: number;
    readonly concepto: number;
    readonly docTipo: number;
    readonly docNro: string;
    readonly cbteDesde: number;
    readonly cbteHasta: number;
    readonly cbteFecha: string;      // YYYYMMDD
    readonly impTotal: number;        // decimal (e.g., 121.00) - NOT centavos
    readonly impNeto: number;         // decimal (e.g., 100.00) - NOT centavos
    readonly impIva: number;          // decimal (e.g., 21.00) - NOT centavos
    readonly impTotConc: number;
    readonly impOpEx: number;
    readonly impTrib: number;
    readonly monId: string;
    readonly monCotiz: number;
    readonly condicionIvaReceptorId: number;
    readonly fchServDesde?: string;   // YYYYMMDD
    readonly fchServHasta?: string;   // YYYYMMDD
    readonly fchVtoPago?: string;     // YYYYMMDD
    readonly iva: ReadonlyArray<{ readonly Id: number; readonly BaseImp: number; readonly Importe: number }>;
    readonly cbtesAsoc?: ReadonlyArray<{
        readonly Tipo: number;
        readonly PtoVta: number;
        readonly Nro: number;
        readonly Cuit?: string;
        readonly CbteFch?: string;
    }>;
}

/** Response from ARCA after invoice creation */
export interface ArcaInvoiceResponse {
    readonly cae: string;
    readonly caeVencimiento: string;  // YYYYMMDD
    readonly cbteNumero: number;
    readonly resultado: 'A' | 'R';    // A = Approved, R = Rejected
    readonly observaciones?: ReadonlyArray<{ readonly Code: number; readonly Msg: string }>;
    readonly errores?: ReadonlyArray<{ readonly Code: number; readonly Msg: string }>;
}

/** ARCA adapter public interface */
export interface ArcaAdapter {
    /** Create an invoice and get CAE */
    createInvoice(request: CreateArcaInvoiceRequest): Promise<ArcaInvoiceResponse>;
    /** Get the last authorized invoice number for a PtoVta + CbteTipo combination */
    getLastInvoiceNumber(params: { readonly puntoVenta: number; readonly cbteTipo: number }): Promise<number>;
    /** Query an existing invoice */
    queryInvoice(params: { readonly puntoVenta: number; readonly cbteTipo: number; readonly cbteNumero: number }): Promise<unknown>;
    /** Check if the ARCA service is available */
    healthCheck(): Promise<boolean>;
}
```

### 10.4 afip.js Initialization and Method Mapping

The adapter wraps `@afipsdk/afip.js`. Here is how to initialize and use it:

```typescript
import Afip from '@afipsdk/afip.js';

// Initialization (done ONCE at adapter creation)
const afip = new Afip({
    CUIT: config.cuit,                    // Hospeda's CUIT (digits only)
    cert: loadedCert,                     // Certificate content (string, not path)
    key: loadedKey,                       // Private key content (string, not path)
    production: config.environment === 'production',
    // afip.js handles WSAA token caching internally
});
```

**Method mapping table:**

| Adapter Method | afip.js Call | Notes |
|----------------|-------------|-------|
| `createInvoice(req)` | `afip.ElectronicBilling.createVoucher(voucherData)` | Returns `{ CAE, CAEFchVto, CbteDesde, ... }` |
| `getLastInvoiceNumber({ puntoVenta, cbteTipo })` | `afip.ElectronicBilling.getLastVoucher(puntoVenta, cbteTipo)` | Returns the last authorized CbteNro (number) |
| `queryInvoice({ puntoVenta, cbteTipo, cbteNumero })` | `afip.ElectronicBilling.getVoucherInfo(cbteNumero, puntoVenta, cbteTipo)` | Returns full voucher data |
| `healthCheck()` | `afip.ElectronicBilling.getServerStatus()` | Returns `{ AppServer, DbServer, AuthServer }` |

**afip.js voucher data format** (what `createVoucher` expects):

```typescript
const voucherData = {
    CantReg: 1,                        // Always 1 (one invoice per request)
    PtoVta: request.puntoVenta,
    CbteTipo: request.cbteTipo,
    Concepto: request.concepto,
    DocTipo: request.docTipo,
    DocNro: request.docNro,
    CbteDesde: request.cbteDesde,
    CbteHasta: request.cbteHasta,
    CbteFch: request.cbteFecha,        // YYYYMMDD string
    ImpTotal: request.impTotal,        // decimal number
    ImpTotConc: request.impTotConc,
    ImpNeto: request.impNeto,
    ImpOpEx: request.impOpEx,
    ImpTrib: request.impTrib,
    ImpIVA: request.impIva,
    MonId: request.monId,
    MonCotiz: request.monCotiz,
    FchServDesde: request.fchServDesde,
    FchServHasta: request.fchServHasta,
    FchVtoPago: request.fchVtoPago,
    // IVA breakdown array (empty for Factura C)
    Iva: request.iva.map(i => ({
        Id: i.Id,
        BaseImp: i.BaseImp,
        Importe: i.Importe,
    })),
    // Associated invoices (only for credit notes)
    ...(request.cbtesAsoc ? {
        CbtesAsoc: request.cbtesAsoc.map(a => ({
            Tipo: a.Tipo,
            PtoVta: a.PtoVta,
            Nro: a.Nro,
            ...(a.Cuit ? { Cuit: a.Cuit } : {}),
            ...(a.CbteFch ? { CbteFch: a.CbteFch } : {}),
        })),
    } : {}),
};
```

**NOTE**: afip.js handles WSAA token caching internally. Do NOT implement token caching in the adapter .. afip.js does this automatically.

### 10.5 Adapter Implementation Notes

1. **Amount conversion**: ARCA expects decimal amounts (e.g., `121.00`), but Hospeda stores centavos (e.g., `12100`). The adapter MUST convert centavos to decimals before sending: `amount / 100`. Use `Number((centavos / 100).toFixed(2))` to ensure 2 decimal precision
2. **Date formatting**: ARCA expects dates as `YYYYMMDD` strings (no separators). Convert ISO dates: `'2026-03-06'.replace(/-/g, '')` -> `'20260306'`
3. **Retry logic**: On ARCA network errors (not validation errors), retry up to `maxRetries` times with exponential backoff: `retryDelayMs * 2^attempt`. Classify errors:
   - **Validation errors** (bad data, wrong CbteTipo) .. do NOT retry, return error immediately
   - **Network errors** (timeout, connection refused) .. retry with backoff
   - **Auth errors** (expired token) .. afip.js handles token refresh internally
4. **Concurrency control**: Use a mutex/semaphore to serialize invoice creation requests. Two concurrent payments could otherwise get the same `lastNumber + 1`, causing ARCA to reject the second. Implementation: use a simple in-memory mutex (adequate for single-server deployment). For multi-server: use a database advisory lock on `fiscal_invoices` table
5. **Idempotency**: Invoice numbers are sequential and unique per PtoVta+CbteTipo. Always call `getLastInvoiceNumber()` inside the mutex to get the next number. Never cache invoice numbers

### 10.6 QR Code Generation

File: `qr-code-generator.ts`

The QR code encodes a URL to ARCA's verification service:

```
https://www.afip.gob.ar/fe/qr/?p=BASE64_ENCODED_JSON
```

The JSON payload structure:

```typescript
interface QrCodePayload {
    readonly ver: 1;                    // Version (always 1)
    readonly fecha: string;             // Invoice date YYYY-MM-DD
    readonly cuit: number;              // Issuer's CUIT (digits only, as number)
    readonly ptoVta: number;            // Punto de Venta
    readonly tipoCmp: number;           // CbteTipo
    readonly nroCmp: number;            // Invoice number
    readonly importe: number;           // Total amount (decimal, NOT centavos)
    readonly moneda: string;            // Currency code (PES)
    readonly ctz: number;               // Exchange rate
    readonly tipoDocRec?: number;       // Recipient doc type (omit if 99)
    readonly nroDocRec?: number;        // Recipient doc number (omit if 0)
    readonly tipoCodAut: 'E';           // Authorization type (E = electronic)
    readonly codAut: number;            // CAE (14 digits, as number)
}
```

Use the `qrcode` npm package to generate the QR image. Output format: PNG buffer for embedding in PDFs.

```typescript
import QRCode from 'qrcode';

export async function generateInvoiceQrCode(params: {
    readonly cbteFecha: string;       // YYYY-MM-DD
    readonly cuit: string;            // digits only
    readonly puntoVenta: number;
    readonly cbteTipo: number;
    readonly cbteNumero: number;
    readonly impTotal: number;        // centavos
    readonly monId: string;
    readonly monCotiz: number;
    readonly docTipo: number;
    readonly docNro: string;
    readonly cae: string;
}): Promise<Buffer> {
    const payload: QrCodePayload = {
        ver: 1,
        fecha: params.cbteFecha,
        cuit: Number(params.cuit),
        ptoVta: params.puntoVenta,
        tipoCmp: params.cbteTipo,
        nroCmp: params.cbteNumero,
        importe: Number((params.impTotal / 100).toFixed(2)),
        moneda: params.monId,
        ctz: params.monCotiz,
        ...(params.docTipo !== 99 ? { tipoDocRec: params.docTipo } : {}),
        ...(params.docNro !== '0' ? { nroDocRec: Number(params.docNro) } : {}),
        tipoCodAut: 'E',
        codAut: Number(params.cae),
    };

    const jsonStr = JSON.stringify(payload);
    const base64 = Buffer.from(jsonStr).toString('base64');
    const url = `https://www.afip.gob.ar/fe/qr/?p=${base64}`;

    return QRCode.toBuffer(url, { type: 'png', width: 200, margin: 1 });
}
```

---

## 11. Tax Calculation Service

File: `packages/billing/src/services/tax-calculation.service.ts`

### 11.1 Core Calculations

All Hospeda plan prices are **IVA-inclusive** (the price the user sees already contains IVA). To generate invoices, we must reverse-calculate the net amount:

```
Given: totalWithIva = plan price (e.g., 1500000 centavos = $15,000 ARS)
IVA rate = 21%

netAmount = Math.round(totalWithIva / 1.21)
ivaAmount = totalWithIva - netAmount

Example:
  totalWithIva = 1500000 centavos ($15,000)
  netAmount = Math.round(1500000 / 1.21) = 1239669 centavos ($12,396.69)
  ivaAmount = 1500000 - 1239669 = 260331 centavos ($2,603.31)

Verification: 1239669 + 260331 = 1500000 (correct)
```

**CRITICAL**: Always calculate `ivaAmount = totalWithIva - netAmount` (not `netAmount * 0.21`) to avoid rounding errors. The sum of `netAmount + ivaAmount` MUST always equal `totalWithIva` exactly.

**NOTE**: The existing `calculateTax()` in `@repo/utils/currency.ts` calculates tax FROM a base amount (`amount * rate / 100`). This is the OPPOSITE of what we need (reverse-calculation from an IVA-inclusive price). Do NOT reuse `calculateTax()` for fiscal invoices. Create a new `reverseCalculateIva()` function in the billing package.

```typescript
/**
 * Reverse-calculates IVA components from an IVA-inclusive total.
 * IMPORTANT: ivaAmount is calculated as remainder to avoid rounding drift.
 */
export function reverseCalculateIva(params: {
    readonly totalWithIva: number;  // in centavos
    readonly ivaRatePercent: number;  // e.g., 21
}): { readonly netAmount: number; readonly ivaAmount: number } {
    const { totalWithIva, ivaRatePercent } = params;
    const netAmount = Math.round(totalWithIva / (1 + ivaRatePercent / 100));
    const ivaAmount = totalWithIva - netAmount;
    return { netAmount, ivaAmount } as const;
}
```

### 11.2 Monotributo Mode

When `tax_regime.type === 'monotributo'`:

- Invoice type: Factura C (code 11)
- Credit note type: NC C (code 13)
- IVA is NOT broken down on the invoice
- WSFEv1 fields: `ImpNeto = total`, `ImpIva = 0`, `Iva = []` (empty array)
- UI: Show price as-is, no IVA breakdown text

### 11.3 Responsable Inscripto Mode

When `tax_regime.type === 'responsable_inscripto'`:

**For Consumidor Final / Monotributista recipients (Factura B):**
- Invoice type: Factura B (code 6)
- Credit note type: NC B (code 8)
- IVA IS broken down (mandatory per Ley 27.743)
- WSFEv1 fields: `ImpNeto = net`, `ImpIva = iva`, `Iva = [{Id: 5, BaseImp: net/100, Importe: iva/100}]`
- Invoice must include legend: "Regimen de Transparencia Fiscal al Consumidor Ley 27.743"

**For Responsable Inscripto recipients (Factura A):**
- Invoice type: Factura A (code 1)
- Credit note type: NC A (code 3)
- IVA IS broken down
- Recipient CUIT is required
- WSFEv1 fields: Same as Factura B

### 11.4 Invoice Type Decision Logic

```typescript
function determineInvoiceType(params: {
    readonly taxRegime: TaxRegime;
    readonly recipientCondicionIva: number;
    readonly recipientWantsFacturaA: boolean;
}): number {
    const { taxRegime, recipientCondicionIva, recipientWantsFacturaA } = params;

    if (taxRegime.type === 'monotributo') {
        return CBTE_TIPO.FACTURA_C;  // Always Factura C for Monotributo
    }

    // taxRegime.type === 'responsable_inscripto'
    if (recipientCondicionIva === CONDICION_IVA.RESPONSABLE_INSCRIPTO && recipientWantsFacturaA) {
        return CBTE_TIPO.FACTURA_A;  // Factura A for RI-to-RI
    }

    return CBTE_TIPO.FACTURA_B;  // Default: Factura B for everyone else
}
```

### 11.5 Credit Note Type Decision Logic

```typescript
function determineCreditNoteType(params: {
    readonly originalCbteTipo: number;
}): number {
    switch (params.originalCbteTipo) {
        case CBTE_TIPO.FACTURA_A:  return CBTE_TIPO.NOTA_CREDITO_A;   // 1 -> 3
        case CBTE_TIPO.FACTURA_B:  return CBTE_TIPO.NOTA_CREDITO_B;   // 6 -> 8
        case CBTE_TIPO.FACTURA_C:  return CBTE_TIPO.NOTA_CREDITO_C;   // 11 -> 13
        default: throw new Error(`Unknown CbteTipo: ${params.originalCbteTipo}`);
    }
}
```

---

## 12. Fiscal Invoice Service

File: `packages/billing/src/services/fiscal-invoice.service.ts`

### 12.1 Create Fiscal Invoice Flow

This is the complete step-by-step flow. Each step is numbered so a developer can implement them sequentially:

```
Step 1: Receive CreateFiscalInvoiceInput (validated by Zod schema from Section 9.6)
Step 2: Check fiscal_invoicing_config.enabled from billing_settings. If false, return early with { skipped: true }
Step 3: Validate impTotal > 0. If 0, return early (free plans don't generate invoices)
Step 4: Load tax_regime from billing_settings (validate with TaxRegimeSchema)
Step 5: Load arca_config from billing_settings (validate with ArcaConfigSchema)
Step 6: Load user profile (for CUIT, DNI, condicionIva, wantsFacturaA, razonSocial)
Step 7: Determine CbteTipo using invoice type decision logic (Section 11.4)
Step 8: Calculate IVA breakdown:
    - If Monotributo: impNeto = impTotal, impIva = 0
    - If RI: use reverseCalculateIva({ totalWithIva: impTotal, ivaRatePercent: taxRegime.ivaRate })
Step 9: Determine recipient document:
    - If user has CUIT and wantsFacturaA: DocTipo = 80, DocNro = user.cuit
    - Else if user has CUIT: DocTipo = 80, DocNro = user.cuit
    - Else if impTotal > arca_config.consumidorFinalDocThreshold:
        - If user has DNI: DocTipo = 96, DocNro = user.dni
        - Else: Log warning, use DocTipo = 99, DocNro = 0 (ARCA may reject, retry after user provides DNI)
    - Else: DocTipo = 99, DocNro = 0
Step 10: Acquire invoice creation mutex (see Section 10.5 point 4)
Step 11: Call ARCA adapter getLastInvoiceNumber(puntoVenta, cbteTipo)
Step 12: Build ARCA request with nextNumber = lastNumber + 1
    - Convert centavos to decimals for all amount fields (/ 100)
    - Convert dates from ISO to YYYYMMDD
Step 13: Call ARCA adapter createInvoice(request)
Step 14: Release mutex
Step 15: If ARCA returns resultado = 'A' (approved):
    a. Extract CAE and CAE vencimiento from response
    b. Insert record into fiscal_invoices table with arca_status = 'authorized'
    c. Generate QR code using CAE data (Section 10.6)
    d. Generate PDF invoice with QR code embedded (Section 13)
    e. Upload PDF to cloud storage, get storage key
    f. Update fiscal_invoices record with pdfStorageKey and pdfGeneratedAt
    g. Send invoice email via NotificationService (Section 14)
    h. Update fiscal_invoices record with emailSentAt
    i. Return success with fiscal invoice data
Step 16: If ARCA returns resultado = 'R' (rejected):
    a. Insert record into fiscal_invoices table with arca_status = 'rejected'
    b. Store ARCA errors in arca_errors column, full response in arca_result
    c. Log error with full ARCA response via @repo/logger
    d. Capture in Sentry as error level
    e. Return error with ARCA error details
    f. DO NOT retry automatically for validation errors
Step 17: If ARCA adapter throws network error (after exhausting retries):
    a. Insert record into fiscal_invoices table with arca_status = 'error'
    b. Store error details in arca_errors column
    c. Log error for manual review
    d. Capture in Sentry as warning level (retry cron will pick it up)
    e. Return error. The retry cron job will handle it
```

### 12.2 Retry Cron Job for Failed Invoices

**File**: `apps/api/src/cron/jobs/fiscal-invoice-retry.job.ts`

Follow the same pattern as `dunning.job.ts`. Register in `apps/api/src/cron/registry.ts` and `apps/api/src/cron/bootstrap.ts`.

**Job configuration:**
- Name: `fiscal-invoice-retry`
- Schedule: `*/15 * * * *` (every 15 minutes)
- Type: Add `'fiscal-invoice-retry'` to the job types in `apps/api/src/cron/types.ts`

**Job logic:**

```
Step 1: Query fiscal_invoices WHERE arca_status = 'error' AND created_at > NOW() - INTERVAL '48 hours'
Step 2: For each invoice:
    a. Acquire mutex
    b. Re-query getLastInvoiceNumber to get correct next number
    c. Rebuild ARCA request with new number
    d. Call createInvoice
    e. Release mutex
    f. If successful: update status to 'authorized', store CAE, generate PDF, upload, send email
    g. If still failing: log and leave as 'error'
Step 3: Query fiscal_invoices WHERE arca_status = 'error' AND created_at <= NOW() - INTERVAL '48 hours'
Step 4: For each stale invoice: send admin notification via NotificationType.FISCAL_INVOICE_STALE
Step 5: Return job result with counts: { retried, succeeded, failed, stale }
```

### 12.3 Create Credit Note Flow

```
Step 1: Receive CreateCreditNoteInput (validated by CreateCreditNoteSchema from Section 9.6)
Step 2: Load original fiscal_invoice from database by fiscalInvoiceId
Step 3: Validate:
    - Original invoice arca_status MUST be 'authorized'
    - Credit note MUST be issued within 15 calendar days of original cbte_fecha
    - If amount specified: must be > 0 and <= remaining creditable amount
    - Remaining creditable = original.impTotal - sum(existing credit notes for this invoice).impTotal
    - If amount not specified: use full original.impTotal (only if no prior credit notes exist)
Step 4: Determine credit note CbteTipo (Section 11.5)
Step 5: Calculate IVA breakdown:
    - If amount equals original.impTotal: use original invoice's impNeto and impIva
    - If partial amount: use reverseCalculateIva with same rate as original
Step 6: Get billingCustomerId by joining billing_refunds -> billing_payments -> customer_id
Step 7: Build ARCA request with CbtesAsoc referencing original invoice:
    CbtesAsoc = [{
        Tipo: original.cbteTipo,
        PtoVta: original.puntoVenta,
        Nro: original.cbteNumero,
        CbteFch: formatDate(original.cbteFecha),  // YYYYMMDD
    }]
Step 8: Acquire mutex
Step 9: Call ARCA adapter getLastInvoiceNumber(puntoVenta, creditNoteCbteTipo)
Step 10: Call ARCA adapter createInvoice(request)
Step 11: Release mutex
Step 12: If approved: store in fiscal_credit_notes, generate PDF, upload, send email
Step 13: If rejected/error: same handling as invoice creation (Steps 16-17 of Section 12.1)
```

### 12.4 Edge Cases and Business Rules

| Scenario | Behavior |
|----------|----------|
| Free plan payment ($0) | Skip fiscal invoice creation entirely |
| Add-on purchase | Generate fiscal invoice with same flow as subscription payment |
| Multiple credit notes for same invoice | Allowed. Sum of all credit note amounts must not exceed original invoice total |
| Regime change with pending 'error' invoices | Retry uses the `tax_regime` stored in the fiscal_invoice record at creation time, NOT the current regime |
| Over-threshold Consumidor Final without DNI | Create invoice with DocTipo=99, DocNro=0. ARCA may reject. Log warning for admin to contact user |
| ARCA planned maintenance | Retry cron handles it. Maintenance windows are typically nights/weekends |

---

## 13. Invoice PDF Generation

File: `packages/billing/src/services/invoice-pdf.service.ts`

### 13.1 PDF Library

Use `@react-pdf/renderer` for PDF generation. This is a React-based PDF engine that runs server-side.

**Server-side React rendering in Hono context:**
```typescript
import { renderToBuffer } from '@react-pdf/renderer';
// renderToBuffer() returns a Node.js Buffer containing the PDF
// No DOM or browser required - it runs entirely server-side
const pdfBuffer = await renderToBuffer(<InvoiceDocument data={invoiceData} />);
```

### 13.2 Invoice PDF Layout

The PDF MUST contain the following sections, in this order:

```
+------------------------------------------------------------------+
| HOSPEDA                                              [QR CODE]    |
| CUIT: 20-XXXXXXXX-X                                              |
| Condicion frente al IVA: [Monotributista / Resp. Inscripto]      |
| Domicilio: [address]                                              |
| Inicio de actividades: [date]                                     |
+------------------------------------------------------------------+
|                                                                    |
| FACTURA [A/B/C]                 Punto de Venta: XXXX              |
| Codigo: XX                      Comprobante Nro: XXXXXXXX         |
| Fecha de Emision: DD/MM/YYYY                                      |
|                                                                    |
+------------------------------------------------------------------+
| DATOS DEL RECEPTOR                                                 |
| Condicion frente al IVA: [Consumidor Final / etc.]                |
| Nombre/Razon Social: [name]                                       |
| CUIT/CUIL/DNI: [number or "---"]                                  |
| Domicilio: [address or "---"]                                      |
+------------------------------------------------------------------+
|                                                                    |
| Concepto: Servicios                                                |
| Periodo facturado: DD/MM/YYYY al DD/MM/YYYY                       |
| Fecha de Vto. para el pago: DD/MM/YYYY                            |
|                                                                    |
+------------------------------------------------------------------+
| DETALLE                                                            |
|-------------------------------------------------------------------|
| Descripcion           | Cant. | Precio Unit. | Subtotal           |
|-------------------------------------------------------------------|
| [plan description]    | 1     | $XX.XXX,XX   | $XX.XXX,XX         |
|-------------------------------------------------------------------|
|                                                                    |
| IF regime === 'responsable_inscripto':                             |
|   Subtotal: $XX.XXX,XX                                            |
|   IVA (21%): $X.XXX,XX                                            |
|   -------                                                          |
|   Total: $XX.XXX,XX                                               |
|   [Regimen de Transparencia Fiscal al Consumidor Ley 27.743]      |
|                                                                    |
| IF regime === 'monotributo':                                       |
|   Total: $XX.XXX,XX                                               |
|                                                                    |
+------------------------------------------------------------------+
| CAE: XXXXXXXXXXXXXX                                                |
| Fecha de Vto. de CAE: DD/MM/YYYY                                  |
+------------------------------------------------------------------+
```

### 13.3 Amount Formatting

- Use Argentine locale: `es-AR`
- Decimal separator: `,` (comma)
- Thousands separator: `.` (period)
- Currency symbol: `$` before amount
- Example: `$15.000,00`
- Convert from centavos to display: `amount / 100`, then format with 2 decimal places

```typescript
function formatArsAmount(centavos: number): string {
    const pesos = centavos / 100;
    return pesos.toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
```

### 13.4 Credit Note PDF

Same layout as invoice but:
- Title: "NOTA DE CREDITO [A/B/C]" instead of "FACTURA"
- Additional section: "Comprobante asociado: Factura [A/B/C] Nro XXXX-XXXXXXXX del DD/MM/YYYY"
- Additional section: "Motivo: [reason description]"

---

## 14. Email Integration

### 14.1 New Notification Types

Add to `packages/notifications/` NotificationType enum:

```typescript
// Add these notification types:
FISCAL_INVOICE_SENT = 'fiscal_invoice_sent',
FISCAL_CREDIT_NOTE_SENT = 'fiscal_credit_note_sent',
FISCAL_INVOICE_STALE = 'fiscal_invoice_stale',  // Admin alert for 48h+ stuck invoices
```

### 14.2 Fiscal Invoice Email Template

Create in `packages/email/src/templates/FiscalInvoiceEmail.tsx`:

```typescript
// React Email template
// Subject: "Tu factura {type} Nro {number} de Hospeda"
// Content:
//   - Greeting: "Hola {recipientName},"
//   - Body: "Te enviamos tu factura electronica correspondiente a tu suscripcion en Hospeda."
//   - Invoice summary: Type, Number, Date, Total
//   - CTA button: "Ver factura" (link to signed PDF URL)
//   - Note: "Este comprobante fue autorizado por ARCA. CAE: {cae}"
//   - Footer: Hospeda branding
```

### 14.3 Integration with Existing NotificationService

The fiscal invoice email is sent via the existing `sendNotification()` helper in `apps/api/src/utils/notification-helper.ts`:

```typescript
// After PDF is generated and uploaded:
await sendNotification({
    type: NotificationType.FISCAL_INVOICE_SENT,
    recipientEmail: invoice.recipientEmail,
    recipientName: invoice.recipientName ?? invoice.recipientEmail,
    userId: invoice.userId,
    // Template-specific fields:
    invoiceType: 'B',                    // A, B, or C
    invoiceNumber: '0002-00000001',      // Formatted number
    invoiceDate: '01/03/2026',
    invoiceTotal: '$15.000,00',
    pdfUrl: signedPdfUrl,               // Signed URL (1h expiry)
    cae: invoice.cae,
}).catch((err) => {
    // Non-blocking. If email fails, it will be retried by notification-schedule cron.
    logger.warn('Fiscal invoice email failed, will retry', { invoiceId: invoice.id, error: err });
});
```

---

## 15. API Endpoints

All new endpoints follow the existing three-tier route architecture.

### 15.1 Admin Endpoints (`/api/v1/admin/billing/fiscal/`)

| Method | Path | Description | Required Permission |
|--------|------|-------------|-------------------|
| GET | `/invoices` | List all fiscal invoices (paginated, filterable) | `fiscalInvoice.view` |
| GET | `/invoices/:id` | Get fiscal invoice detail | `fiscalInvoice.view` |
| GET | `/invoices/:id/pdf` | Get signed URL for invoice PDF download | `fiscalInvoice.download` |
| POST | `/invoices/:id/retry` | Retry a failed invoice (status = 'error') | `fiscalInvoice.retry` |
| GET | `/credit-notes` | List all credit notes (paginated, filterable) | `fiscalCreditNote.view` |
| GET | `/credit-notes/:id` | Get credit note detail | `fiscalCreditNote.view` |
| POST | `/credit-notes` | Create a credit note for an invoice | `fiscalCreditNote.create` |
| GET | `/tax-regime` | Get current tax regime configuration | `taxConfig.view` |
| PUT | `/tax-regime` | Update tax regime (Mono <-> RI switch) | `taxConfig.update` |
| GET | `/invoicing-config` | Get fiscal invoicing enabled/disabled config | `taxConfig.view` |
| PUT | `/invoicing-config` | Enable/disable fiscal invoicing | `taxConfig.update` |
| GET | `/arca/health` | Check ARCA service status | `taxConfig.view` |
| POST | `/arca/test-invoice` | Create a test invoice in homologacion | `taxConfig.testArca` |

**List filters for `/invoices`:**
- `status` (pending, authorized, rejected, error)
- `cbteTipo` (1, 6, 11)
- `userId`
- `dateFrom`, `dateTo`
- `search` (by recipient name, CAE, or invoice number)
- Standard pagination: `page`, `pageSize`

**Routes file**: Create `apps/api/src/routes/admin/billing/fiscal/` directory with:
- `invoices.routes.ts`
- `credit-notes.routes.ts`
- `tax-config.routes.ts`
- `arca.routes.ts`
- `index.ts` (mounts all sub-routes)

Mount in `apps/api/src/routes/admin/billing/index.ts`.

### 15.2 Protected Endpoints (`/api/v1/protected/billing/fiscal/`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/my-invoices` | List current user's fiscal invoices | User session |
| GET | `/my-invoices/:id/pdf` | Get signed URL for own invoice PDF | User session |
| GET | `/my-credit-notes` | List current user's credit notes | User session |

**Routes file**: Create `apps/api/src/routes/protected/billing/fiscal.routes.ts`

### 15.3 Public Endpoints (`/api/v1/public/billing/`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/tax-info` | Get current tax regime type (for price display) | None |

**Response:**
```json
{
    "success": true,
    "data": {
        "taxRegimeType": "monotributo",
        "ivaRate": 21,
        "showIvaBreakdown": false
    }
}
```

When `type === 'monotributo'`: `showIvaBreakdown = false`
When `type === 'responsable_inscripto'`: `showIvaBreakdown = true`

This endpoint is used by the web app to determine whether to show "(IVA incluido)" or a full IVA breakdown on pricing pages. Cache the response client-side for the session duration.

### 15.4 Webhook Integration

**File to modify**: `apps/api/src/routes/webhooks/mercadopago/payment-logic.ts`

**Where to add**: Inside the `processPaymentUpdated()` function, AFTER the success notification is sent and AFTER add-on confirmation (if applicable).

```typescript
// In processPaymentUpdated(), after existing success path:

// === BEGIN FISCAL INVOICE TRIGGER ===
// Fire-and-forget: do NOT await or block the webhook response
void (async () => {
    try {
        // 1. Check if fiscal invoicing is enabled
        const fiscalConfig = await billingSettingsModel.findByKey('fiscal_invoicing_config');
        if (!fiscalConfig?.value?.enabled) return;

        // 2. Skip zero-amount payments
        const paymentAmount = extractPaymentAmount(data); // existing helper
        if (!paymentAmount || paymentAmount <= 0) return;

        // 3. Get subscription and customer info
        // NOTE: extractPaymentInfo() already gives us the amount.
        // We need additional data that requires DB queries:
        const payment = await billingPaymentsModel.findByProviderIds(data);
        if (!payment) return;

        const customer = await billingCustomersModel.findById(payment.customerId);
        if (!customer?.metadata?.userId) return;

        const user = await userModel.findById(customer.metadata.userId);
        if (!user) return;

        // 4. Get subscription period dates (if subscription payment)
        let periodStart: string;
        let periodEnd: string;
        if (payment.subscriptionId) {
            const subscription = await billingSubscriptionsModel.findById(payment.subscriptionId);
            periodStart = subscription?.currentPeriodStart?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0];
            periodEnd = subscription?.currentPeriodEnd?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0];
        } else {
            // Add-on or one-time payment: use today as both dates
            const today = new Date().toISOString().split('T')[0];
            periodStart = today;
            periodEnd = today;
        }

        // 5. Trigger fiscal invoice creation
        await fiscalInvoiceService.createFromPayment({
            billingPaymentId: payment.id,
            billingCustomerId: payment.customerId,
            userId: customer.metadata.userId,
            impTotal: payment.amount,
            fchServDesde: periodStart,
            fchServHasta: periodEnd,
            fchVtoPago: periodEnd,
            recipientEmail: user.email,
            recipientName: user.displayName ?? user.firstName ?? user.email,
            description: payment.metadata?.planName
                ? `${payment.metadata.planName} - ${periodStart} al ${periodEnd}`
                : `Hospeda - ${periodStart} al ${periodEnd}`,
        });
    } catch (err) {
        // Non-blocking error. Retry cron will pick up 'error' status invoices.
        logger.error('Fiscal invoice creation failed (will retry via cron)', { error: err });
        captureException(err);
    }
})();
// === END FISCAL INVOICE TRIGGER ===
```

---

## 16. UI Changes

### 16.1 Web App (`apps/web`) - Price Display

**How the web app gets tax regime info:**
1. The pricing pages (`/precios/turistas`, `/precios/propietarios`) call the public endpoint `GET /api/v1/public/billing/tax-info` at page render time (SSR)
2. The response provides `taxRegimeType` and `showIvaBreakdown`
3. Pass as props to PricingCard components
4. Cache on client for session duration (localStorage with 1h TTL, same pattern as exchange rates)
5. If the endpoint fails, default to `showIvaBreakdown: false` (show "(IVA incluido)" only)

**PricingCard changes** (file: `apps/web/src/components/shared/PricingCard.astro`):

Add new props:
```typescript
interface Props {
    readonly plan: Plan;
    readonly highlighted?: boolean;
    readonly highlightLabel?: string;
    readonly class?: string;
    // NEW:
    readonly showIvaBreakdown?: boolean;  // from tax-info endpoint
    readonly ivaRate?: number;             // default 21
}
```

Display logic:
- When `showIvaBreakdown === false` (Monotributo): Show `"$15.000 /mes (IVA incluido)"` after the price
- When `showIvaBreakdown === true` (RI): Show:
  ```
  Subtotal: $12.396,69
  IVA (21%): $2.603,31
  Total: $15.000,00 /mes
  ```

### 16.2 Web App - User Profile Tax Data

Add a new section to the user profile edit page.

**File**: `apps/web/src/components/account/ProfileEditForm.client.tsx`

Currently shows only `name` and `bio`. Add a collapsible "Datos fiscales" section BELOW the existing fields:

```
Datos fiscales (opcional)
--------------------------
[ ] Quiero recibir Factura A

If checked, show these fields:
  CUIT/CUIL: [___-________-_]  (validated with Modulo 11 on blur)
  Razon Social: [________________]

Note text: "Si no completas estos datos, recibiras Factura B/C como Consumidor Final."

Always visible (independent of Factura A checkbox):
  DNI: [________]  (optional, 7-8 digits)
  Note text: "Tu DNI puede ser requerido para facturas que superen $75.760"
```

When submitting, include the new fields in the API call to update user profile.

### 16.3 Web App - Invoice History

**File**: `apps/web/src/components/account/InvoiceHistory.client.tsx`

Currently shows QZPay billing invoices. Add a SECOND section or tab below for fiscal invoices:

```
Mis Comprobantes Fiscales
--------------------------
| Fecha       | Tipo  | Nro        | Total      | Estado     | PDF  |
|-------------|-------|------------|------------|------------|------|
| 01/03/2026  | B     | 0002-0001  | $15.000,00 | Autorizada | [dl] |
| 01/02/2026  | B     | 0002-0002  | $15.000,00 | Autorizada | [dl] |
```

- Fetch from `GET /api/v1/protected/billing/fiscal/my-invoices`
- PDF download button calls `GET /api/v1/protected/billing/fiscal/my-invoices/:id/pdf` which returns a signed URL, then opens it in a new tab
- Status badges: Autorizada (green), Pendiente (yellow), Rechazada (red), Error (red)
- Format invoice number as `PPPP-NNNNNNNN` (punto_venta padded to 4 digits, cbte_numero padded to 8)

### 16.4 Admin App - New Pages

#### Tax Configuration Page

**Route**: `apps/admin/src/routes/_authed/billing/tax-config.tsx`
**Feature dir**: `apps/admin/src/features/billing-tax-config/`

```
Configuracion Fiscal
--------------------------
Regimen actual: [Monotributista / Resp. Inscripto (dropdown)]
  If Monotributo: Categoria: [A-H (dropdown)]
CUIT: [20-40937847-2]
Razon Social: [Hospeda SAS]
Punto de Venta: [2]
Tasa IVA: [21%]

Facturacion automatica: [Habilitada / Deshabilitada (toggle)]
  If disabled: Motivo: [text field]

Entorno ARCA: [Homologacion / Produccion]
Estado del servicio: [Available indicator / Unavailable indicator]

[Guardar] [Probar conexion con ARCA]
```

Follow the admin page pattern: `SidebarPageLayout` wrapper, `Card` for each section, hooks in `hooks.ts`.

#### Fiscal Invoices List Page

**Route**: `apps/admin/src/routes/_authed/billing/fiscal-invoices.tsx`
**Feature dir**: `apps/admin/src/features/billing-fiscal-invoices/`

Standard admin list with filters for status, type, date range, and search. Each row shows: date, type (A/B/C), number, recipient, total, IVA, CAE, status, PDF download. Retry button for 'error' status rows.

Follow same pattern as `apps/admin/src/routes/_authed/billing/invoices.tsx` (existing QZPay invoices page).

Feature directory structure:
```
billing-fiscal-invoices/
  index.ts
  hooks.ts                    # useFiscalInvoicesQuery, useRetryFiscalInvoiceMutation
  types.ts                    # FiscalInvoice, FiscalInvoiceFilters
  FiscalInvoicesTable.tsx
  FiscalInvoiceFilters.tsx
  FiscalInvoiceDetailDialog.tsx
```

#### Credit Notes Page

**Route**: `apps/admin/src/routes/_authed/billing/credit-notes.tsx`
**Feature dir**: `apps/admin/src/features/billing-credit-notes/`

Similar to fiscal invoices list. Each row shows: date, type (NC A/B/C), number, original invoice reference, amount, reason, CAE, status, PDF download. Button to create new credit note opens a dialog.

Feature directory structure:
```
billing-credit-notes/
  index.ts
  hooks.ts                    # useCreditNotesQuery, useCreateCreditNoteMutation
  types.ts
  CreditNotesTable.tsx
  CreditNoteFilters.tsx
  CreditNoteDetailDialog.tsx
  CreateCreditNoteDialog.tsx  # Select invoice, reason, optional partial amount
```

#### Admin Navigation

Add billing section to `apps/admin/src/lib/menu.ts`:

```typescript
{
    titleKey: 'admin-menu.billing.title',
    children: [
        // ... existing billing items ...
        {
            titleKey: 'admin-menu.billing.fiscalInvoices',
            to: '/billing/fiscal-invoices',
            permission: PermissionEnum.FISCAL_INVOICE_VIEW,
        },
        {
            titleKey: 'admin-menu.billing.creditNotes',
            to: '/billing/credit-notes',
            permission: PermissionEnum.FISCAL_CREDIT_NOTE_VIEW,
        },
        {
            titleKey: 'admin-menu.billing.taxConfig',
            to: '/billing/tax-config',
            permission: PermissionEnum.TAX_CONFIG_VIEW,
        },
    ],
}
```

---

## 17. i18n Strings

Add to `packages/i18n/src/locales/`:

### Spanish (es) - add to `billing.json`:
```json
{
    "tax": {
        "ivaIncluded": "IVA incluido",
        "subtotal": "Subtotal",
        "iva": "IVA ({rate}%)",
        "total": "Total",
        "transparencyLaw": "Regimen de Transparencia Fiscal al Consumidor Ley 27.743",
        "wantFacturaA": "Quiero recibir Factura A",
        "facturaANote": "Si no completas estos datos, recibiras Factura B/C como Consumidor Final.",
        "dniNote": "Tu DNI puede ser requerido para facturas que superen $75.760",
        "cuit": "CUIT/CUIL",
        "dni": "DNI",
        "condicionIva": "Condicion frente al IVA",
        "razonSocial": "Razon Social",
        "regime": {
            "monotributo": "Monotributista",
            "responsableInscripto": "Responsable Inscripto",
            "consumidorFinal": "Consumidor Final",
            "exento": "IVA Exento"
        },
        "fiscalData": "Datos fiscales",
        "fiscalDataOptional": "Datos fiscales (opcional)"
    },
    "fiscalInvoice": {
        "title": "Factura {type}",
        "creditNote": "Nota de Credito {type}",
        "pointOfSale": "Punto de Venta",
        "number": "Comprobante Nro",
        "issueDate": "Fecha de Emision",
        "servicePeriod": "Periodo facturado",
        "paymentDueDate": "Fecha de Vto. para el pago",
        "cae": "CAE",
        "caeExpiry": "Fecha de Vto. de CAE",
        "recipientData": "Datos del receptor",
        "detail": "Detalle",
        "myInvoices": "Mis Comprobantes Fiscales",
        "download": "Descargar PDF",
        "status": {
            "authorized": "Autorizada",
            "pending": "Pendiente",
            "rejected": "Rechazada",
            "error": "Error"
        },
        "retry": "Reintentar",
        "retrySuccess": "Factura reintentada exitosamente",
        "retryError": "Error al reintentar factura",
        "empty": "No hay comprobantes fiscales",
        "creditNoteReason": {
            "refund": "Reembolso",
            "cancellation": "Cancelacion",
            "correction": "Correccion",
            "downgrade": "Cambio de plan"
        },
        "associatedInvoice": "Comprobante asociado",
        "reason": "Motivo",
        "createCreditNote": "Crear nota de credito"
    }
}
```

### English (en) - add to `billing.json`:
```json
{
    "tax": {
        "ivaIncluded": "Tax included",
        "subtotal": "Subtotal",
        "iva": "VAT ({rate}%)",
        "total": "Total",
        "transparencyLaw": "Consumer Tax Transparency Regime Law 27.743",
        "wantFacturaA": "I want to receive Invoice A",
        "facturaANote": "If you don't complete this information, you will receive Invoice B/C as a Final Consumer.",
        "dniNote": "Your DNI may be required for invoices exceeding ARS $75,760",
        "cuit": "CUIT/CUIL",
        "dni": "DNI",
        "condicionIva": "Tax status",
        "razonSocial": "Business Name",
        "regime": {
            "monotributo": "Monotributo",
            "responsableInscripto": "Registered Taxpayer",
            "consumidorFinal": "Final Consumer",
            "exento": "Tax Exempt"
        },
        "fiscalData": "Tax information",
        "fiscalDataOptional": "Tax information (optional)"
    },
    "fiscalInvoice": {
        "title": "Invoice {type}",
        "creditNote": "Credit Note {type}",
        "pointOfSale": "Point of Sale",
        "number": "Invoice No.",
        "issueDate": "Issue Date",
        "servicePeriod": "Service Period",
        "paymentDueDate": "Payment Due Date",
        "cae": "CAE",
        "caeExpiry": "CAE Expiry Date",
        "recipientData": "Recipient Information",
        "detail": "Detail",
        "myInvoices": "My Fiscal Invoices",
        "download": "Download PDF",
        "status": {
            "authorized": "Authorized",
            "pending": "Pending",
            "rejected": "Rejected",
            "error": "Error"
        },
        "retry": "Retry",
        "retrySuccess": "Invoice retried successfully",
        "retryError": "Error retrying invoice",
        "empty": "No fiscal invoices",
        "creditNoteReason": {
            "refund": "Refund",
            "cancellation": "Cancellation",
            "correction": "Correction",
            "downgrade": "Plan change"
        },
        "associatedInvoice": "Associated invoice",
        "reason": "Reason",
        "createCreditNote": "Create credit note"
    }
}
```

### Portuguese (pt) - add to `billing.json`:
```json
{
    "tax": {
        "ivaIncluded": "Impostos incluidos",
        "subtotal": "Subtotal",
        "iva": "IVA ({rate}%)",
        "total": "Total",
        "transparencyLaw": "Regime de Transparencia Fiscal ao Consumidor Lei 27.743",
        "wantFacturaA": "Quero receber Fatura A",
        "facturaANote": "Se voce nao preencher esses dados, recebera Fatura B/C como Consumidor Final.",
        "dniNote": "Seu DNI pode ser necessario para faturas que excedam ARS $75.760",
        "cuit": "CUIT/CUIL",
        "dni": "DNI",
        "condicionIva": "Situacao fiscal",
        "razonSocial": "Razao Social",
        "regime": {
            "monotributo": "Monotributista",
            "responsableInscripto": "Responsavel Inscrito",
            "consumidorFinal": "Consumidor Final",
            "exento": "Isento de IVA"
        },
        "fiscalData": "Dados fiscais",
        "fiscalDataOptional": "Dados fiscais (opcional)"
    },
    "fiscalInvoice": {
        "title": "Fatura {type}",
        "creditNote": "Nota de Credito {type}",
        "pointOfSale": "Ponto de Venda",
        "number": "Fatura Nro",
        "issueDate": "Data de Emissao",
        "servicePeriod": "Periodo faturado",
        "paymentDueDate": "Data de Vencimento",
        "cae": "CAE",
        "caeExpiry": "Data de Vencimento do CAE",
        "recipientData": "Dados do destinatario",
        "detail": "Detalhe",
        "myInvoices": "Meus Comprovantes Fiscais",
        "download": "Baixar PDF",
        "status": {
            "authorized": "Autorizada",
            "pending": "Pendente",
            "rejected": "Rejeitada",
            "error": "Erro"
        },
        "retry": "Tentar novamente",
        "retrySuccess": "Fatura reenviada com sucesso",
        "retryError": "Erro ao tentar novamente",
        "empty": "Sem comprovantes fiscais",
        "creditNoteReason": {
            "refund": "Reembolso",
            "cancellation": "Cancelamento",
            "correction": "Correcao",
            "downgrade": "Mudanca de plano"
        },
        "associatedInvoice": "Comprovante associado",
        "reason": "Motivo",
        "createCreditNote": "Criar nota de credito"
    }
}
```

### Admin i18n (add to `admin-billing.json` for all 3 locales):

```json
{
    "fiscalInvoices": {
        "title": "Fiscal Invoices",
        "description": "Manage ARCA-authorized fiscal invoices",
        "columns": {
            "date": "Date",
            "type": "Type",
            "number": "Number",
            "recipient": "Recipient",
            "total": "Total",
            "iva": "IVA",
            "cae": "CAE",
            "status": "Status"
        }
    },
    "creditNotes": {
        "title": "Credit Notes",
        "description": "Manage fiscal credit notes"
    },
    "taxConfig": {
        "title": "Tax Configuration",
        "description": "Configure tax regime and ARCA integration",
        "currentRegime": "Current Regime",
        "category": "Category",
        "arcaEnvironment": "ARCA Environment",
        "serviceStatus": "Service Status",
        "available": "Available",
        "unavailable": "Unavailable",
        "testConnection": "Test ARCA Connection",
        "autoInvoicing": "Automatic Invoicing",
        "enabled": "Enabled",
        "disabled": "Disabled",
        "disabledReason": "Reason for disabling"
    }
}
```

---

## 18. Migration Strategy

### Phase 0: Prerequisites (no code changes)
1. Set up cloud storage (R2 or S3) - see Section 5.1
2. Generate ARCA homologacion certificates - see Section 5.2
3. Register Punto de Venta in ARCA homologacion - see Section 5.3

### Phase 1: Database & Configuration (no user-facing changes)
1. Create Drizzle schemas for `fiscal_invoices` and `fiscal_credit_notes` (Section 6.1, 6.2)
2. Add user table columns (`cuit`, `dni`, `condicion_iva`, `razon_social`, `wants_factura_a`) (Section 6.3)
3. Generate and apply database migration
4. Add new PermissionEnum entries (Section 8)
5. Seed `billing_settings` with `tax_regime`, `arca_config`, and `fiscal_invoicing_config` entries (Section 6.4)
6. Add environment variables to `.env.example` and deployment configs (Section 7)
7. Create cloud storage package/module

### Phase 2: Core Services (no user-facing changes)
1. Implement Zod validation schemas (Section 9)
2. Implement ARCA adapter with `@afipsdk/afip.js` (Section 10)
3. Implement tax calculation service with `reverseCalculateIva()` (Section 11)
4. Implement fiscal invoice service (Section 12)
5. Implement QR code generator (Section 10.6)
6. Implement invoice PDF generator (Section 13)
7. Create email template for fiscal invoices (Section 14)
8. Write comprehensive unit tests for all services (mock ARCA)
9. Test against ARCA homologacion environment with real certificates

### Phase 3: API Endpoints
1. Implement public tax-info endpoint (Section 15.3)
2. Implement admin fiscal invoice endpoints (Section 15.1)
3. Implement admin credit note endpoints (Section 15.1)
4. Implement admin tax configuration endpoints (Section 15.1)
5. Implement protected user invoice endpoints (Section 15.2)
6. Extend MercadoPago webhook handler (Section 15.4)
7. Implement fiscal invoice retry cron job (Section 12.2)

### Phase 4: UI Changes
1. Update PricingCard component with IVA text (Section 16.1)
2. Add tax data section to user profile (Section 16.2)
3. Add fiscal invoice history to subscription page (Section 16.3)
4. Build admin tax configuration page (Section 16.4)
5. Build admin fiscal invoices list page (Section 16.4)
6. Build admin credit notes page (Section 16.4)
7. Add billing section to admin navigation (Section 16.4)
8. Add i18n strings for all three locales (Section 17)

### Phase 5: Integration Testing & Go-Live
1. End-to-end test: payment -> invoice -> PDF -> email (homologacion)
2. End-to-end test: refund -> credit note -> PDF -> email (homologacion)
3. Test Mono -> RI regime switch
4. Test Factura A flow (RI recipient with CUIT)
5. Test fiscal_invoicing_enabled kill switch
6. Obtain production ARCA certificates
7. Register production Punto de Venta
8. Switch `arca_config.environment` to `production`
9. Enable `fiscal_invoicing_config.enabled = true`
10. Monitor first production invoices

---

## 19. Testing Requirements

### Unit Tests (minimum 90% coverage)

| Component | Test Focus |
|-----------|-----------|
| CUIT validation | Valid CUITs, invalid check digits, invalid prefixes, all valid prefixes (20/23/24/27/28/30/33/34), format normalization (with/without dashes), edge cases (leading zeros) |
| DNI validation | Valid DNIs (7-8 digits), invalid lengths, format normalization (dots stripped) |
| Tax calculation (`reverseCalculateIva`) | Reverse IVA calculation for ALL 9 plan prices, rounding correctness, sum verification (net + iva = total always), zero amount handling |
| Invoice type logic | All combinations: Mono/RI regime x ConsumerFinal/Mono/RI/Exento recipient x wantsFacturaA true/false |
| Credit note type logic | All mappings: Factura A->NC A, B->NC B, C->NC C, invalid CbteTipo throws error |
| QR code payload | JSON structure, base64 encoding, URL format, optional field omission (DocTipo 99 omitted) |
| ARCA adapter | Mocked afip.js responses: success (resultado=A), rejection (resultado=R), network error, retry behavior, amount conversion (centavos->decimal), date formatting (ISO->YYYYMMDD) |
| PDF generation | Correct layout for Factura A/B/C, IVA breakdown presence/absence based on regime, amount formatting (es-AR locale), credit note layout differences |
| Fiscal invoicing config | Kill switch enabled/disabled behavior, edge cases |
| Credit note validation | Within 15-day window, amount limits, multiple credit notes cumulative check |

### Integration Tests

| Scenario | What to Verify |
|----------|----------------|
| Payment webhook -> fiscal invoice | Invoice created in DB, CAE stored, PDF generated and uploaded, email sent |
| Refund -> credit note | Credit note references original, CAE obtained, PDF generated |
| Regime switch Mono -> RI | New invoices use Factura B, old ones remain Factura C |
| User requests Factura A | CUIT validated, Factura A issued, recipient data correct |
| ARCA downtime | Invoice created with status 'error', retry cron picks it up and succeeds |
| Over-threshold Consumidor Final with DNI | DNI used as DocNro with DocTipo=96 |
| Over-threshold Consumidor Final without DNI | Invoice created with DocTipo=99, warning logged |
| Free plan payment | No fiscal invoice created |
| Add-on payment | Fiscal invoice created with correct amount and description |
| Kill switch disabled | Payment processes normally, no fiscal invoice created |
| Multiple credit notes on same invoice | Cumulative amount validated correctly |
| Concurrent payments | Mutex serializes invoice creation, no duplicate numbers |

### Homologacion Tests

Before production go-live, ALL these must pass against ARCA's homologacion environment:

1. Create Factura C with Concepto 2 (Services)
2. Create Factura B with IVA breakdown
3. Create Factura A with recipient CUIT
4. Create NC B referencing a Factura B
5. Create NC C referencing a Factura C
6. Query an existing invoice by number
7. Get last authorized number for all CbteTipo values used
8. Handle ARCA rejection (send invalid data intentionally)
9. Verify QR code scans correctly and links to ARCA verification

---

## 20. Security Considerations

1. **Certificate storage**: ARCA certificates contain private keys. NEVER commit to git. Store as encrypted environment variables (base64) or use a secrets manager. Certificates go in env vars, NOT in `billing_settings` (to prevent API exposure)
2. **CUIT/CUIL/DNI data**: Personal tax IDs are PII. Apply same data protection policies as email/phone
3. **Invoice PDFs**: Contain financial data. Serve via signed URLs with short expiration (1 hour). Store the cloud storage key in DB, generate signed URL on-demand. NEVER expose direct storage URLs
4. **Admin endpoints**: All fiscal operations require admin role + specific `PermissionEnum` permissions (Section 8.3). Read operations require `fiscalInvoice.view`. Write operations require `fiscalInvoice.retry`, `fiscalCreditNote.create`, or `taxConfig.update`
5. **Audit trail**: Every fiscal invoice creation, retry, and credit note issuance MUST be logged. The `fiscal_invoices` and `fiscal_credit_notes` tables themselves serve as audit trail with `created_at`, `created_by`, `arca_result`, and `arca_errors` columns
6. **Rate limiting**: ARCA has rate limits. The mutex/semaphore in the adapter (Section 10.5 point 4) prevents concurrent calls. For additional protection, limit to max ~10 requests/second
7. **Environment isolation**: NEVER use production certificates in homologacion or vice versa. The adapter validates certificate by checking that `arca_config.environment` matches the env var `HOSPEDA_ARCA_ENVIRONMENT`

---

## 21. Dependencies

### New npm Dependencies

| Package | Purpose | License | Add To | Why This One |
|---------|---------|---------|--------|-------------|
| `@afipsdk/afip.js` | ARCA SOAP integration (WSAA + WSFEv1) | MIT | `packages/billing` | 100k+ downloads, battle-tested since 2017, TypeScript support, handles certificate auth and token caching |
| `qrcode` | QR code generation for invoices | MIT | `packages/billing` | Most popular QR library, 10M+ weekly downloads |
| `@types/qrcode` | Type definitions for qrcode | MIT | `packages/billing` (devDep) | TypeScript support |
| `@react-pdf/renderer` | Server-side PDF generation | MIT | `packages/billing` | React-based, works with existing JSX tooling, good layout control, server-side rendering |
| `@aws-sdk/client-s3` | Cloud storage (S3/R2 compatible) | Apache-2.0 | `packages/billing` or new `packages/storage` | Standard S3 client, works with both AWS S3 and Cloudflare R2 |
| `@aws-sdk/s3-request-presigner` | Signed URL generation | Apache-2.0 | Same as above | Required for generating pre-signed download URLs |

### Existing Dependencies Used

| Package | Usage |
|---------|-------|
| `zod` | Validation schemas for all tax/invoice types |
| `@repo/logger` | Logging all ARCA interactions |
| `@repo/i18n` | Tax-related UI strings |
| `@repo/db` (drizzle) | New table schemas and migrations |
| `@repo/email` (resend) | Fiscal invoice email sending |
| `@repo/notifications` | Notification orchestration and retry |

---

## 22. Monitoring & Observability

### Sentry Error Tracking

- **Critical**: ARCA invoice creation failures (alert immediately)
- **Warning**: ARCA retry attempts, missing DNI for over-threshold
- **Info**: Successful invoice creation

### Metrics to Track

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `fiscal.invoice.created` | Count of invoices created per day | N/A (informational) |
| `fiscal.invoice.failed` | Count of failed invoice attempts | > 5 in 1 hour |
| `fiscal.invoice.retry_success` | Count of successful retries | N/A |
| `fiscal.arca.latency_ms` | ARCA API response time | > 10000 ms |
| `fiscal.arca.availability` | ARCA health check result | 3+ consecutive failures |
| `fiscal.credit_note.created` | Count of credit notes per day | N/A |
| `fiscal.invoice.pending_48h` | Invoices stuck in 'error' > 48h | > 0 |

---

## 23. Rollback Plan

If critical issues arise after enabling ARCA integration:

1. **Disable auto-invoicing**: Set `fiscal_invoicing_config.enabled = false` via admin UI or directly in `billing_settings`. The webhook handler checks this flag before triggering invoice creation
2. **Revert to manual**: Invoices can be created manually by the accountant using the data in `billing_payments`
3. **No data loss**: All payment data exists independently of fiscal invoices
4. **Database**: The new tables (`fiscal_invoices`, `fiscal_credit_notes`) can remain empty without affecting billing operations
5. **User-facing**: The "(IVA incluido)" text still shows (harmless). Invoice download links simply won't appear if no fiscal invoices exist

---

## 24. Out of Scope

These items are explicitly NOT part of this spec:

| Item | Reason |
|------|--------|
| **Ingresos Brutos (IIBB)** | Provincial tax declared separately to ATER. Does not affect invoicing logic. Handled by accountant |
| **Ganancias (Income Tax)** | Annual declaration. No system integration needed |
| **Multi-currency invoicing** | All ARCA invoices are in ARS. USD/BRL display prices are informational only |
| **Factura E (export)** | For services exported to non-Argentine clients. Not applicable to Hospeda's current market |
| **Factura M (monitored)** | For newly registered taxpayers under ARCA monitoring. Only if ARCA assigns this status |
| **FCE MiPyME** | Electronic credit invoices for SMEs. Not needed for SaaS subscriptions |
| **Batch invoicing** | Creating multiple invoices in a single ARCA call. Optimize later if volume justifies |
| **Invoice email template customization** | Use a simple, functional template. Polish later |
| **Libro IVA Digital management** | ARCA automatically maintains this from electronic invoices |
| **ARCA parameter caching** | Caching IVA rates, document types from ARCA param endpoints. Use hardcoded constants (they change very rarely) |
| **Cloud storage setup** | This spec defines usage. The actual R2/S3 bucket creation and IAM setup is infrastructure work |

---

## 25. File Locations Reference

Complete list of files to create or modify:

### New Files

| File | Description |
|------|-------------|
| `packages/db/src/schemas/billing/fiscal_invoices.dbschema.ts` | Drizzle schema for fiscal invoices |
| `packages/db/src/schemas/billing/fiscal_credit_notes.dbschema.ts` | Drizzle schema for credit notes |
| `packages/schemas/src/entities/billing/tax-regime.schema.ts` | Tax regime Zod schema |
| `packages/schemas/src/entities/billing/arca-config.schema.ts` | ARCA config Zod schema |
| `packages/schemas/src/entities/billing/fiscal-invoicing-config.schema.ts` | Kill switch Zod schema |
| `packages/schemas/src/entities/billing/cuit.schema.ts` | CUIT/CUIL validation schema |
| `packages/schemas/src/entities/billing/dni.schema.ts` | DNI validation schema |
| `packages/schemas/src/entities/billing/fiscal-invoice.schema.ts` | Fiscal invoice Zod schemas |
| `packages/billing/src/adapters/arca/index.ts` | ARCA adapter exports |
| `packages/billing/src/adapters/arca/arca-adapter.ts` | ARCA adapter implementation |
| `packages/billing/src/adapters/arca/arca-adapter.types.ts` | ARCA adapter TypeScript interfaces |
| `packages/billing/src/adapters/arca/arca-adapter.config.ts` | ARCA constants |
| `packages/billing/src/adapters/arca/arca-adapter.test.ts` | ARCA adapter tests |
| `packages/billing/src/adapters/arca/wsfe-request-builder.ts` | WSFEv1 request builder |
| `packages/billing/src/adapters/arca/wsfe-response-parser.ts` | WSFEv1 response parser |
| `packages/billing/src/adapters/arca/qr-code-generator.ts` | QR code generation |
| `packages/billing/src/adapters/arca/cae-validator.ts` | CAE format validation |
| `packages/billing/src/services/tax-calculation.service.ts` | IVA calculation service |
| `packages/billing/src/services/fiscal-invoice.service.ts` | Fiscal invoice orchestration |
| `packages/billing/src/services/invoice-pdf.service.ts` | PDF generation |
| `packages/email/src/templates/FiscalInvoiceEmail.tsx` | Invoice email template |
| `packages/email/src/templates/FiscalCreditNoteEmail.tsx` | Credit note email template |
| `apps/api/src/routes/admin/billing/fiscal/index.ts` | Admin fiscal route mount |
| `apps/api/src/routes/admin/billing/fiscal/invoices.routes.ts` | Admin invoice endpoints |
| `apps/api/src/routes/admin/billing/fiscal/credit-notes.routes.ts` | Admin credit note endpoints |
| `apps/api/src/routes/admin/billing/fiscal/tax-config.routes.ts` | Admin tax config endpoints |
| `apps/api/src/routes/admin/billing/fiscal/arca.routes.ts` | Admin ARCA health/test endpoints |
| `apps/api/src/routes/protected/billing/fiscal.routes.ts` | User fiscal invoice endpoints |
| `apps/api/src/routes/public/billing/tax-info.routes.ts` | Public tax info endpoint |
| `apps/api/src/cron/jobs/fiscal-invoice-retry.job.ts` | Retry cron job |
| `apps/admin/src/routes/_authed/billing/fiscal-invoices.tsx` | Admin fiscal invoices page |
| `apps/admin/src/routes/_authed/billing/credit-notes.tsx` | Admin credit notes page |
| `apps/admin/src/routes/_authed/billing/tax-config.tsx` | Admin tax config page |
| `apps/admin/src/features/billing-fiscal-invoices/` | Admin fiscal invoices feature dir |
| `apps/admin/src/features/billing-credit-notes/` | Admin credit notes feature dir |
| `apps/admin/src/features/billing-tax-config/` | Admin tax config feature dir |

### Files to Modify

| File | Change |
|------|--------|
| `packages/db/src/schemas/billing/index.ts` | Export new schemas |
| `packages/db/src/schemas/user/user.dbschema.ts` | Add cuit, dni, condicionIva, razonSocial, wantsFacturaA columns |
| `packages/schemas/src/enums/permission.enum.ts` | Add FISCAL_INVOICE, FISCAL_CREDIT_NOTE, TAX_CONFIG permissions |
| `packages/schemas/src/entities/user/user.crud.schema.ts` | Add tax fields to UpdateUserSchema |
| `packages/i18n/src/locales/es/billing.json` | Add tax and fiscal invoice strings |
| `packages/i18n/src/locales/en/billing.json` | Add tax and fiscal invoice strings |
| `packages/i18n/src/locales/pt/billing.json` | Add tax and fiscal invoice strings |
| `apps/api/src/routes/webhooks/mercadopago/payment-logic.ts` | Add fiscal invoice trigger |
| `apps/api/src/routes/admin/billing/index.ts` | Mount fiscal routes |
| `apps/api/src/cron/registry.ts` | Register fiscal-invoice-retry job |
| `apps/api/src/cron/bootstrap.ts` | Bootstrap fiscal-invoice-retry job |
| `apps/api/src/cron/types.ts` | Add fiscal-invoice-retry job type |
| `apps/web/src/components/shared/PricingCard.astro` | Add IVA display props |
| `apps/web/src/components/account/ProfileEditForm.client.tsx` | Add tax data section |
| `apps/web/src/components/account/InvoiceHistory.client.tsx` | Add fiscal invoices section |
| `apps/admin/src/lib/menu.ts` | Add billing menu section with fiscal pages |
| `apps/api/.env.example` | Add ARCA and storage env vars |

---

## 26. Cross References

| Reference | Description |
|-----------|-------------|
| [SPEC-021](../SPEC-021-billing-system-fixes/spec.md) | Billing system fixes (original deferral source for BILL-15) |
| [ADR-006](../../docs/decisions/ADR-006-integer-monetary-values.md) | All monetary values as integers (centavos) |
| [ADR-008](../../docs/decisions/ADR-008-afip-deferred-v2.md) | Original deferral decision. **Superseded by this spec** |
| [Tax System Research](./tax-system-research.md) | Exhaustive investigation of Argentina's tax system |
| [AFIP Research](./afip-research.md) | Initial AFIP research from SPEC-021 |

---

## 27. Acceptance Criteria

The implementation is complete when ALL of the following are true:

1. A successful MercadoPago payment automatically creates a fiscal invoice in ARCA's homologacion environment
2. The fiscal invoice has a valid CAE
3. A PDF with QR code is generated and uploaded to cloud storage
4. The PDF is sent to the customer's email via the notification system
5. The customer can view and download their fiscal invoices from their account page
6. An admin can view all fiscal invoices in the admin panel with filters and search
7. An admin can retry a failed invoice (status = 'error')
8. An admin can create a credit note for any authorized invoice (full or partial amount)
9. The credit note has a valid CAE and references the original invoice
10. Multiple credit notes for the same invoice are supported (cumulative amount checked)
11. Switching from Monotributo to Responsable Inscripto changes new invoices from Factura C to Factura B
12. A user who enables "Quiero Factura A" with a valid CUIT receives Factura A
13. Price displays show "(IVA incluido)" or IVA breakdown depending on the active regime
14. The `fiscal_invoicing_enabled` kill switch prevents invoice creation when disabled
15. Free plan payments ($0) do not generate fiscal invoices
16. Add-on purchases generate fiscal invoices
17. All unit tests pass with >= 90% coverage
18. All homologacion tests pass (Section 19)
19. The system handles ARCA downtime gracefully (invoices are retried automatically via cron)
20. Invoices stuck in 'error' for >48h trigger admin notifications
21. All i18n strings exist for es, en, and pt
22. New admin permissions (fiscalInvoice.*, fiscalCreditNote.*, taxConfig.*) are defined and enforced
23. CUIT validation uses Modulo 11 algorithm correctly
24. DNI field is available for over-threshold Consumidor Final transactions
25. Concurrent payment processing does not create duplicate invoice numbers (mutex verified)
