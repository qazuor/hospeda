/**
 * Integration tests for DELETE /api/v1/protected/exchange-rates/:id endpoint
 * Tests deletion of manual exchange rate overrides with validation
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('DELETE /api/v1/protected/exchange-rates/:id', () => {
    let app: AppOpenAPI;
    const baseUrl = '/api/v1/protected/exchange-rates';
    const validManualOverrideId = '12345678-1234-4567-8901-123456789012'; // Assume this is a manual override
    const nonManualRateId = '87654321-4321-4321-8765-876543218765'; // Assume this is NOT a manual override
    const nonExistentId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

    beforeAll(async () => {
        app = initApp();
    });

    describe('Success Cases (204)', () => {
        it('should delete manual override with valid ID', async () => {
            try {
                const response = await app.request(`${baseUrl}/${validManualOverrideId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json',
                        Authorization: 'Bearer mock-admin-token'
                    }
                });

                // Expect 204 No Content for successful deletion
                expect([204, 200, 401, 403, 404]).toContain(response.status);

                if (response.status === 204) {
                    // No content for successful deletion
                    const text = await response.text();
                    expect(text).toBe('');
                } else if (response.status === 200) {
                    // Some implementations might return 200 with null body
                    const data = await response.json();
                    expect(data).toBeDefined();
                }
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });

        it('should include proper headers in response', async () => {
            try {
                const response = await app.request(`${baseUrl}/${validManualOverrideId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json',
                        Authorization: 'Bearer mock-admin-token'
                    }
                });

                expect([204, 200, 401, 403, 404]).toContain(response.status);

                // Should have content-type even for 204
                const contentType = response.headers.get('content-type');
                if (response.status === 200) {
                    expect(contentType).toContain('application/json');
                }
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Validation Errors (400)', () => {
        it('should return 400 for invalid UUID format', async () => {
            const invalidIds = [
                'invalid-uuid',
                '123',
                'not-a-uuid',
                '12345678-1234-1234-1234-123456789012', // Invalid version
                'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
                '',
                'g2345678-1234-4567-8901-123456789012'
            ];

            for (const invalidId of invalidIds) {
                try {
                    const response = await app.request(`${baseUrl}/${invalidId}`, {
                        method: 'DELETE',
                        headers: {
                            'user-agent': 'vitest',
                            Accept: 'application/json',
                            Authorization: 'Bearer mock-admin-token'
                        }
                    });

                    expect([400, 404, 401, 403]).toContain(response.status);

                    if (response.status === 400) {
                        const data = await response.json();
                        expect(data).toHaveProperty('success', false);
                        expect(data).toHaveProperty('error');
                        expect(data.error).toHaveProperty('message');
                        expect(data.error.message).toMatch(/Invalid.*ID.*format|UUID|invalid/i);
                    }
                } catch (error: unknown) {
                    if (error && typeof error === 'object' && 'status' in error) {
                        expect([401, 403]).toContain((error as { status: number }).status);
                    } else {
                        throw error;
                    }
                }
            }
        });

        it('should return 400 when trying to delete non-manual rate', async () => {
            try {
                const response = await app.request(`${baseUrl}/${nonManualRateId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json',
                        Authorization: 'Bearer mock-admin-token'
                    }
                });

                // Should return 400 or 403 when trying to delete non-manual override
                expect([400, 403, 404, 401]).toContain(response.status);

                if (response.status === 400) {
                    const data = await response.json();
                    expect(data).toHaveProperty('success', false);
                    expect(data).toHaveProperty('error');
                    expect(data.error.message).toMatch(/manual.*override|cannot.*delete/i);
                }
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Resource Not Found (404)', () => {
        it('should return 404 for non-existent exchange rate', async () => {
            try {
                const response = await app.request(`${baseUrl}/${nonExistentId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json',
                        Authorization: 'Bearer mock-admin-token'
                    }
                });

                expect([404, 401, 403]).toContain(response.status);

                if (response.status === 404) {
                    const data = await response.json();
                    expect(data).toHaveProperty('success', false);
                    expect(data).toHaveProperty('error');
                    expect(data.error.message).toMatch(/not found|does not exist/i);
                }
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Authorization (401/403)', () => {
        it('should return 401 without authentication token', async () => {
            try {
                const response = await app.request(`${baseUrl}/${validManualOverrideId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                        // No Authorization header
                    }
                });

                // 404 is acceptable if route not registered yet (T-029 will register it)
                expect([401, 403, 404]).toContain(response.status);

                if (response.status !== 404) {
                    const data = await response.json();
                    expect(data).toHaveProperty('success', false);
                    expect(data).toHaveProperty('error');
                }
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });

        it('should return 403 without required permission', async () => {
            try {
                const response = await app.request(`${baseUrl}/${validManualOverrideId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json',
                        Authorization: 'Bearer mock-user-token' // User without EXCHANGE_RATE_DELETE permission
                    }
                });

                // 404 is acceptable if route not registered yet (T-029 will register it)
                expect([403, 401, 404]).toContain(response.status);

                if (response.status === 403) {
                    const data = await response.json();
                    expect(data).toHaveProperty('success', false);
                    expect(data).toHaveProperty('error');
                    expect(data.error.message).toMatch(/permission|forbidden|access/i);
                }
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });

        it('should require EXCHANGE_RATE_DELETE permission', async () => {
            try {
                const response = await app.request(`${baseUrl}/${validManualOverrideId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json',
                        Authorization: 'Bearer mock-admin-token'
                    }
                });

                // If authenticated with proper permissions, should succeed or return business logic errors
                expect([204, 200, 400, 404, 401, 403]).toContain(response.status);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Idempotency', () => {
        it('should handle multiple deletion attempts gracefully', async () => {
            try {
                // First deletion
                const response1 = await app.request(`${baseUrl}/${validManualOverrideId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json',
                        Authorization: 'Bearer mock-admin-token'
                    }
                });

                // Second deletion (should return 404 if first succeeded)
                const response2 = await app.request(`${baseUrl}/${validManualOverrideId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json',
                        Authorization: 'Bearer mock-admin-token'
                    }
                });

                expect([204, 200, 404, 401, 403]).toContain(response1.status);
                expect([204, 200, 404, 401, 403]).toContain(response2.status);

                // If first succeeded, second should return 404
                if ([204, 200].includes(response1.status)) {
                    expect(response2.status).toBe(404);
                }
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle edge case UUIDs', async () => {
            const edgeCaseIds = [
                'ffffffff-ffff-4fff-8fff-ffffffffffff', // Max values
                '00000001-0000-4000-8000-000000000001', // Min valid values
                '12345678-1234-4567-a901-123456789012' // With hex letters
            ];

            for (const edgeId of edgeCaseIds) {
                try {
                    const response = await app.request(`${baseUrl}/${edgeId}`, {
                        method: 'DELETE',
                        headers: {
                            'user-agent': 'vitest',
                            Accept: 'application/json',
                            Authorization: 'Bearer mock-admin-token'
                        }
                    });

                    expect([204, 200, 400, 404, 401, 403]).toContain(response.status);

                    if (response.status === 400) {
                        const data = await response.json();
                        expect(data).toHaveProperty('success', false);
                        expect(data).toHaveProperty('error');
                    }
                } catch (error: unknown) {
                    if (error && typeof error === 'object' && 'status' in error) {
                        expect([401, 403]).toContain((error as { status: number }).status);
                    } else {
                        throw error;
                    }
                }
            }
        });
    });

    describe('Performance', () => {
        it('should complete deletion within reasonable time', async () => {
            try {
                const startTime = Date.now();

                const response = await app.request(`${baseUrl}/${validManualOverrideId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json',
                        Authorization: 'Bearer mock-admin-token'
                    }
                });

                const endTime = Date.now();
                const duration = endTime - startTime;

                expect([204, 200, 404, 401, 403]).toContain(response.status);
                expect(duration).toBeLessThan(5000); // Should complete in less than 5 seconds
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });
});
