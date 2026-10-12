import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';

/** Default local port for the Brevo-shaped E2E mail capture server. */
export const E2E_MAIL_CAPTURE_PORT = 18091;
/** Default local URL for the Brevo-shaped E2E mail capture server. */
export const E2E_MAIL_CAPTURE_URL = `http://127.0.0.1:${E2E_MAIL_CAPTURE_PORT}`;

/** A message accepted by the local email capture server. */
export interface CapturedE2eMail {
    readonly to: readonly string[];
    readonly subject: string;
    readonly html: string;
    readonly receivedAt: Date;
}

/** Options for starting the local email capture server. */
export interface E2eMailCaptureOptions {
    readonly port?: number;
    readonly host?: string;
}

/** A running local server that captures the Brevo transactional email request shape. */
export interface E2eMailCaptureServer {
    readonly url: string;
    readonly port: number;
    mails(): readonly CapturedE2eMail[];
    mailsTo(args: { readonly to: string }): readonly CapturedE2eMail[];
    waitForMail(args: {
        readonly to: string;
        readonly subject: string;
        readonly timeoutMs: number;
    }): Promise<CapturedE2eMail>;
    close(): Promise<void>;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

/** Start the local Brevo-shaped mail capture server. */
export async function startE2eMailCapture(
    options: E2eMailCaptureOptions = {}
): Promise<E2eMailCaptureServer> {
    const captured: CapturedE2eMail[] = [];
    const server: Server = createServer(async (request, response) => {
        if (request.method !== 'POST' || request.url !== '/smtp/email') {
            response.writeHead(404).end();
            return;
        }
        let body: unknown;
        try {
            body = await readJson(request);
        } catch {
            response.writeHead(400).end();
            return;
        }
        if (typeof body !== 'object' || body === null || Array.isArray(body)) {
            response.writeHead(400).end();
            return;
        }
        const mail = body as Record<string, unknown>;
        const sender = mail.sender;
        const recipients = mail.to;
        if (
            typeof sender !== 'object' ||
            sender === null ||
            typeof (sender as Record<string, unknown>).email !== 'string' ||
            !Array.isArray(recipients) ||
            recipients.length === 0 ||
            !recipients.every(
                (recipient) =>
                    typeof recipient === 'object' &&
                    recipient !== null &&
                    typeof (recipient as Record<string, unknown>).email === 'string'
            ) ||
            typeof mail.subject !== 'string' ||
            typeof mail.htmlContent !== 'string'
        ) {
            response.writeHead(400).end();
            return;
        }
        captured.push({
            to: recipients.map((recipient) => (recipient as { email: string }).email),
            subject: mail.subject,
            html: mail.htmlContent,
            receivedAt: new Date()
        });
        response.writeHead(201, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ messageId: `${randomUUID()}@e2e-capture` }));
    });
    const host = options.host ?? '127.0.0.1';
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port ?? E2E_MAIL_CAPTURE_PORT, host, () => {
            server.off('error', reject);
            resolve();
        });
    });
    const address = server.address();
    if (!address || typeof address === 'string')
        throw new Error('Could not determine capture port');
    return {
        url: `http://${host}:${address.port}`,
        port: address.port,
        mails() {
            return structuredClone(captured);
        },
        mailsTo(args) {
            return captured
                .filter((mail) => mail.to.includes(args.to))
                .map((mail) => structuredClone(mail));
        },
        async waitForMail(args) {
            const deadline = Date.now() + args.timeoutMs;
            while (Date.now() <= deadline) {
                const match = captured.find(
                    (mail) => mail.to.includes(args.to) && mail.subject === args.subject
                );
                if (match) return structuredClone(match);
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
            const subjects = captured
                .filter((mail) => mail.to.includes(args.to))
                .map((mail) => mail.subject);
            throw new Error(
                `Timed out waiting for mail to ${args.to} with subject "${args.subject}". ` +
                    `Captured subjects for recipient: ${subjects.join(', ') || '(none)'}`
            );
        },
        async close() {
            server.closeAllConnections();
            await new Promise<void>((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve()))
            );
        }
    };
}
