// @vitest-environment jsdom
/**
 * Tests for ChecklistWidget component (SPEC-155 T-026).
 *
 * Strategy:
 * - Mock `useDashboardResolver` to return a stub `resolveForScope`.
 * - Wrap each render in a minimal `QueryClientProvider` so `useQuery` works.
 * - For client-side mode, supply entities directly via `widget.config.entities`
 *   (no source id) and verify computed items.
 * - For resolver mode, configure `resolveForScope` to return found/not-found
 *   options and control loading/error/data states.
 *
 * Covers:
 * - accommodation-health: computes items from entity, shows done/missing icons.
 * - accommodation-health: completeness indicator (fraction + %) updates correctly.
 * - accommodation-health: multi-accommodation → selector shown; selecting switches list.
 * - accommodation-health: single accommodation → no selector rendered.
 * - host-profile-health: computes items from host profile entity.
 * - content-health: computes items from post entity + event entity.
 * - Loading state (resolver mode, never-resolving query).
 * - Error state + retry button.
 * - Empty state (null data from resolver OR empty entities).
 * - Unavailable state when source provided but not registered.
 *
 * References: SPEC-155 T-026
 */

import type { Widget } from '@/config/ia/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    AccommodationEntity,
    EventEntity,
    HostProfileEntity,
    PostEntity
} from '../ChecklistWidget';
import { ChecklistWidget } from '../ChecklistWidget';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockResolveForScope = vi.fn();

vi.mock('@/contexts/dashboard-resolver-context', () => ({
    useDashboardResolver: () => ({
        resolveForScope: mockResolveForScope,
        buildContextForScope: vi.fn(),
        role: 'HOST',
        isAuthenticated: true
    })
}));

// Mock icon components so tests don't depend on Phosphor bundle.
vi.mock('@repo/icons', () => ({
    AlertTriangleIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="alert-triangle-icon"
            className={className}
            aria-hidden="true"
        />
    ),
    CheckCircleIcon: ({
        className,
        'data-testid': dtid
    }: { className?: string; 'data-testid'?: string }) => (
        <svg
            data-testid={dtid ?? 'check-circle-icon'}
            className={className}
            aria-hidden="true"
        />
    ),
    AlertCircleIcon: ({
        className,
        'data-testid': dtid
    }: { className?: string; 'data-testid'?: string }) => (
        <svg
            data-testid={dtid ?? 'alert-circle-icon'}
            className={className}
            aria-hidden="true"
        />
    ),
    // Select icons (used in SelectTrigger, SelectItem)
    CheckIcon: ({ className }: { className?: string }) => (
        <svg
            className={className}
            aria-hidden="true"
        />
    ),
    ChevronDownIcon: ({ className }: { className?: string }) => (
        <svg
            className={className}
            aria-hidden="true"
        />
    ),
    ChevronUpIcon: ({ className }: { className?: string }) => (
        <svg
            className={className}
            aria-hidden="true"
        />
    )
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                refetchOnWindowFocus: false,
                refetchOnMount: false
            }
        }
    });
}

