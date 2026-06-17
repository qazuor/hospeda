import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { CaretLeftIcon } from '../../../src/components/icons';
import { theme } from '../../../src/design';
import {
    type ThreadMessage,
    useConversationThread
} from '../../../src/lib/api/hooks/use-conversation-thread';
import { useReplyConversation } from '../../../src/lib/api/hooks/use-reply-conversation';
import { appDefaultLocale, getTranslation } from '../../../src/lib/i18n';
import { logger } from '../../../src/lib/logger';

/**
 * Conversation thread + reply screen (SPEC-243 T-044).
 *
 * Reads the conversation `id` from Expo Router's dynamic segment.
 * Fetches GET /api/v1/protected/conversations/owner/:id which also updates
 * `lastReadAtByOwner` server-side, marking the conversation as read.
 *
 * Renders:
 * - Message history as a FlatList with guest/owner message distinction.
 * - A text input + send button at the bottom for composing a reply.
 * - Send calls POST /api/v1/protected/conversations/owner/:id/messages
 *   with body { body: string }. On success: clears input + invalidates
 *   thread, inbox list, and unread-count queries (AC-M3.2).
 *
 * Loading, error, and empty states are handled explicitly.
 *
 * Expo Router requires a **default export** for route files.
 * Styling uses StyleSheet.create at module scope (ADR-034).
 */
