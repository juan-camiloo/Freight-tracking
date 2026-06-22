import { useNativeNotification } from '@/components/ui/NativeNotification';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { requestWebNotificationPermissionAndRegister } from '../lib/pushNotifications';
import { useDashboardShipments } from './useDashboardShipments';
export function useWebNotifications() {
    const [webNotificationPermission, setWebNotificationPermission] = useState<string | null>(null);
    const notification = useNativeNotification();
    const userId:any = useDashboardShipments();

    const { t } = useTranslation();

    useEffect(() => {   
        if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) return;
        setWebNotificationPermission(Notification.permission);
    }, []);

    const handleEnableWebNotifications = async () => {
        if (!userId) return;
    
        try {
            const permission = await requestWebNotificationPermissionAndRegister(userId);
            setWebNotificationPermission(permission);
    
            if (permission === 'granted') {
                notification.success(t('dashboard.notificationsEnabled'));
            } else if (permission === 'denied') {
                notification.error(t('dashboard.notificationsDenied'));
            } else {
                notification.info(t('dashboard.notificationsUnsupported'));
            }
        } catch (error) {
          notification.error(error instanceof Error ? error.message : t('dashboard.notificationsEnableError'));
        }
    };

    return { 
        webNotificationPermission, 
        handleEnableWebNotifications };
}