/**
 * Lifecycle states an entity can be in across its full workflow.
 *
 * The four-stage workflow is: **incomplete → operational → paused → final**.
 *
 * - `DRAFT`: still being configured, never published. Distinguished from
 *   INACTIVE by never having been operational.
 * - `ACTIVE`: published, operational, in normal use.
 * - `INACTIVE`: was active, currently paused. Reactivable. Examples:
 *   accommodation paused for vacation, sponsor between contract cycles,
 *   subscription suspended for failed payment, user suspended by admin,
 *   amenity under maintenance.
 * - `ARCHIVED`: permanently retired. Not expected to return to ACTIVE
 *   (though the model permits restore).
 *
 * The middle state `INACTIVE` is what differentiates "draft-never-ran"
 * from "ran-and-paused" from "retired-forever". Adding it allows
 * cleaner workflows for entities that need a temporary suspension
 * without losing the distinction with DRAFT or ARCHIVED.
 */
export enum LifecycleStatusEnum {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    ARCHIVED = 'ARCHIVED'
}
