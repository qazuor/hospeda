import type {
    EmailTransport,
    SendEmailInput,
    SendEmailResult
} from './email-transport.interface.js';

/**
 * Mock email transport for testing
 *
 * Stores sent emails in memory instead of actually sending them.
 * Useful for unit tests and development environments.
 *
 * @example
 * ```ts
 * // In tests
 * const mockTransport = new MockEmailTransport();
 *
 * await emailService.send({
 *   to: 'test@example.com',
 *   subject: 'Test',
 *   react: <TestEmail />
 * });
 *
 * expect(mockTransport.sentEmails).toHaveLength(1);
 * expect(mockTransport.getLastEmail()?.to).toBe('test@example.com');
 * ```
 *
 * @example
 * ```ts
 * // Simulate failures
 * const mockTransport = new MockEmailTransport({ shouldFail: true });
 *
 * await expect(
 *   emailService.send({ to: 'test@example.com', ... })
 * ).rejects.toThrow('Mock email transport configured to fail');
 * ```
 */
export class MockEmailTransport implements EmailTransport {
    /** Array of all emails sent through this transport */
    public sentEmails: SendEmailInput[] = [];

    /** Whether to throw errors on send attempts */
    private readonly shouldFail: boolean;

    /** Error message to throw when shouldFail is true */
    private readonly failureMessage: string;

    /**
     * Creates a new mock email transport
     *
     * @param options - Mock configuration options
     * @param options.shouldFail - If true, send() will throw errors
     * @param options.failureMessage - Custom error message for failures
     */
    constructor(options?: { shouldFail?: boolean; failureMessage?: string }) {
        this.shouldFail = options?.shouldFail ?? false;
        this.failureMessage = options?.failureMessage || 'Mock email transport configured to fail';
    }

    /**
     * Mock send implementation
     *
     * Stores the email in memory and returns a fake message ID.
     * If configured to fail, throws an error instead.
     *
     * @param input - Email content and metadata
     * @returns Promise resolving to send result with fake message ID
     * @throws {Error} If shouldFail is true
     */
    async send(input: SendEmailInput): Promise<SendEmailResult> {
        if (this.shouldFail) {
            throw new Error(this.failureMessage);
        }

        this.sentEmails.push(input);

        return {
            messageId: `mock-${Date.now()}-${this.sentEmails.length}`
        };
    }

    /**
     * Get the most recently sent email
     *
     * @returns Last email sent, or undefined if none sent
     */
    getLastEmail(): SendEmailInput | undefined {
        return this.sentEmails[this.sentEmails.length - 1];
    }

    /**
     * Clear all stored emails
     *
     * Resets the sentEmails array to empty. Useful between tests.
     */
    reset(): void {
        this.sentEmails = [];
    }
}
