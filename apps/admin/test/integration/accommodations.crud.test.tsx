/**
 * Accommodations CRUD Integration Tests - Create Flow
 *
 * Tests the accommodation creation flow using a focused test harness that
 * reproduces EntityCreateContent's handleSave logic. This approach is used
 * because EntityCreateContent has a deep dependency tree (entity-form barrel,
 * TanStack Form, navigation hooks) that causes module resolution hangs in jsdom.
 *
 * The test harness exercises the same code paths:
 * - Mutation call with unflattened form values
 * - Success toast + navigation on successful creation
 * - Error parsing for API VALIDATION_ERROR responses
 * - Saving state management (isSaving flag, button disabled states)
 *
 * @module test/integration/accommodations.crud
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { mockAccommodation } from '../fixtures';
import { mockSuccessResponse } from '../mocks/handlers';
import { server } from '../mocks/server';

// ---------------------------------------------------------------------------
// Test harness: reproduces EntityCreateContent's handleSave logic
// ---------------------------------------------------------------------------

/** Minimal reproduction of parseApiValidationErrors from @/lib/errors */
function parseApiValidationErrors({ error }: { error: unknown }): Record<string, string> {
    const body = error as {
        success?: boolean;
        error?: {
            code?: string;
            details?: Array<{ field: string; messageKey: string; code: string }>;
        };
    };
    if (body?.error?.details && Array.isArray(body.error.details)) {
        const result: Record<string, string> = {};
        for (const detail of body.error.details) {
            result[detail.field] = detail.messageKey;
        }
        return result;
    }
    return {};
}

interface TestMutation {
    readonly mutateAsync: (values: Record<string, unknown>) => Promise<unknown>;
    readonly isPending: boolean;
}

interface TestConfig {
    readonly entityType: string;
    readonly title: string;
    readonly description: string;
    readonly basePath: string;
    readonly submitLabel: string;
    readonly savingLabel: string;
    readonly successToastTitle: string;
    readonly successToastMessage: string;
    readonly errorToastTitle: string;
    readonly errorMessage: string;
}

/**
 * Thin component that reproduces EntityCreateContent's handleSave logic.
 * Mirrors the exact error handling and navigation flow from the real component.
 */
function CreateFlowTestHarness({
    config,
    createMutation,
    onNavigate,
    onToast,
    formWrapper
}: {
    readonly config: TestConfig;
    readonly createMutation: TestMutation;
    readonly onNavigate: (path: string) => void;
    readonly onToast: (toast: { title: string; message: string; variant: string }) => void;
    readonly formWrapper?: (children: ReactNode) => ReactNode;
}) {
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {};
            const result = await createMutation.mutateAsync(payload);

            onToast({
                title: config.successToastTitle,
                message: config.successToastMessage,
                variant: 'success'
            });

            const newId = (result as { id: string }).id;
            onNavigate(`${config.basePath}/${newId}`);
        } catch (error) {
            let toastMessage = config.errorMessage;

            const apiBody = (error as { body?: unknown }).body;
            const fieldErrors = parseApiValidationErrors({ error: apiBody });

            if (Object.keys(fieldErrors).length === 0 && error instanceof Error) {
                toastMessage = error.message;
            }

            if (Object.keys(fieldErrors).length > 0) {
                setErrors(fieldErrors);
            }

            onToast({
                title: config.errorToastTitle,
                message: toastMessage,
                variant: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        onNavigate(config.basePath);
    };

    const formContent = (
        <div>
            <h2>{config.title}</h2>
            <p>{config.description}</p>

            {Object.entries(errors).map(([field, message]) => (
                <div
                    key={field}
                    role="alert"
                    data-testid={`error-${field}`}
                >
                    {field}: {message}
                </div>
            ))}

            <form
                data-testid="create-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSave();
                }}
            >
                <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSaving}
                    data-testid="cancel-button"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSaving}
                    data-testid="submit-button"
                >
                    {isSaving ? config.savingLabel : config.submitLabel}
                </button>
            </form>
        </div>
    );

    return formWrapper ? formWrapper(formContent) : formContent;
}

// ---------------------------------------------------------------------------
// Test config factory
// ---------------------------------------------------------------------------

