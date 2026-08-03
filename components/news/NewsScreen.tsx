import { AuthScreenBackground } from '@/components/auth/AuthChrome';
import { AUTH_MOBILE_DOCK_PADDING } from '@/components/auth/AuthNavigation';
import Header from '@/components/Header';
import { NewsList } from '@/components/news/NewsList';
import { useResponsive } from '@/hooks/useResponsive';
import { router } from 'expo-router';
import { t } from 'i18next';
import { StyleSheet, View } from 'react-native';

export function NewsScreen() {
    const { height } = useResponsive();

    const backFunction = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };
    return (
        <View style={[styles.container, { minHeight: height }]}>
            <AuthScreenBackground />
            <Header
                isDesktop={false}
                title={t('news.header')}
                showSearch={false}
                onGoBack={backFunction}
            />
            <NewsList contentContainerStyle={styles.contentWithDock} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
    },
    contentWithDock: {
        paddingBottom: AUTH_MOBILE_DOCK_PADDING,
    },
});