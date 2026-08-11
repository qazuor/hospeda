import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as mod from '../../../../src/routes/_authed/gastronomies/$id_.edit';

/**
 * HOS-382 regression test.
 *
 * This file used to assert that the gastronomy edit page wired
 * `media.featuredImage` / `media.gallery` field handlers to Cloudinary
 * uploads. That wiring was the bug: `media` is not a writable key on
 * `GastronomyUpdateInputSchema` (the `media` JSONB column was dropped —
 * HOS-372), so the schema silently stripped it on every PATCH. Every photo
 * uploaded through those fields reached Cloudinary but never got a DB row —
 * a permanently-billed orphan. Photos are now managed exclusively via the
 * relational Gallery tab (`CommerceGalleryManager`,
 * `/gastronomies/:id/gallery`), so this test now guards the opposite: the
 * edit page must NEVER forward `fieldHandlers` to `EntityEditContent` again.
 */

type CapturedFieldHandlers =
    | Record<
          string,
          {
              onUpload: (file: File) => Promise<string>;
          }
      >
    | undefined;

let capturedFieldHandlers: CapturedFieldHandlers;

vi.mock('@/components/entity-pages/EntityEditContent', () => ({
    EntityEditContent: (props: { fieldHandlers?: CapturedFieldHandlers }) => {
        capturedFieldHandlers = props.fieldHandlers;
        return <div data-testid="entity-edit-content" />;
    }
}));

vi.mock('@/components/entity-pages/EntityPageBase', () => ({
    EntityPageBase: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('@/components/auth/RoutePermissionGuard', () => ({
    RoutePermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('@/components/faqs/FaqManager', () => ({ FaqManager: () => null }));
vi.mock('@/components/ui-wrapped', () => ({
    Tabs: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TabsList: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TabsTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TabsContent: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
// PageTabs is stubbed rather than mocking `@tanstack/react-router`'s
// `useLocation`/`Link` (the router mock below only provides `createFileRoute`).
vi.mock('@/components/layout/PageTabs', () => ({
    PageTabs: () => <div data-testid="page-tabs" />,
    gastronomyTabs: []
}));
vi.mock('@/features/gastronomy', () => ({
    useGastronomyPage: () => ({ entity: null, isLoading: false, error: null, permissions: {} })
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));
vi.mock('@/lib/factories', () => ({
    createErrorComponent: () => () => null,
    createPendingComponent: () => () => null
}));
vi.mock('@tanstack/react-router', () => ({
    createFileRoute:
        (_path: string) =>
        <T extends Record<string, unknown>>(options: T) => ({
            options,
            useParams: () => ({ id: '550e8400-e29b-41d4-a716-446655440000' })
        })
}));

describe('Route /_authed/gastronomies/$id_/edit', () => {
    it('HOS-382: no longer forwards media.featuredImage / media.gallery field handlers', async () => {
        const Page = (mod.Route as unknown as { options: { component: React.ComponentType } })
            .options.component;

        const { getByTestId } = render(<Page />);

        // Positive control: EntityEditContent must have actually mounted, or the
        // `capturedFieldHandlers` assertion below is vacuously true (undefined
        // because nothing ran, not because the page stopped forwarding it).
        expect(getByTestId('entity-edit-content')).toBeInTheDocument();

        // Sub-tab navigation guard: the edit page must render PageTabs (mocked
        // above) so the Gallery tab stays reachable from the edit view.
        expect(getByTestId('page-tabs')).toBeInTheDocument();

        // The bug: this used to be a populated map with 'media.featuredImage' and
        // 'media.gallery' keys that quietly buffered uploads into a `media`
        // object the update schema then stripped. It must now be undefined.
        expect(capturedFieldHandlers).toBeUndefined();
    });
});
