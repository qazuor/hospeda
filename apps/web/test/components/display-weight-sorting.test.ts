import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ─── Source file paths ────────────────────────────────────────────────────────

const featuredCardPath = resolve(
    __dirname,
    '../../src/components/accommodation/AccommodationCardFeatured.astro'
);
const featuredCardContent = readFileSync(featuredCardPath, 'utf8');

const destinationTypesPath = resolve(
    __dirname,
    '../../src/components/destination/destination-card.types.ts'
);
const destinationTypesContent = readFileSync(destinationTypesPath, 'utf8');

const transformsPath = resolve(__dirname, '../../src/lib/api/transforms.ts');
const transformsContent = readFileSync(transformsPath, 'utf8');

// ─── AccommodationCardFeatured.astro – displayWeight sorting ─────────────────

describe('AccommodationCardFeatured.astro displayWeight sorting', () => {
    describe('Sort expression', () => {
        it('should sort combined badge items by displayWeight DESC', () => {
            expect(featuredCardContent).toContain(
                '.sort((a, b) => (b.displayWeight ?? 50) - (a.displayWeight ?? 50))'
            );
        });

        it('should apply a default weight of 50 when displayWeight is absent', () => {
            // Both sides of the subtraction must use ?? 50 as the fallback
            expect(featuredCardContent).toMatch(
                /b\.displayWeight\s*\?\?\s*50\)\s*-\s*\(a\.displayWeight\s*\?\?\s*50/
            );
        });
    });

    describe('Badge item shape', () => {
        it('should include displayWeight as an optional field in the badge item type', () => {
            expect(featuredCardContent).toContain('displayWeight?: number');
        });

        it('should declare allBadgeItems combining amenities and features', () => {
            expect(featuredCardContent).toContain('allBadgeItems');
            expect(featuredCardContent).toContain('accommodation.amenities');
            expect(featuredCardContent).toContain('accommodation.features');
        });
    });

    describe('Slice after sort', () => {
        it('should slice the sorted list to the first 6 items', () => {
            expect(featuredCardContent).toContain('allBadgeItems.slice(0, 6)');
        });

        it('should track the overflow count from the sorted list', () => {
            expect(featuredCardContent).toContain('allBadgeItems.length - badgeItems.length');
        });
    });
});

// ─── AccommodationCardDetailed.astro – intentionally excluded ────────────────

const detailedCardPath = resolve(
    __dirname,
    '../../src/components/accommodation/AccommodationCardDetailed.astro'
);
const detailedCardContent = readFileSync(detailedCardPath, 'utf8');

describe('AccommodationCardDetailed.astro displayWeight exclusion', () => {
    it('should NOT contain displayWeight because this card does not display amenities or features', () => {
        expect(detailedCardContent).not.toContain('displayWeight');
    });

    it('should NOT contain amenities or features arrays', () => {
        expect(detailedCardContent).not.toContain('amenities');
        expect(detailedCardContent).not.toContain('features');
    });

    it('should display specs (capacity, beds, bathrooms) instead of amenity badges', () => {
        expect(detailedCardContent).toContain('capacity');
        expect(detailedCardContent).toContain('beds');
        expect(detailedCardContent).toContain('bathrooms');
    });
});

// ─── destination-card.types.ts – displayWeight in attractions ─────────────────

describe('destination-card.types.ts displayWeight field', () => {
    describe('DestinationCardData interface', () => {
        it('should define attractions as a ReadonlyArray', () => {
            expect(destinationTypesContent).toContain('readonly attractions?: ReadonlyArray');
        });

        it('should include displayWeight as an optional number in the attraction shape', () => {
            expect(destinationTypesContent).toContain('readonly displayWeight?: number');
        });

        it('should document that attractions are ordered by displayWeight DESC from the service layer', () => {
            expect(destinationTypesContent).toContain('displayWeight DESC');
        });
    });

    describe('Attraction fields', () => {
        it('should include id, name and icon alongside displayWeight', () => {
            expect(destinationTypesContent).toContain('readonly id: string');
            expect(destinationTypesContent).toContain('readonly name: string');
            expect(destinationTypesContent).toContain('readonly icon?: string');
        });
    });
});

// ─── AmenitiesList.astro – displayWeight sorting ─────────────────────────────

const amenitiesListPath = resolve(
    __dirname,
    '../../src/components/accommodation/AmenitiesList.astro'
);
const amenitiesListContent = readFileSync(amenitiesListPath, 'utf8');

describe('AmenitiesList.astro displayWeight sorting', () => {
    it('should include displayWeight as optional field in AmenityItem', () => {
        expect(amenitiesListContent).toContain('displayWeight?: number');
    });

    it('should sort amenities by displayWeight DESC before rendering', () => {
        expect(amenitiesListContent).toContain('(b.displayWeight ?? 50) - (a.displayWeight ?? 50)');
    });

    it('should use sortedAmenities for rendering instead of raw props', () => {
        expect(amenitiesListContent).toContain('sortedAmenities.map');
    });

    it('should create a copy to avoid mutating props', () => {
        expect(amenitiesListContent).toContain('[...amenities].sort');
    });
});

