/**
 * The rows of the fake's lists the battery does NOT measure, each declared by name with its
 * reason (HOS-1512, AC:B1:15, owner decision 2026-11-18). The battery moves no money and needs no
 * person: a row that needs a real charge, a card, a human checkout, a refund (`401` in sandbox),
 * or more than one run to show, is watched by hand. Every row of `fake-lists.json` is either here
 * or in a measurement's `rows`, never both (checked by `validateWatchCoverage`).
 *
 * @module battery/catalog/watched-by-hand
 */

/** One row the battery declares watched by hand. */
export interface WatchedByHand {
    /** The row id in `fake-lists.json`. */
    readonly row: string;
    /** Why the battery cannot measure it alone, in one line. */
    readonly reason: string;
}

const LIVE_AUTHORIZATION =
    'needs a live (authorized) authorization, which needs a card and a person on the checkout';

/** The rows watched by hand, by name. */
export const WATCHED_BY_HAND: readonly WatchedByHand[] = [
    { row: 'M1', reason: `a change to a live authorization: ${LIVE_AUTHORIZATION}` },
    { row: 'M2', reason: `two changes to a live authorization: ${LIVE_AUTHORIZATION}` },
    {
        row: 'M3',
        reason: 'a duplicate creation needs two pending creations in one measurement, and the battery allows one (security review 2026-11-18)'
    },
    {
        row: 'M5',
        reason: `an amount change and the notices it does not send: ${LIVE_AUTHORIZATION}, and it watches the notice channels over time`
    },
    {
        row: 'M6',
        reason: 'notices arrive late, repeated or never: it watches the webhook channels across time, not one pass'
    },
    {
        row: 'M7',
        reason: 'needs a rejected charge attempt (RC-5, RC-6), which needs a real card'
    },
    {
        row: 'M8',
        reason: 'needs a charge of a live authorization; re-reading old charges would need the due and charged instants, which EX-51 does not name as fields'
    },
    {
        row: 'M11',
        reason: 'an open approval link never expires: it needs time across runs, not one pass'
    },
    {
        row: 'M12',
        reason: `a pause that never resumes needs a paused authorization over time: ${LIVE_AUTHORIZATION}`
    },
    {
        row: 'M13',
        reason: 'a refund refused as not refundable: refunds answer 401 in sandbox and move money in production'
    },
    {
        row: 'RP1',
        reason: 'card tokens are not the subscription path (owner decision 2026-11-18): the battery never sends one'
    },
    {
        row: 'RP2',
        reason: 'a refund without its key: refunds answer 401 in sandbox and move money in production'
    },
    {
        row: 'RP4',
        reason: 'another currency: a pending creation is pinned to ARS (security review 2026-11-18), so a USD or BRL probe is never sent'
    },
    {
        row: 'RP5',
        reason: 'a repeated refund: refunds answer 401 in sandbox and move money in production'
    },
    { row: 'RP6', reason: `a paused authorization refusing changes: ${LIVE_AUTHORIZATION}` },
    {
        row: 'RP8',
        reason: 'a failed cycle with its four attempts: it needs a card that declines, over days'
    },
    {
        row: 'RP9',
        reason: 'a paused authorization is not charged: the pause instant is not on the object, so a re-read cannot tell a charge before the pause from one after it'
    },
    {
        row: 'RP10',
        reason: `the next charge date after a resume: it needs a resume event, ${LIVE_AUTHORIZATION}`
    },
    {
        row: 'RP11',
        reason: 'the last charged date is the last attempt: retries happen on one record (GR-3), so the attempt instant is not on any record a re-read can compare with'
    },
    {
        row: 'RP12',
        reason: 'a card change emits a zero-amount validation: it needs a card and a person'
    },
    {
        row: 'RP14',
        reason: 'order refunds need an order charged with a card token, which is not the subscription path'
    },
    {
        row: 'RP15',
        reason: 'one-time order creation needs a card token, which is not the subscription path'
    },
    {
        row: 'RP16',
        reason: 'a declined one-time order needs a card token, which is not the subscription path'
    }
];
