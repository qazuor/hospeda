/**
 * @file Post Edit Route — media upload wiring test
 *
 * SPEC-078-GAPS T-038 / GAP-078-004: verifies the post edit page wires
 * the shared media upload hook and forwards `media.featuredImage` and
 * `media.gallery` handlers to EntityEditContent.
 */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as mod from '../../../../src/routes/_authed/posts/$id_.edit';

// -- Mocks ------------------------------------------------------------------

const uploadEntityImageMutateAsync = vi.fn().mockResolvedValue({
    url: 'https://cdn.example.com/post.jpg',
    publicId: 'post/public-id',
    width: 1024,
    height: 768
});
const deleteImageMutateAsync = vi.fn().mockResolvedValue({
    deleted: true,
    publicId: 'post/public-id'
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
    {
        onUpload: (file: File) => Promise<string>;
        onDelete: (publicId: string) => Promise<void>;
    }
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

vi.mock('@/components/RevalidateEntityButton', () => ({
    RevalidateEntityButton: () => null
}));

vi.mock('@/features/posts/hooks/usePostPage', () => ({
    usePostPage: () => ({
        entity: null,
        isLoading: false,
        error: null,
        permissions: {}
    })
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

// -- Test -------------------------------------------------------------------

describe('Route /_authed/posts/$id_/edit', () => {
    it("wires EntityEditContent with fieldHandlers that upload as entityType='post'", async () => {
        const Page = (mod.Route as unknown as { options: { component: React.ComponentType } })
            .options.component;

        render(<Page />);

        const handlers = capturedFieldHandlers as CapturedFieldHandlers | undefined;
        if (!handlers) throw new Error('fieldHandlers was not forwarded to EntityEditContent');
        expect(handlers['media.featuredImage']).toBeDefined();
        expect(handlers['media.gallery']).toBeDefined();

        const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });
        const featuredUrl = await handlers['media.featuredImage'].onUpload(file);
        const galleryUrl = await handlers['media.gallery'].onUpload(file);

        expect(featuredUrl).toBe('https://cdn.example.com/post.jpg');
        expect(galleryUrl).toBe('https://cdn.example.com/post.jpg');
        expect(uploadEntityImageMutateAsync).toHaveBeenCalledTimes(2);
        expect(uploadEntityImageMutateAsync).toHaveBeenNthCalledWith(1, {
            file,
            entityType: 'post',
            entityId: '550e8400-e29b-41d4-a716-446655440000',
            role: 'featured'
        });
        expect(uploadEntityImageMutateAsync).toHaveBeenNthCalledWith(2, {
            file,
            entityType: 'post',
            entityId: '550e8400-e29b-41d4-a716-446655440000',
            role: 'gallery'
        });

        await handlers['media.gallery'].onDelete('post/public-id');
        expect(deleteImageMutateAsync).toHaveBeenCalledWith({
            publicId: 'post/public-id'
        });
    });
});
