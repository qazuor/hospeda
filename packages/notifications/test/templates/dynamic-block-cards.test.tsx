import { render } from '@react-email/components';
import { describe, expect, it } from 'vitest';
import {
    DynamicBlockCards,
    type NewsletterDynamicCard,
    type NewsletterResolvedBlock,
    truncateSummary
} from '../../src/templates/newsletter/dynamic-block-cards.js';

const card: NewsletterDynamicCard = {
    name: 'Casa & río',
    summary: 'A quiet stay',
    imageUrl: 'https://example.com/cover.jpg',
    url: 'https://example.com/es/alojamientos/casa/'
};
const block: NewsletterResolvedBlock = {
    blockKey: 'block-one',
    hidden: false,
    itemIds: ['second', 'first'],
    cards: { first: { es: { ...card, name: 'First' } }, second: { es: card } }
};

describe('DynamicBlockCards', () => {
    it('renders every selected card in itemIds order with cell-based styling', async () => {
        const html = await render(
            <DynamicBlockCards
                block={block}
                locale="es"
            />
        );
        expect(html.match(/data-newsletter-card=/g)).toHaveLength(2);
        expect(html.indexOf('Casa &amp; río')).toBeLessThan(html.indexOf('First'));
        expect(html).toContain('border:1px solid');
        expect(html).toContain('border-radius:8px');
        expect(html).toContain('class="hd-tint"');
        expect(html).toContain('width="160"');
        expect(html).toContain('https://example.com/cover.jpg');
        expect(html).not.toMatch(/display:(flex|grid)/);
    });

    it.each([
        ['es', 'Ver alojamiento'],
        ['en', 'View accommodation'],
        ['pt', 'Ver hospedagem']
    ] as const)('localizes the CTA in %s and falls back to Spanish card content', async (locale, cta) => {
        const html = await render(
            <DynamicBlockCards
                block={block}
                locale={locale}
            />
        );
        expect(html).toContain(cta);
        expect(html).toContain('Casa &amp; río');
    });

    it('uses translated content and falls back for empty translated fields', async () => {
        const translated = {
            ...block,
            itemIds: ['first'],
            cards: {
                first: { es: card, en: { ...card, name: '', summary: 'English summary' } }
            }
        };
        const html = await render(
            <DynamicBlockCards
                block={translated}
                locale="en"
            />
        );
        expect(html).toContain('Casa &amp; río');
        expect(html).toContain('English summary');
    });

    it.each([
        'http://example.com/a.jpg',
        'javascript:alert(1)',
        'data:image/png;base64,AA',
        '//example.com/a.jpg',
        'invalid',
        null
    ])('omits unsafe image %s and escapes text', async (imageUrl) => {
        const unsafe = {
            ...block,
            itemIds: ['first'],
            cards: {
                first: {
                    es: {
                        ...card,
                        imageUrl,
                        name: '<script>alert(1)</script>',
                        summary: '<b>Not HTML</b>',
                        url: 'javascript:alert(1)'
                    }
                }
            }
        };
        const html = await render(
            <DynamicBlockCards
                block={unsafe}
                locale="es"
            />
        );
        expect(html).not.toContain('<img');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('javascript:');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&lt;b&gt;Not HTML&lt;/b&gt;');
    });

    it('renders a compact row: cover cell beside the text, a text link and no button', async () => {
        const html = await render(
            <DynamicBlockCards
                block={{ ...block, itemIds: ['first'] }}
                locale="es"
            />
        );
        expect(html.indexOf('https://example.com/cover.jpg')).toBeLessThan(html.indexOf('First'));
        expect(html).toContain('data-utm-content="dynamic-card"');
        expect(html).toContain('data-utm-content="dynamic-card-image"');
        expect(html).toContain('Ver alojamiento →');
        expect(html).not.toContain('hospeda-btn');
    });

    it('drops the cover cell entirely when there is no safe image', async () => {
        const html = await render(
            <DynamicBlockCards
                block={{
                    ...block,
                    itemIds: ['first'],
                    cards: { first: { es: { ...card, imageUrl: null } } }
                }}
                locale="es"
            />
        );
        expect(html).not.toContain('width="160"');
        expect(html).toContain('Ver alojamiento →');
    });

    it.each([
        ['keeps a short summary', 'A quiet stay', 'A quiet stay'],
        ['collapses whitespace', '  A   quiet\n stay ', 'A quiet stay']
    ])('truncateSummary %s', (_label, text, expected) => {
        expect(truncateSummary({ text })).toBe(expected);
    });

    it('truncateSummary cuts a long summary at a word boundary with an ellipsis', () => {
        const text = `${'palabra '.repeat(30)}final`;
        const result = truncateSummary({ text });
        expect(result.length).toBeLessThanOrEqual(111);
        expect(result.endsWith('palabra…')).toBe(true);
    });

    it('renders nothing for hidden or empty blocks', () => {
        expect(DynamicBlockCards({ block: { ...block, hidden: true }, locale: 'es' })).toBeNull();
        expect(DynamicBlockCards({ block: { ...block, itemIds: [] }, locale: 'es' })).toBeNull();
    });
});