function TestWrapper({ children }: { readonly children: ReactNode }) {
    const queryClient = makeQueryClient();
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** Minimal Widget fixture for checklist type. */
function makeWidget(overrides: Partial<Widget> = {}): Widget {
    return {
        id: 'test-checklist',
        type: 'checklist',
        label: {
            es: 'Estado del alojamiento',
            en: 'Accommodation health',
            pt: 'Saúde do alojamento'
        },
        scope: 'own',
        onMissing: 'disable',
        config: { checkset: 'accommodation-health' },
        ...overrides
    };
}

/** Stub resolver options that immediately return the given data. */
function stubQueryOptions(data: unknown) {
    return {
        queryKey: ['dashboard', 'test', 'HOST', 'own'],
        queryFn: () => Promise.resolve(data),
        staleTime: 60_000
    };
}

/** Stub resolver options whose queryFn always rejects. */
function stubErrorOptions() {
    return {
        queryKey: ['dashboard', 'error', 'HOST', 'own'],
        queryFn: () => Promise.reject(new Error('fetch failed')),
        staleTime: 60_000
    };
}

/**
 * Noop resolver — used when no source is configured (client-side mode).
 * `found: false` with enabled: false prevents any fetch.
 */
function noopResolver() {
    mockResolveForScope.mockReturnValue({
        found: false,
        options: {
            queryKey: ['dashboard', '__noop__', 'HOST', 'own'],
            queryFn: () => Promise.resolve(null),
            staleTime: Number.POSITIVE_INFINITY,
            enabled: false
        }
    });
}

// ---------------------------------------------------------------------------
// Sample entities
// ---------------------------------------------------------------------------

const fullAccommodation: AccommodationEntity = {
    id: 'acc-1',
    name: 'Casa de campo',
    photos: [{ url: 'photo.jpg' }],
    description: 'Una hermosa casa rodeada de naturaleza.',
    amenities: [{ id: 'wifi' }],
    price: 5000,
    latitude: -32.5,
    longitude: -58.2,
    contactPhone: '+54 123 456 789'
};

const partialAccommodation: AccommodationEntity = {
    id: 'acc-2',
    name: 'Departamento céntrico',
    photos: [], // missing
    description: '', // missing
    amenities: [], // missing
    price: 0, // missing
    latitude: null, // missing
    longitude: null, // missing
    contactPhone: null, // missing
    contactEmail: null // missing
};

const fullHostProfile: HostProfileEntity = {
    id: 'host-1',
    name: 'María García',
    avatarUrl: 'https://example.com/avatar.jpg',
    bio: 'Anfitriona desde 2020.',
    phone: '+54 123 456',
    socialLink: 'https://instagram.com/maria',
    emailVerified: true
};

const partialHostProfile: HostProfileEntity = {
    id: 'host-2',
    name: '', // missing
    avatarUrl: null, // missing
    bio: null, // missing
    phone: null, // missing
    socialLink: null, // missing
    emailVerified: false // missing
};

const postWithIssues: PostEntity = {
    id: 'post-1',
    title: 'Artículo sin imagen',
    featuredImage: null, // missing
    tags: [], // missing
    seoTitle: null // missing
};

const eventWithIssues: EventEntity = {
    id: 'event-1',
    title: 'Evento sin lugar',
    featuredImage: 'img.jpg',
    locationId: null, // missing
    organizerId: null, // missing
    description: null // missing
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChecklistWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Client-side mode (no source, entities via config) ──────────────────

    describe('accommodation-health (client-side)', () => {
        it('renders the checklist card with label', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'accommodation-health',
                                entities: [fullAccommodation]
                            }
                        })}
                    />
                </TestWrapper>
            );

            expect(screen.getByTestId('checklist-widget')).toBeInTheDocument();
            expect(screen.getByTestId('checklist-label')).toHaveTextContent(
                'Estado del alojamiento'
            );
        });

        it('computes 6/6 done for a fully-filled accommodation', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'accommodation-health',
                                entities: [fullAccommodation]
                            }
                        })}
                    />
                </TestWrapper>
            );

            expect(screen.getByTestId('checklist-completeness-fraction')).toHaveTextContent(
                '6/6 completado'
            );
            expect(screen.getByTestId('checklist-completeness-pct')).toHaveTextContent('100%');
        });

        it('computes 0/6 done for a fully-empty accommodation', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'accommodation-health',
                                entities: [partialAccommodation]
                            }
                        })}
                    />
                </TestWrapper>
            );

            expect(screen.getByTestId('checklist-completeness-fraction')).toHaveTextContent(
                '0/6 completado'
            );
            expect(screen.getByTestId('checklist-completeness-pct')).toHaveTextContent('0%');
        });

        it('shows done icon for completed items', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'accommodation-health',
                                entities: [fullAccommodation]
                            }
                        })}
                    />
                </TestWrapper>
            );

            // photos item should be done
            const photosRow = screen.getByTestId('checklist-item-photos');
            expect(within(photosRow).getByTestId('checklist-icon-done-photos')).toBeInTheDocument();
        });

        it('shows missing icon for incomplete items', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'accommodation-health',
                                entities: [partialAccommodation]
                            }
                        })}
                    />
                </TestWrapper>
            );

            // photos item should be missing
            const photosRow = screen.getByTestId('checklist-item-photos');
            expect(
                within(photosRow).getByTestId('checklist-icon-missing-photos')
            ).toBeInTheDocument();
        });

        it('does NOT render the accommodation selector when only 1 accommodation', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'accommodation-health',
                                entities: [fullAccommodation]
                            }
                        })}
                    />
                </TestWrapper>
            );

            expect(
                screen.queryByTestId('checklist-accommodation-selector')
            ).not.toBeInTheDocument();
        });

        it('renders the accommodation selector when > 1 accommodation', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'accommodation-health',
                                entities: [fullAccommodation, partialAccommodation]
                            }
                        })}
                    />
                </TestWrapper>
            );

            expect(screen.getByTestId('checklist-accommodation-selector')).toBeInTheDocument();
        });

        it('shows 6/6 for the first accommodation by default (selector default)', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'accommodation-health',
                                entities: [fullAccommodation, partialAccommodation]
                            }
                        })}
                    />
                </TestWrapper>
            );

            // First accommodation (fullAccommodation) should be selected by default.
            expect(screen.getByTestId('checklist-completeness-fraction')).toHaveTextContent(
                '6/6 completado'
            );
        });

        it('updates checklist after selecting a different accommodation via the trigger', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'accommodation-health',
                                entities: [fullAccommodation, partialAccommodation]
                            }
                        })}
                    />
                </TestWrapper>
            );

            // Initially showing full accommodation (6/6)
            expect(screen.getByTestId('checklist-completeness-fraction')).toHaveTextContent(
                '6/6 completado'
            );

            // Open the selector and pick the partial accommodation
            const trigger = screen.getByRole('combobox');
            fireEvent.click(trigger);

            // Select second option (partialAccommodation)
            const option = screen.getByText('Departamento céntrico');
            fireEvent.click(option);

            // Should now show 0/6
            expect(screen.getByTestId('checklist-completeness-fraction')).toHaveTextContent(
                '0/6 completado'
            );
        });
    });

    // ── host-profile-health ────────────────────────────────────────────────

    describe('host-profile-health (client-side)', () => {
        it('computes 6/6 done for a fully-filled profile', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'host-profile-health',
                                entities: [fullHostProfile]
                            }
                        })}
                    />
                </TestWrapper>
            );

            expect(screen.getByTestId('checklist-completeness-fraction')).toHaveTextContent(
                '6/6 completado'
            );
        });

        it('computes 0/6 done for an empty profile', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'host-profile-health',
                                entities: [partialHostProfile]
                            }
                        })}
                    />
                </TestWrapper>
            );

            expect(screen.getByTestId('checklist-completeness-fraction')).toHaveTextContent(
                '0/6 completado'
            );
        });

        it('does NOT render the accommodation selector for host-profile-health', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'host-profile-health',
                                entities: [fullHostProfile]
                            }
                        })}
                    />
                </TestWrapper>
            );

            expect(
                screen.queryByTestId('checklist-accommodation-selector')
            ).not.toBeInTheDocument();
        });
    });

    // ── content-health ─────────────────────────────────────────────────────

    describe('content-health (client-side)', () => {
        it('computes items for a post with missing fields', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'content-health',
                                entities: [postWithIssues]
                            }
                        })}
                    />
                </TestWrapper>
            );

            // 0/3 for the post with issues
            expect(screen.getByTestId('checklist-completeness-fraction')).toHaveTextContent(
                '0/3 completado'
            );
        });

        it('computes items for an event with missing fields', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'content-health',
                                entities: [eventWithIssues]
                            }
                        })}
                    />
                </TestWrapper>
            );

            // 1/4: featuredImage present, but locationId/organizerId/description missing
            expect(screen.getByTestId('checklist-completeness-fraction')).toHaveTextContent(
                '1/4 completado'
            );
        });

        it('combines post and event items in the flat list', () => {
            noopResolver();

            render(
                <TestWrapper>
                    <ChecklistWidget
                        widget={makeWidget({
                            config: {
                                checkset: 'content-health',
                                entities: [postWithIssues, eventWithIssues]
                            }
                        })}
                    />
                </TestWrapper>
            );

            // 3 post items + 4 event items = 7 total; 0 post done + 1 event done = 1/7
            expect(screen.getByTestId('checklist-completeness-fraction')).toHaveTextContent(
                '1/7 completado'
            );
        });
    });

    // ── Empty states ───────────────────────────────────────────────────────

    it('renders empty state when config entities array is empty', () => {
        noopResolver();

        render(
            <TestWrapper>
                <ChecklistWidget
                    widget={makeWidget({
                        config: {
                            checkset: 'accommodation-health',
                            entities: []
                        }
                    })}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('checklist-widget-empty')).toBeInTheDocument();
        expect(screen.queryByTestId('checklist-widget')).not.toBeInTheDocument();
    });

    // ── Resolver mode states ───────────────────────────────────────────────

    it('renders the unavailable state when source is not registered', () => {
        mockResolveForScope.mockReturnValue({
            found: false,
            options: {
                queryKey: ['dashboard', '__noop__', 'HOST', 'own'],
                queryFn: () => Promise.resolve(null),
                staleTime: Number.POSITIVE_INFINITY,
                enabled: false
            }
        });

        render(
            <TestWrapper>
                <ChecklistWidget
                    widget={makeWidget({
                        config: {
                            checkset: 'accommodation-health',
                            source: 'host.accommodations.list'
                        }
                    })}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('checklist-widget-unavailable')).toBeInTheDocument();
        expect(screen.queryByTestId('checklist-widget')).not.toBeInTheDocument();
    });

    it('renders the skeleton while the resolver query is loading', () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: {
                queryKey: ['dashboard', 'pending', 'HOST', 'own'],
                queryFn: () => new Promise(() => undefined), // never resolves
                staleTime: 60_000
            }
        });

        render(
            <TestWrapper>
                <ChecklistWidget
                    widget={makeWidget({
                        config: {
                            checkset: 'accommodation-health',
                            source: 'host.accommodations.list'
                        }
                    })}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('checklist-widget-skeleton')).toBeInTheDocument();
        expect(screen.queryByTestId('checklist-widget')).not.toBeInTheDocument();
    });

    it('renders the error state with a retry button when the resolver query fails', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubErrorOptions()
        });

        render(
            <TestWrapper>
                <ChecklistWidget
                    widget={makeWidget({
                        config: {
                            checkset: 'accommodation-health',
                            source: 'host.accommodations.list'
                        }
                    })}
                />
            </TestWrapper>
        );

        const errorEl = await screen.findByTestId('checklist-widget-error');
        expect(errorEl).toBeInTheDocument();
        expect(screen.queryByTestId('checklist-widget')).not.toBeInTheDocument();
    });

    it('exposes a retry button inside the error state', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubErrorOptions()
        });

        render(
            <TestWrapper>
                <ChecklistWidget
                    widget={makeWidget({
                        config: {
                            checkset: 'accommodation-health',
                            source: 'host.accommodations.list'
                        }
                    })}
                />
            </TestWrapper>
        );

        const retryBtn = await screen.findByRole('button', { name: /reintentar/i });
        expect(retryBtn).toBeInTheDocument();
        expect(() => fireEvent.click(retryBtn)).not.toThrow();
    });

    it('renders empty state when resolver returns null', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(null)
        });

        render(
            <TestWrapper>
                <ChecklistWidget
                    widget={makeWidget({
                        config: {
                            checkset: 'accommodation-health',
                            source: 'host.accommodations.list'
                        }
                    })}
                />
            </TestWrapper>
        );

        expect(await screen.findByTestId('checklist-widget-empty')).toBeInTheDocument();
    });

    it('renders the checklist when resolver returns an array of entities', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions([fullAccommodation])
        });

        render(
            <TestWrapper>
                <ChecklistWidget
                    widget={makeWidget({
                        config: {
                            checkset: 'accommodation-health',
                            source: 'host.accommodations.list'
                        }
                    })}
                />
            </TestWrapper>
        );

        expect(await screen.findByTestId('checklist-widget')).toBeInTheDocument();
        expect(screen.getByTestId('checklist-completeness-fraction')).toHaveTextContent(
            '6/6 completado'
        );
    });
});
