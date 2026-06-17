import { useRouter } from 'expo-router';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { theme } from '../../../src/design';
import {
    type OwnerConversationItem,
    useOwnerConversations
} from '../../../src/lib/api/hooks/use-owner-conversations';
import { getTranslation } from '../../../src/lib/i18n';
import { useLocale } from '../../../src/lib/locale-context';
import { logger } from '../../../src/lib/logger';

/**
 * Host conversations inbox screen (SPEC-243 T-043).
 *
 * Fetches GET /api/v1/protected/conversations/owner (page 1, pageSize 20).
 * Renders a FlatList of conversation rows, each showing:
 * - Guest name (or fallback label when null)
 * - Accommodation name
 * - Latest message excerpt
 * - Unread badge when unreadCount > 0 (AC-M3.1)
 *
 * Tapping a row navigates to ./[id] (thread + reply screen).
 * Loading, error, and empty states are handled explicitly.
 *
 * Expo Router requires a **default export** for route files.
 * Styling uses StyleSheet.create at module scope (ADR-034).
 */
export default function ConversationsInboxScreen() {
    const { locale } = useLocale();
    const t = (key: string) => getTranslation(key, locale);
    const router = useRouter();
    const { data, isLoading, isRefetching, error, refetch } = useOwnerConversations({
        page: 1,
        pageSize: 20
    });

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator
                    size="large"
                    color={theme.colors.river[500]}
                />
                <Text style={styles.loadingText}>{t('mobile.host.conversations.loading')}</Text>
            </View>
        );
    }

    if (error) {
        logger.warn('ConversationsInbox fetch error', { error: String(error) });
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{t('mobile.host.conversations.error')}</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => void refetch()}
                >
                    <Text style={styles.retryButtonText}>
                        {t('mobile.host.conversations.retry')}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    const items = data?.items ?? [];

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{t('mobile.host.conversations.title')}</Text>
            <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: ListRenderItemInfo<OwnerConversationItem>) => (
                    <ConversationRow
                        item={item}
                        onPress={() => router.push(`/(host)/conversations/${item.id}`)}
                        t={t}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>{t('mobile.host.conversations.empty')}</Text>
                    </View>
                }
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching || isLoading}
                        onRefresh={() => void refetch()}
                        colors={[theme.colors.river[500]]}
                        tintColor={theme.colors.river[500]}
                    />
                }
            />
        </View>
    );
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

interface ConversationRowProps {
    item: OwnerConversationItem;
    onPress: () => void;
    t: (key: string) => string;
}

/**
 * Renders a single inbox row.
 *
 * Shows: guest name, accommodation name, latest message preview, and an
 * unread badge when unreadCount > 0 (AC-M3.1).
 */
function ConversationRow({ item, onPress, t }: ConversationRowProps) {
    const guestLabel = item.guestName ?? t('mobile.host.conversations.guestUnknown');
    const hasUnread = item.unreadCount > 0;

    return (
        <TouchableOpacity
            style={styles.row}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={guestLabel}
        >
            <View style={styles.rowContent}>
                <View style={styles.rowLeft}>
                    <View style={styles.rowHeader}>
                        <Text
                            style={[styles.guestName, hasUnread && styles.guestNameUnread]}
                            numberOfLines={1}
                        >
                            {guestLabel}
                        </Text>
                        {hasUnread ? (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                            </View>
                        ) : null}
                    </View>
                    {item.accommodationName ? (
                        <Text
                            style={styles.accommodationName}
                            numberOfLines={1}
                        >
                            {item.accommodationName}
                        </Text>
                    ) : null}
                    {item.lastMessageExcerpt ? (
                        <Text
                            style={styles.excerpt}
                            numberOfLines={2}
                        >
                            {item.lastMessageExcerpt}
                        </Text>
                    ) : null}
                </View>
            </View>
        </TouchableOpacity>
    );
}

// ---------------------------------------------------------------------------
// Styles — module scope (ADR-034)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.semantic.background,
        padding: theme.spacing[5]
    },
    centered: {
        flex: 1,
        backgroundColor: theme.colors.semantic.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing[6]
    },
    title: {
        fontSize: theme.typography.semantic.h2,
        fontWeight: '700',
        color: theme.colors.neutral[700],
        marginBottom: theme.spacing[4]
    },
    list: {
        paddingBottom: theme.spacing[10]
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
    row: {
        backgroundColor: theme.colors.neutral[50],
        borderRadius: theme.radius.semantic.card,
        borderWidth: 1,
        borderColor: theme.colors.semantic.border,
        marginBottom: theme.spacing[3],
        padding: theme.spacing[4]
    },
    rowContent: {
        flexDirection: 'row',
        alignItems: 'flex-start'
    },
    rowLeft: {
        flex: 1
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing[1]
    },
    guestName: {
        flex: 1,
        fontSize: theme.typography.semantic.body,
        fontWeight: '600',
        color: theme.colors.neutral[700],
        marginRight: theme.spacing[2]
    },
    guestNameUnread: {
        color: theme.colors.river[700]
    },
    accommodationName: {
        fontSize: theme.typography.semantic.bodySm,
        color: theme.colors.neutral[500],
        marginBottom: theme.spacing[1]
    },
    excerpt: {
        fontSize: theme.typography.semantic.bodySm,
        color: theme.colors.neutral[400],
        lineHeight: 18
    },
    unreadBadge: {
        backgroundColor: theme.colors.river[500],
        borderRadius: theme.radius.semantic.pill,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing[2]
    },
    unreadBadgeText: {
        color: theme.colors.semantic.textInverted,
        fontSize: theme.typography.semantic.caption,
        fontWeight: '700'
    }
});
