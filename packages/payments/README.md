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
  - `FakePaymentProvider`, in memory, all eight capabilities, and it **lies
    like the real one** (see "The fake lies, from a closed list" below).
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
- **Confirm by re-reading** (AC:B1:3): `confirmAuthorizationMutation({ provider,
  acknowledgement, sent })` re-reads the authorization by id and compares every
  field the mutation sent. A field that did not land makes it `notApplied`
  (a failed mutation), naming each such field; a field that did land is not
  hidden by one that did not.
- **A read by id carries its instant** (AC:B1:4, INV:D17): `readAuthorization`
  and `readCharge` return a `ProviderRead<T>` (`snapshot` + `readAt`). Only an
  implementation builds one (its builder is not exported, and the brand is a
  module-private symbol), stamped with the **injected** `Clock`
  (`@repo/billing-verticals-contract`): both implementations take
  `{ clock }` in their constructor and never read the system time. A decision
  takes the state through `assertFreshForAct({ read, act })`, which refuses a
  read older than the act's start (`STALE_READ`) so the act re-reads. The
  start is the decision on that subject, not the run; for an administrative
  action, its confirmation (`{ kind: 'adminAction', confirmedAt }`).

## The fake lies, from a closed list

The fake does not simulate a reasonable provider: it reproduces what the real
one was MEASURED doing (DEC-TEST-003). `src/fake/fake-lists.json` holds two
closed lists and one apart, validated at load (`FAKE_LISTS`):

- **`lies`, M1..M13**: each row has its name, the matrix rows it comes from
  (date and account) and the test that proves our code resists it
  (`defenseTest`).
- **`rules`, RP1..RP12**: the provider's own rules and measured behaviour. Not
  lies; the fake keeps them always.
- **`simulations`**: network cases nobody measured (`lostResponse`,
  `networkCut`, `noticesOutOfOrder`). Not lies, never counted as such.

Three rules, held at runtime by the constructor and statically by GUARD:G15
(`scripts/check-fake-lies.ts`, `pnpm check:fake-lies`):

1. A lie not in the list cannot be told: each lie lives in ONE place of
   `src/fake/`, as `this.lying({ lie: 'M<n>' })`.
2. By default the fake tells every lie: `new FakePaymentProvider({ clock })`.
3. A test turns one off only by naming it and saying why, written in place:
   `new FakePaymentProvider({ clock, honestAbout: [{ lie: 'M8', why: '…' }] })`.
   Simulations are the other way round: off unless `simulate: [{ simulation, why }]`.

**What the fake tells today** (B1.4a, HOS-1510): the lies whose surface the
payment interface carries, M3 (a duplicate per equal request), M5 (no notice of
an amount change), M6 (notices late, repeated or never; a refund in three
deliveries and two formats; a charge once per channel), M8 (a charge lands at
minute :02 of the next hour), M10 (the broken link), M11 (an open link never
expires) and M13 (the first partial refund refused as not refundable); and the
rules RP2, RP3, RP4, RP5, RP6 and RP9. The other rows (M1, M2, M4, M7, M9, M12;
RP1, RP7, RP8, RP10, RP11, RP12) stay in the list and arrive with the units that
add their surface to the interface.

Every delay of the fake runs on the injected clock: advance it to see a late
charge land, a late notice arrive (`FAKE_NOTICE_DELAY_MS`) or, with M11 off, an
open link expire. `takeDeliveries()` hands over the notices that are due.

## The approval link is shown only sanitized

`authorize` returns `approvalUrl`, the provider-hosted page where the customer
grants the permission. The provider hands it back broken (EX-37: an
`activation=true` parameter opens a "page does not exist" screen), so outside
this package it is read ONLY through `sanitizeApprovalUrl(result)`, which
refuses anything that is not an absolute `https:` URL (`ApprovalUrlRejectedError`)
refuses a link carrying credentials (`https://trusted@other/…`), and removes
every `activation` parameter (name matched case-sensitively, as EX-37 measured
it), keeping the other query pairs byte for byte. Show its `url`, never the raw
field.

**The name `approvalUrl` is reserved outside this package.** GUARD:G10 fails on
the bare name anywhere outside `packages/payments` except inside the parentheses
of `sanitizeApprovalUrl(…)`: a member read, a destructuring, an object key, and
type positions too (an interface property, a Zod schema key, a response type).
Name your own field something else, e.g. `checkoutUrl`.

GUARD:G10 (`scripts/check-approval-url-sanitized.ts`) fails CI on any other
read outside `packages/payments`, and on any code outside it that names the
provider's own link field. Its siblings guard the rest of what an authorization
sends: GUARD:G9 (`check-reason-is-copy.ts`, the `reason` is customer copy, never
an identifier) and GUARD:G11 (`check-no-provider-trial.ts`, no trial-request
field where an authorization is built).

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
- The gateway's SDK (`mercadopago`, `@mercadopago/*`) is imported only under
  `src/adapters/` (never in the fake) and declared only in this package's own
  `package.json`: GUARD:G12 (`scripts/check-sdk-outside-adapter.ts`,
  `pnpm check:sdk-outside-adapter`).
- No decision comes out of a notice without re-reading by id: GUARD:G17
  (`scripts/check-decision-rereads-by-id.ts`, `pnpm check:decision-rereads-by-id`).
  (a) a notice receiver reads only kind, id and version; (b) a decision takes
  the provider's state only as a `ProviderRead` through `assertFreshForAct`;
  (c) nothing outside `scripts/cutover/` reads the notification table.
- Internal `@repo/*` packages are allowed when avoiding them is not simple.
- No table: the package declares no schema and depends on no database layer.
