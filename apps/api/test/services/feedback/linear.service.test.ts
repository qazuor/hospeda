/**
 * Tests for LinearFeedbackService
 *
 * Covers:
 * - uploadFile: correct args to fileUpload, PUT to presigned URL
 * - uploadFile: error propagation on non-ok PUT response
 * - createIssue: markdown body construction
 * - createIssue: attachments are uploaded before issue creation
 * - createIssue: severity -> priority mapping
 * - createIssue: title format [type] title
 * - buildIssueBody: all sections present when data is provided
 * - buildIssueBody: optional sections omitted when data is missing
 * - collectLabels: placeholder labels are excluded
 * - collectLabels: real label IDs are included
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    CreateFeedbackIssueInput,
    FeedbackAttachment
} from '../../../src/services/feedback/linear.service';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { MockLinearClient, mockClientInstance, mockFetch } = vi.hoisted(() => {
    const instance = {
        fileUpload: vi.fn(),
        createIssue: vi.fn()
    };

    return {
        MockLinearClient: vi.fn(() => instance),
        mockClientInstance: instance,
        mockFetch: vi.fn()
    };
});

vi.mock('@linear/sdk', () => ({
    LinearClient: MockLinearClient
}));

vi.mock('@repo/logger', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }))
}));

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const MOCK_FEEDBACK_CONFIG = {
    linear: {
        teamId: 'team-abc',
        projectId: 'PLACEHOLDER_PROJECT_ID',
        defaultStateId: 'PLACEHOLDER_STATE_TRIAGE',
        labels: {
            source: {
                web: 'lbl-source-web',
                admin: 'PLACEHOLDER_LABEL_SOURCE_ADMIN',
                standalone: 'PLACEHOLDER_LABEL_SOURCE_STANDALONE'
            },
            environment: {
                beta: 'PLACEHOLDER_LABEL_ENV_BETA'
            }
        }
    },
    reportTypes: [
        { id: 'bug-js', label: 'Error de JavaScript', linearLabelId: 'lbl-bug-js' },
        {
            id: 'feature-request',
            label: 'Solicitud de funcionalidad',
            linearLabelId: 'PLACEHOLDER_LABEL_FEATURE_REQUEST'
        }
    ],
    severityLevels: [
        { id: 'critical', label: 'Critico', description: '...', linearPriority: 1 },
        { id: 'high', label: 'Alto', description: '...', linearPriority: 2 },
        { id: 'medium', label: 'Medio', description: '...', linearPriority: 3 },
        { id: 'low', label: 'Bajo', description: '...', linearPriority: 4 }
    ]
} as const;

const makeFile = (partial?: Partial<FeedbackAttachment>): FeedbackAttachment => ({
    buffer: Buffer.from('test content'),
    filename: 'screenshot.png',
    contentType: 'image/png',
    size: 12,
    ...partial
});

const makeInput = (partial?: Partial<CreateFeedbackIssueInput>): CreateFeedbackIssueInput => ({
    reportType: 'Error de JavaScript',
    reportTypeId: 'bug-js',
    title: 'Page crashes on checkout',
    description: 'Unhandled exception when clicking Pay.',
    reporterName: 'Ana Lopez',
    reporterEmail: 'ana@example.com',
    appSource: 'web',
    environment: { timestamp: '2026-03-06T12:00:00Z' },
    ...partial
});

const mockUploadPayload = (uploadUrl: string, assetUrl: string) => ({
    uploadFile: {
        uploadUrl,
        assetUrl,
        headers: [{ key: 'x-amz-acl', value: 'public-read' }]
    }
});

const mockIssuePayload = (id: string, identifier: string) => ({
    issue: Promise.resolve({
        id,
        url: `https://linear.app/team/issue/${identifier}`,
        identifier
    })
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LinearFeedbackService', () => {
    // Import is deferred so the mock is in place when the module loads
    let LinearFeedbackService: typeof import(
        '../../../src/services/feedback/linear.service'
    ).LinearFeedbackService;

    beforeEach(async () => {
        vi.clearAllMocks();
        global.fetch = mockFetch;
        ({ LinearFeedbackService } = await import('../../../src/services/feedback/linear.service'));
    });

    const makeService = () =>
        new LinearFeedbackService({ apiKey: 'test-key', feedbackConfig: MOCK_FEEDBACK_CONFIG });

    // -------------------------------------------------------------------------
    // uploadFile
    // -------------------------------------------------------------------------

    describe('uploadFile', () => {
        it('should call fileUpload with correct content-type, filename and size', async () => {
            // Arrange
            const service = makeService();
            const file = makeFile();
            mockClientInstance.fileUpload.mockResolvedValue(
                mockUploadPayload(
                    'https://s3.example.com/upload',
                    'https://cdn.example.com/asset.png'
                )
            );
            mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

            // Act
            await service.uploadFile(file);

            // Assert
            expect(mockClientInstance.fileUpload).toHaveBeenCalledWith(
                'image/png',
                'screenshot.png',
                12
            );
        });

        it('should PUT to the presigned URL with Content-Type and Linear headers', async () => {
            // Arrange
            const service = makeService();
            const file = makeFile();
            mockClientInstance.fileUpload.mockResolvedValue(
                mockUploadPayload(
                    'https://s3.example.com/upload',
                    'https://cdn.example.com/asset.png'
                )
            );
            mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

            // Act
            await service.uploadFile(file);

            // Assert
            expect(mockFetch).toHaveBeenCalledWith(
                'https://s3.example.com/upload',
                expect.objectContaining({
                    method: 'PUT',
                    headers: expect.objectContaining({
                        'Content-Type': 'image/png',
                        'x-amz-acl': 'public-read'
                    }),
                    body: file.buffer
                })
            );
        });

        it('should return the assetUrl from Linear', async () => {
            // Arrange
            const service = makeService();
            const file = makeFile();
            mockClientInstance.fileUpload.mockResolvedValue(
                mockUploadPayload(
                    'https://s3.example.com/upload',
                    'https://cdn.example.com/my-asset.png'
                )
            );
            mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

            // Act
            const result = await service.uploadFile(file);

            // Assert
            expect(result).toEqual({ assetUrl: 'https://cdn.example.com/my-asset.png' });
        });

        it('should throw when PUT response is not ok', async () => {
            // Arrange
            const service = makeService();
            const file = makeFile();
            mockClientInstance.fileUpload.mockResolvedValue(
                mockUploadPayload(
                    'https://s3.example.com/upload',
                    'https://cdn.example.com/asset.png'
                )
            );
            mockFetch.mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' });

            // Act & Assert
            await expect(service.uploadFile(file)).rejects.toThrow(
                'Linear file upload failed: 403 Forbidden'
            );
        });

        it('should throw when fileUpload returns no upload data', async () => {
            // Arrange
            const service = makeService();
            const file = makeFile();
            mockClientInstance.fileUpload.mockResolvedValue({ uploadFile: null });

            // Act & Assert
            await expect(service.uploadFile(file)).rejects.toThrow(
                'Linear fileUpload returned no upload data'
            );
        });
    });

    // -------------------------------------------------------------------------
    // createIssue - title format
    // -------------------------------------------------------------------------

    describe('createIssue - title format', () => {
        it('should prefix the title with the report type in brackets', async () => {
            // Arrange
            const service = makeService();
            mockClientInstance.createIssue.mockResolvedValue(mockIssuePayload('id-1', 'ABC-1'));

            const input = makeInput({ reportType: 'Error de JavaScript', title: 'Crash on load' });

            // Act
            await service.createIssue(input);

            // Assert
            expect(mockClientInstance.createIssue).toHaveBeenCalledWith(
                expect.objectContaining({ title: '[Error de JavaScript] Crash on load' })
            );
        });
    });

    // -------------------------------------------------------------------------
    // createIssue - severity -> priority
    // -------------------------------------------------------------------------

    describe('createIssue - severity to priority mapping', () => {
        it.each([
            ['critical', 1],
            ['high', 2],
            ['medium', 3],
            ['low', 4]
        ] as const)(
            'should map severityId "%s" to priority %i',
            async (severityId, expectedPriority) => {
                // Arrange
                const service = makeService();
                mockClientInstance.createIssue.mockResolvedValue(
                    mockIssuePayload('id-x', 'ABC-99')
                );

                const input = makeInput({ severityId });

                // Act
                await service.createIssue(input);

                // Assert
                expect(mockClientInstance.createIssue).toHaveBeenCalledWith(
                    expect.objectContaining({ priority: expectedPriority })
                );
            }
        );

        it('should default to priority 3 (medium) when severityId is absent', async () => {
            // Arrange
            const service = makeService();
            mockClientInstance.createIssue.mockResolvedValue(mockIssuePayload('id-d', 'ABC-0'));

            const input = makeInput({ severityId: undefined });

            // Act
            await service.createIssue(input);

            // Assert
            expect(mockClientInstance.createIssue).toHaveBeenCalledWith(
                expect.objectContaining({ priority: 3 })
            );
        });

        it('should default to priority 3 for an unrecognised severityId', async () => {
            // Arrange
            const service = makeService();
            mockClientInstance.createIssue.mockResolvedValue(mockIssuePayload('id-u', 'ABC-7'));

            const input = makeInput({ severityId: 'unknown-level' });

            // Act
            await service.createIssue(input);

            // Assert
            expect(mockClientInstance.createIssue).toHaveBeenCalledWith(
                expect.objectContaining({ priority: 3 })
            );
        });
    });

    // -------------------------------------------------------------------------
    // createIssue - attachments
    // -------------------------------------------------------------------------

    describe('createIssue - attachments', () => {
        it('should upload all attachments before creating the issue', async () => {
            // Arrange
            const service = makeService();
            const callOrder: string[] = [];

            mockClientInstance.fileUpload.mockImplementation(() => {
                callOrder.push('fileUpload');
                return Promise.resolve(
                    mockUploadPayload(
                        'https://s3.example.com/upload',
                        'https://cdn.example.com/a.png'
                    )
                );
            });

            mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

            mockClientInstance.createIssue.mockImplementation(() => {
                callOrder.push('createIssue');
                return Promise.resolve(mockIssuePayload('id-2', 'ABC-2'));
            });

            const input = makeInput({
                attachments: [makeFile({ filename: 'a.png' }), makeFile({ filename: 'b.png' })]
            });

            // Act
            await service.createIssue(input);

            // Assert
            expect(callOrder).toEqual(['fileUpload', 'fileUpload', 'createIssue']);
            expect(mockClientInstance.fileUpload).toHaveBeenCalledTimes(2);
        });

        it('should embed asset URLs as markdown images in the issue body', async () => {
            // Arrange
            const service = makeService();
            mockClientInstance.fileUpload.mockResolvedValue(
                mockUploadPayload(
                    'https://s3.example.com/upload',
                    'https://cdn.example.com/screenshot.png'
                )
            );
            mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
            mockClientInstance.createIssue.mockResolvedValue(mockIssuePayload('id-3', 'ABC-3'));

            const input = makeInput({ attachments: [makeFile()] });

            // Act
            await service.createIssue(input);

            // Assert
            const call = mockClientInstance.createIssue.mock.calls[0]?.[0] as {
                description: string;
            };
            expect(call.description).toContain(
                '![attachment-1](https://cdn.example.com/screenshot.png)'
            );
        });

        it('should create issue without attachments when none are provided', async () => {
            // Arrange
            const service = makeService();
            mockClientInstance.createIssue.mockResolvedValue(mockIssuePayload('id-4', 'ABC-4'));

            const input = makeInput({ attachments: undefined });

            // Act
            await service.createIssue(input);

            // Assert
            expect(mockClientInstance.fileUpload).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // createIssue - return value
    // -------------------------------------------------------------------------

    describe('createIssue - return value', () => {
        it('should return issueId, issueUrl and issueIdentifier', async () => {
            // Arrange
            const service = makeService();
            mockClientInstance.createIssue.mockResolvedValue(
                mockIssuePayload('uuid-123', 'HSPD-42')
            );

            // Act
            const result = await service.createIssue(makeInput());

            // Assert
            expect(result).toEqual({
                issueId: 'uuid-123',
                issueUrl: 'https://linear.app/team/issue/HSPD-42',
                issueIdentifier: 'HSPD-42'
            });
        });

        it('should throw when createIssue returns no issue', async () => {
            // Arrange
            const service = makeService();
            mockClientInstance.createIssue.mockResolvedValue({
                issue: Promise.resolve(null)
            });

            // Act & Assert
            await expect(service.createIssue(makeInput())).rejects.toThrow(
                'Linear createIssue returned no issue'
            );
        });
    });

    // -------------------------------------------------------------------------
    // buildIssueBody - all sections present
    // -------------------------------------------------------------------------

    describe('buildIssueBody - all sections when data is present', () => {
        it('should include all optional sections when full input is provided', async () => {
            // Arrange
            const service = makeService();
            mockClientInstance.createIssue.mockResolvedValue(mockIssuePayload('id-full', 'ABC-F'));

            const input = makeInput({
                severityId: 'high',
                stepsToReproduce: '1. Open checkout\n2. Click Pay',
                expectedResult: 'Payment processed',
                actualResult: 'Page crashed',
                environment: {
                    timestamp: '2026-03-06T12:00:00Z',
                    currentUrl: 'https://hospeda.com/checkout',
                    browser: 'Chrome 120',
                    os: 'macOS 14',
                    viewport: '1440x900',
                    deployVersion: 'abc123',
                    userId: 'user-42',
                    consoleErrors: ['TypeError: Cannot read properties of undefined'],
                    errorInfo: {
                        message: 'TypeError: Cannot read properties of undefined',
                        stack: 'at checkout.js:42'
                    }
                }
            });

            // Act
            await service.createIssue(input);

            // Assert
            const description = (
                mockClientInstance.createIssue.mock.calls[0]?.[0] as { description: string }
            ).description;

            expect(description).toContain('## Reportado por');
            expect(description).toContain('Ana Lopez');
            expect(description).toContain('## Descripcion');
            expect(description).toContain('Unhandled exception');
            expect(description).toContain('**Severidad:** Alto');
            expect(description).toContain('## Pasos para reproducir');
            expect(description).toContain('Open checkout');
            expect(description).toContain('## Resultado esperado');
            expect(description).toContain('Payment processed');
            expect(description).toContain('## Resultado actual');
            expect(description).toContain('Page crashed');
            expect(description).toContain('## Entorno');
            expect(description).toContain('https://hospeda.com/checkout');
            expect(description).toContain('Chrome 120');
            expect(description).toContain('macOS 14');
            expect(description).toContain('1440x900');
            expect(description).toContain('abc123');
            expect(description).toContain('user-42');
            expect(description).toContain('## Errores de consola');
            expect(description).toContain('TypeError: Cannot read properties of undefined');
            expect(description).toContain('## Error');
            expect(description).toContain('at checkout.js:42');
            expect(description).toContain('*Fuente: web*');
        });
    });

    // -------------------------------------------------------------------------
    // buildIssueBody - optional sections omitted
    // -------------------------------------------------------------------------

    describe('buildIssueBody - optional sections omitted when data is missing', () => {
        it('should not include steps, expected/actual result, or error sections for minimal input', async () => {
            // Arrange
            const service = makeService();
            mockClientInstance.createIssue.mockResolvedValue(mockIssuePayload('id-min', 'ABC-M'));

            const input = makeInput({
                severityId: undefined,
                stepsToReproduce: undefined,
                expectedResult: undefined,
                actualResult: undefined,
                attachments: undefined,
                environment: { timestamp: '2026-03-06T12:00:00Z' }
            });

            // Act
            await service.createIssue(input);

            // Assert
            const description = (
                mockClientInstance.createIssue.mock.calls[0]?.[0] as { description: string }
            ).description;

            expect(description).not.toContain('## Pasos para reproducir');
            expect(description).not.toContain('## Resultado esperado');
            expect(description).not.toContain('## Resultado actual');
            expect(description).not.toContain('## Capturas');
            expect(description).not.toContain('## Errores de consola');
            expect(description).not.toContain('## Error');
            expect(description).not.toContain('**Severidad:**');
        });

        it('should always include reporter, description, environment and source sections', async () => {
            // Arrange
            const service = makeService();
            mockClientInstance.createIssue.mockResolvedValue(
                mockIssuePayload('id-always', 'ABC-A')
            );

            // Act
            await service.createIssue(makeInput());

            // Assert
            const description = (
                mockClientInstance.createIssue.mock.calls[0]?.[0] as { description: string }
            ).description;

            expect(description).toContain('## Reportado por');
            expect(description).toContain('## Descripcion');
            expect(description).toContain('## Entorno');
            expect(description).toContain('*Fuente:');
        });
    });

    // -------------------------------------------------------------------------
    // collectLabels
    // -------------------------------------------------------------------------

    describe('collectLabels', () => {
        it('should include real report-type label and real source label', async () => {
            // Arrange - bug-js has real label, web source has real label
            const service = makeService();
            mockClientInstance.createIssue.mockResolvedValue(mockIssuePayload('id-lbl', 'ABC-L'));

            const input = makeInput({ reportTypeId: 'bug-js', appSource: 'web' });

            // Act
            await service.createIssue(input);

            // Assert
            const call = mockClientInstance.createIssue.mock.calls[0]?.[0] as {
                labelIds: string[];
            };
            expect(call.labelIds).toContain('lbl-bug-js');
            expect(call.labelIds).toContain('lbl-source-web');
        });

        it('should exclude placeholder report-type labels', async () => {
            // Arrange - feature-request still has PLACEHOLDER_ label
            const service = makeService();
            mockClientInstance.createIssue.mockResolvedValue(mockIssuePayload('id-ph', 'ABC-P'));

            const input = makeInput({ reportTypeId: 'feature-request', appSource: 'web' });

            // Act
            await service.createIssue(input);

            // Assert
            const call = mockClientInstance.createIssue.mock.calls[0]?.[0] as {
                labelIds: string[];
            };
            expect(call.labelIds).not.toContain('PLACEHOLDER_LABEL_FEATURE_REQUEST');
            // web source label is real, should still be present
            expect(call.labelIds).toContain('lbl-source-web');
        });

        it('should exclude placeholder source labels', async () => {
            // Arrange - admin source is still PLACEHOLDER_
            const service = makeService();
            mockClientInstance.createIssue.mockResolvedValue(mockIssuePayload('id-ph2', 'ABC-P2'));

            const input = makeInput({ reportTypeId: 'bug-js', appSource: 'admin' });

            // Act
            await service.createIssue(input);

            // Assert
            const call = mockClientInstance.createIssue.mock.calls[0]?.[0] as {
                labelIds: string[];
            };
            expect(call.labelIds).not.toContain('PLACEHOLDER_LABEL_SOURCE_ADMIN');
            // bug-js label is real
            expect(call.labelIds).toContain('lbl-bug-js');
        });

        it('should produce an empty labelIds array when all labels are placeholders', async () => {
            // Arrange
            const service = makeService();
            mockClientInstance.createIssue.mockResolvedValue(mockIssuePayload('id-empty', 'ABC-E'));

            const input = makeInput({ reportTypeId: 'feature-request', appSource: 'admin' });

            // Act
            await service.createIssue(input);

            // Assert
            const call = mockClientInstance.createIssue.mock.calls[0]?.[0] as {
                labelIds: string[];
            };
            expect(call.labelIds).toHaveLength(0);
        });
    });
});
