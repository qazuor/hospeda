import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRightIcon, ChevronDownIcon, ChevronRightIcon, DebugIcon } from '@repo/icons';
import { type RefObject, useState } from 'react';

/** Debug metadata attached to each assistant message. */
interface DebugInfo {
    readonly provider: string;
    readonly model: string;
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
    readonly finishReason: string;
    readonly conversationId?: string;
}

/** Debug context data sent before the stream starts. */
interface DebugContext {
    readonly contextBlock: string;
    readonly resolvedPrompt: string;
    readonly systemMessage: string;
    readonly feature: string;
    readonly accommodationId?: string;
}

/** A single message in the playground conversation. */
interface PlaygroundMessage {
    readonly role: 'user' | 'assistant' | 'system' | 'error';
    readonly content: string;
    readonly timestamp: number;
    readonly debugInfo?: DebugInfo;
    readonly debugContext?: DebugContext;
}

/**
 * Renders the conversation area with messages, streaming bubble, and input.
 */
export function MessagesArea(props: {
    readonly messages: readonly PlaygroundMessage[];
    readonly isStreaming: boolean;
    readonly currentAssistantContent: string;
    readonly inputMessage: string;
    readonly onInputChange: (value: string) => void;
    readonly onSend: () => void;
    readonly onAbort: () => void;
    readonly onKeyDown: (e: React.KeyboardEvent) => void;
    readonly messagesEndRef: RefObject<HTMLDivElement | null>;
}) {
    const {
        messages,
        isStreaming,
        currentAssistantContent,
        inputMessage,
        onInputChange,
        onSend,
        onAbort,
        onKeyDown,
        messagesEndRef
    } = props;

    const [openDebugId, setOpenDebugId] = useState<number | null>(null);
    const [openDebugSection, setOpenDebugSection] = useState<
        'metadata' | 'contextBlock' | 'systemPrompt' | 'fullSystem' | 'messages' | null
    >('metadata');

    const toggleDebug = (timestamp: number) => {
        setOpenDebugId((prev) => (prev === timestamp ? null : timestamp));
    };

    const toggleDebugSection = (
        section: 'metadata' | 'contextBlock' | 'systemPrompt' | 'fullSystem' | 'messages'
    ) => {
        setOpenDebugSection((prev) => (prev === section ? null : section));
    };

    /** Truncate a string to maxLen, adding ellipsis if truncated. */
    const truncate = (text: string, maxLen: number) =>
        text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;

    /** Get the messages that were sent before a given assistant message index. */
    const getMessagesSent = (assistantIndex: number) => messages.slice(0, assistantIndex);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Conversación</CardTitle>
                <CardDescription>
                    {messages.length === 0
                        ? 'Enviá un mensaje para comenzar.'
                        : `${messages.length} mensaje${messages.length === 1 ? '' : 's'}`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="max-h-[400px] min-h-[200px] space-y-3 overflow-y-auto rounded-md border bg-muted/30 p-4">
                    {messages.length === 0 && !isStreaming && (
                        <p className="text-center text-muted-foreground text-sm">
                            No hay mensajes aún. Escribí algo para probar la IA.
                        </p>
                    )}

                    {messages.map((msg, i) => {
                        const isDebugOpen = openDebugId === msg.timestamp;
                        const messagesSent = msg.role === 'assistant' ? getMessagesSent(i) : [];

                        return (
                            <div
                                key={`${msg.timestamp}-${i}`}
                                className={`flex flex-col ${
                                    msg.role === 'user' ? 'items-end' : 'items-start'
                                }`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                        msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : msg.role === 'error'
                                              ? 'bg-destructive/10 text-destructive'
                                              : 'border bg-background'
                                    }`}
                                >
                                    <div className="mb-1 font-medium text-xs opacity-70">
                                        {msg.role === 'user'
                                            ? 'Tú'
                                            : msg.role === 'error'
                                              ? 'Error'
                                              : 'Asistente'}
                                    </div>
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                </div>

                                {/* Debug panel for assistant messages */}
                                {msg.role === 'assistant' && msg.debugInfo && (
                                    <div className="mt-1 max-w-[80%]">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 gap-1 px-2 font-mono text-muted-foreground text-xs"
                                            onClick={() => toggleDebug(msg.timestamp)}
                                        >
                                            <DebugIcon className="h-3 w-3" />
                                            {isDebugOpen ? 'Ocultar debug' : 'Ver debug'}
                                            {isDebugOpen ? (
                                                <ChevronDownIcon className="h-3 w-3" />
                                            ) : (
                                                <ChevronRightIcon className="h-3 w-3" />
                                            )}
                                        </Button>

                                        {isDebugOpen && (
                                            <div className="mt-1 space-y-2 rounded-md border border-dashed bg-muted/50 p-3 font-mono text-xs">
                                                {/* Section: Metadata */}
                                                <DebugSection
                                                    title="Metadata"
                                                    id="metadata"
                                                    isOpen={openDebugSection === 'metadata'}
                                                    onToggle={() => toggleDebugSection('metadata')}
                                                >
                                                    <div className="space-y-1">
                                                        <div>
                                                            <span className="text-muted-foreground">
                                                                Provider:{' '}
                                                            </span>
                                                            {msg.debugInfo.provider}
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">
                                                                Model:{' '}
                                                            </span>
                                                            {msg.debugInfo.model}
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">
                                                                Tokens:{' '}
                                                            </span>
                                                            {msg.debugInfo.promptTokens} prompt +{' '}
                                                            {msg.debugInfo.completionTokens}{' '}
                                                            completion
                                                        </div>
                                                        {msg.debugInfo.conversationId && (
                                                            <div>
                                                                <span className="text-muted-foreground">
                                                                    Conversation ID:{' '}
                                                                </span>
                                                                <span className="break-all">
                                                                    {msg.debugInfo.conversationId}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <span className="text-muted-foreground">
                                                                Finish:{' '}
                                                            </span>
                                                            {msg.debugInfo.finishReason}
                                                        </div>
                                                    </div>
                                                </DebugSection>

                                                {/* Section: Context Block */}
                                                {msg.debugContext && (
                                                    <DebugSection
                                                        title="Context Block (accommodation data)"
                                                        id="contextBlock"
                                                        isOpen={openDebugSection === 'contextBlock'}
                                                        onToggle={() =>
                                                            toggleDebugSection('contextBlock')
                                                        }
                                                    >
                                                        <pre className="max-h-[300px] overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed">
                                                            {msg.debugContext.contextBlock ||
                                                                '(empty)'}
                                                        </pre>
                                                    </DebugSection>
                                                )}

                                                {/* Section: System Prompt */}
                                                {msg.debugContext && (
                                                    <DebugSection
                                                        title="System Prompt (resolved from DB)"
                                                        id="systemPrompt"
                                                        isOpen={openDebugSection === 'systemPrompt'}
                                                        onToggle={() =>
                                                            toggleDebugSection('systemPrompt')
                                                        }
                                                    >
                                                        <pre className="max-h-[300px] overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed">
                                                            {msg.debugContext.resolvedPrompt ||
                                                                '(empty)'}
                                                        </pre>
                                                    </DebugSection>
                                                )}

                                                {/* Section: Full System Message */}
                                                {msg.debugContext && (
                                                    <DebugSection
                                                        title="Full System Message (sent to model)"
                                                        id="fullSystem"
                                                        isOpen={openDebugSection === 'fullSystem'}
                                                        onToggle={() =>
                                                            toggleDebugSection('fullSystem')
                                                        }
                                                    >
                                                        <pre className="max-h-[300px] overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed">
                                                            {msg.debugContext.systemMessage ||
                                                                '(empty)'}
                                                        </pre>
                                                    </DebugSection>
                                                )}

                                                {/* Section: Messages Sent */}
                                                <DebugSection
                                                    title="Messages Sent"
                                                    id="messages"
                                                    isOpen={openDebugSection === 'messages'}
                                                    onToggle={() => toggleDebugSection('messages')}
                                                >
                                                    <div className="space-y-1 border-border border-l-2 pl-2">
                                                        {messagesSent.length === 0 ? (
                                                            <div className="text-muted-foreground italic">
                                                                (no messages — first exchange)
                                                            </div>
                                                        ) : (
                                                            messagesSent.map((m, j) => (
                                                                <div key={`${m.timestamp}-${j}`}>
                                                                    <span className="text-muted-foreground">
                                                                        [{m.role}]{' '}
                                                                    </span>
                                                                    {truncate(m.content, 100)}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </DebugSection>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {currentAssistantContent && (
                        <div className="flex justify-start">
                            <div className="max-w-[80%] rounded-lg border bg-background px-3 py-2 text-sm">
                                <div className="mb-1 font-medium text-xs opacity-70">
                                    Asistente
                                    <span className="ml-2 animate-pulse">●</span>
                                </div>
                                <div className="whitespace-pre-wrap">{currentAssistantContent}</div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <div className="mt-4 flex gap-2">
                    <Textarea
                        value={inputMessage}
                        onChange={(e) => onInputChange(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="Escribí tu mensaje de prueba..."
                        className="min-h-[60px]"
                        disabled={isStreaming}
                    />
                    <div className="flex flex-col gap-2">
                        {isStreaming ? (
                            <Button
                                variant="destructive"
                                onClick={onAbort}
                                className="h-auto"
                            >
                                Detener
                            </Button>
                        ) : (
                            <Button
                                onClick={onSend}
                                disabled={!inputMessage.trim()}
                                className="h-auto"
                            >
                                <ArrowRightIcon className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Debug section helper
// ---------------------------------------------------------------------------

function DebugSection(props: {
    readonly title: string;
    readonly id: string;
    readonly isOpen: boolean;
    readonly onToggle: () => void;
    readonly children: React.ReactNode;
}) {
    const { title, isOpen, onToggle, children } = props;

    return (
        <div className="rounded border border-border/50 bg-background/50 p-2">
            <button
                type="button"
                className="flex w-full items-center justify-between text-left font-semibold text-[11px] text-muted-foreground uppercase tracking-wide"
                onClick={onToggle}
            >
                {title}
                {isOpen ? (
                    <ChevronDownIcon className="h-3 w-3 shrink-0" />
                ) : (
                    <ChevronRightIcon className="h-3 w-3 shrink-0" />
                )}
            </button>
            {isOpen && <div className="mt-2">{children}</div>}
        </div>
    );
}
