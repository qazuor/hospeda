/**
 * The primitive shapes every entry of the contract is built from.
 *
 * The contract does not fix an id format (contract §2, §4.1 name the ids, not
 * their encoding), so an id is a non-empty string: an empty one is never a
 * reference, which is what contract §2.3 forbids ("una fuente sin referencia
 * resoluble no se puede expresar").
 */
import { VerticalEnum } from '@repo/schemas';
import { z } from 'zod';

/** A vertical, from the closed enum of `@repo/schemas`. Mandatory wherever the contract names one. */
export const VerticalSchema = z.enum(VerticalEnum);

/** A person (`user` in the contract). */
export const UserIdSchema = z.string().min(1);

/** A listing (`ficha` / `idDeFicha` in the contract). */
export const ListingIdSchema = z.string().min(1);

/** A plan version (`versiónDePlan`). */
export const PlanVersionIdSchema = z.string().min(1);

/** An addon version (`versiónDeAddon`). */
export const AddonVersionIdSchema = z.string().min(1);

/** An addon product (`addon` in `políticaDeAddon`). */
export const AddonIdSchema = z.string().min(1);

/** An instant. A `Date` that is not a valid instant is rejected. */
export const InstantSchema = z.date();

/** `(user, vertical)`: the pair most entries are asked about. */
export const UserVerticalArgsSchema = z.strictObject({
    userId: UserIdSchema,
    vertical: VerticalSchema
});

/** `(user, vertical)`, the argument shape shared by several entries. */
export type UserVerticalArgs = z.infer<typeof UserVerticalArgsSchema>;