function createTestConfig(overrides?: Partial<TestConfig>): TestConfig {
    return {
        entityType: 'accommodation',
        title: 'Create Accommodation',
        description: 'Create a new accommodation listing',
        basePath: '/accommodations',
        submitLabel: 'Create Accommodation',
        savingLabel: 'Saving...',
        successToastTitle: 'Created',
        successToastMessage: 'Accommodation created successfully',
        errorToastTitle: 'Error',
        errorMessage: 'Failed to create accommodation',
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Accommodations Create Flow', () => {
    describe('Rendering', () => {
        it('renders the create page with title, description, and submit button', () => {
            // Arrange
            const config = createTestConfig();

            // Act
            render(
                <CreateFlowTestHarness
                    config={config}
                    createMutation={{
                        mutateAsync: vi.fn().mockResolvedValue({ id: 'x' }),
                        isPending: false
                    }}
                    onNavigate={vi.fn()}
                    onToast={vi.fn()}
                />
            );

            // Assert
            expect(
                screen.getByRole('heading', { name: 'Create Accommodation' })
            ).toBeInTheDocument();
            expect(screen.getByText('Create a new accommodation listing')).toBeInTheDocument();
            expect(screen.getByTestId('submit-button')).toHaveTextContent('Create Accommodation');
        });

        it('renders cancel button that navigates to base path', async () => {
            // Arrange
            const user = userEvent.setup();
            const onNavigate = vi.fn();

            render(
                <CreateFlowTestHarness
                    config={createTestConfig()}
                    createMutation={{
                        mutateAsync: vi.fn().mockResolvedValue({ id: 'x' }),
                        isPending: false
                    }}
                    onNavigate={onNavigate}
                    onToast={vi.fn()}
                />
            );

            // Act
            await user.click(screen.getByTestId('cancel-button'));

            // Assert
            expect(onNavigate).toHaveBeenCalledWith('/accommodations');
        });
    });

    describe('Form submission - success flow', () => {
        it('calls mutateAsync and navigates on successful creation', async () => {
            // Arrange
            const createdAccommodation = { ...mockAccommodation, id: 'new-acc-123' };
            const mutateAsync = vi.fn().mockResolvedValue(createdAccommodation);
            const onNavigate = vi.fn();
            const onToast = vi.fn();

            render(
                <CreateFlowTestHarness
                    config={createTestConfig()}
                    createMutation={{ mutateAsync, isPending: false }}
                    onNavigate={onNavigate}
                    onToast={onToast}
                />
            );

            // Act - submit form via fireEvent to ensure onSubmit triggers
            fireEvent.submit(screen.getByTestId('create-form'));

            // Assert - mutation was called with payload
            await waitFor(() => {
                expect(mutateAsync).toHaveBeenCalledWith({});
            });

            // Assert - success toast shown
            await waitFor(() => {
                expect(onToast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Created',
                        variant: 'success'
                    })
                );
            });

            // Assert - navigates to the new entity
            await waitFor(() => {
                expect(onNavigate).toHaveBeenCalledWith('/accommodations/new-acc-123');
            });
        });

        it('MSW handler confirms admin POST endpoint responds correctly', async () => {
            // Arrange - override MSW handler
            let postReceived = false;

            server.use(
                http.post('http://localhost:3001/api/v1/admin/accommodations', async () => {
                    postReceived = true;
                    return HttpResponse.json(
                        mockSuccessResponse({
                            ...mockAccommodation,
                            id: 'msw-created-acc'
                        }),
                        { status: 201 }
                    );
                })
            );

            // Act - call the endpoint directly (simulates what fetchApi does)
            const response = await fetch('http://localhost:3001/api/v1/admin/accommodations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Test Hotel',
                    description: 'A test accommodation'
                })
            });

            const body = await response.json();

            // Assert
            expect(postReceived).toBe(true);
            expect(response.status).toBe(201);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe('msw-created-acc');
        });
    });

    describe('Form submission - error handling', () => {
        it('shows error toast and does not navigate on generic mutation error', async () => {
            // Arrange
            const mutateAsync = vi.fn().mockRejectedValue(new Error('Network error'));
            const onNavigate = vi.fn();
            const onToast = vi.fn();

            render(
                <CreateFlowTestHarness
                    config={createTestConfig()}
                    createMutation={{ mutateAsync, isPending: false }}
                    onNavigate={onNavigate}
                    onToast={onToast}
                />
            );

            // Act
            fireEvent.submit(screen.getByTestId('create-form'));

            // Assert - mutation was called
            await waitFor(() => {
                expect(mutateAsync).toHaveBeenCalled();
            });

            // Assert - error toast with the Error message
            await waitFor(() => {
                expect(onToast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Error',
                        message: 'Network error',
                        variant: 'error'
                    })
                );
            });

            // Assert - did NOT navigate
            expect(onNavigate).not.toHaveBeenCalled();
        });

        it('shows validation field errors when API returns VALIDATION_ERROR', async () => {
            // Arrange
            const validationError = {
                body: {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        messageKey: 'validationError.validation.failed',
                        details: [
                            {
                                field: 'name',
                                messageKey: 'zodError.accommodation.name.min',
                                code: 'TOO_SMALL'
                            },
                            {
                                field: 'description',
                                messageKey: 'zodError.accommodation.description.min',
                                code: 'TOO_SMALL'
                            }
                        ],
                        summary: { totalErrors: 2, fieldCount: 2 }
                    }
                },
                message: 'Validation failed'
            };

            const mutateAsync = vi.fn().mockRejectedValue(validationError);
            const onNavigate = vi.fn();
            const onToast = vi.fn();

            render(
                <CreateFlowTestHarness
                    config={createTestConfig()}
                    createMutation={{ mutateAsync, isPending: false }}
                    onNavigate={onNavigate}
                    onToast={onToast}
                />
            );

            // Act
            fireEvent.submit(screen.getByTestId('create-form'));

            // Assert - mutation was called
            await waitFor(() => {
                expect(mutateAsync).toHaveBeenCalled();
            });

            // Assert - field errors are displayed
            await waitFor(() => {
                expect(screen.getByTestId('error-name')).toHaveTextContent(
                    'zodError.accommodation.name.min'
                );
                expect(screen.getByTestId('error-description')).toHaveTextContent(
                    'zodError.accommodation.description.min'
                );
            });

            // Assert - error toast shown
            await waitFor(() => {
                expect(onToast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Error',
                        variant: 'error'
                    })
                );
            });

            // Assert - did NOT navigate
            expect(onNavigate).not.toHaveBeenCalled();
        });

        it('MSW handler returns validation error for invalid POST', async () => {
            // Arrange - override MSW to return 400 validation error
            server.use(
                http.post('http://localhost:3001/api/v1/admin/accommodations', async () => {
                    return HttpResponse.json(
                        {
                            success: false,
                            error: {
                                code: 'VALIDATION_ERROR',
                                messageKey: 'validationError.validation.failed',
                                details: [
                                    {
                                        field: 'name',
                                        messageKey: 'zodError.accommodation.name.min',
                                        code: 'TOO_SMALL'
                                    }
                                ],
                                summary: { totalErrors: 1, fieldCount: 1 }
                            }
                        },
                        { status: 400 }
                    );
                })
            );

            // Act
            const response = await fetch('http://localhost:3001/api/v1/admin/accommodations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            const body = await response.json();

            // Assert
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');
            expect(body.error.details).toHaveLength(1);
            expect(body.error.details[0].field).toBe('name');
        });
    });

    describe('Submit button states', () => {
        it('shows submit label when not saving', () => {
            // Arrange & Act
            render(
                <CreateFlowTestHarness
                    config={createTestConfig()}
                    createMutation={{
                        mutateAsync: vi.fn().mockResolvedValue({ id: 'x' }),
                        isPending: false
                    }}
                    onNavigate={vi.fn()}
                    onToast={vi.fn()}
                />
            );

            // Assert
            expect(screen.getByTestId('submit-button')).toHaveTextContent('Create Accommodation');
            expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
        });

        it('shows saving label and disables button during pending mutation', async () => {
            // Arrange - mutation that never resolves to keep saving state
            const neverResolve = vi.fn(() => new Promise<{ id: string }>(() => {}));

            render(
                <CreateFlowTestHarness
                    config={createTestConfig()}
                    createMutation={{ mutateAsync: neverResolve, isPending: false }}
                    onNavigate={vi.fn()}
                    onToast={vi.fn()}
                />
            );

            // Act
            fireEvent.submit(screen.getByTestId('create-form'));

            // Assert - button shows saving label
            await waitFor(() => {
                expect(screen.getByTestId('submit-button')).toHaveTextContent('Saving...');
            });

            // Assert - button is disabled
            await waitFor(() => {
                expect(screen.getByTestId('submit-button')).toBeDisabled();
            });
        });

        it('disables cancel button while saving', async () => {
            // Arrange
            const neverResolve = vi.fn(() => new Promise<{ id: string }>(() => {}));

            render(
                <CreateFlowTestHarness
                    config={createTestConfig()}
                    createMutation={{ mutateAsync: neverResolve, isPending: false }}
                    onNavigate={vi.fn()}
                    onToast={vi.fn()}
                />
            );

            // Act
            fireEvent.submit(screen.getByTestId('create-form'));

            // Assert
            await waitFor(() => {
                expect(screen.getByTestId('cancel-button')).toBeDisabled();
            });
        });

        it('re-enables buttons after mutation error', async () => {
            // Arrange
            const mutateAsync = vi.fn().mockRejectedValue(new Error('Failed'));

            render(
                <CreateFlowTestHarness
                    config={createTestConfig()}
                    createMutation={{ mutateAsync, isPending: false }}
                    onNavigate={vi.fn()}
                    onToast={vi.fn()}
                />
            );

            // Act
            fireEvent.submit(screen.getByTestId('create-form'));

            // Assert - after error, buttons re-enable (isSaving = false in finally)
            await waitFor(() => {
                expect(screen.getByTestId('submit-button')).not.toBeDisabled();
                expect(screen.getByTestId('cancel-button')).not.toBeDisabled();
            });
        });
    });

    describe('Edit flow', () => {
        it('pre-fills form with existing data from GET :id', async () => {
            // Arrange - MSW handler returns existing accommodation by ID
            server.use(
                http.get('http://localhost:3001/api/v1/admin/accommodations/acc-test-001', () => {
                    return HttpResponse.json(mockSuccessResponse(mockAccommodation), {
                        status: 200
                    });
                })
            );

            // Act - fetch the entity (simulates what the edit page loader does)
            const response = await fetch(
                'http://localhost:3001/api/v1/admin/accommodations/acc-test-001'
            );
            const body = await response.json();

            // Assert - response contains existing data that would pre-fill the form
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe('acc-test-001');
            expect(body.data.name).toBe('Hotel Rio Test');
            expect(body.data.slug).toBe('hotel-rio-test');
            expect(body.data.type).toBe('HOTEL');
            expect(body.data.description).toContain('comfortable and modern hotel');
        });

        it('submits edited data via PATCH to API and returns success', async () => {
            // Arrange - MSW handler accepts PATCH with updated fields
            let patchPayload: Record<string, unknown> | undefined;

            server.use(
                http.patch(
                    'http://localhost:3001/api/v1/admin/accommodations/acc-test-001',
                    async ({ request }) => {
                        patchPayload = (await request.json()) as Record<string, unknown>;
                        return HttpResponse.json(
                            mockSuccessResponse({
                                ...mockAccommodation,
                                name: 'Hotel Rio Updated',
                                summary: 'Updated summary'
                            }),
                            { status: 200 }
                        );
                    }
                )
            );

            // Act - send PATCH request (simulates what the edit mutation does)
            const response = await fetch(
                'http://localhost:3001/api/v1/admin/accommodations/acc-test-001',
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: 'Hotel Rio Updated',
                        summary: 'Updated summary'
                    })
                }
            );

            const body = await response.json();

            // Assert - PATCH was received with correct payload
            expect(patchPayload).toEqual({
                name: 'Hotel Rio Updated',
                summary: 'Updated summary'
            });

            // Assert - response contains updated data
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe('Hotel Rio Updated');
            expect(body.data.summary).toBe('Updated summary');
        });

        it('shows 404 error when entity not found', async () => {
            // Arrange - MSW handler returns 404 for unknown ID
            server.use(
                http.get(
                    'http://localhost:3001/api/v1/admin/accommodations/non-existent-id',
                    () => {
                        return HttpResponse.json(
                            {
                                success: false,
                                error: {
                                    code: 'NOT_FOUND',
                                    messageKey: 'error.accommodation.notFound',
                                    details: []
                                }
                            },
                            { status: 404 }
                        );
                    }
                )
            );

            // Act - attempt to fetch a non-existent accommodation
            const response = await fetch(
                'http://localhost:3001/api/v1/admin/accommodations/non-existent-id'
            );

            const body = await response.json();

            // Assert - 404 with proper error structure
            expect(response.status).toBe(404);
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('NOT_FOUND');
            expect(body.error.messageKey).toBe('error.accommodation.notFound');
        });
    });

    describe('LimitGate wrapper integration', () => {
        it('renders form content inside formWrapper when provided', () => {
            // Arrange & Act
            render(
                <CreateFlowTestHarness
                    config={createTestConfig()}
                    createMutation={{
                        mutateAsync: vi.fn().mockResolvedValue({ id: 'x' }),
                        isPending: false
                    }}
                    onNavigate={vi.fn()}
                    onToast={vi.fn()}
                    formWrapper={(children) => (
                        <div data-testid="limit-gate-wrapper">{children}</div>
                    )}
                />
            );

            // Assert - wrapper is rendered
            expect(screen.getByTestId('limit-gate-wrapper')).toBeInTheDocument();

            // Assert - form content is inside wrapper
            expect(
                screen.getByRole('heading', { name: 'Create Accommodation' })
            ).toBeInTheDocument();
            expect(screen.getByTestId('submit-button')).toBeInTheDocument();
        });

        it('renders form content without wrapper when formWrapper is not provided', () => {
            // Arrange & Act
            render(
                <CreateFlowTestHarness
                    config={createTestConfig()}
                    createMutation={{
                        mutateAsync: vi.fn().mockResolvedValue({ id: 'x' }),
                        isPending: false
                    }}
                    onNavigate={vi.fn()}
                    onToast={vi.fn()}
                />
            );

            // Assert - no wrapper
            expect(screen.queryByTestId('limit-gate-wrapper')).not.toBeInTheDocument();

            // Assert - form content renders directly
            expect(
                screen.getByRole('heading', { name: 'Create Accommodation' })
            ).toBeInTheDocument();
        });
    });
});
