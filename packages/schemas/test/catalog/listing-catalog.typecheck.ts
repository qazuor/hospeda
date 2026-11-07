import type { ListingSectionId, SectionTraitId } from '../../src/catalog/listing-catalog.ids.js';
import type {
    ListingSectionDefinition,
    ListingVertical
} from '../../src/catalog/listing-catalog.types.js';

const venueSection: ListingSectionId<'venue'> = 'menu';
// @ts-expect-error venue-only section ids cannot be used for accommodation
const invalidSection: ListingSectionId<'accommodation'> = 'menu';
const menuTrait: SectionTraitId<'venue', 'menu'> = 'qr';
// @ts-expect-error a nonexistent field cannot be added to the menu section
const invalidField: ListingSectionDefinition<'venue'>['fields'][number] = 'notAField';
void [venueSection, invalidSection, menuTrait, invalidField];
const vertical: ListingVertical = 'venue';
void vertical;
