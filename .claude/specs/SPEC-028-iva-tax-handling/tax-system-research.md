# Tax System Research: Argentina - AFIP/ARCA Integration

> Date: 2026-03-06
> Status: Research Complete
> Purpose: Exhaustive investigation for SPEC-028 rewrite

---

## Table of Contents

1. [Argentina Tax System Overview](#1-argentina-tax-system-overview)
2. [IVA (Value Added Tax) Deep Dive](#2-iva-value-added-tax-deep-dive)
3. [Tax Regime: Monotributo vs Responsable Inscripto](#3-tax-regime-monotributo-vs-responsable-inscripto)
4. [Electronic Invoicing (Factura Electronica)](#4-electronic-invoicing-factura-electronica)
5. [ARCA Web Services Technical Details](#5-arca-web-services-technical-details)
6. [Integration Options Comparison](#6-integration-options-comparison)
7. [Node.js/TypeScript Libraries](#7-nodejstypescript-libraries)
8. [CUIT/CUIL Validation](#8-cuitcuil-validation)
9. [Ingresos Brutos (Provincial Tax)](#9-ingresos-brutos-provincial-tax)
10. [Credit Notes (Notas de Credito)](#10-credit-notes-notas-de-credito)
11. [QR Code Requirements](#11-qr-code-requirements)
12. [New 2025 Regulation: IVA Transparency](#12-new-2025-regulation-iva-transparency)
13. [Legal Obligations Summary](#13-legal-obligations-summary)
14. [Recommendations for Hospeda](#14-recommendations-for-hospeda)

---

## 1. Argentina Tax System Overview

Argentina has a multi-layered tax system with obligations at national, provincial, and municipal levels.

### National Taxes (ARCA - formerly AFIP)

| Tax | Rate | Applies To | Frequency |
|-----|------|-----------|-----------|
| **IVA** (Value Added Tax) | 21% general, 10.5% reduced, 27% enhanced | All sales of goods/services | Monthly declaration |
| **Ganancias** (Income Tax) | 5% - 35% progressive scale | Net income | Annual declaration (June) |
| **Debitos/Creditos Bancarios** | 0.6% | Bank transactions | Automatic withholding |

### Provincial Taxes (ATER for Entre Rios)

| Tax | Rate | Applies To | Frequency |
|-----|------|-----------|-----------|
| **Ingresos Brutos** (Gross Revenue Tax) | 2.5% - 6% depending on activity | Gross revenue | Monthly declaration |

### Key Institutional Change

Since October 2024, **AFIP was renamed to ARCA** (Agencia de Recaudacion y Control Aduanero). All web services, endpoints, and APIs remain the same but under the new domain `arca.gob.ar`. Existing CUIT, clave fiscal, and configurations continue working.

---

## 2. IVA (Value Added Tax) Deep Dive

### IVA Rates and Codes (WSFEv1)

| ARCA Code | Rate | Applies To |
|-----------|------|-----------|
| 5 | **21%** | General rate - most goods and services (including SaaS/digital services) |
| 4 | **10.5%** | Reduced - food staples, certain electronics, production goods |
| 6 | **27%** | Enhanced - telecommunications, gas, electricity, water for commercial use |
| 3 | **0%** | Exempt - healthcare to social security, exported goods/services |
| 8 | **5%** | Special reduced |
| 9 | **2.5%** | Special reduced |

### For Hospeda (SaaS Platform)

- **Standard rate: 21%** applies to digital subscription services
- The 10.5% reduced rate does NOT apply to SaaS/software subscriptions
- Exported services (clients outside Argentina) are taxed at 0%

### How IVA Works for Responsable Inscripto

```
IVA Debito Fiscal (IVA charged on sales)
- IVA Credito Fiscal (IVA paid on purchases)
- Retenciones y Percepciones (withholdings)
- Saldo a favor periodo anterior (prior month credit balance)
= IVA a Pagar (IVA payable) or Saldo a Favor (credit balance)
```

The business charges 21% IVA on its invoices. It can then deduct IVA paid on its own purchases (Factura A from other Responsables Inscriptos). The difference is paid monthly to ARCA.

### IVA and SaaS Digital Services

Per ARCA regulations, digital services provided over the internet that are consumed in Argentina are subject to IVA. This includes:

- Software as a Service (SaaS)
- Downloadable software and apps
- Cloud computing services
- Platform/marketplace services

For **domestic** SaaS providers (Hospeda's case): standard IVA obligations apply. The provider must be registered as either Monotributista or Responsable Inscripto and issue corresponding invoices.

---

## 3. Tax Regime: Monotributo vs Responsable Inscripto

### Decision Matrix for Hospeda

| Aspect | Monotributo | Responsable Inscripto |
|--------|-------------|----------------------|
| **Invoice type** | Factura C (no IVA breakdown) | Factura B (to consumers/monotributistas), Factura A (to other RI) |
| **IVA handling** | Included in fixed monthly fee, NOT broken down | Must charge, break down, declare monthly |
| **Income limit** | Limited annual billing (categories with caps) | No limit |
| **Monthly cost** | Fixed fee per category | Variable (IVA + Ganancias declarations) |
| **Administrative burden** | Low (single monthly payment) | High (monthly IVA declaration, annual Ganancias, Libro IVA Digital) |
| **Scalability** | Limited - must switch to RI when exceeding caps | Unlimited |
| **IVA credit recovery** | Cannot recover IVA on purchases | Can deduct IVA paid on purchases as fiscal credit |

### Recommendation for Hospeda

**Responsable Inscripto** is the correct regime for a SaaS platform because:

1. Monotributo has annual revenue caps that a growing platform will exceed
2. RI allows recovery of IVA paid on infrastructure costs (servers, services, etc.)
3. Investors/partners expect formal RI status
4. Enables issuing Factura A to B2B clients (hotels, complexes) who need IVA credit

### Invoice Types by Regime and Recipient

**If Hospeda is Responsable Inscripto:**

| Recipient's Tax Status | Invoice Type | IVA Treatment |
|------------------------|--------------|---------------|
| Responsable Inscripto (e.g., hotel chain) | **Factura A** | IVA discriminated (shown separately) |
| Monotributista (e.g., small property owner) | **Factura B** | IVA included but shown per transparency law |
| Consumidor Final (e.g., tourist user) | **Factura B** | IVA included but shown per transparency law |
| IVA Exento | **Factura B** | IVA included but shown per transparency law |

**If Hospeda is Monotributista (unlikely at scale):**

| Recipient | Invoice Type | IVA Treatment |
|-----------|--------------|---------------|
| Anyone | **Factura C** | No IVA breakdown |

---

## 4. Electronic Invoicing (Factura Electronica)

### Overview

All registered taxpayers in Argentina MUST issue electronic invoices (Factura Electronica) through ARCA's web services. There are no exceptions for digital businesses.

### Invoice Lifecycle

```
1. Determine next invoice number (FECompUltimoAutorizado)
2. Build invoice data with all required fields
3. Submit to ARCA via WSFEv1 (FECAESolicitar)
4. Receive CAE (Codigo de Autorizacion Electronico) - 14-digit unique code
5. Generate PDF with QR code containing CAE
6. Send to customer via email
7. Record in Libro IVA Digital
```

### CAE (Codigo de Autorizacion Electronico)

- **What**: 14-digit unique authorization code from ARCA per invoice
- **Validity**: 10 calendar days for services, 5 days for goods
- **Cannot be deleted**: If you make an error, you must issue a Credit Note (Nota de Credito) with its own CAE
- **Failure handling**: If ARCA rejects the request, the invoice is NOT valid. Must fix and retry.

### Required Fields for WSFEv1

| Field | Description | Example |
|-------|-------------|---------|
| `CantReg` | Number of invoices in batch | `1` |
| `PtoVta` | Point of sale number (pre-registered) | `1` |
| `CbteTipo` | Invoice type code | `6` (Factura B) |
| `Concepto` | Concept type | `2` (Services) |
| `DocTipo` | Recipient document type | `80` (CUIT), `96` (DNI), `99` (Other) |
| `DocNro` | Recipient document number | `20123456789` |
| `CbteDesde` | Invoice number (from) | `1` |
| `CbteHasta` | Invoice number (to) | `1` |
| `CbteFch` | Invoice date (YYYYMMDD) | `20260306` |
| `ImpTotal` | Total amount (with IVA) | `121.00` |
| `ImpTotConc` | Non-taxable amount | `0` |
| `ImpNeto` | Net taxable amount (before IVA) | `100.00` |
| `ImpOpEx` | Exempt amount | `0` |
| `ImpIVA` | Total IVA amount | `21.00` |
| `ImpTrib` | Other taxes amount | `0` |
| `MonId` | Currency code | `PES` (Argentine Pesos) |
| `MonCotiz` | Exchange rate (1 for PES) | `1` |
| `CondicionIVAReceptorId` | Recipient's IVA condition | `5` (Consumidor Final) |
| `FchServDesde` | Service period start (for Concepto 2/3) | `20260301` |
| `FchServHasta` | Service period end (for Concepto 2/3) | `20260331` |
| `FchVtoPago` | Payment due date (for Concepto 2/3) | `20260415` |
| `Iva` | Array of IVA rates applied | `[{Id: 5, BaseImp: 100, Importe: 21}]` |

### Recipient IVA Condition Codes (CondicionIVAReceptorId)

| Code | Description |
|------|-------------|
| 1 | IVA Responsable Inscripto |
| 4 | IVA Sujeto Exento |
| 5 | Consumidor Final |
| 6 | Responsable Monotributo |
| 7 | Sujeto No Categorizado |
| 8 | Proveedor del Exterior |
| 9 | Cliente del Exterior |
| 10 | IVA Liberado (Ley 19.640) |
| 13 | Monotributista Social |
| 15 | IVA No Alcanzado |
| 16 | Monotributo Trabajador Independiente Promovido |

### Invoice Type Codes (CbteTipo)

| Code | Type | Use |
|------|------|-----|
| **1** | Factura A | RI to RI |
| **2** | Nota de Debito A | Debit note A |
| **3** | Nota de Credito A | Credit note A (refund/correction for Factura A) |
| **6** | Factura B | RI to Consumer Final / Monotributista / Exento |
| **7** | Nota de Debito B | Debit note B |
| **8** | Nota de Credito B | Credit note B (refund/correction for Factura B) |
| **11** | Factura C | Monotributista to anyone |
| **12** | Nota de Debito C | Debit note C |
| **13** | Nota de Credito C | Credit note C |
| **51** | Factura M | Monitored taxpayer |
| **201** | FCE MiPyME A | Electronic credit invoice (SME) A |
| **206** | FCE MiPyME B | Electronic credit invoice (SME) B |
| **211** | FCE MiPyME C | Electronic credit invoice (SME) C |

### Concept Codes

| Code | Description | Service Dates Required? |
|------|-------------|------------------------|
| 1 | Products | No |
| 2 | **Services** | **Yes** (FchServDesde, FchServHasta, FchVtoPago) |
| 3 | Products and Services | Yes |

**For Hospeda: Always use Concepto = 2 (Services)**, since subscriptions are services.

### Document Type Codes (DocTipo)

| Code | Type | When to Use |
|------|------|-------------|
| 80 | **CUIT** | For RI or Monotributista recipients |
| 86 | **CUIL** | For individual recipients |
| 96 | **DNI** | For consumer final (optional for amounts under threshold) |
| 99 | **Doc (Otro)** | When no document is required |

### Currency Codes

| Code | Currency |
|------|----------|
| PES | Argentine Peso (ARS) |
| DOL | US Dollar |
| 012 | Real (BRL) |
| 060 | Euro |

### Tribute Types (for other taxes like IIBB)

| Code | Type |
|------|------|
| 1 | Impuestos nacionales |
| 2 | Impuestos provinciales (Ingresos Brutos) |
| 3 | Impuestos municipales |
| 4 | Impuestos Internos |
| 99 | Otro |

---

## 5. ARCA Web Services Technical Details

### Architecture

ARCA uses a two-step authentication flow:

```
                    +----------+
                    |   WSAA   |  (Authentication)
                    | (SOAP)   |
                    +----+-----+
                         |
                    Token + Sign
                         |
                    +----v-----+
                    |  WSFEv1  |  (Invoicing)
                    |  (SOAP)  |
                    +----------+
```

### Step 1: WSAA (Web Service de Autenticacion y Autorizacion)

**Purpose**: Authenticate the application and obtain a Ticket de Acceso (TA).

**Flow**:
1. Generate a TRA (Ticket de Requerimiento de Acceso) XML, signed with the digital certificate
2. Send signed TRA to WSAA via SOAP
3. Receive a TA containing `Token` and `Sign` values
4. TA has limited validity (typically 12 hours)

**Endpoints**:
- Testing: `https://wsaahomo.arca.gob.ar/ws/services/LoginCms`
- Production: `https://wsaa.arca.gob.ar/ws/services/LoginCms`

### Step 2: WSFEv1 (Web Service de Factura Electronica v1)

**Purpose**: Create, query, and manage electronic invoices.

**Endpoints**:
- Testing: `https://wswhomo.arca.gob.ar/wsfev1/service.asmx`
- Production: `https://servicios1.arca.gob.ar/wsfev1/service.asmx`

**Key Methods**:

| Method | Purpose |
|--------|---------|
| `FECAESolicitar` | **Request CAE for new invoice(s)** |
| `FECompUltimoAutorizado` | Get last authorized invoice number |
| `FECompConsultar` | Query an existing invoice |
| `FEParamGetTiposCbte` | Get valid invoice types |
| `FEParamGetTiposIva` | Get valid IVA rates |
| `FEParamGetTiposDoc` | Get valid document types |
| `FEParamGetTiposMonedas` | Get valid currencies |
| `FEParamGetCondicionIvaReceptor` | Get valid recipient IVA conditions |
| `FEParamGetTiposConcepto` | Get valid concept types |

### Certificate Requirements

| Aspect | Testing (Homologacion) | Production |
|--------|----------------------|------------|
| **Obtain via** | WSASS (self-service portal) | Administrador de Certificados Digitales |
| **Requires** | Clave Fiscal nivel 3 | Clave Fiscal nivel 3 |
| **Format** | X.509 (.crt + .key) | X.509 (.crt + .key) |
| **Validity** | 2 years | 2 years |
| **Renewal** | Not before 30 days of expiration | Not before 30 days of expiration |
| **Per environment** | Must use homologacion cert | Must use production cert |

### Punto de Venta (Point of Sale)

Before issuing invoices, a Punto de Venta must be registered:

1. Access `arca.gob.ar` with Clave Fiscal
2. Go to "Administracion de Puntos de Venta y Domicilios"
3. Select "A/B/M de Puntos de Venta"
4. Add new point with a code (e.g., `0002`) and optional name
5. Each point has independent numbering (invoices start at 1)

**Important**: Each Punto de Venta has its own sequential invoice numbering. Once a number is assigned, it cannot be reused. If you create separate Puntos de Venta for different environments (dev vs prod), they have independent sequences.

---

## 6. Integration Options Comparison

### Option A: Direct ARCA Integration via @afipsdk/afip.js

| Aspect | Details |
|--------|---------|
| **Library** | `@afipsdk/afip.js` (MIT license, 100k+ downloads since 2017) |
| **Cost** | Free (open-source) |
| **Language** | TypeScript/JavaScript |
| **Approach** | Direct SOAP communication with ARCA web services |
| **Certificate** | You manage your own .crt + .key files |
| **Authentication** | Library handles WSAA automatically |
| **Maintenance** | Community-maintained, active development |
| **Support** | Discord community, email support |

**Pros**:
- Free, no recurring costs
- Full control over the integration
- No third-party dependency for production
- MIT license, no vendor lock-in
- Active community with 100k+ downloads

**Cons**:
- Must manage certificates yourself (renewal every 2 years)
- Must handle ARCA downtime/errors
- Must build PDF generation, QR codes, email sending
- Must build retry logic for ARCA failures
- More development effort upfront

**Code Example** (from afipsdk.com):
```typescript
import Afip from '@afipsdk/afip.js';

const afip = new Afip({ access_token: 'TU_ACCESS_TOKEN', CUIT: 20409378472 });

// Get last invoice number
const lastVoucher = await afip.ElectronicBilling.getLastVoucher(1, 6);
const nextNumber = lastVoucher + 1;

// Create Factura B
const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
const res = await afip.ElectronicBilling.createVoucher({
    CantReg: 1,
    PtoVta: 1,
    CbteTipo: 6,        // Factura B
    Concepto: 2,         // Services
    DocTipo: 99,         // No document
    DocNro: 0,
    CbteDesde: nextNumber,
    CbteHasta: nextNumber,
    CbteFch: parseInt(date),
    ImpTotal: 121,
    ImpTotConc: 0,
    ImpNeto: 100,
    ImpOpEx: 0,
    ImpIVA: 21,
    ImpTrib: 0,
    MonId: 'PES',
    MonCotiz: 1,
    CondicionIVAReceptorId: 5,  // Consumidor Final
    Iva: [{ Id: 5, BaseImp: 100, Importe: 21 }],
});

console.log(res.CAE);        // "71234567890123"
console.log(res.CAEFchVto);  // "20260316"
```

### Option B: @nicoo01x/arca-sdk (Modern TypeScript Alternative)

| Aspect | Details |
|--------|---------|
| **Library** | `@nicoo01x/arca-sdk` (v3.1.0) |
| **Cost** | Free (npm package) |
| **Language** | TypeScript-first |
| **Approach** | Modern typed wrapper around ARCA SOAP services |
| **Features** | Invoices A/B/C, Credit/Debit Notes, Padron A13, QR generation |
| **Error handling** | Typed errors: ValidationError, AuthError, NetworkError, RemoteServiceError |
| **Certificate** | Pass PEM strings or filesystem paths |

**Pros**:
- Modern TypeScript with full type definitions
- Built-in QR code generation
- Typed error handling (ValidationError, AuthError, NetworkError, RemoteServiceError)
- Supports both production and homologation endpoints
- Clean promise-based API
- More recent/actively maintained

**Cons**:
- Newer library, smaller community (vs afip.js's 100k downloads)
- Less battle-tested in production
- Still need to manage certificates and build PDF/email

### Option C: TusFacturasApp (Third-Party REST API)

| Aspect | Details |
|--------|---------|
| **Service** | TusFacturasApp API |
| **Cost** | ARS $30,000 - $1,300,000/month + 21% IVA |
| **API Type** | REST (JSON), TLS 1.2+ |
| **Approach** | They handle all ARCA communication |
| **Certificate** | Managed by them |
| **Invoice types** | A, B, C, E, M, MiPyME |

**Pricing Plans** (as of March 2026):

| Plan | Monthly Price (ARS) | Monthly Invoices | Points of Sale |
|------|-------------------|-----------------|----------------|
| API26 1K4C | $30,000 + IVA | 1,000 | 4 |
| API26 3K7C | $80,000 + IVA | 3,000 | 7 |
| API26 6K10C | $130,000 + IVA | 6,000 | 10 |
| API26 10K20C | $190,000 + IVA | 10,000 | 20 |
| API26 20K25C | $250,000 + IVA | 20,000 | 25 |
| API26 35K30C | $550,000 + IVA | 35,000 | 30 |
| API26 50K40C | $700,000 + IVA | 50,000 | 40 |
| API26 100K40C | $1,300,000 + IVA | 100,000 | 40 |

**All plans include**: Unlimited users, multi-CUIT, stock control, expense tracking, Excel import/export, WhatsApp billing bot, email confirmations, unlimited customer support.

**Pros**:
- Simplest integration (REST API with JSON)
- No certificate management
- No ARCA downtime handling (they manage it)
- Built-in PDF generation and email sending
- Always up-to-date with ARCA regulations
- Multi-CUIT support included

**Cons**:
- Significant monthly cost ($30,000-$1,300,000 ARS/month)
- Vendor dependency (if they go down, invoicing stops)
- Must add 21% IVA to their prices
- 30-day billing cycle (must renew monthly)
- Less control over invoice format/design

### Option D: Facturap.ar (NOT READY)

Currently in development ("ARCA API esta en desarrollo"). Claims to be a free REST alternative to ARCA SOAP. **Not viable for production use as of March 2026.**

### Comparison Matrix

| Criteria | afip.js | arca-sdk | TusFacturasApp |
|----------|---------|----------|----------------|
| **Monthly cost** | $0 | $0 | $30,000+ ARS |
| **Development effort** | High | Medium-High | Low |
| **TypeScript support** | Good | Excellent | N/A (REST) |
| **Certificate management** | Manual | Manual | Managed |
| **ARCA downtime handling** | Manual | Manual | Managed |
| **PDF generation** | Build yourself | Build yourself | Included |
| **Email sending** | Build yourself | Build yourself | Included |
| **QR code generation** | Build yourself | Included | Included |
| **Community size** | Large (100k+) | Small | N/A |
| **Vendor lock-in** | None | None | High |
| **Maturity** | High (since 2017) | Medium (v3.1) | High (since 2015) |

---

## 7. Node.js/TypeScript Libraries

### Primary Options

#### @afipsdk/afip.js
- **npm**: `@afipsdk/afip.js`
- **GitHub**: github.com/afipsdk/afip.js
- **License**: MIT (free, open-source)
- **Downloads**: 100,000+ since 2017
- **TypeScript**: Full type definitions included
- **Web Services**: WSFE (invoicing), WSAA (auth), Padron (taxpayer registry)
- **Documentation**: docs.afipsdk.com
- **Disclaimer**: No official relationship with AFIP/ARCA

#### @nicoo01x/arca-sdk
- **npm**: `@nicoo01x/arca-sdk`
- **Version**: 3.1.0
- **TypeScript**: First-class TypeScript support
- **Features**: Invoices A/B/C, Credit/Debit Notes, Padron A13, QR generation
- **Error types**: ValidationError, AuthError, NetworkError, RemoteServiceError
- **Configuration**: PEM strings or filesystem paths for certificates

#### facturajs (Legacy)
- **npm**: `facturajs`
- **GitHub**: github.com/emilioastarita/facturajs
- **Status**: Older library, less maintained
- **Not recommended for new projects**

### PDF Generation (separate concern)

For generating invoice PDFs, you would need a separate library:
- `@react-pdf/renderer` (React-based PDF generation)
- `pdfkit` (low-level PDF generation)
- `puppeteer` (HTML-to-PDF via headless browser)

---

## 8. CUIT/CUIL Validation

### Format

CUIT/CUIL is an 11-digit number in the format `XX-XXXXXXXX-X`:

- **First 2 digits**: Type prefix
- **Middle 8 digits**: DNI number (persons) or society number (companies)
- **Last digit**: Check digit (verificador)

### Type Prefixes

| Prefix | Entity Type |
|--------|-------------|
| 20 | Male individual |
| 23 | Male individual (when check digit = 10 with prefix 20) |
| 27 | Female individual |
| 28 | Female individual (when check digit = 10 with prefix 27) |
| 30 | Company/legal entity |
| 33 | Company (when check digit = 10 with prefix 30) |

### Check Digit Algorithm (Modulo 11)

```
Weights: [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

1. Multiply each of the first 10 digits by the corresponding weight
2. Sum all products
3. checkDigit = 11 - (sum % 11)
4. If checkDigit == 11, actual digit = 0
5. If checkDigit == 10, actual digit = 9 (and prefix changes: 20->23, 27->28, 30->33)
```

### Example Validation (TypeScript)

```typescript
function validateCuit(cuit: string): boolean {
    const clean = cuit.replace(/[-\s]/g, '');
    if (clean.length !== 11 || !/^\d{11}$/.test(clean)) return false;

    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const digits = clean.split('').map(Number);

    let sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += digits[i] * weights[i];
    }

    let checkDigit = 11 - (sum % 11);
    if (checkDigit === 11) checkDigit = 0;
    if (checkDigit === 10) checkDigit = 9;

    return digits[10] === checkDigit;
}
```

### Required for Invoicing

- **Factura A**: CUIT of recipient is REQUIRED
- **Factura B to Consumidor Final**: Document optional if total < ARS 75,760.58 per operation (threshold as of 2025)
- **Factura B to Monotributista**: CUIT is required

---

## 9. Ingresos Brutos (Provincial Tax)

### Overview

Ingresos Brutos (IIBB) is a provincial gross revenue tax. Each of Argentina's 24 jurisdictions sets its own rates. For Hospeda, operating from Entre Rios, the relevant authority is **ATER** (Administradora Tributaria de Entre Rios).

### Entre Rios 2025 Rates (Post-Reforma Tributaria)

| Activity | Rate |
|----------|------|
| Digital services (non-resident providers, except gambling) | 3.00% |
| Digital services (gambling/betting) | 9.00% |
| Business/professional services ("Servicios Empresariales") | 5.00% |
| Commercial intermediation/agencies | 6.00% |
| Communications | 5.00% |
| Wholesale/retail commerce | 4.00% |
| Industry (income < $1,100M) | Exempt |
| Industry (income > $4,000M) | 1.50% |

### For Hospeda

- If classified as "Servicios Empresariales" or IT services: likely **5%**
- Exact classification depends on NAES activity code registered with ATER
- The 3% digital services rate is specifically for **non-resident** providers
- Must consult with accountant for exact NAES code classification
- IIBB is declared monthly to ATER (separate from ARCA national taxes)

### Convenio Multilateral

If Hospeda has clients in multiple provinces, it may need to register under **Convenio Multilateral**, which distributes IIBB obligations across provinces proportionally. This is common for online businesses serving the entire country.

---

## 10. Credit Notes (Notas de Credito)

### When Required

Credit Notes MUST be issued for:
- Refunds (full or partial)
- Billing errors/corrections
- Discounts applied after invoicing
- Service cancellations
- Subscription downgrades with prorated refund

### Rules

1. Must be issued to the **same recipient** as the original invoice
2. Must reference the **original invoice number** (CbtesAsoc field)
3. Must be issued within **15 calendar days** of the event requiring it
4. Carries its own **CAE** (same authorization process as invoices)
5. **Cannot be deleted** - if a credit note has an error, issue a Debit Note to correct it

### Credit Note Type Mapping

| Original Invoice | Credit Note Type | Code |
|-----------------|------------------|------|
| Factura A (code 1) | Nota de Credito A | **3** |
| Factura B (code 6) | Nota de Credito B | **8** |
| Factura C (code 11) | Nota de Credito C | **13** |

### For Hospeda

Every subscription refund, plan downgrade with credit, or billing correction requires:
1. Issue a Nota de Credito via WSFEv1 with the refund amount
2. Reference the original Factura in `CbtesAsoc`
3. Process the actual refund via MercadoPago
4. Record both the credit note and refund in the billing system

---

## 11. QR Code Requirements

### Mandatory Since 2020

All electronic invoices in Argentina MUST include a QR code. The QR encodes:

- Invoice date
- CUIT of issuer
- Point of sale number
- Invoice type
- Invoice number
- Total amount
- Currency
- Exchange rate
- Recipient document type (if applicable)
- Recipient document number (if applicable)
- Authorization type code
- Authorization code (CAE)

### QR Code URL Format

The QR code encodes a URL to ARCA's verification service:
```
https://www.afip.gob.ar/fe/qr/?p=BASE64_ENCODED_JSON
```

Where the JSON payload contains all the fields above. When scanned, it allows anyone to verify the invoice's authenticity against ARCA's database.

### Implementation

- The `@nicoo01x/arca-sdk` library includes built-in QR generation
- For `@afipsdk/afip.js`, QR must be generated manually using the CAE response data
- Libraries like `qrcode` (npm) can generate the QR image from the URL

---

## 12. New 2025 Regulation: IVA Transparency

### Ley 27.743 - Regimen de Transparencia Fiscal al Consumidor

**Effective**: January 1, 2025 (large companies), April 1, 2025 (all others)

**Requirement**: ALL Factura B invoices must now **discriminate (show separately) the IVA amount** and any national internal taxes, even for Consumidores Finales.

Previously, Factura B showed a single total without IVA breakdown. Now, invoices must include the legend:

> "Regimen de Transparencia Fiscal al Consumidor Ley 27.743"

And show:
- Net amount (before IVA)
- IVA amount (21%)
- Total amount

### Impact on Hospeda

This is CRITICAL for the spec. Even with Factura B (the most common for Hospeda's users), the IVA MUST be shown as a separate line item. This means:

1. **Prices displayed to users should show the IVA breakdown** (not just "IVA incluido")
2. **Invoice PDFs must show net + IVA + total**
3. The WSFEv1 already requires `ImpNeto`, `ImpIVA`, and `ImpTotal` as separate fields
4. This is no longer optional - it's mandatory by law

---

## 13. Legal Obligations Summary

### For a SaaS Platform (Responsable Inscripto) in Entre Rios

**Monthly Obligations**:
- File IVA sworn declaration (F713/F2002) via ARCA
- Maintain Libro IVA Digital (digital IVA book) with all issued/received invoices
- File Ingresos Brutos declaration via ATER
- Issue electronic invoices for ALL commercial transactions
- Track and apply withholdings/perceptions

**Annual Obligations**:
- File Ganancias (Income Tax) sworn declaration
- File Bienes Personales if applicable

**Per Transaction**:
- Issue Factura A (to RI) or Factura B (to consumers/monotributistas) with CAE
- Include QR code on invoice
- Show IVA breakdown (Ley 27.743)
- Send invoice to customer
- For refunds: issue Nota de Credito within 15 days

**Infrastructure**:
- Active CUIT registered as Responsable Inscripto
- Clave Fiscal nivel 3 or higher
- Digital certificate for ARCA web services (renewed every 2 years)
- At least one Punto de Venta registered for electronic invoicing
- Accounting software or system connected to ARCA

---

## 14. Recommendations for Hospeda

### Tax Regime Decision

**Recommendation: Responsable Inscripto**

Hospeda should operate as Responsable Inscripto, not Monotributista. This is a business decision that should be confirmed with the company's accountant, but the reasons are:
- No revenue caps
- Can recover IVA on purchases (hosting, services, etc.)
- Professional image for B2B clients
- Enables Factura A for hotel chains and complexes

### Integration Approach

**Recommendation: @nicoo01x/arca-sdk (Option B) for v2**

| Phase | Approach | Rationale |
|-------|----------|-----------|
| **v1 (current)** | Manual invoicing via accountant | Already decided (ADR-008). Works until ~100 subs |
| **v2 initial** | `@nicoo01x/arca-sdk` | Modern TypeScript, typed errors, built-in QR, promise-based |
| **v2 fallback** | `@afipsdk/afip.js` | Fallback if arca-sdk proves unstable. Battle-tested, 100k+ downloads |
| **If budget available** | TusFacturasApp | Removes all ARCA complexity but adds $30,000+/month cost |

### Price Display Strategy

Current state: Prices are "IVA-inclusive" but nothing reflects this in the UI.

**Recommendation for v1 (quick fix)**:
- Add "(IVA incluido)" text to all price displays
- Store a `taxInclusive: true` flag in BillingSettings
- Add i18n strings for tax-related labels

**Recommendation for v2 (full implementation)**:
- Store prices as net amounts (before IVA) in the database
- Calculate and display IVA as a separate line item (per Ley 27.743)
- Show: Subtotal + IVA (21%) = Total on all invoices and pricing pages
- Or: Keep prices as IVA-inclusive totals and reverse-calculate the net (total / 1.21)

### Invoice Flow for Subscriptions

```
1. User subscribes to plan via MercadoPago
2. MercadoPago webhook confirms payment
3. System generates Factura B via ARCA (WSFEv1)
   - Concepto: 2 (Services)
   - Service period: subscription billing period
   - ImpNeto: plan price / 1.21
   - ImpIVA: plan price - (plan price / 1.21)
   - ImpTotal: plan price
4. Store CAE, invoice number, and all data in billing_invoices
5. Generate PDF with QR code
6. Send PDF to customer via email
7. Record in Libro IVA Digital data
```

### For Refunds

```
1. Refund initiated (cancellation, downgrade, dispute)
2. Issue Nota de Credito B (code 8) via ARCA
   - Reference original Factura in CbtesAsoc
   - Same IVA breakdown but negative amounts
3. Store credit note CAE and data
4. Process refund via MercadoPago
5. Generate credit note PDF
6. Send to customer
```

### CUIT/CUIL Collection Strategy

For Hospeda's user base:
- **Tourist users** (Consumidor Final): CUIT/CUIL NOT required for plans under the threshold (~ARS 75,760)
- **Owner users** (likely Monotributista or RI): CUIT is REQUIRED for Factura A/B
- **Complex users** (likely RI): CUIT is REQUIRED

**Recommendation**: Add optional CUIT field to user profile. Make it required for Owner/Complex plans. Validate using the Modulo 11 algorithm.

---

## Sources

### Official ARCA/AFIP Documentation
- [ARCA Web Services SOAP](https://www.afip.gob.ar/ws/)
- [WSFE Documentation](https://www.afip.gob.ar/ws/documentacion/ws-factura-electronica.asp)
- [WSAA Documentation](https://www.afip.gob.ar/ws/documentacion/wsaa.asp)
- [Digital Certificates](https://www.afip.gob.ar/ws/documentacion/certificados.asp)
- [QR Code Requirements](https://www.afip.gob.ar/fe/qr/)
- [Electronic Invoicing Portal](https://www.afip.gob.ar/fe/)
- [IVA Digital Services](https://www.afip.gob.ar/iva/servicios-digitales/obligados.asp)
- [Invoice Types Table (XLS)](https://www.afip.gob.ar/fe/documentos/TABLACOMPROBANTES.xls)
- [IVA Transparency Regulation](https://servicioscf.afip.gob.ar/publico/sitio/contenido/novedad/ver.aspx?id=4709)

### Libraries
- [afip.js GitHub](https://github.com/afipsdk/afip.js)
- [afip.js npm](https://www.npmjs.com/package/@afipsdk/afip.js)
- [AfipSDK Platform](https://afipsdk.com/)
- [AfipSDK Node.js Invoice Guide](https://afipsdk.com/blog/crear-factura-electronica-de-afip-en-nodejs/)
- [@nicoo01x/arca-sdk npm](https://www.npmjs.com/package/@nicoo01x/arca-sdk)
- [arca-sdk GitHub](https://github.com/Nicoo01x)

### Third-Party Services
- [TusFacturasApp API Pricing](https://www.tusfacturas.app/tarifas-tusfacturas-planes-api-factura-electronica.html)
- [TusFacturasApp API Docs](https://developers.tusfacturas.app/)

### Tax References
- [Responsable Inscripto Guide 2026](https://contablix.ar/blog/responsable-inscripto-guia-definitiva-impuestos/)
- [ARCA IVA Discrimination for Factura B](https://www.cgcetucuman.org.ar/como-sera-la-nueva-factura-con-el-iva-discriminado-y-desde-cuando-se-emitira-a-consumidor-final/)
- [Argentina VAT 2025 Digital Platform Rules](https://vatabout.com/es/argentina-vat-2025-plataforma-digital-normas)
- [WSFEv1 Reference Tables](https://www.sistemasagiles.com.ar/trac/wiki/ProyectoWSFEv1)
- [CUIT/CUIL Wikipedia](https://es.wikipedia.org/wiki/Clave_%C3%9Anica_de_Identificaci%C3%B3n_Tributaria)

### Entre Rios Provincial Tax
- [Entre Rios IIBB 2025 Rates](https://dosflorines.com.ar/como-quedan-las-nuevas-escalas-de-ingresos-brutos-en-entre-rios-para-2025/)
- [ATER Official Site](https://www.ater.gob.ar/)
- [Entre Rios Tax Reform 2025](https://www.ater.gob.ar/ater2/NoticiasV2.asp?ID=625)

### ADR/Decision Documents (Internal)
- [ADR-006: Integer Monetary Values](../../docs/decisions/ADR-006-integer-monetary-values.md)
- [ADR-008: AFIP Deferred to v2](../../docs/decisions/ADR-008-afip-deferred-v2.md)
