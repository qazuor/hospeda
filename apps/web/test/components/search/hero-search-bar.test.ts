import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/search/HeroSearchBar.client.tsx');
const content = readFileSync(componentPath, 'utf8');

const typesPath = resolve(__dirname, '../../../src/components/search/search-bar-types.ts');
const typesContent = readFileSync(typesPath, 'utf8');

const constantsPath = resolve(__dirname, '../../../src/components/search/search-bar-constants.ts');
const constantsContent = readFileSync(constantsPath, 'utf8');

describe('HeroSearchBar.client.tsx', () => {
    describe('Architecture', () => {
        it('should use <search> element for semantic search landmark', () => {
            // HTML5 <search> element replaces role="search" on <form>
            expect(content).toContain('<search ');
        });

        it('should not use native <select> elements', () => {
            expect(content).not.toMatch(/<select[\s>]/);
        });

        it('should import @floating-ui/react via popover components', () => {
            expect(content).toContain('DateRangePopover');
            expect(content).toContain('GuestsPopover');
            expect(content).toContain('TypePopover');
            expect(content).toContain('DestinationPopover');
        });

        it('should import SearchBottomSheet for mobile', () => {
            expect(content).toContain('SearchBottomSheet');
        });
    });

    describe('Props', () => {
        it('should re-export HeroSearchBarProps type', () => {
            expect(content).toContain('export type { HeroSearchBarProps }');
        });

        it('should accept locale prop', () => {
            expect(content).toContain("locale: 'es' | 'en' | 'pt'");
        });

        it('should accept apiBaseUrl prop', () => {
            expect(content).toContain('apiBaseUrl: string');
        });

        it('should accept labels prop of type HeroSearchBarLabels', () => {
            expect(content).toContain('labels: HeroSearchBarLabels');
        });

        it('should accept baseAccommodationsPath prop', () => {
            expect(content).toContain('baseAccommodationsPath: string');
        });
    });

    describe('Named export', () => {
        it('should have named export HeroSearchBar', () => {
            expect(content).toContain('export function HeroSearchBar');
        });

        it('should not have a default export', () => {
            expect(content).not.toContain('export default');
        });
    });

    describe('State management', () => {
        it('should use INITIAL_SEARCH_STATE from types module', () => {
            expect(content).toContain('INITIAL_SEARCH_STATE');
        });

        it('should track layoutMode state with 3 modes', () => {
            // Replaced boolean `isMobile` with 3-mode layout system:
            // 'mobile' | 'horizontal' | 'vertical'
            expect(content).toContain('layoutMode');
            expect(content).toContain("'mobile'");
            expect(content).toContain("'horizontal'");
            expect(content).toContain("'vertical'");
        });

        it('should track isSheetOpen state for mobile bottom sheet', () => {
            expect(content).toContain('isSheetOpen');
        });
    });

    describe('Data fetching', () => {
        it('should fetch destinations from API', () => {
            expect(content).toContain('fetchDestinations');
        });

        it('should not fetch accommodation types (static enum)', () => {
            expect(content).not.toContain('fetchAccommodationTypes');
        });

        it('should handle cancelled flag for cleanup', () => {
            expect(content).toContain('cancelled');
        });
    });

    describe('URL building', () => {
        it('should have a buildSearchUrl helper', () => {
            expect(content).toContain('buildSearchUrl');
        });

        it('should support multi-value params with URLSearchParams.append', () => {
            expect(content).toContain("params.append('destino'");
            expect(content).toContain("params.append('tipo'");
        });

        it('should include adults param when not default', () => {
            expect(content).toContain("params.set('adultos'");
        });

        it('should include children param when > 0', () => {
            expect(content).toContain("params.set('ninos'");
        });
    });

    describe('Mobile behavior', () => {
        it('should detect mobile via resize listener', () => {
            expect(content).toContain('resize');
            expect(content).toContain('innerWidth');
        });

        it('should render mobile trigger button with search icon', () => {
            expect(content).toContain('setIsSheetOpen(true)');
        });
    });

    describe('Desktop layout', () => {
        it('should have submit button with type="submit"', () => {
            expect(content).toContain('type="submit"');
        });

        it('should use rounded-[20px] for organic styling', () => {
            expect(content).toContain('rounded-[20px]');
        });

        it('should use border-primary-light', () => {
            expect(content).toContain('border-primary-light');
        });
    });

    describe('File constraints', () => {
        it('should be under 500 lines', () => {
            const lineCount = content.split('\n').length;
            expect(lineCount).toBeLessThan(500);
        });
    });
});

describe('search-bar-types.ts', () => {
    it('should define SearchFormState with multi-select fields', () => {
        expect(typesContent).toContain('destinations: readonly string[]');
        expect(typesContent).toContain('types: readonly AccommodationTypeEnum[]');
    });

    it('should define adults and children fields', () => {
        expect(typesContent).toContain('adults: number');
        expect(typesContent).toContain('children: number');
    });

    it('should define HeroSearchBarLabels interface', () => {
        expect(typesContent).toContain('export interface HeroSearchBarLabels');
    });

    it('should include new label fields', () => {
        expect(typesContent).toContain('datesPlaceholder: string');
        expect(typesContent).toContain('guestsPlaceholder: string');
        expect(typesContent).toContain('adultsLabel: string');
        expect(typesContent).toContain('childrenLabel: string');
        expect(typesContent).toContain('closePanelAriaLabel: string');
        expect(typesContent).toContain('typeLabels:');
    });

    it('should export INITIAL_SEARCH_STATE with defaults', () => {
        expect(typesContent).toContain('INITIAL_SEARCH_STATE');
        expect(typesContent).toContain('adults: 2');
        expect(typesContent).toContain('children: 0');
    });

    it('should define DestinationOption interface', () => {
        expect(typesContent).toContain('export interface DestinationOption');
    });
});

describe('search-bar-constants.ts', () => {
    it('should import AccommodationTypeEnum from @repo/schemas', () => {
        expect(constantsContent).toContain("from '@repo/schemas'");
    });

    it('should define ACCOMMODATION_TYPE_OPTIONS', () => {
        expect(constantsContent).toContain('ACCOMMODATION_TYPE_OPTIONS');
    });

    it('should cover all 10 accommodation types', () => {
        expect(constantsContent).toContain('AccommodationTypeEnum.HOTEL');
        expect(constantsContent).toContain('AccommodationTypeEnum.CABIN');
        expect(constantsContent).toContain('AccommodationTypeEnum.APARTMENT');
        expect(constantsContent).toContain('AccommodationTypeEnum.HOUSE');
        expect(constantsContent).toContain('AccommodationTypeEnum.COUNTRY_HOUSE');
        expect(constantsContent).toContain('AccommodationTypeEnum.HOSTEL');
        expect(constantsContent).toContain('AccommodationTypeEnum.CAMPING');
        expect(constantsContent).toContain('AccommodationTypeEnum.ROOM');
        expect(constantsContent).toContain('AccommodationTypeEnum.MOTEL');
        expect(constantsContent).toContain('AccommodationTypeEnum.RESORT');
    });

    it('should define CSS constants', () => {
        expect(constantsContent).toContain('FOCUS_RING');
        expect(constantsContent).toContain('POPOVER_BASE');
        expect(constantsContent).toContain('FIELD_TRIGGER');
    });

    it('should define guest limits', () => {
        expect(constantsContent).toContain('ADULTS_MIN');
        expect(constantsContent).toContain('ADULTS_MAX');
        expect(constantsContent).toContain('CHILDREN_MIN');
        expect(constantsContent).toContain('CHILDREN_MAX');
    });
});
