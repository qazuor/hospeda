/**
 * @file Event Edit Route — media upload wiring test
 *
 * SPEC-078-GAPS T-038 / GAP-078-018: verifies the event edit page wires
 * the shared media upload hook and forwards a `fieldHandlers` prop to
 * EntityEditContent with an `images.onUpload` that calls
 * `uploadEntityImage.mutateAsync` with `entityType: 'event'`.
 */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as mod from '../../../../src/routes/_authed/events/$id_.edit';

// -- Mocks ------------------------------------------------------------------

const uploadEntityImageMutateAsync = vi.fn().mockResolvedValue({
    url: 'https://cdn.example.com/event.jpg',
    publicId: 'event/public-id',
    width: 1024,
    height: 768
});
const deleteImageMutateAsync = vi.fn().mockResolvedValue({
    deleted: true,
    publicId: 'event/public-id'
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

vi.mock('@/features/events/hooks/useEventPage', () => ({
    useEventPage: () => ({
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

describe('Route /_authed/events/$id_/edit', () => {
    it("wires EntityEditContent with fieldHandlers that upload as entityType='event'", async () => {
        const Page = (mod.Route as unknown as { options: { component: React.ComponentType } })
            .options.component;

        render(<Page />);

        const handlers = capturedFieldHandlers as CapturedFieldHandlers | undefined;
        if (!handlers) throw new Error('fieldHandlers was not forwarded to EntityEditContent');
        expect(handlers.images).toBeDefined();

        const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });
        const url = await handlers.images.onUpload(file);

        expect(url).toBe('https://cdn.example.com/event.jpg');
        expect(uploadEntityImageMutateAsync).toHaveBeenCalledTimes(1);
        expect(uploadEntityImageMutateAsync).toHaveBeenCalledWith({
            file,
            entityType: 'event',
            entityId: '550e8400-e29b-41d4-a716-446655440000',
            role: 'gallery'
        });

        await handlers.images.onDelete('event/public-id');
        expect(deleteImageMutateAsync).toHaveBeenCalledWith({
            publicId: 'event/public-id'
        });
    });
});
