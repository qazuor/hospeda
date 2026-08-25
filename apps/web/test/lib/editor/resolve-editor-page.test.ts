import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadAccommodationEditorData = vi.fn();
const findEditorSectionBySlug = vi.fn();

vi.mock('@/lib/api/accommodation-editor-data', () => ({
    loadAccommodationEditorData: (args: unknown) => loadAccommodationEditorData(args)
}));

vi.mock('@/lib/editor/accommodation-editor-sections', () => ({
    findEditorSectionBySlug: (args: unknown) => findEditorSectionBySlug(args)
}));

vi.mock('@/lib/middleware-helpers', () => ({
    buildLoginRedirect: ({ locale, currentUrl }: { locale: string; currentUrl: string }) =>
        `/${locale}/auth/signin?redirectTo=${encodeURIComponent(currentUrl)}`
}));

vi.mock('@/lib/urls', () => ({
    buildUrl: ({ locale, path }: { locale: string; path: string }) => `/${locale}/${path}`
}));

const { resolveEditorPage } = await import('@/lib/editor/resolve-editor-page');

const COOKIE = 'better-auth.session_token=abc123';

function okEditorData() {
    return {
        accommodation: { name: 'Casa del Sol' },
        destinations: [],
        amenities: [],
        features: [],
        translations: null,
        featuredImage: null,
        gallery: [],
        faqs: [{ id: 'faq-1', question: 'Check-in', answer: '14:00' }]
    };
}

function createAstro({
    cookieHeader = COOKIE,
    user = { id: 'user-1' },
    accommodationId = 'acc-1'
}: {
    readonly cookieHeader?: string | null;
    readonly user?: Record<string, string> | null;
    readonly accommodationId?: string;
} = {}) {
    const redirects: string[] = [];

    return {
        astro: {
            locals: {
                locale: 'es',
                user
            },
            url: new URL(
                `https://example.com/es/mi-cuenta/propiedades/${accommodationId}/editar/preguntas/`
            ),
            params: { id: accommodationId },
            request: {
                headers: new Headers(cookieHeader ? { cookie: cookieHeader } : {})
            },
            redirect: (location: string) => {
                redirects.push(location);
                return new Response(null, { status: 302, headers: { Location: location } });
            }
        },
        redirects
    };
}

describe('resolveEditorPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findEditorSectionBySlug.mockReturnValue({ id: 'faqs' });
        loadAccommodationEditorData.mockResolvedValue({ status: 'ok', data: okEditorData() });
    });

    it('forwards the SSR cookie header when resolving the FAQ editor route (HOS-786)', async () => {
        const { astro } = createAstro();

        const result = await resolveEditorPage({
            astro: astro as never,
            sectionSlug: 'preguntas',
            need: ['faqs']
        });

        expect(loadAccommodationEditorData).toHaveBeenCalledWith({
            accommodationId: 'acc-1',
            cookieHeader: COOKIE,
            need: ['faqs']
        });
        expect(result).toMatchObject({
            accommodationId: 'acc-1',
            sectionId: 'faqs'
        });
    });

    it('passes undefined when the request carries no cookie header', async () => {
        const { astro } = createAstro({ cookieHeader: null });

        await resolveEditorPage({
            astro: astro as never,
            sectionSlug: 'preguntas',
            need: ['faqs']
        });

        expect(loadAccommodationEditorData).toHaveBeenCalledWith({
            accommodationId: 'acc-1',
            cookieHeader: undefined,
            need: ['faqs']
        });
    });
});
