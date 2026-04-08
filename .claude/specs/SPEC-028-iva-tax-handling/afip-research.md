# AFIP Electronic Invoicing Research

> Task: T-031 (SPEC-021)
> Date: 2026-03-02
> Status: Research Complete

## Overview

AFIP (Administracion Federal de Ingresos Publicos) requires all registered businesses in Argentina to issue electronic invoices (Factura Electronica) for their sales. This applies to SaaS/subscription businesses.

## Invoice Types

| Type | Issuer | Recipient | Use Case |
|------|--------|-----------|----------|
| **Factura A** | Responsable Inscripto | Responsable Inscripto | B2B (both parties are IVA-registered) |
| **Factura B** | Responsable Inscripto | Consumidor Final / Monotributista | B2C (issuer is IVA-registered, buyer is not) |
| **Factura C** | Monotributista | Anyone | Issuer is Monotributista |

For Hospeda:

- If Hospeda is **Responsable Inscripto**: Issue **Factura B** to HOST users (mostly consumidores finales or monotributistas)
- If Hospeda is **Monotributista**: Issue **Factura C** (unlikely at scale)

## Required Fields

1. **CUIT/CUIL** of the buyer (required for Factura A, optional for Factura B under ARS 75,760.58 per operation as of 2025)
2. **CAE** (Codigo de Autorizacion Electronico): Unique code from AFIP for each invoice
3. **Punto de Venta**: Pre-registered billing point
4. **Concepto**: 2 (Servicios) or 3 (Productos y Servicios)
5. **Fecha de servicio**: Period of the service billed
6. **IVA breakdown**: 21% standard rate for digital services

## Integration Options

### Option 1: Direct AFIP Integration via Web Services

- Use AFIP WSFE (Web Service de Facturacion Electronica) v1
- Libraries: `afip.js` (Node.js), custom SOAP client
- Requires: Digital certificate (`.key` + `.crt`), CUIT registration, Punto de Venta
- Pros: Full control, real-time CAE generation
- Cons: Complex SOAP/XML integration, certificate management, AFIP downtime handling

### Option 2: Third-party Service

Popular Argentine invoicing APIs:

- **TusFacturasApp** (tusfacturas.app) - REST API, handles AFIP communication
- **FacturaDigital** - similar service
- **Colppy** - accounting + invoicing
- Cost: $5,000-15,000 ARS/month depending on volume

Pros: Simpler REST integration, AFIP complexity abstracted
Cons: Monthly cost, dependency on third-party availability

### Option 3: Defer to v2 (Manual Invoicing for v1)

- Hosts pay via MercadoPago (which provides its own receipt)
- Hospeda issues manual invoices via accounting software (e.g., Tango, Colppy)
- No automated AFIP integration in code
- Pros: Fastest to launch, no complex integration
- Cons: Manual work, doesn't scale, hosts don't get automated tax-compliant invoices

## MercadoPago Considerations

MercadoPago itself is NOT a fiscal invoice. MercadoPago provides:

- Payment receipts (comprobante de pago)
- NOT valid as Factura Electronica for tax purposes

The business (Hospeda) still needs to emit its own Factura for each charge.

## Recommendation

For v1 launch, **Option 3 (Defer)** is recommended:

- Focus on core platform features first
- Use MercadoPago for payment collection
- Issue manual invoices via accounting software until user base justifies automation
- Plan AFIP integration for v2 (Q3 2026) when subscription volume warrants it