// ─── DestinationCard.client.tsx – attraction badges with displayWeight ───────

const destinationClientPath = resolve(
    __dirname,
    '../../src/components/destination/DestinationCard.client.tsx'
);
const destinationClientContent = readFileSync(destinationClientPath, 'utf8');

describe('DestinationCard.client.tsx displayWeight support', () => {
    describe('DestinationAttraction interface', () => {
        it('should define DestinationAttraction with displayWeight', () => {
            expect(destinationClientContent).toContain('interface DestinationAttraction');
            expect(destinationClientContent).toContain('readonly displayWeight?: number');
        });
    });

    describe('DestinationItem interface', () => {
        it('should include attractions field with DestinationAttraction type', () => {
            expect(destinationClientContent).toContain(
                'readonly attractions?: readonly DestinationAttraction[]'
            );
        });

        it('should document that attractions are ordered by displayWeight DESC', () => {
            expect(destinationClientContent).toContain('displayWeight DESC');
        });
    });

    describe('Sorting and slicing', () => {
        it('should sort attractions by displayWeight DESC', () => {
            expect(destinationClientContent).toContain(
                '(b.displayWeight ?? 50) - (a.displayWeight ?? 50)'
            );
        });

        it('should create a copy to avoid mutating props', () => {
            expect(destinationClientContent).toContain('[...(destination.attractions ?? [])]');
        });

        it('should slice to MAX_ATTRACTIONS after sorting', () => {
            expect(destinationClientContent).toContain(
                'sortedAttractions.slice(0, MAX_ATTRACTIONS)'
            );
        });

        it('should track overflow count', () => {
            expect(destinationClientContent).toContain(
                'sortedAttractions.length - MAX_ATTRACTIONS'
            );
        });
    });

    describe('Attraction badge rendering', () => {
        it('should import resolveIcon from @repo/icons', () => {
            expect(destinationClientContent).toContain(
                "import { LocationIcon, resolveIcon } from '@repo/icons'"
            );
        });

        it('should resolve icon via resolveIcon for each attraction', () => {
            expect(destinationClientContent).toContain(
                'resolveIcon({ iconName: attraction.icon })'
            );
        });

        it('should fall back to LocationIcon when no icon is set', () => {
            expect(destinationClientContent).toContain('LocationIcon');
        });

        it('should set aria-label with attraction name for accessibility', () => {
            expect(destinationClientContent).toContain('aria-label={attraction.name}');
        });

        it('should set role="img" on badge elements', () => {
            expect(destinationClientContent).toContain('role="img"');
        });

        it('should show overflow count when attractions exceed max', () => {
            expect(destinationClientContent).toContain('extraAttractionCount > 0');
            expect(destinationClientContent).toContain('+{extraAttractionCount}');
        });

        it('should only render badges when there are visible attractions', () => {
            expect(destinationClientContent).toContain('visibleAttractions.length > 0');
        });
    });
});

// ─── transforms.ts – extractRelationItems ────────────────────────────────────

describe('transforms.ts extractRelationItems', () => {
    describe('CardAmenityFeature interface', () => {
        it('should export CardAmenityFeature with a displayWeight field', () => {
            expect(transformsContent).toContain('displayWeight?: number');
        });

        it('should include key, label and icon alongside displayWeight', () => {
            // Verify all four fields are present in the exported interface
            expect(transformsContent).toContain('readonly key: string');
            expect(transformsContent).toContain('readonly label: string');
            expect(transformsContent).toContain('readonly icon?: string');
        });
    });

    describe('extractRelationItems implementation', () => {
        it('should extract displayWeight from the nested relation object', () => {
            expect(transformsContent).toContain(
                'displayWeight: Number(nested?.displayWeight ?? 50)'
            );
        });

        it('should use 50 as the fallback displayWeight when the field is absent', () => {
            expect(transformsContent).toContain('nested?.displayWeight ?? 50');
        });

        it('should coerce displayWeight to a number via Number()', () => {
            expect(transformsContent).toMatch(/displayWeight:\s*Number\(nested\?\.displayWeight/);
        });
    });
});

// ─── transforms.ts – toDestinationCardProps ──────────────────────────────────

describe('transforms.ts toDestinationCardProps', () => {
    describe('Attractions mapping', () => {
        it('should map displayWeight from each raw attraction item', () => {
            expect(transformsContent).toContain('displayWeight: a.displayWeight');
        });

        it('should include id, name and icon in the mapped attraction', () => {
            // All four fields must be present in the map callback
            expect(transformsContent).toContain('id: a.id');
            expect(transformsContent).toContain('name: a.name');
            expect(transformsContent).toContain('icon: a.icon');
        });

        it('should type attractions with optional displayWeight on the raw input', () => {
            expect(transformsContent).toContain('displayWeight?: number');
        });

        it('should fall back to an empty array when attractions is undefined', () => {
            expect(transformsContent).toContain('?? []');
        });
    });

    describe('Raw input typing', () => {
        it('should type the raw attractions array with id, name, icon and displayWeight', () => {
            expect(transformsContent).toContain(
                'Array<{ id: string; name: string; icon?: string; displayWeight?: number }>'
            );
        });
    });
});
