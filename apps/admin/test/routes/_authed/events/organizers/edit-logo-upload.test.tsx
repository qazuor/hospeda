import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as mod from '../../../../../src/routes/_authed/events/organizers/$id_.edit';

const uploadEntityImageMutateAsync = vi.fn().mockResolvedValue({
    url: 'https://cdn.example.com/organizer-logo.jpg',
    publicId: 'event-organizer/logo',
    width: 512,
    height: 512
});

vi.mock('@/hooks/use-media-upload', async () => {
    const actual = await vi.importActual<typeof import('@/hooks/use-media-upload')>(
        '@/hooks/use-media-upload'
    );
    return {
        ...actual,
        useMediaUpload: () => ({
            uploadEntityImage: { mutateAsync: uploadEntityImageMutateAsync },
            deleteImage: { mutateAsync: vi.fn() },
            isUploading: false,
            uploadError: null,
            isDeleting: false
        })
    };
});

type CapturedFieldHandlers = Record<string, { onUpload: (file: File) => Promise<string> }>;

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

vi.mock('@/features/event-organizers/hooks/useEventOrganizerPage', () => ({
    useEventOrganizerPage: () => ({ entity: null, isLoading: false, error: null, permissions: {} })
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

describe('Route /_authed/events/organizers/$id_/edit', () => {
    it('wires the logo field to organizerLogo uploads', async () => {
        const Page = (mod.Route as unknown as { options: { component: React.ComponentType } })
            .options.component;

        render(<Page />);

        const handlers = capturedFieldHandlers as CapturedFieldHandlers | undefined;
        if (!handlers) throw new Error('fieldHandlers was not forwarded to EntityEditContent');
        expect(handlers.logo).toBeDefined();

        const file = new File(['x'], 'logo.jpg', { type: 'image/jpeg' });
        const url = await handlers.logo.onUpload(file);

        expect(url).toBe('https://cdn.example.com/organizer-logo.jpg');
        expect(uploadEntityImageMutateAsync).toHaveBeenCalledWith({
            file,
            entityType: 'eventOrganizer',
            entityId: '550e8400-e29b-41d4-a716-446655440000',
            role: 'organizerLogo'
        });
    });
});
