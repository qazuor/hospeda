# @repo/billing-verticals-contract

The single place where verticals and billing talk to each other: neither imports the other outside this package.

It holds the contract and nothing that implements it (contract §7.1,
`.specs/HOS-1352-billing-verticals-redesign/spec-consolidada/03-contrato-de-cobertura.md`).
V1 fills items 1 to 4; B1 fills item 5.

## What is here

The production entry, `@repo/billing-verticals-contract`:

1. **The two interfaces** (`src/interfaces.ts`), each one what ONE half provides:
   - `BillingForVerticals`, what verticals asks billing: `coverage`
     (`cobertura`, §2), `retentionStopped` (`retenciónDetenida`, §4.1),
     `canCharge` (`puedeCobrarle`, §4.1) and `onCoverageChanged`, the
     coverage-changed notice (§3).
   - `VerticalsForBilling`, what billing reads from verticals: `planPolicy`
     (`políticaDePlan`), `changeDirection` (`direcciónDeCambio`),
     `listingPurged` (`fichaPurgada`), `listing` (`ficha`), `addonPolicy`
     (`políticaDeAddon`), the write `extendTrial` (`extenderTrial`), all §4.1,
     and `onListingPurged`, the PURGED push (§3.1).
   - Both events are emitted **after the commit** of the write that produced
     them, never inside its transaction, and are not believed: the consumer
     asks again.
2. **Their validations**: a zod schema for every argument, response and event
   (`src/*.schema.ts`), and the gate (`validateBillingForVerticals`,
   `validateVerticalsForBilling`) that refuses to deliver a value that does not
   validate: it throws `ContractValidationError` instead (§6.1 on the side of
   the shape). The coverage response is checked across fields too: `covered`
   is exactly "at least one source of class TITLE" (§2.4), the type × `until`
   table of §2.4 holds, and never two SUBSCRIPTION titles (§2.6).
   `coverageSourceClassOf` derives a source's class; it is never transported.
3. **`Clock`** (B1, AC:B1:17): `{ now(): Date }`, the interface the production
   code of both halves reads the time through. The composition root of
   `apps/api` injects the system time; tests inject the adjustable clock of
   `@repo/test-clock`.

The test-only subpath, `@repo/billing-verticals-contract/testing`, which no
production build imports (`test/testing-never-in-production.test.ts`):

4. **The simulators of each side**: `BillingForVerticalsSimulator` and
   `VerticalsForBillingSimulator`, programmable in-memory fakes behind the same
   validation gate.
5. **The shared case sets**: `coverageCaseSet` (the forward set of §6.2, run
   against both implementations of `coverage`) and `inverseCaseSet` (the
   inverse set, in five groups so each verticals piece runs its own). They
   receive `describe`, `it` and `expect` as parameters, and each one has the
   case a constant implementation fails.

## Vocabulary

The interfaces and fields are in English; each method's JSDoc cites the
contract's Spanish name with `@see`. Field and value mapping:
`cubierto` → `covered`, `fuentes` → `sources`, `tipo` → `type`
(`SUSCRIPCIÓN` → `SUBSCRIPTION`, `CORTESÍA` → `COURTESY`), `referencia` →
`reference`, `alcance` → `scope`, `objetivo` → `target`, `desde` → `since`,
`hasta` → `until` (`NO_VENCE` → `NEVER_EXPIRES`, `SIN_FECHA_CONOCIDA` →
`NO_KNOWN_DATE`, `SIN_EMPEZAR` → `NOT_STARTED`), `cobrada` → `charged`, `piso`
→ `floor`, `NINGUNO` and "nada" → `null`.

## Boundaries

The package depends only on `zod` and on `VerticalEnum` from `@repo/schemas`:
nothing of either half (billing, payments, verticals) nor of the database
layer. `test/package-shape.test.ts` checks it, and GUARD:G14
(`scripts/check-billing-verticals-boundary.ts`) checks that neither half
imports the other outside this package.
