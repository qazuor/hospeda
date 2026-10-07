/**
 * Entry point of `@repo/billing-verticals-contract`.
 *
 * It exports TYPES only, no runtime value: what one half may ask of the other
 * is a shape, and the implementations live in the halves (billing, verticals)
 * or in the composition root of `apps/api`. V1 and B1 fill it.
 *
 * - `Clock`: the interface the production code of both halves reads the time
 *   through (B1, AC:B1:17).
 */
export type { Clock } from './clock';
