import { AccommodationMediaModel, AccommodationModel } from '@repo/db';
import {
    AccommodationMediaListInputSchema,
    type AccommodationMediaListOutput,
    type AccommodationMediaState,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { entityNotFoundError } from '../../utils/not-found.js';
import { hasPermission } from '../../utils/permission.js';
import { ACCOMMODATION_ENTITY_NAME } from '../entity-names.js';

/** Input for reading accommodation media through an owner or inspector surface. */
export interface GetAccommodationMediaForReaderInput {
    readonly actor: Actor;
    readonly accommodationId: string;
    readonly state?: AccommodationMediaState;
}

/** Reads accommodation media for its owner or an actor with inspection permission. */
export async function getAccommodationMediaForReader(
    input: GetAccommodationMediaForReaderInput
): Promise<AccommodationMediaListOutput['media']> {
    const parsed = AccommodationMediaListInputSchema.safeParse({
        accommodationId: input.accommodationId,
        state: input.state
    });
    if (!parsed.success)
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, parsed.error.message);

    const accommodation = await new AccommodationModel().findById(parsed.data.accommodationId);
    if (!accommodation || accommodation.deletedAt !== null) {
        throw entityNotFoundError({ entityName: ACCOMMODATION_ENTITY_NAME });
    }
    const mayInspect = hasPermission(input.actor, PermissionEnum.ACCOMMODATION_VIEW_ALL);
    const ownsWithPermission =
        hasPermission(input.actor, PermissionEnum.ACCOMMODATION_UPDATE_OWN) &&
        input.actor.id === accommodation.ownerId;
    if (!mayInspect && !ownsWithPermission) {
        throw entityNotFoundError({ entityName: ACCOMMODATION_ENTITY_NAME });
    }

    const { items } = await new AccommodationMediaModel().findByAccommodation({
        accommodationId: parsed.data.accommodationId,
        state: parsed.data.state ?? 'visible',
        pageSize: 200
    });
    return items;
}
