import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const astroComponentPath = resolve(__dirname, '../../../src/components/ui/PriceDisplay.astro');
const reactComponentPath = resolve(__dirname, '../../../src/components/ui/PriceDisplay.client.tsx');

const astroContent = readFileSync(astroComponentPath, 'utf8');
const reactContent = readFileSync(reactComponentPath, 'utf8');

describe('PriceDisplay.astro', () => {
    describe('Props', () => {
        it('should require amountARS prop', () => {
            expect(astroContent).toContain('amountARS: number');
        });

        it('should accept locale prop', () => {
            expect(astroContent).toContain("locale?: 'es' | 'en' | 'pt'");
        });

        it('should accept userCurrency prop', () => {
            expect(astroContent).toContain("userCurrency?: 'ARS' | 'USD' | 'BRL'");
        });

        it('should accept showDisclaimer prop', () => {
            expect(astroContent).toContain('showDisclaimer?: boolean');
        });

        it('should accept className prop', () => {
            expect(astroContent).toContain('className?: string');
        });

        it('should default locale to es', () => {
            expect(astroContent).toContain("locale = 'es'");
        });

        it('should default showDisclaimer to true', () => {
            expect(astroContent).toContain('showDisclaimer = true');
        });
    });

    describe('Conversion Rates', () => {
        it('should define ARS conversion rate as 1', () => {
            expect(astroContent).toContain('ARS: 1');
        });

        it('should define USD conversion rate as 1000', () => {
            expect(astroContent).toContain('USD: 1000');
        });

        it('should define BRL conversion rate as 200', () => {
            expect(astroContent).toContain('BRL: 200');
        });
    });

    describe('Locale to Currency Mapping', () => {
        it('should map es to ARS', () => {
            expect(astroContent).toContain("es: 'ARS'");
        });

        it('should map en to USD', () => {
            expect(astroContent).toContain("en: 'USD'");
        });

        it('should map pt to BRL', () => {
            expect(astroContent).toContain("pt: 'BRL'");
        });
    });

    describe('Currency Formatters', () => {
        it('should use toBcp47Locale for locale resolution', () => {
            expect(astroContent).toContain('toBcp47Locale(locale)');
            expect(astroContent).toContain('currency: resolvedCurrency');
        });

        it('should use formatCurrency from @repo/i18n for formatting', () => {
            expect(astroContent).toContain('formatCurrency');
            expect(astroContent).toContain('formatCurrency({');
        });
    });

    describe('Currency Resolution', () => {
        it('should resolve currency from userCurrency or locale', () => {
            expect(astroContent).toContain('userCurrency || localeToCurrency[locale]');
        });

        it('should default to ARS if locale is not found', () => {
            expect(astroContent).toContain("|| 'ARS'");
        });
    });

    describe('Disclaimer Logic', () => {
        it('should show disclaimer for non-ARS currencies', () => {
            expect(astroContent).toContain("resolvedCurrency !== 'ARS'");
        });

        it('should respect showDisclaimer prop', () => {
            expect(astroContent).toContain('showDisclaimer &&');
        });

        it('should display disclaimer text in Spanish', () => {
            expect(astroContent).toContain('Precio aproximado');
            expect(astroContent).toContain('Valor de referencia en ARS');
        });

        it('should include ARS formatted value in disclaimer', () => {
            expect(astroContent).toContain('{arsFormatted}');
        });
    });

    describe('Structure', () => {
        it('should render as span with price-display class', () => {
            expect(astroContent).toContain('<span class:list');
            expect(astroContent).toContain("'price-display'");
        });

        it('should render formatted price in price-value span', () => {
            expect(astroContent).toContain('class="price-value"');
            expect(astroContent).toContain('{formattedPrice}');
        });

        it('should conditionally render disclaimer', () => {
            expect(astroContent).toContain('{shouldShowDisclaimer &&');
        });

        it('should apply className prop', () => {
            expect(astroContent).toContain('className');
        });
    });

    describe('Styling', () => {
        it('should have disclaimer with small text', () => {
            expect(astroContent).toContain('text-xs');
        });

        it('should have disclaimer with gray color', () => {
            expect(astroContent).toContain('text-text-tertiary');
        });

        it('should have disclaimer as block element', () => {
            expect(astroContent).toContain('block');
        });

        it('should have disclaimer with top margin', () => {
            expect(astroContent).toContain('mt-1');
        });
    });
});

