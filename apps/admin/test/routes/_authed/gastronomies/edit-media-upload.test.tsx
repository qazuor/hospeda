import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as mod from '../../../../src/routes/_authed/gastronomies/$id_.edit';

const uploadEntityImageMutateAsync = vi.fn().mockResolvedValue({
    url: 'https://cdn.example.com/gastronomy.jpg',
    publicId: 'gastronomy/public-id',
    width: 1024,
    height: 768
});
const deleteImageMutateAsync = vi.fn().mockResolvedValue({
    deleted: true,
    publicId: 'gastronomy/public-id'
});

vi.mock('@/hooks/use-media-upload', async () => {
    const actual = await vi.importActual<typeof import('@/hooks/use-media-upload')>(
        '@/hooks/use-media-upload'
    );
    return {
        ...actual,
        useMediaUpload: () => ({
            uploadEntityImage: { mutateAsync: uploadEntityImageMutateAsync },
            deleteImage: { mutateAsync: deleteImageMutateAsync },
            isUploading: false,
            uploadError: null,
            isDeleting: false
        })
    };
});

type CapturedFieldHandlers = Record<
    string,
    { onUpload: (file: File) => Promise<string>; onDelete: (publicId: string) => Promise<void> }
>;

let capturedFieldHandlers: CapturedFieldHandlers | undefined;

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
    it('wires featured and gallery fields to gastronomy media uploads', async () => {
        const Page = (mod.Route as unknown as { options: { component: React.ComponentType } })
            .options.component;

        render(<Page />);

        const handlers = capturedFieldHandlers as CapturedFieldHandlers | undefined;
        if (!handlers) throw new Error('fieldHandlers was not forwarded to EntityEditContent');

        const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });
        await handlers['media.featuredImage'].onUpload(file);
        await handlers['media.gallery'].onUpload(file);

        expect(uploadEntityImageMutateAsync).toHaveBeenNthCalledWith(1, {
            file,
            entityType: 'gastronomy',
            entityId: '550e8400-e29b-41d4-a716-446655440000',
            role: 'featured'
        });
        expect(uploadEntityImageMutateAsync).toHaveBeenNthCalledWith(2, {
            file,
            entityType: 'gastronomy',
            entityId: '550e8400-e29b-41d4-a716-446655440000',
            role: 'gallery'
        });

        await handlers['media.gallery'].onDelete('gastronomy/public-id');
        expect(deleteImageMutateAsync).toHaveBeenCalledWith({ publicId: 'gastronomy/public-id' });
    });
});
