import { z } from 'zod';
import { VerticalEnum } from '../enums/vertical.enum.js';

/**
 * Closed catalog of domain events that can activate a vertical's trial
 * (DEC-TRIAL-006).
 *
 * Each vertical declares AT MOST one of these. A vertical that declares none
 * grants no trial, and that fails CLOSED with no special case in the engine.
 * Growing this list is a deliberate act: it is mirrored by a CHECK constraint on
 * `vertical.activation_event`.
 */
export const VERTICAL_ACTIVATION_EVENTS = {
    /** The listing was published (accommodation, venue, experience). */
    LISTING_PUBLISHED: 'listing_published',
    /** The person pressed the `Empezar` button (tourist). */
    START_BUTTON_PRESSED: 'start_button_pressed'
} as const;

/** One member of the closed activation-event catalog. */
export type VerticalActivationEvent =
    (typeof VERTICAL_ACTIVATION_EVENTS)[keyof typeof VERTICAL_ACTIVATION_EVENTS];

/** Every activation event, in declaration order. */
export const VERTICAL_ACTIVATION_EVENT_VALUES = Object.values(
    VERTICAL_ACTIVATION_EVENTS
) as readonly VerticalActivationEvent[];

/** Zod schema for {@link VerticalActivationEvent}. */
export const VerticalActivationEventSchema = z.enum(
    VERTICAL_ACTIVATION_EVENT_VALUES as [VerticalActivationEvent, ...VerticalActivationEvent[]]
);

/**
 * The activation event each vertical declares (DEC-TRIAL-006). `null` means
 * "none declared": that vertical grants no trial. Partner is `null` today.
 *
 * Typed as a full `Record` so adding a vertical without deciding its event does
 * not compile.
 */
export const VERTICAL_ACTIVATION_EVENT_BY_VERTICAL: Readonly<
    Record<VerticalEnum, VerticalActivationEvent | null>
> = {
    [VerticalEnum.ACCOMMODATION]: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED,
    [VerticalEnum.VENUE]: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED,
    [VerticalEnum.EXPERIENCE]: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED,
    [VerticalEnum.TOURIST]: VERTICAL_ACTIVATION_EVENTS.START_BUTTON_PRESSED,
    [VerticalEnum.PARTNER]: null
};

/**
 * The activation events that something in the product actually PRODUCES today
 * (HOS-1967). Declaring an event in {@link VERTICAL_ACTIVATION_EVENT_BY_VERTICAL}
 * is not the same as wiring it: `start_button_pressed` is declared for tourist,
 * but nothing calls the trial engine with it, so no tourist trial can start.
 *
 * A vertical whose declared event is absent from this list has NO trial path,
 * and a surface must never promise it a trial, whatever its trial plan's
 * `trial_days` says. Adding an event here is the act of wiring its trigger
 * (HOS-1970 would add `start_button_pressed` together with its producer).
 */
export const TRIGGERED_VERTICAL_ACTIVATION_EVENTS: readonly VerticalActivationEvent[] = [
    VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED
];

/**
 * Whether a vertical has a real trial path: it declares an activation event and
 * that event has a producer ({@link TRIGGERED_VERTICAL_ACTIVATION_EVENTS}).
 *
 * @param input - RO-RO input.
 * @param input.vertical - The vertical to ask about.
 * @returns `{ hasTrialPath }` — `false` for a vertical with no event, or with an
 *   event nothing produces.
 */
export function resolveVerticalTrialPath(input: {
    readonly vertical: VerticalEnum | `${VerticalEnum}`;
}): {
    readonly hasTrialPath: boolean;
} {
    const event = VERTICAL_ACTIVATION_EVENT_BY_VERTICAL[input.vertical as VerticalEnum] ?? null;
    return {
        hasTrialPath: event !== null && TRIGGERED_VERTICAL_ACTIVATION_EVENTS.includes(event)
    };
}