export default function ConversationThreadScreen() {
    const t = (key: string) => getTranslation(key, appDefaultLocale);
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const { data, isLoading, error, refetch } = useConversationThread(id);
    const replyMutation = useReplyConversation();

    const [replyText, setReplyText] = useState('');
    const [sendError, setSendError] = useState<string | null>(null);
    const flatListRef = useRef<FlatList<ThreadMessage>>(null);
    /**
     * Tracks whether the initial scroll-to-end has already been performed.
     * Flipped to true after the first non-empty message list is rendered so
     * that subsequent content size changes (keyboard, new incoming messages)
     * do NOT yank the user back to the bottom while they scroll up to read.
     */
    const hasScrolledToEnd = useRef(false);

    const handleSend = () => {
        const trimmed = replyText.trim();
        if (!trimmed || !id) return;

        setSendError(null);
        replyMutation.mutate(
            { id, body: trimmed },
            {
                onSuccess: () => {
                    setReplyText('');
                    // Scroll to bottom to show the newly sent message
                    flatListRef.current?.scrollToEnd({ animated: true });
                },
                onError: (err) => {
                    logger.warn('ConversationThread reply error', { error: String(err) });
                    setSendError(t('mobile.host.conversations.thread.sendError'));
                }
            }
        );
    };

    // Header with back button and conversation subject
    const guestLabel = data?.conversation.guestName ?? t('mobile.host.conversations.guestUnknown');

    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        accessibilityRole="button"
                        accessibilityLabel={t('mobile.host.conversations.thread.back')}
                    >
                        <CaretLeftIcon
                            color={theme.colors.river[500]}
                            size={24}
                            weight="bold"
                        />
                    </TouchableOpacity>
                    <View style={styles.headerTitles}>
                        <Text
                            style={styles.headerTitle}
                            numberOfLines={1}
                        >
                            {isLoading ? t('mobile.host.conversations.thread.title') : guestLabel}
                        </Text>
                        {data?.conversation.accommodationName ? (
                            <Text
                                style={styles.headerSubtitle}
                                numberOfLines={1}
                            >
                                {data.conversation.accommodationName}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {/* Messages */}
                {isLoading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator
                            size="large"
                            color={theme.colors.river[500]}
                        />
                        <Text style={styles.loadingText}>
                            {t('mobile.host.conversations.thread.loading')}
                        </Text>
                    </View>
                ) : error ? (
                    <View style={styles.centered}>
                        <Text style={styles.errorText}>
                            {t('mobile.host.conversations.thread.error')}
                        </Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => void refetch()}
                        >
                            <Text style={styles.retryButtonText}>
                                {t('mobile.host.conversations.retry')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={data?.messages ?? []}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }: ListRenderItemInfo<ThreadMessage>) => (
                            <MessageBubble message={item} />
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>
                                    {t('mobile.host.conversations.thread.empty')}
                                </Text>
                            </View>
                        }
                        contentContainerStyle={styles.messageList}
                        showsVerticalScrollIndicator={false}
                        onLayout={() => {
                            // Scroll to the latest message once on initial render.
                            // The flag prevents subsequent layout events (keyboard
                            // open/close, window resize) from yanking the user back
                            // while they scroll up to read history.
                            if (!hasScrolledToEnd.current && (data?.messages.length ?? 0) > 0) {
                                hasScrolledToEnd.current = true;
                                flatListRef.current?.scrollToEnd({ animated: false });
                            }
                        }}
                    />
                )}

                {/* Reply input */}
                <View style={styles.replyBar}>
                    {sendError ? <Text style={styles.sendErrorText}>{sendError}</Text> : null}
                    <View style={styles.replyRow}>
                        <TextInput
                            style={styles.replyInput}
                            value={replyText}
                            onChangeText={setReplyText}
                            placeholder={t('mobile.host.conversations.thread.inputPlaceholder')}
                            placeholderTextColor={theme.colors.neutral[400]}
                            multiline
                            maxLength={5000}
                            accessible
                            accessibilityLabel={t(
                                'mobile.host.conversations.thread.inputPlaceholder'
                            )}
                        />
                        <TouchableOpacity
                            style={[
                                styles.sendButton,
                                (!replyText.trim() || replyMutation.isPending) &&
                                    styles.sendButtonDisabled
                            ]}
                            onPress={handleSend}
                            disabled={!replyText.trim() || replyMutation.isPending}
                            accessibilityRole="button"
                            accessibilityLabel={t('mobile.host.conversations.thread.send')}
                        >
                            {replyMutation.isPending ? (
                                <ActivityIndicator
                                    size="small"
                                    color={theme.colors.semantic.textInverted}
                                />
                            ) : (
                                <Text style={styles.sendButtonText}>
                                    {t('mobile.host.conversations.thread.send')}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

// ---------------------------------------------------------------------------
// Message bubble component
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
    message: ThreadMessage;
}

/** Renders a single message bubble, right-aligned for OWNER, left for GUEST. */
function MessageBubble({ message }: MessageBubbleProps) {
    const isOwner = message.senderType === 'OWNER';

    return (
        <View style={[styles.bubbleWrapper, isOwner ? styles.bubbleWrapperOwner : null]}>
            <View style={[styles.bubble, isOwner ? styles.bubbleOwner : styles.bubbleGuest]}>
                <Text style={[styles.bubbleText, isOwner ? styles.bubbleTextOwner : null]}>
                    {message.body}
                </Text>
                <Text style={[styles.bubbleTime, isOwner ? styles.bubbleTimeOwner : null]}>
                    {formatTime(message.createdAt)}
                </Text>
            </View>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a message timestamp as HH:MM for display in the bubble footer.
 */
function formatTime(createdAt: string | Date): string {
    const date = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Styles — module scope (ADR-034)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    flex: {
        flex: 1
    },
    container: {
        flex: 1,
        backgroundColor: theme.colors.semantic.background
    },
    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.semantic.border,
        backgroundColor: theme.colors.semantic.background
    },
    backButton: {
        marginRight: theme.spacing[3],
        padding: theme.spacing[1]
    },
    headerTitles: {
        flex: 1
    },
    headerTitle: {
        fontSize: theme.typography.semantic.body,
        fontWeight: '700',
        color: theme.colors.neutral[700]
    },
    headerSubtitle: {
        fontSize: theme.typography.semantic.bodySm,
        color: theme.colors.neutral[500],
        marginTop: 2
    },
    // States
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing[6]
    },
    loadingText: {
        marginTop: theme.spacing[3],
        fontSize: theme.typography.semantic.bodySm,
        color: theme.colors.neutral[500]
    },
    errorText: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.danger[600],
        textAlign: 'center',
        marginBottom: theme.spacing[4]
    },
    retryButton: {
        backgroundColor: theme.colors.river[500],
        borderRadius: theme.radius.semantic.button,
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[6]
    },
    retryButtonText: {
        color: theme.colors.semantic.textInverted,
        fontSize: theme.typography.semantic.button,
        fontWeight: '600'
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: theme.spacing[12]
    },
    emptyText: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.neutral[400]
    },
    // Messages
    messageList: {
        padding: theme.spacing[4],
        paddingBottom: theme.spacing[6]
    },
    bubbleWrapper: {
        marginBottom: theme.spacing[3],
        alignItems: 'flex-start'
    },
    bubbleWrapperOwner: {
        alignItems: 'flex-end'
    },
    bubble: {
        maxWidth: '80%',
        borderRadius: theme.radius.semantic.card,
        padding: theme.spacing[3]
    },
    bubbleGuest: {
        backgroundColor: theme.colors.neutral[100],
        borderBottomLeftRadius: 4
    },
    bubbleOwner: {
        backgroundColor: theme.colors.river[500],
        borderBottomRightRadius: 4
    },
    bubbleText: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.neutral[700],
        lineHeight: 20
    },
    bubbleTextOwner: {
        color: theme.colors.semantic.textInverted
    },
    bubbleTime: {
        fontSize: theme.typography.semantic.caption,
        color: theme.colors.neutral[400],
        marginTop: theme.spacing[1],
        textAlign: 'right'
    },
    bubbleTimeOwner: {
        color: 'rgba(255,255,255,0.7)'
    },
    // Reply bar
    replyBar: {
        borderTopWidth: 1,
        borderTopColor: theme.colors.semantic.border,
        backgroundColor: theme.colors.semantic.background,
        padding: theme.spacing[3]
    },
    sendErrorText: {
        fontSize: theme.typography.semantic.bodySm,
        color: theme.colors.danger[600],
        marginBottom: theme.spacing[2]
    },
    replyRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: theme.spacing[3]
    },
    replyInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: theme.colors.semantic.border,
        borderRadius: theme.radius.semantic.button,
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[2],
        fontSize: theme.typography.semantic.body,
        color: theme.colors.neutral[700],
        backgroundColor: theme.colors.neutral[50],
        maxHeight: 120,
        minHeight: 44
    },
    sendButton: {
        backgroundColor: theme.colors.river[500],
        borderRadius: theme.radius.semantic.button,
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[4],
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 72,
        minHeight: 44
    },
    sendButtonDisabled: {
        backgroundColor: theme.colors.neutral[300]
    },
    sendButtonText: {
        color: theme.colors.semantic.textInverted,
        fontSize: theme.typography.semantic.button,
        fontWeight: '600'
    }
});
