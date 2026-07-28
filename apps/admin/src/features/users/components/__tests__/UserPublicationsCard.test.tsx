// @vitest-environment jsdom

import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event } from '@/features/events/schemas/events.schemas';
import type { Post } from '@/features/posts/schemas/posts.schemas';
import { fetchApi } from '@/lib/api/client';
import { UserPublicationsCard } from '../UserPublicationsCard';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            }
        }
    });

    return function Wrapper({ children }: { readonly children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
}

function createPost(overrides: Partial<Post> = {}): Post {
    return {
        id: 'post-1',
        title: 'Guía del río',
        summary: 'Una guía corta',
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE',
        authorName: 'Editor Uno',
        ...overrides
    } as unknown as Post;
}

function createEvent(overrides: Partial<Event> = {}): Event {
    return {
        id: 'event-1',
        name: 'Festival del río',
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE',
        organizerName: 'Secretaría de Cultura',
        locationName: 'Predio Multieventos',
        ...overrides
    } as unknown as Event;
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('UserPublicationsCard', () => {
    it('renders events and posts associated to the user', async () => {
        mockedFetchApi.mockImplementation(async ({ path }) => {
            if (typeof path === 'string' && path.startsWith('/api/v1/admin/events?')) {
                return {
                    data: {
                        success: true,
                        data: {
                            items: [createEvent()],
                            pagination: { total: 1 }
                        }
                    }
                } as Awaited<ReturnType<typeof fetchApi>>;
            }

            if (typeof path === 'string' && path.startsWith('/api/v1/admin/posts?')) {
                return {
                    data: {
                        success: true,
                        data: {
                            items: [createPost()],
                            pagination: { total: 1 }
                        }
                    }
                } as Awaited<ReturnType<typeof fetchApi>>;
            }

            throw new Error(`Unexpected path in test: ${String(path)}`);
        });

        render(
            <UserPublicationsCard
                userId="user-1"
                permissions={[
                    PermissionEnum.EVENT_VIEW_ALL,
                    PermissionEnum.EVENT_UPDATE,
                    PermissionEnum.POST_VIEW_ALL,
                    PermissionEnum.POST_UPDATE
                ]}
            />,
            { wrapper: createWrapper() }
        );

        await waitFor(() => {
            expect(screen.getByText('Festival del río')).toBeInTheDocument();
            expect(screen.getByText('Guía del río')).toBeInTheDocument();
        });

        expect(screen.getByText('admin-pages.access.users.publications.title')).toBeInTheDocument();
        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/events?authorId=user-1&pageSize=100&sort=createdAt%3Adesc'
            })
        );
        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/posts?authorId=user-1&pageSize=100&sort=createdAt%3Adesc'
            })
        );
    });

    it('renders the empty state when the user has no events or posts', async () => {
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: {
                    items: [],
                    pagination: { total: 0 }
                }
            }
        } as Awaited<ReturnType<typeof fetchApi>>);

        render(
            <UserPublicationsCard
                userId="user-1"
                permissions={[PermissionEnum.EVENT_VIEW_ALL, PermissionEnum.POST_VIEW_ALL]}
            />,
            { wrapper: createWrapper() }
        );

        await waitFor(() => {
            expect(
                screen.getByText('admin-pages.access.users.publications.empty')
            ).toBeInTheDocument();
        });
    });

    it('stays hidden when the actor cannot view events or posts', () => {
        render(
            <UserPublicationsCard
                userId="user-1"
                permissions={[]}
            />,
            { wrapper: createWrapper() }
        );

        expect(
            screen.queryByText('admin-pages.access.users.publications.title')
        ).not.toBeInTheDocument();
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });
});
