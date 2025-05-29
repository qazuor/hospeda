import type { ContactInfoType } from '../../common/contact.types.js';
import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';
import type { EventOrganizerId } from '../../common/id.types.js';
import type { SocialNetworkType } from '../../common/social.types.js';

export interface EventOrganizerType extends WithAudit, WithLifecycleState, WithAdminInfo {
    id: EventOrganizerId;
    name: string;
    logo?: string;
    contactInfo?: ContactInfoType;
    social?: SocialNetworkType;
}

/**
 * Partial editable structure of an EventOrganizerType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialEventOrganizerType = Partial<Writable<EventOrganizerType>>;

/**
 * Input structure used to create a new event organizer.
 * Omits fields that are auto-generated or related to internal state.
 */
export type NewEventOrganizerInputType = NewEntityInput<EventOrganizerType>;

/**
 * Input structure used to update an existing event organizer.
 * All fields are optional for partial patching.
 */
export type UpdateEventOrganizerInputType = PartialEventOrganizerType;
