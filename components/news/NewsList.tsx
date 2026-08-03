import type { NewsCategoryKey } from '@/components/news/NEWS_CATEGORY';
import { NEWS_SPACING } from '@/components/news/NEWS_THEME';
import { NewsEmpty } from '@/components/news/NewsEmpty';
import { NewsItem as NewsListItem } from '@/components/news/NewsItem';
import { NewsSectionHeader } from '@/components/news/NewsSectionHeader';
import { supabase } from '@/lib/URLs';
import { t } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, SectionList, StyleProp, StyleSheet, View, ViewStyle, ViewToken } from 'react-native';

type NewsItem = {
    id: string,
    title: string,
    content: string,
    category: 'urgent' | 'common' | 'publicity',
    status: string,
    created_at: string,
    image_url: string | null,
    important_until: string | null;
}

type NewsSection = {
    key: 'important' | 'recent';
    title: string;
    data: NewsItem[];
};

type NewsRead = {
    news_id: string;
};

const IMPORTANT_WINDOW_MS = 24 * 60 * 60 * 1000;

function getRelativeTime(dateString: string) {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return t('news.justNow', { defaultValue: 'hace un momento' });
    if (minutes < 60) return t('news.minutesAgo', { count: minutes, defaultValue: `hace ${minutes} min` });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('news.hoursAgo', { count: hours, defaultValue: `hace ${hours} horas` });
    const days = Math.floor(hours / 24);
    return t('news.daysAgo', { count: days, defaultValue: `hace ${days} días` });
}

type NewsListProps = {
    // Permite que cada wrapper (móvil/escritorio) ajuste solo el padding/estilo del contenido,
    // sin tocar la lógica ni el diseño interno de los items.
    contentContainerStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<ViewStyle>;
};

export function NewsList({ contentContainerStyle, style }: NewsListProps) {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [expansionLevels, setExpansionLevels] = useState<Record<string, number>>({});

    const isAbortError = (error: unknown) =>
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));

    useEffect(() => {
        void loadNews();
    }, []);

    const loadNews = async () => {
        setLoading(true);
        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();
            if (userError && !isAbortError(userError)) {
                console.error('Error loading news user:', userError);
            }
            const currentUserId = user?.id ?? null;
            setUserId(currentUserId);

            const { data: news, error } = await supabase
                .from('news')
                .select('*')
                .eq('status', 'active')
                .neq('category', 'publicity') // publicidad se maneja aparte, no aquí
                .order('created_at', { ascending: false });
            if (news) {
                const activeNews = news as NewsItem[];
                setNews(activeNews);
                if (currentUserId && activeNews.length) {
                    const { data: reads, error: readsError } = await supabase
                        .from('news_reads')
                        .select('news_id')
                        .eq('user_id', currentUserId)
                        .in('news_id', activeNews.map(item => item.id));

                    if (readsError) {
                        if (!isAbortError(readsError)) {
                            console.error('Error loading news reads:', readsError);
                        }
                        setReadIds(new Set());
                    } else {
                        setReadIds(new Set((reads as NewsRead[] | null)?.map(read => read.news_id) ?? []));
                    }
                } else {
                    setReadIds(new Set());
                }
            } else if (error) {
                if (!isAbortError(error)) {
                    console.error('Error loading news:', error);
                }
            }
        } catch (error) {
            if (isAbortError(error)) return;
        } finally {
            setLoading(false);
        }
    };

    const getExpansionLevel = (id: string) => expansionLevels[id] ?? 0;

    const expandStep = (id: string) => {
        setExpansionLevels(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    };

    const collapseToZero = (id: string) => {
        setExpansionLevels(prev => {
            if (!(id in prev)) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const markNewsAsRead = async (id: string) => {
        if (!userId || readIds.has(id)) return;

        setReadIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });

        const { error } = await supabase
            .from('news_reads')
            .upsert(
                {
                    user_id: userId,
                    news_id: id,
                    read_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,news_id' },
            );

        if (error && !isAbortError(error)) {
            console.error('Error marking news as read:', error);
        }
    };

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 60,
        minimumViewTime: 2000,
    }).current;

    const markNewsAsReadRef = useRef(markNewsAsRead);
    useEffect(() => {
        markNewsAsReadRef.current = markNewsAsRead;
    });

    const onViewableItemsChanged = useRef(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            viewableItems.forEach((viewable) => {
                const item = viewable.item as NewsItem | undefined;
                if (item?.id) {
                    void markNewsAsReadRef.current(item.id);
                }
            });
        }
    ).current;

    const handleNewsPress = (id: string) => {
        if (getExpansionLevel(id) > 0) {
            collapseToZero(id);
        } else {
            expandStep(id);
        }
        void markNewsAsRead(id);
    };

    if (loading) {
        return (
            <View style={[styles.loadingScreen, style]}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    const shouldShowAsRecent = (item: NewsItem) => {
        if (item.category !== 'urgent') return true;

        const importantUntil = item.important_until
            ? new Date(item.important_until).getTime()
            : new Date(item.created_at).getTime() + IMPORTANT_WINDOW_MS;

        return importantUntil < Date.now() || readIds.has(item.id);
    };

    const importantNews = news.filter(item => !shouldShowAsRecent(item));
    const recentNews = news.filter(shouldShowAsRecent);

    const sections: NewsSection[] = [
        ...(importantNews.length ? [{ key: 'important' as const, title: t('news.important', { defaultValue: 'Importante' }), data: importantNews }] : []),
        ...(recentNews.length ? [{ key: 'recent' as const, title: t('news.more', { defaultValue: 'Más recientes' }), data: recentNews }] : []),
    ];

    return (
        <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            style={[styles.list, style]}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
            contentContainerStyle={[styles.listContent, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
                <NewsSectionHeader title={section.title} />
            )}
            renderItem={({ item }) => (
                <NewsListItem
                    title={item.title}
                    content={item.content}
                    category={item.category as NewsCategoryKey}
                    relativeTime={getRelativeTime(item.created_at)}
                    expansionLevel={getExpansionLevel(item.id)}
                    imagePath={item.image_url}
                    onPress={() => handleNewsPress(item.id)}
                    onExpand={() => expandStep(item.id)}
                    onCollapse={() => collapseToZero(item.id)}
                />
            )}
            ListEmptyComponent={
                <NewsEmpty title={t('news.empty')} />
            }
        />
    );
}

const styles = StyleSheet.create({
    loadingScreen: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 0,
        paddingTop: 0,
        paddingBottom: NEWS_SPACING.screen,
    },
});