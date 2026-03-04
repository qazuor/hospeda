# ADR-008: Defer AFIP Integration to v2

## Status

Accepted

## Context

AFIP (Administracion Federal de Ingresos Publicos) is Argentina's federal tax authority. Formal businesses in Argentina are legally required to issue electronic invoices (factura electronica) through AFIP's web services for every commercial transaction. This integration involves:

- Obtaining and managing digital certificates from AFIP.
- Implementing SOAP-based web services (WSFE, WSAA) for invoice generation.
- Handling multiple invoice types (Factura A, B, C) depending on the buyer's tax status.
- Managing sequential invoice numbering (CAE .. Codigo de Autorizacion Electronico).
- Compliance with IVA (VAT) calculations and reporting requirements.
- Dealing with AFIP's notoriously unreliable service availability and complex error handling.

The platform was under pressure to launch and validate the product-market fit before investing in complex tax compliance infrastructure.

## Decision

We defer AFIP e-invoicing integration to **v2**. For v1, invoicing is handled manually by the platform's accountant using standard accounting software. The billing system records all transactions with sufficient detail to generate invoices externally.

## Consequences

### Positive

- **Faster launch** .. Removing AFIP integration from v1 scope saves an estimated 2-3 months of development time.
- **Lower initial complexity** .. The billing system can focus on payment processing and subscription management without the additional layer of tax document generation.
- **Legal compliance maintained** .. Manual invoicing through an accountant is a legally valid approach in Argentina. Many businesses operate this way.
- **Reduced risk** .. AFIP's web services are complex and frequently change. Deferring avoids blocking the launch on an unreliable external dependency.

### Negative

- **Manual invoicing overhead** .. The accountant must generate invoices manually for each transaction, which does not scale beyond a modest number of monthly transactions.
- **Must build eventually** .. AFIP integration is not optional for a growing business. It is deferred, not eliminated. The work will still need to be done.
- **Limited automation** .. Customers do not receive invoices automatically. There may be delays between payment and invoice delivery.
- **Technical debt** .. The billing system will need to be extended to support AFIP integration, potentially requiring schema changes and new service layers.

### Neutral

- The `@repo/billing` package stores transaction details (amount, date, customer, description) in a format that can be used to generate AFIP-compliant invoices when the integration is built.
- Argentina's Monotributo (simplified tax regime) has less complex invoicing requirements, which may apply to the platform's initial operations.

## Alternatives Considered

### Implement AFIP from Day 1

Building full AFIP integration before launch was rejected because:

- Would delay the launch by an estimated 2-3 months.
- AFIP's SOAP-based web services require significant development effort and ongoing maintenance.
- The platform needed to validate product-market fit before investing in complex compliance infrastructure.
- The risk of building on AFIP's frequently changing API before the billing model is stable was too high.

### Use a Third-Party AFIP Service

Services like Afip.js, TusFacturas, or FacturaDirecta abstract AFIP's complexity behind simpler APIs. This was deferred (not rejected) because:

- Adds a dependency and ongoing cost.
- Still requires integration work, though significantly less than direct AFIP integration.
- May be the chosen approach for v2 if the cost-benefit analysis is favorable.
- Does not eliminate the need to understand invoice types, IVA calculations, and CAE management.
