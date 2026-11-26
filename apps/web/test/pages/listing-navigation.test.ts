import { expect, it } from 'vitest';

it('switches or clears only the accommodation type and starts at page one', async () => {
    const { buildAccommodationTypeChipHref } = await import('@/lib/listing-navigation');
    const searchParams = new URLSearchParams(
        'q=cabaña&minPrice=10000&sortBy=priceAsc&types=APARTMENT&type=APARTMENT&page=3&tag=a&tag=b'
    );

    for (const path of ['/es/alojamientos/tipo/casa/', '/es/alojamientos/']) {
        const href = buildAccommodationTypeChipHref({ path, searchParams });
        const next = new URL(href, 'https://example.test');

        expect(next.pathname).toBe(path);
        expect([...next.searchParams]).toEqual([
            ['q', 'cabaña'],
            ['minPrice', '10000'],
            ['sortBy', 'priceAsc'],
            ['tag', 'a'],
            ['tag', 'b']
        ]);
    }
    expect(searchParams.get('page')).toBe('3');
});

it('round-trips repeated filters through GET form data and applies the new sort on page one', async () => {
    const { buildListingSortForm } = await import('@/lib/listing-navigation');
    const url = new URL(
        'https://example.test/es/alojamientos/tipo/casa/page/3/?page=3&q=cabaña&amenities=one&amenities=two&sortBy=priceAsc&sortOrder=asc'
    );
    const options = [{ value: 'featured' }, { value: 'priceAsc' }, { value: 'priceDesc' }];
    const { path, carried, currentSort } = buildListingSortForm({ url, options });
    const form = document.createElement('form');
    form.method = 'get';
    form.action = new URL(path, url).href;
    for (const [name, value] of carried) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.append(input);
    }
    const select = document.createElement('select');
    select.name = 'sortBy';
    for (const { value } of options) select.add(new Option(value, value));
    select.value = currentSort ?? '';
    form.append(select);
    expect(select.value).toBe('priceAsc');

    select.value = 'priceDesc';
    const next = new URL(form.action);
    for (const [key, value] of new FormData(form)) next.searchParams.append(key, String(value));

    expect(next.pathname).toBe('/es/alojamientos/tipo/casa/');
    expect([...next.searchParams]).toEqual([
        ['q', 'cabaña'],
        ['amenities', 'one'],
        ['amenities', 'two'],
        ['sortBy', 'priceDesc']
    ]);
    expect(buildListingSortForm({ url: next, options }).currentSort).toBe('priceDesc');
});
