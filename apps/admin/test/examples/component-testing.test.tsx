/**
 * Example: Testing React Components with API Calls
 *
 * This file demonstrates how to test React components that:
 * - Fetch data from APIs
 * - Handle loading states
 * - Display error states
 * - Render dynamic content
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { mockErrorResponse, mockPaginatedResponse } from '../mocks/handlers';
import { server } from '../mocks/server';

const API_BASE = '/api/v1';

/**
 * Example component that fetches and displays a list
 */
function EntityList({ endpoint, title }: { endpoint: string; title: string }) {
    const [data, setData] = useState<Array<{ id: string; name: string }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(endpoint)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((result) => {
                setData(result.data?.items || []);
                setIsLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setIsLoading(false);
            });
    }, [endpoint]);

    if (isLoading) return <div data-testid="loading">Loading...</div>;
    if (error) return <div data-testid="error">Error: {error}</div>;

    return (
        <div data-testid="entity-list">
            <h2>{title}</h2>
            {data.length === 0 ? (
                <p data-testid="empty-state">No items found</p>
            ) : (
                <ul>
                    {data.map((item) => (
                        <li
                            key={item.id}
                            data-testid={`item-${item.id}`}
                        >
                            {item.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/**
 * Example component with search functionality
 */
function SearchableList({ endpoint }: { endpoint: string }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Array<{ id: string; name: string }>>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async () => {
        if (query.length < 2) return;
        setIsSearching(true);
        try {
            const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setResults(data.data?.items || []);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div data-testid="searchable-list">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                data-testid="search-input"
            />
            <button
                onClick={handleSearch}
                disabled={isSearching}
                data-testid="search-button"
            >
                {isSearching ? 'Searching...' : 'Search'}
            </button>
            <ul data-testid="search-results">
                {results.map((item) => (
                    <li key={item.id}>{item.name}</li>
                ))}
            </ul>
        </div>
    );
}

/**
 * Example form component
 */
function CreateEntityForm({ onSuccess }: { onSuccess: (data: unknown) => void }) {
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const res = await fetch(`http://localhost${API_BASE}/admin/accommodations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || 'Create failed');
            }

            const data = await res.json();
            onSuccess(data.data);
            setName('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            data-testid="create-form"
        >
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                data-testid="name-input"
            />
            <button
                type="submit"
                disabled={isSubmitting}
                data-testid="submit-button"
            >
                {isSubmitting ? 'Creating...' : 'Create'}
            </button>
            {error && <div data-testid="form-error">{error}</div>}
        </form>
    );
}

describe('Component Testing Examples', () => {
    describe('Entity List Component', () => {
        it('should show loading state initially', () => {
            render(
                <EntityList
                    endpoint={`${API_BASE}/public/accommodations`}
                    title="Hotels"
                />
            );

            expect(screen.getByTestId('loading')).toBeInTheDocument();
        });

        it('should display data after loading', async () => {
            render(
                <EntityList
                    endpoint={`${API_BASE}/public/accommodations`}
                    title="Hotels"
                />
            );

            await waitFor(() => {
                expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
            });

            expect(screen.getByTestId('entity-list')).toBeInTheDocument();
            expect(screen.getByText('Hotels')).toBeInTheDocument();
            expect(screen.getByTestId('item-acc-1')).toBeInTheDocument();
            expect(screen.getByText('Test Hotel')).toBeInTheDocument();
        });

        it('should display error state on failure', async () => {
            server.use(
                http.get(`${API_BASE}/public/accommodations`, () => {
                    return HttpResponse.json(
                        mockErrorResponse('SERVER_ERROR', 'Database connection failed'),
                        { status: 500 }
                    );
                })
            );

            render(
                <EntityList
                    endpoint={`${API_BASE}/public/accommodations`}
                    title="Hotels"
                />
            );

            await waitFor(() => {
                expect(screen.getByTestId('error')).toBeInTheDocument();
            });

            expect(screen.getByText(/Error: HTTP 500/)).toBeInTheDocument();
        });

        it('should display empty state when no items', async () => {
            server.use(
                http.get(`${API_BASE}/public/accommodations`, () => {
                    return HttpResponse.json(mockPaginatedResponse([]));
                })
            );

            render(
                <EntityList
                    endpoint={`${API_BASE}/public/accommodations`}
                    title="Hotels"
                />
            );

            await waitFor(() => {
                expect(screen.getByTestId('empty-state')).toBeInTheDocument();
            });

            expect(screen.getByText('No items found')).toBeInTheDocument();
        });

        it('should display multiple items', async () => {
            server.use(
                http.get(`${API_BASE}/public/accommodations`, () => {
                    return HttpResponse.json(
                        mockPaginatedResponse([
                            { id: '1', name: 'Hotel A' },
                            { id: '2', name: 'Hotel B' },
                            { id: '3', name: 'Hotel C' }
                        ])
                    );
                })
            );

            render(
                <EntityList
                    endpoint={`${API_BASE}/public/accommodations`}
                    title="Hotels"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Hotel A')).toBeInTheDocument();
            });

            expect(screen.getByText('Hotel B')).toBeInTheDocument();
            expect(screen.getByText('Hotel C')).toBeInTheDocument();
        });
    });

    describe('Searchable List Component', () => {
        it('should perform search on button click', async () => {
            const user = userEvent.setup();

            let receivedQuery = '';
            server.use(
                http.get(`${API_BASE}/public/accommodations`, ({ request }) => {
                    const url = new URL(request.url);
                    receivedQuery = url.searchParams.get('q') || '';
                    return HttpResponse.json(
                        mockPaginatedResponse([{ id: '1', name: `Result for "${receivedQuery}"` }])
                    );
                })
            );

            render(<SearchableList endpoint={`${API_BASE}/public/accommodations`} />);

            const input = screen.getByTestId('search-input');
            const button = screen.getByTestId('search-button');

            await user.type(input, 'beach hotel');
            await user.click(button);

            await waitFor(() => {
                expect(receivedQuery).toBe('beach hotel');
            });

            expect(screen.getByText('Result for "beach hotel"')).toBeInTheDocument();
        });

        it('should show searching state during API call', async () => {
            const user = userEvent.setup();

            // Add delay to observe loading state
            server.use(
                http.get(`${API_BASE}/public/accommodations`, async () => {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    return HttpResponse.json(mockPaginatedResponse([{ id: '1', name: 'Result' }]));
                })
            );

            render(<SearchableList endpoint={`${API_BASE}/public/accommodations`} />);

            await user.type(screen.getByTestId('search-input'), 'test');
            await user.click(screen.getByTestId('search-button'));

            // Button should show searching state
            expect(screen.getByTestId('search-button')).toHaveTextContent('Searching...');

            await waitFor(() => {
                expect(screen.getByTestId('search-button')).toHaveTextContent('Search');
            });
        });
    });

    describe('Create Entity Form', () => {
        it('should submit form and call onSuccess', async () => {
            const user = userEvent.setup();
            const onSuccess = vi.fn();

            server.use(
                http.post(
                    `http://localhost${API_BASE}/admin/accommodations`,
                    async ({ request }) => {
                        const body = await request.json();
                        return HttpResponse.json(
                            {
                                success: true,
                                data: { id: 'new-id', ...(body as object) },
                                metadata: { timestamp: new Date().toISOString(), requestId: 'test' }
                            },
                            { status: 201 }
                        );
                    }
                )
            );

            render(<CreateEntityForm onSuccess={onSuccess} />);

            await user.type(screen.getByTestId('name-input'), 'New Hotel');
            fireEvent.submit(screen.getByTestId('create-form'));

            await waitFor(() => {
                expect(onSuccess).toHaveBeenCalledWith({ id: 'new-id', name: 'New Hotel' });
            });

            // Form should be cleared
            expect(screen.getByTestId('name-input')).toHaveValue('');
        });

        it('should show submitting state during API call', async () => {
            const user = userEvent.setup();

            server.use(
                http.post(`http://localhost${API_BASE}/admin/accommodations`, async () => {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    return HttpResponse.json({
                        success: true,
                        data: { id: 'new-id' },
                        metadata: { timestamp: new Date().toISOString(), requestId: 'test' }
                    });
                })
            );

            render(<CreateEntityForm onSuccess={() => {}} />);

            await user.type(screen.getByTestId('name-input'), 'New Hotel');
            fireEvent.submit(screen.getByTestId('create-form'));

            expect(screen.getByTestId('submit-button')).toHaveTextContent('Creating...');
            expect(screen.getByTestId('submit-button')).toBeDisabled();

            await waitFor(() => {
                expect(screen.getByTestId('submit-button')).toHaveTextContent('Create');
            });
        });

        it('should display error on API failure', async () => {
            const user = userEvent.setup();

            server.use(
                http.post(`http://localhost${API_BASE}/admin/accommodations`, () => {
                    return HttpResponse.json(
                        mockErrorResponse('VALIDATION_ERROR', 'Name is required'),
                        { status: 400 }
                    );
                })
            );

            render(<CreateEntityForm onSuccess={() => {}} />);

            await user.type(screen.getByTestId('name-input'), 'Test');
            fireEvent.submit(screen.getByTestId('create-form'));

            await waitFor(() => {
                expect(screen.getByTestId('form-error')).toBeInTheDocument();
            });

            expect(screen.getByText('Name is required')).toBeInTheDocument();
        });
    });

    describe('Testing with Different Data Scenarios', () => {
        it('should handle special characters in data', async () => {
            server.use(
                http.get(`${API_BASE}/public/accommodations`, () => {
                    return HttpResponse.json(
                        mockPaginatedResponse([
                            { id: '1', name: 'Hotel "La Paz" & Spa <Premium>' },
                            { id: '2', name: "O'Brien's Inn" }
                        ])
                    );
                })
            );

            render(
                <EntityList
                    endpoint={`${API_BASE}/public/accommodations`}
                    title="Hotels"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Hotel "La Paz" & Spa <Premium>')).toBeInTheDocument();
            });

            expect(screen.getByText("O'Brien's Inn")).toBeInTheDocument();
        });

        it('should handle unicode characters', async () => {
            server.use(
                http.get(`${API_BASE}/public/accommodations`, () => {
                    return HttpResponse.json(
                        mockPaginatedResponse([
                            { id: '1', name: 'Hotel Café ☕ Premium' },
                            { id: '2', name: 'Hospedaje José María' }
                        ])
                    );
                })
            );

            render(
                <EntityList
                    endpoint={`${API_BASE}/public/accommodations`}
                    title="Hotels"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Hotel Café ☕ Premium')).toBeInTheDocument();
            });

            expect(screen.getByText('Hospedaje José María')).toBeInTheDocument();
        });
    });

    describe('Testing Component Interactions', () => {
        it('should test keyboard interactions', async () => {
            const user = userEvent.setup();

            render(<SearchableList endpoint={`${API_BASE}/public/accommodations`} />);

            const input = screen.getByTestId('search-input');

            // Focus input
            await user.click(input);
            expect(input).toHaveFocus();

            // Type using keyboard
            await user.keyboard('test search');
            expect(input).toHaveValue('test search');

            // Clear with select all + delete
            await user.keyboard('{Control>}a{/Control}{Backspace}');
            expect(input).toHaveValue('');
        });

        it('should test form submission with Enter key', async () => {
            const user = userEvent.setup();
            const onSuccess = vi.fn();

            server.use(
                http.post(`http://localhost${API_BASE}/admin/accommodations`, async () => {
                    return HttpResponse.json({
                        success: true,
                        data: { id: 'new-id', name: 'Test' },
                        metadata: { timestamp: new Date().toISOString(), requestId: 'test' }
                    });
                })
            );

            render(<CreateEntityForm onSuccess={onSuccess} />);

            await user.type(screen.getByTestId('name-input'), 'Test Hotel');
            fireEvent.submit(screen.getByTestId('create-form'));

            await waitFor(() => {
                expect(onSuccess).toHaveBeenCalled();
            });
        });
    });
});
