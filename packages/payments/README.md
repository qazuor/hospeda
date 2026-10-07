# @repo/payments

The payments package: the only way the billing domain talks to a payment
gateway (DEC-ARCH-004, HOS-1352 unit B1).

## What is here

- **`PaymentProvider`**, the interface of the **eight capabilities** the domain
  needs, and nothing more (`B/06` §1): authorize, charge, change the amount,
  pause and resume, cancel, refund, read, notify. Prorating, scheduling a
  cancellation, applying a discount, granting a trial and ordering events are
  never asked of a provider (`NOT_ASKED_OF_THE_PROVIDER`).
- **No provider concept in the interface.** `PaymentProviderNamesNoProviderConcept`
  (`src/provider/provider-concepts.ts`) walks the whole interface at compile time
  and fails the build if any name in it carries a provider term
  (`PROVIDER_CONCEPT_TERMS`). `DetectorCatchesNestedConcepts` keeps that check
  from going vacuous.
- **Two implementations**:
  - `FakePaymentProvider`, in memory, all eight capabilities. Today it is an
    honest skeleton; the measured lies (M1..M13) and the provider's own rules
    (RP1..RP12) are added by B1.4.
  - `MercadoPagoPaymentProvider`, the adapter skeleton: same interface, validates
    each input, refuses with `NOT_IMPLEMENTED`. It does not call the provider and
    no SDK is installed.
- **Capability support, declared per provider** (`capabilitySupport`): for each
  capability, `full`, `partial` with every gap and whether our side emulates,
  degrades or blocks it, or `none`. Mercado Pago's three half-capabilities
  (pause and resume, read, notify) are declared as such, never as parity.
- **Rules every caller inherits**: an acknowledgement is not a confirmation, so
  every mutation is confirmed by re-reading by id (INV:D5); a notice carries only
  kind, id and version, never state (GUARD:G17).

## The probe manifest

`src/probes/probes.json` is the versioned list of provider subject ids that
belong to a live measurement, which the cutover must leave alone. It is **pure
data**, born as `{ "ids": [] }`, and has two readers:

- production code imports `PROBE_MANIFEST` from this package; the module
  validates the file with `ProbeManifestSchema` at load, so a missing or
  malformed manifest fails the build or the start, never empties the list;
- the cutover script (U3) reads the JSON **by path**:
  `packages/payments/src/probes/probes.json` (`PROBE_MANIFEST_PATH`).

**Do not move or rename that file**: the second reader depends on the path.

## Boundaries

- No dependency on any app, nor on the verticals half (that direction is
  GUARD:G14's).
- No legacy billing library, anywhere in the repo: GUARD:G16
  (`scripts/check-payments-boundary.ts`, `pnpm check:payments-boundary`).
- Internal `@repo/*` packages are allowed when avoiding them is not simple.
- No table: the package declares no schema and depends on no database layer.
