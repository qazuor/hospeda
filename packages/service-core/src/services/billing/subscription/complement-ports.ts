import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import type { LiveAnchorReader } from '../addon/addon-orphanhood-ports.js';

/** Policy readers required to select recurring complements. */
export interface ComplementPolicyPorts {
    /** Reads the anchored addon version policy. */
    readonly addonPolicy: VerticalsForBilling['addonPolicy'];
    /** Reads a listing's owner and vertical. */
    readonly listing: VerticalsForBilling['listing'];
    /** Reads permanent live anchors; defaults to the database implementation. */
    readonly liveAnchors?: LiveAnchorReader;
}
