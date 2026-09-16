// app/(auth)/news/create.tsx  (ajusta la ruta a tu estructura real)
import { AuthScreenBackground } from '@/components/auth/AuthChrome';
import Header from '@/components/Header';
import { ImageCropModal } from '@/components/news/ImageCropModal';
import { NEWS_CATEGORY, type NewsCategoryKey } from '@/components/news/NEWS_CATEGORY';
import { NEWS_SPACING, NEWS_THEME } from '@/components/news/NEWS_THEME';
import { useResponsive } from '@/hooks/useResponsive';
import { supabase } from '@/lib/URLs';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { t } from 'i18next';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

const SELECTABLE_CATEGORIES: NewsCategoryKey[] = ['urgent', 'common'];

export default function CreateNews() {
    const { height } = useResponsive();

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState<NewsCategoryKey>('common');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [cropModalVisible, setCropModalVisible] = useState(false);

    const backFunction = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/newsMobile' as any);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.9,
            // sin allowsEditing ni aspect — se sube tal cual
        });

        if (!result.canceled && result.assets?.[0]) {
            setImageUri(result.assets[0].uri);
        }
    };

    const removeImage = () => setImageUri(null);

    const validate = () => {
        if (!title.trim()) {
            Alert.alert(t('news.create.errorTitle', { defaultValue: 'Falta el título' }));
            return false;
        }
        if (!content.trim()) {
            Alert.alert(t('news.create.errorContent', { defaultValue: 'Falta el contenido' }));
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validate() || submitting) return;

        setSubmitting(true);
        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                throw userError ?? new Error('No user session');
            }

            const newsId = crypto.randomUUID();

            // 1. Insert primero (image_url queda null hasta que el trigger lo llene)
            const { error: insertError } = await supabase.from('news').insert({
                id: newsId,
                title: title.trim(),
                content: content.trim(),
                category,
                created_by: user.id,
                status: 'active',
            });

            if (insertError) throw insertError;

            // 2. Subir imagen si el usuario eligió una — el trigger llena image_url
            if (imageUri) {
                const ext = imageUri.split('.').pop()?.split('?')[0] ?? 'jpg';
                const path = `${newsId}/cover.${ext}`;
                const fileData = await fetch(imageUri).then(r => r.blob());

                const { error: uploadError } = await supabase.storage
                    .from('news_img')
                    .upload(path, fileData, {
                        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
                        upsert: true,
                    });

                if (uploadError) {
                    // La noticia ya se creó; avisamos que la imagen falló pero no bloqueamos
                    console.error('Error uploading news image:', uploadError);
                    Alert.alert(
                        t('news.create.imageErrorTitle', { defaultValue: 'Noticia creada' }),
                        t('news.create.imageErrorBody', {
                            defaultValue: 'La noticia se publicó, pero la imagen no se pudo subir.',
                        }),
                    );
                }
            }

            router.replace('/newsMobile' as any);
        } catch (error) {
            console.error('Error creating news:', error);
            Alert.alert(
                t('news.create.submitErrorTitle', { defaultValue: 'Error' }),
                t('news.create.submitErrorBody', {
                    defaultValue: 'No se pudo publicar la noticia. Intenta de nuevo.',
                }),
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={[styles.container, { minHeight: height }]}>
            <AuthScreenBackground />
            <Header
                isDesktop={false}
                title={t('news.create.header', { defaultValue: 'Nueva noticia' })}
                showSearch={false}
                onGoBack={backFunction}
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.label}>{t('news.create.titleLabel', { defaultValue: 'Título' })}</Text>
                <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t('news.create.titlePlaceholder', { defaultValue: 'Escribe un título' })}
                    placeholderTextColor={NEWS_THEME.secondaryText}
                    maxLength={120}
                />

                <Text style={styles.label}>{t('news.create.contentLabel', { defaultValue: 'Contenido' })}</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    value={content}
                    onChangeText={setContent}
                    placeholder={t('news.create.contentPlaceholder', { defaultValue: 'Escribe el contenido de la noticia' })}
                    placeholderTextColor={NEWS_THEME.secondaryText}
                    multiline
                    textAlignVertical="top"
                />

                <Text style={styles.label}>{t('news.create.categoryLabel', { defaultValue: 'Categoría' })}</Text>
                <View style={styles.categoryRow}>
                    {SELECTABLE_CATEGORIES.map((key) => {
                        const style = NEWS_CATEGORY[key];
                        const selected = category === key;
                        return (
                            <Pressable
                                key={key}
                                onPress={() => setCategory(key)}
                                style={[
                                    styles.categoryChip,
                                    {
                                        backgroundColor: selected ? style.iconBackground : 'transparent',
                                        borderColor: style.color,
                                    },
                                ]}
                            >
                                <Ionicons name={style.icon} size={16} color={style.color} />
                                <Text style={[styles.categoryChipText, { color: style.color }]}>
                                    {t(`news.category.${key}`, { defaultValue: key })}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={styles.label}>{t('news.create.imageLabel', { defaultValue: 'Imagen (opcional)' })}</Text>
                {imageUri ? (
                    <Pressable style={styles.imagePreviewWrap} onPress={() => setCropModalVisible(true)}>
                        <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                        <Pressable style={styles.removeImageButton} onPress={removeImage}>
                            <Ionicons name="close-circle" size={22} color={NEWS_THEME.background} />
                        </Pressable>
                    </Pressable>
                ) : (
                    <Pressable style={styles.imagePickerButton} onPress={pickImage}>
                        <Ionicons name="image-outline" size={20} color={NEWS_THEME.secondaryText} />
                        <Text style={styles.imagePickerText}>
                            {t('news.create.pickImage', { defaultValue: 'Seleccionar imagen' })}
                        </Text>
                    </Pressable>
                )}

                <Pressable
                    style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>
                            {t('news.create.submit', { defaultValue: 'Publicar' })}
                        </Text>
                    )}
                </Pressable>
            </ScrollView>
            <ImageCropModal
                visible={cropModalVisible}
                imageUri={imageUri}
                onCancel={() => setCropModalVisible(false)}
                onConfirm={({ uri }) => {
                    setImageUri(uri);
                    setCropModalVisible(false);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: NEWS_SPACING.screen,
        paddingBottom: 32,
        gap: 4,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: NEWS_THEME.secondaryText,
        marginTop: 16,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: NEWS_THEME.divider,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: NEWS_THEME.primaryText,
    },
    textArea: {
        minHeight: 120,
    },
    categoryRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    categoryChipText: {
        fontSize: 13,
        fontWeight: '600',
    },
    imagePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: NEWS_THEME.divider,
        borderRadius: 10,
        paddingVertical: 20,
    },
    imagePickerText: {
        fontSize: 14,
        color: NEWS_THEME.secondaryText,
    },
    imagePreviewWrap: {
        position: 'relative',
    },
    imagePreview: {
        width: '100%',
        height: 180,
        borderRadius: 12,
        backgroundColor: NEWS_THEME.divider,
    },
    removeImageButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
    },
    submitButton: {
        marginTop: 24,
        backgroundColor: NEWS_THEME.accent,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
});