describe('PriceDisplay.client.tsx', () => {
    describe('Props Interface', () => {
        it('should define PriceDisplayProps interface', () => {
            expect(reactContent).toContain('export interface PriceDisplayProps');
        });

        it('should require amountARS prop', () => {
            expect(reactContent).toContain('readonly amountARS: number');
        });

        it('should accept locale prop', () => {
            expect(reactContent).toContain("readonly locale?: 'es' | 'en' | 'pt'");
        });

        it('should accept userCurrency prop', () => {
            expect(reactContent).toContain("readonly userCurrency?: 'ARS' | 'USD' | 'BRL'");
        });

        it('should accept showDisclaimer prop', () => {
            expect(reactContent).toContain('readonly showDisclaimer?: boolean');
        });

        it('should accept className prop', () => {
            expect(reactContent).toContain('readonly className?: string');
        });

        it('should use readonly for all props', () => {
            const propsMatches = reactContent.match(/readonly \w+:/g);
            expect(propsMatches).toBeTruthy();
            expect(propsMatches!.length).toBeGreaterThan(0);
        });
    });

    describe('Named Export', () => {
        it('should export PriceDisplay as named function', () => {
            expect(reactContent).toContain('export function PriceDisplay');
        });

        it('should not use default export', () => {
            expect(reactContent).not.toContain('export default');
        });
    });

    describe('Conversion Rates', () => {
        it('should define FALLBACK_RATES constant', () => {
            expect(reactContent).toContain('const FALLBACK_RATES');
        });

        it('should define ARS rate as 1', () => {
            expect(reactContent).toContain('ARS: 1');
        });

        it('should define USD rate as 1000', () => {
            expect(reactContent).toContain('USD: 1000');
        });

        it('should define BRL rate as 200', () => {
            expect(reactContent).toContain('BRL: 200');
        });

        it('should use as const for immutability', () => {
            expect(reactContent).toContain('as const');
        });
    });

    describe('Exchange Rate Cache', () => {
        it('should define CACHE_KEY constant', () => {
            expect(reactContent).toContain('const CACHE_KEY');
        });

        it('should define CACHE_TTL_MS constant', () => {
            expect(reactContent).toContain('const CACHE_TTL_MS');
        });

        it('should implement readCachedRates function', () => {
            expect(reactContent).toContain('function readCachedRates');
        });

        it('should implement writeCachedRates function', () => {
            expect(reactContent).toContain('function writeCachedRates');
        });
    });

    describe('Dynamic Exchange Rate Fetching', () => {
        it('should implement fetchExchangeRates function', () => {
            expect(reactContent).toContain('async function fetchExchangeRates');
        });

        it('should implement resolveExchangeRates function', () => {
            expect(reactContent).toContain('async function resolveExchangeRates');
        });

        it('should fall back to FALLBACK_RATES on error', () => {
            expect(reactContent).toContain('return FALLBACK_RATES');
        });

        it('should use useEffect to load rates asynchronously', () => {
            expect(reactContent).toContain('useEffect');
            expect(reactContent).toContain('resolveExchangeRates');
        });

        it('should use useState to store conversion rates', () => {
            expect(reactContent).toContain('useState<ConversionRates>');
        });
    });

    describe('Currency Formatters', () => {
        it('should use toBcp47Locale for locale resolution', () => {
            expect(reactContent).toContain('toBcp47Locale(locale)');
            expect(reactContent).toContain('formatCurrency');
        });

        it('should use currency style via formatCurrency from @repo/i18n', () => {
            expect(reactContent).toContain('formatCurrency({');
            expect(reactContent).toContain('currency: resolvedCurrency');
        });
    });

    describe('Default Values', () => {
        it('should default locale to es', () => {
            expect(reactContent).toContain("locale = 'es'");
        });

        it('should default showDisclaimer to true', () => {
            expect(reactContent).toContain('showDisclaimer = true');
        });

        it('should default className to empty string', () => {
            expect(reactContent).toContain("className = ''");
        });
    });

    describe('JSDoc Documentation', () => {
        it('should have component-level JSDoc', () => {
            expect(reactContent).toContain('* PriceDisplay component');
        });

        it('should document example usage', () => {
            expect(reactContent).toContain('@example');
        });

        it('should document params', () => {
            expect(reactContent).toContain('@param props');
        });

        it('should document returns', () => {
            expect(reactContent).toContain('@returns');
        });
    });

    describe('Return Type', () => {
        it('should return JSX.Element', () => {
            expect(reactContent).toContain('): JSX.Element');
        });

        it('should import JSX type from react', () => {
            expect(reactContent).toContain("import type { JSX } from 'react'");
        });
    });

    describe('Structure', () => {
        it('should render span with price-display class', () => {
            expect(reactContent).toContain('className={`price-display');
        });

        it('should render price-value span', () => {
            expect(reactContent).toContain('className="price-value"');
        });

        it('should conditionally render disclaimer', () => {
            expect(reactContent).toContain('{shouldShowDisclaimer &&');
        });

        it('should apply className with trim', () => {
            expect(reactContent).toContain('.trim()');
        });
    });

    describe('Disclaimer Styling', () => {
        it('should have disclaimer with block display', () => {
            expect(reactContent).toContain('block');
        });

        it('should have disclaimer with top margin', () => {
            expect(reactContent).toContain('mt-1');
        });

        it('should have disclaimer with small text', () => {
            expect(reactContent).toContain('text-xs');
        });

        it('should have disclaimer with gray color', () => {
            expect(reactContent).toContain('text-text-tertiary');
        });
    });
});
