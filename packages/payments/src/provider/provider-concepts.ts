/**
 * The compile-time check that the payment provider interface names no provider
 * concept (AC:B1:1, TEST:B1:1).
 *
 * The condition B of DEC-ARCH-004: if the fake cannot be written without leaking
 * a provider's concepts, the interface is wrongly defined. This module turns
 * that into a type: `ProviderConceptsIn<T>` collects every property name, method
 * name and string-literal value reachable from `T` (through method parameters,
 * resolved return values, arrays and nested objects) that contains a banned
 * term, case-insensitively. The aliases at the bottom make the build fail when
 * that set is not empty for `PaymentProvider`.
 *
 * The terms are listed once, here, and also exported as a runtime list so the
 * tests can scan the source of the interface and of the fake with the same
 * vocabulary.
 */
import type { PaymentProvider } from './payment-provider';

/**
 * Provider concepts the domain interface may never name, lower case. Matched as
 * substrings of the lower-cased name, so `preapprovalId` and `INIT_POINT` are
 * caught. Each spelling is listed with and without its separator because a
 * type cannot strip underscores.
 */
export const PROVIDER_CONCEPT_TERMS = [
    'mercadopago',
    'mercado_pago',
    'preapproval',
    'init_point',
    'initpoint',
    'sandbox_init',
    'auto_recurring',
    'autorecurring',
    'external_reference',
    'externalreference',
    'back_url',
    'backurl',
    'notification_url',
    'notificationurl',
    'collector_id',
    'collectorid',
    'payer_id',
    'payerid',
    'endpoint',
    '/v1/'
] as const;

/** One banned term. */
export type ProviderConceptTerm = (typeof PROVIDER_CONCEPT_TERMS)[number];

/**
 * Every name reachable from `T`: property and method names, plus string-literal
 * values. A wide `string` is not a name and contributes nothing.
 */
type NamesIn<T> = T extends string
    ? string extends T
        ? never
        : T
    : T extends (...args: infer A) => infer R
      ? NamesIn<A[number]> | NamesIn<Awaited<R>>
      : T extends Date
        ? never
        : T extends readonly (infer E)[]
          ? NamesIn<E>
          : T extends object
            ? { [K in keyof T & string]-?: LiteralKey<K> | NamesIn<T[K]> }[keyof T & string]
            : never;

/**
 * A key, unless it is the wide `string` of an index signature (a `Record<string, …>`).
 * Letting that `string` into the union would absorb every literal name next to it
 * and blind the whole check.
 */
type LiteralKey<K extends string> = string extends K ? never : K;

/** Resolves to `N` when it contains a banned term, to `never` otherwise. */
type FlagIfConcept<N extends string> =
    Lowercase<N> extends `${string}${ProviderConceptTerm}${string}` ? N : never;

/** Every name reachable from `T` that contains a provider concept. `never` when clean. */
export type ProviderConceptsIn<T> =
    NamesIn<T> extends infer N ? (N extends string ? FlagIfConcept<N> : never) : never;

/**
 * Accepts only `never`. When the detector finds a concept, the compiler error
 * names it: `Type '"preapprovalId"' does not satisfy the constraint 'never'`.
 */
export type AssertNoProviderConcept<Found extends never> = Found;

/** Accepts only a non-empty set: proves the detector is able to find something. */
export type AssertDetected<Found extends string> = [Found] extends [never] ? false : true;

/** Accepts only `true`. */
type MustBeTrue<T extends true> = T;

/**
 * THE CHECK. The payment provider interface, walked whole, names no provider
 * concept. Adding one anywhere in it (a method, a field of an input or of a
 * result, a literal in a status union) stops this package from compiling.
 */
export type PaymentProviderNamesNoProviderConcept = AssertNoProviderConcept<
    ProviderConceptsIn<PaymentProvider>
>;

/**
 * The positive control: the detector does catch a concept nested in an input,
 * in a result and in a literal union, under every casing. A detector that found
 * nothing anywhere would make the check above vacuous; this keeps it honest.
 */
export type DetectorCatchesNestedConcepts = MustBeTrue<
    AssertDetected<
        ProviderConceptsIn<{
            open(input: {
                readonly preapprovalId: string;
            }): Promise<{ readonly INIT_POINT: string }>;
            readonly status: 'ok' | 'callEndpoint';
            // An index signature next to them, like the interface's own headers.
            readonly headers: Readonly<Record<string, string>>;
        }>
    >
>;
