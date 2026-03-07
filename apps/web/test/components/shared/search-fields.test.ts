/**
 * @file search-fields.test.ts
 * @description Source-level tests for the hero search form field components:
 * SearchFieldType.tsx, SearchFieldDestination.tsx, and GuestCounter.tsx.
 *
 * All three live in src/components/shared/ and are consumed by HeroSearchForm.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../../src');

function readComponent(relativePath: string): string {
    return readFileSync(resolve(srcDir, relativePath), 'utf8');
}

// ──────────────────────────────────────────────────────────────────────────────
// SearchFieldType.tsx
// ──────────────────────────────────────────────────────────────────────────────

describe('SearchFieldType.tsx', () => {
    const src = readComponent('components/shared/SearchFieldType.tsx');

    describe('Exports', () => {
        it('should use a named export', () => {
            expect(src).toContain('export function SearchFieldType');
        });

        it('should NOT use a default export', () => {
            expect(src).not.toMatch(/^export default/m);
        });
    });

    describe('Props interface', () => {
        it('should define SearchFieldTypeProps interface', () => {
            expect(src).toContain('interface SearchFieldTypeProps');
        });

        it('should have readonly value prop', () => {
            expect(src).toContain('readonly value:');
        });

        it('should have readonly onValueChange prop', () => {
            expect(src).toContain('readonly onValueChange:');
        });

        it('should have readonly variant prop (desktop | mobile)', () => {
            expect(src).toContain("readonly variant: 'desktop' | 'mobile'");
        });

        it('should have readonly locale prop', () => {
            expect(src).toContain('readonly locale?');
        });
    });

    describe('Select component usage', () => {
        it('should import Select components from @/components/ui/select', () => {
            expect(src).toContain('@/components/ui/select');
        });

        it('should render a Select element', () => {
            expect(src).toContain('<Select');
        });

        it('should render a SelectTrigger element', () => {
            expect(src).toContain('<SelectTrigger');
        });

        it('should render a SelectContent element', () => {
            expect(src).toContain('<SelectContent>');
        });

        it('should render SelectItem elements for each type', () => {
            expect(src).toContain('<SelectItem');
        });
    });

    describe('Hero semantic tokens for desktop variant', () => {
        it('should apply text-hero-text class in desktop variant trigger', () => {
            expect(src).toContain('text-hero-text');
        });

        it('should apply data-[placeholder]:text-hero-text-muted in desktop trigger', () => {
            expect(src).toContain('text-hero-text-muted');
        });

        it('should use transparent background (bg-transparent) for desktop trigger', () => {
            expect(src).toContain('bg-transparent');
        });

        it('should remove border (border-0) for desktop trigger', () => {
            expect(src).toContain('border-0');
        });

        it('should use bg-muted/50 for mobile variant trigger', () => {
            expect(src).toContain('bg-muted/50');
        });
    });

    describe('i18n integration', () => {
        it('should import createT from i18n lib', () => {
            expect(src).toContain('createT');
        });

        it('should use i18n key for accommodation type label', () => {
            expect(src).toContain("'home.searchBar.accommodationType'");
        });

        it('should use i18n key for placeholder', () => {
            expect(src).toContain("'home.searchBar.accommodationTypePlaceholder'");
        });
    });

    describe('Icons', () => {
        it('should import HomeIcon from @repo/icons', () => {
            expect(src).toContain('HomeIcon');
            expect(src).toContain('@repo/icons');
        });
    });

    describe('Data source', () => {
        it('should import ACCOMMODATION_TYPE_NAMES static data', () => {
            expect(src).toContain('ACCOMMODATION_TYPE_NAMES');
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// SearchFieldDestination.tsx
// ──────────────────────────────────────────────────────────────────────────────

describe('SearchFieldDestination.tsx', () => {
    const src = readComponent('components/shared/SearchFieldDestination.tsx');

    describe('Exports', () => {
        it('should use a named export', () => {
            expect(src).toContain('export function SearchFieldDestination');
        });

        it('should NOT use a default export', () => {
            expect(src).not.toMatch(/^export default/m);
        });
    });

    describe('Props interface', () => {
        it('should define SearchFieldDestinationProps interface', () => {
            expect(src).toContain('interface SearchFieldDestinationProps');
        });

        it('should have readonly value prop', () => {
            expect(src).toContain('readonly value:');
        });

        it('should have readonly onValueChange prop', () => {
            expect(src).toContain('readonly onValueChange:');
        });

        it('should have readonly variant prop (desktop | mobile)', () => {
            expect(src).toContain("readonly variant: 'desktop' | 'mobile'");
        });

        it('should have readonly locale prop', () => {
            expect(src).toContain('readonly locale?');
        });
    });

    describe('Select component usage', () => {
        it('should import Select components from @/components/ui/select', () => {
            expect(src).toContain('@/components/ui/select');
        });

        it('should render a Select element', () => {
            expect(src).toContain('<Select');
        });

        it('should render a SelectTrigger element', () => {
            expect(src).toContain('<SelectTrigger');
        });

        it('should render SelectItem for each destination', () => {
            expect(src).toContain('<SelectItem');
        });
    });

    describe('Hero semantic tokens for desktop variant', () => {
        it('should apply text-hero-text for desktop trigger', () => {
            expect(src).toContain('text-hero-text');
        });

        it('should apply text-hero-text-muted for placeholder', () => {
            expect(src).toContain('text-hero-text-muted');
        });

        it('should use bg-transparent for desktop variant', () => {
            expect(src).toContain('bg-transparent');
        });

        it('should use bg-muted/50 for mobile variant', () => {
            expect(src).toContain('bg-muted/50');
        });
    });

    describe('i18n integration', () => {
        it('should import createT from i18n lib', () => {
            expect(src).toContain('createT');
        });

        it('should use i18n key for destination label', () => {
            expect(src).toContain("'home.searchBar.destination'");
        });

        it('should use i18n key for destination placeholder', () => {
            expect(src).toContain("'home.searchBar.destinationPlaceholder'");
        });
    });

    describe('Icons', () => {
        it('should import LocationIcon from @repo/icons', () => {
            expect(src).toContain('LocationIcon');
            expect(src).toContain('@repo/icons');
        });
    });

    describe('Data source', () => {
        it('should import DESTINATION_NAMES static data', () => {
            expect(src).toContain('DESTINATION_NAMES');
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// GuestCounter.tsx
// ──────────────────────────────────────────────────────────────────────────────

describe('GuestCounter.tsx', () => {
    const src = readComponent('components/shared/GuestCounter.tsx');

    describe('Exports', () => {
        it('should use a named export', () => {
            expect(src).toContain('export function GuestCounter');
        });

        it('should NOT use a default export', () => {
            expect(src).not.toMatch(/^export default/m);
        });
    });

    describe('Props interface', () => {
        it('should define GuestCounterProps interface', () => {
            expect(src).toContain('interface GuestCounterProps');
        });

        it('should have readonly label prop', () => {
            expect(src).toContain('readonly label:');
        });

        it('should have readonly sublabel prop', () => {
            expect(src).toContain('readonly sublabel:');
        });

        it('should have readonly value prop', () => {
            expect(src).toContain('readonly value:');
        });

        it('should have readonly onIncrement prop', () => {
            expect(src).toContain('readonly onIncrement:');
        });

        it('should have readonly onDecrement prop', () => {
            expect(src).toContain('readonly onDecrement:');
        });

        it('should have optional min prop', () => {
            expect(src).toContain('readonly min?');
        });

        it('should have optional locale prop', () => {
            expect(src).toContain('readonly locale?');
        });
    });

    describe('Stepper controls', () => {
        it('should render increment button', () => {
            expect(src).toContain('onIncrement');
        });

        it('should render decrement button', () => {
            expect(src).toContain('onDecrement');
        });

        it('should disable decrement button when value equals min', () => {
            expect(src).toContain('value <= min');
        });

        it('should display current value', () => {
            expect(src).toContain('{value}');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label on decrement button using i18n', () => {
            expect(src).toContain("'home.searchBar.decrease'");
        });

        it('should have aria-label on increment button using i18n', () => {
            expect(src).toContain("'home.searchBar.increase'");
        });

        it('should use output element with aria-live for value display', () => {
            expect(src).toContain('<output');
            expect(src).toContain('aria-live="polite"');
        });

        it('should use aria-atomic on the output element', () => {
            expect(src).toContain('aria-atomic="true"');
        });

        it('should have type=button on increment button', () => {
            expect(src).toContain('type="button"');
        });
    });

    describe('Icons', () => {
        it('should import AddIcon from @repo/icons', () => {
            expect(src).toContain('AddIcon');
            expect(src).toContain('@repo/icons');
        });

        it('should import MinusIcon from @repo/icons', () => {
            expect(src).toContain('MinusIcon');
        });
    });

    describe('i18n integration', () => {
        it('should import createT from i18n lib', () => {
            expect(src).toContain('createT');
        });
    });

    describe('Semantic tokens', () => {
        it('should use text-foreground for label text', () => {
            expect(src).toContain('text-foreground');
        });

        it('should use text-muted-foreground for sublabel', () => {
            expect(src).toContain('text-muted-foreground');
        });

        it('should use border-border for button border', () => {
            expect(src).toContain('border-border');
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// GuestCounter.tsx - stepper min/max bounds and disabled state
// ──────────────────────────────────────────────────────────────────────────────

describe('GuestCounter.tsx - min bound enforcement', () => {
    const src = readComponent('components/shared/GuestCounter.tsx');

    it('should disable the decrement button when value equals min', () => {
        expect(src).toContain('disabled={value <= min}');
    });

    it('should apply disabled:opacity-30 to the decrement button', () => {
        expect(src).toContain('disabled:opacity-30');
    });

    it('should apply disabled:cursor-not-allowed to the decrement button', () => {
        expect(src).toContain('disabled:cursor-not-allowed');
    });

    it('should default min to 0 when not provided', () => {
        expect(src).toContain('min = 0');
    });

    it('should NOT set a disabled attribute on the increment button', () => {
        // Increment button has no upper-bound disable logic in the source
        const incrementButtonBlock = src.slice(src.lastIndexOf('onClick={onIncrement}'));
        expect(incrementButtonBlock).not.toContain('disabled=');
    });
});

describe('GuestCounter.tsx - output element accessibility', () => {
    const src = readComponent('components/shared/GuestCounter.tsx');

    it('should use an <output> element rather than a plain span for the count', () => {
        expect(src).toContain('<output');
    });

    it('should add aria-live="polite" so screen readers announce value changes', () => {
        expect(src).toContain('aria-live="polite"');
    });

    it('should add aria-atomic="true" so the full count is announced at once', () => {
        expect(src).toContain('aria-atomic="true"');
    });

    it('should center the count text with text-center and fixed width', () => {
        expect(src).toContain('w-6 text-center');
    });
});

describe('GuestCounter.tsx - button layout and shape', () => {
    const src = readComponent('components/shared/GuestCounter.tsx');

    it('should render circular buttons with rounded-full', () => {
        expect(src).toContain('rounded-full');
    });

    it('should apply h-8 w-8 fixed dimensions to stepper buttons', () => {
        expect(src).toContain('h-8 w-8');
    });

    it('should use gap-3 to space minus/value/plus horizontally', () => {
        expect(src).toContain('gap-3');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// SearchFieldType.tsx - multi-option rendering and variant styling
// ──────────────────────────────────────────────────────────────────────────────

describe('SearchFieldType.tsx - variant class switching', () => {
    const src = readComponent('components/shared/SearchFieldType.tsx');

    it('should compute a triggerClassName variable based on the variant', () => {
        expect(src).toContain('triggerClassName');
    });

    it('should apply shadow-none and focus-visible:ring-0 for the desktop variant', () => {
        expect(src).toContain('shadow-none');
        expect(src).toContain('focus-visible:ring-0');
    });

    it('should wrap the field in a padded div only in the desktop variant', () => {
        expect(src).toContain("variant === 'desktop' ? 'flex-1 px-3 py-1' : undefined");
    });

    it('should pass chevronColor=currentColor to SelectTrigger in desktop mode', () => {
        expect(src).toContain("chevronColor={variant === 'desktop' ? 'currentColor' : undefined}");
    });
});

describe('SearchFieldType.tsx - label icon weight by variant', () => {
    const src = readComponent('components/shared/SearchFieldType.tsx');

    it('should use regular weight for HomeIcon in desktop variant', () => {
        expect(src).toContain("weight={variant === 'desktop' ? 'regular' : 'duotone'}");
    });

    it('should render the label icon with uppercase tracking-wider styling', () => {
        expect(src).toContain('uppercase tracking-wider');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// SearchFieldDestination.tsx - variant styling and chevron behaviour
// ──────────────────────────────────────────────────────────────────────────────

describe('SearchFieldDestination.tsx - variant class switching', () => {
    const src = readComponent('components/shared/SearchFieldDestination.tsx');

    it('should compute a triggerClassName variable based on the variant', () => {
        expect(src).toContain('triggerClassName');
    });

    it('should apply shadow-none and focus-visible:ring-0 for the desktop variant', () => {
        expect(src).toContain('shadow-none');
        expect(src).toContain('focus-visible:ring-0');
    });

    it('should wrap the field in a padded div only in the desktop variant', () => {
        expect(src).toContain("variant === 'desktop' ? 'flex-1 px-3 py-1' : undefined");
    });

    it('should pass chevronColor=currentColor in desktop mode', () => {
        expect(src).toContain("chevronColor={variant === 'desktop' ? 'currentColor' : undefined}");
    });
});

describe('SearchFieldDestination.tsx - icon and label weight by variant', () => {
    const src = readComponent('components/shared/SearchFieldDestination.tsx');

    it('should use regular weight for LocationIcon in desktop variant', () => {
        expect(src).toContain("weight={variant === 'desktop' ? 'regular' : 'duotone'}");
    });

    it('should render the label with uppercase tracking-wider styling', () => {
        expect(src).toContain('uppercase tracking-wider');
    });
});

describe('SearchFieldDestination.tsx - DEFAULT_LOCALE fallback', () => {
    const src = readComponent('components/shared/SearchFieldDestination.tsx');

    it('should import DEFAULT_LOCALE from i18n lib', () => {
        expect(src).toContain('DEFAULT_LOCALE');
    });

    it('should use DEFAULT_LOCALE as the default value for the locale prop', () => {
        expect(src).toContain('locale = DEFAULT_LOCALE');
    });
});

describe('SearchFieldType.tsx - DEFAULT_LOCALE fallback', () => {
    const src = readComponent('components/shared/SearchFieldType.tsx');

    it('should import DEFAULT_LOCALE from i18n lib', () => {
        expect(src).toContain('DEFAULT_LOCALE');
    });

    it('should use DEFAULT_LOCALE as the default value for the locale prop', () => {
        expect(src).toContain('locale = DEFAULT_LOCALE');
    });
});
