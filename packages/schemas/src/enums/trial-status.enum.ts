/**
 * State of a `trial` row — the trial machine of `V/03` §2 (program HOS-1352,
 * piece V4). Three states live in the column:
 *
 * - `TRIAL_ACTIVE`: the trial clock is running (`T1`, extended by `T4`).
 * - `TRIAL_EXPIRED`: the clock ran out with no title that converts (`T3`).
 * - `TRIAL_CONVERTED`: a title that converts took over (`T2`, `T5`), or the row
 *   was born already consumed (`T6`, `T8`), without a clock.
 *
 * `PRE_TRIAL` is a real state with rules and exits, but it is the initial state
 * of a machine whose row is born in its first transition: it lives OUTSIDE the
 * column (a `PRE_TRIAL` person has no `trial` row), so it is not a value here.
 */
export enum TrialStatusEnum {
    TRIAL_ACTIVE = 'TRIAL_ACTIVE',
    TRIAL_EXPIRED = 'TRIAL_EXPIRED',
    TRIAL_CONVERTED = 'TRIAL_CONVERTED'
}
