import type { SeoType } from '@repo/types';

/**
 * Returns mock admin info for testing purposes.
 * @param overrides - Fields to override in the mock.
 * @returns AdminInfo object
 */
export const getMockAdminInfo = (
    overrides: Partial<{ notes: string; favorite: boolean }> = {}
) => ({
    notes: 'Notas para administración',
    favorite: false,
    ...overrides
});

/**
 * Returns mock SEO information for testing purposes.
 * @param overrides - Fields to override in the mock.
 * @returns SeoType object
 */
export const getMockSeo = (overrides: Partial<SeoType> = {}) => ({
    title: 'Título SEO válido para test (máx 60)',
    description:
        'Descripción SEO suficientemente larga para pasar la validación de Zod. Debe tener más de 70 caracteres para que pase.',
    keywords: ['test', 'seo', 'keywords'] as string[],
    ...overrides
});
