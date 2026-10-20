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
    /** The listing was published (accommodation, gastronomy, experience). */
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
    [VerticalEnum.GASTRONOMY]: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED,
    [VerticalEnum.EXPERIENCE]: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED,
    [VerticalEnum.TOURIST]: VERTICAL_ACTIVATION_EVENTS.START_BUTTON_PRESSED,
    [VerticalEnum.PARTNER]: null
};
