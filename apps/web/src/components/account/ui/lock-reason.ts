/**
 * Why something is locked, shared by `LockedState` and `AsyncRegion`
 * (HOS-2413 T-024 / T-028, D9 «sin acceso único»).
 *
 * The CALLER reads plan names from the catalog and passes them in as
 * `PlanRef`s. The kit never hardcodes a plan name, price or limit
 * (`check:commercial-values`).
 *
 * @module components/account/ui/lock-reason
 */

/** A plan the caller read from the catalog. */
export interface PlanRef {
    /** Display name from the catalog. */
    readonly name: string;
}

/** The reason a feature is locked. */
export type LockReason =
    | {
          readonly kind: 'plan';
          /** What the feature is, in a few words. */
          readonly feature: string;
          /** One sentence on what it does for the owner. */
          readonly description: string;
          /** The plans that unlock it, from the catalog. */
          readonly plans: readonly PlanRef[];
          /** Where «Ver planes» goes. */
          readonly plansHref: string;
          /** When given, shows «Empezar prueba» (the D22 trial hook). */
          readonly onStartTrial?: () => void;
      }
    | {
          readonly kind: 'role';
          readonly feature: string;
          readonly description: string;
          /** Where «Sumarme» goes. */
          readonly joinHref: string;
      }
    | {
          readonly kind: 'permission';
          readonly feature: string;
          readonly description: string;
          /** Where to read more or ask for access. */
          readonly helpHref: string;
      };
