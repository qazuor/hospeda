/**
 * Which methods of `PaymentProvider` implement which capability.
 *
 * The map is checked in both directions at compile time: every capability has
 * at least one method, and every method of the interface belongs to exactly one
 * capability. A method added to the interface without its capability does not
 * compile.
 */
import type { PaymentCapability } from './capabilities';
import type { PaymentProviderMethod } from './payment-provider';

/** Capability → the interface methods that implement it. */
export const CAPABILITY_METHODS = {
    authorize: ['authorize'],
    charge: ['charge'],
    changeAmount: ['changeAmount'],
    pauseAndResume: ['pause', 'resume'],
    cancel: ['cancel'],
    refund: ['refund'],
    read: ['readAuthorization', 'readCharge'],
    notify: ['decodeNotice']
} as const satisfies {
    readonly [C in PaymentCapability]: readonly [PaymentProviderMethod, ...PaymentProviderMethod[]];
};

/** Every method named by the map. */
type MappedMethod = (typeof CAPABILITY_METHODS)[PaymentCapability][number];

/** Resolves to `true` only when the two unions are identical. */
type SameUnion<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Accepts only `true`; anything else is a compile error at the use site. */
type MustBeTrue<T extends true> = T;

/**
 * Compile-time proof that the map covers every interface method. If a method is
 * added to `PaymentProvider` and not to `CAPABILITY_METHODS`, this alias stops
 * compiling.
 */
export type EveryMethodHasACapability = MustBeTrue<SameUnion<MappedMethod, PaymentProviderMethod>>;

/** Every interface method, in capability order, flattened from `CAPABILITY_METHODS`. */
export const PROVIDER_METHODS: readonly PaymentProviderMethod[] = Object.freeze(
    Object.values(CAPABILITY_METHODS).flat()
);
