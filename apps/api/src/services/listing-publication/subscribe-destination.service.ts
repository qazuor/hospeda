import type { PublicationVertical } from '../../../../../packages/verticals/src/publication/publication-types';
import { resolveSubscribeDestinationForUser as resolve } from '../../utils/listing-publication/subscribe-destination';

export function resolveSubscribeDestinationForUser(args: {
    readonly userId: string;
    readonly vertical: PublicationVertical;
}) {
    return resolve(args);
}
