import * as ImageManipulator from 'expo-image-manipulator';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type Preset = {
    key: string;
    label: string;
    aspect: number | null; // null = mantener original
};

const PRESETS: Preset[] = [
    { key: 'original', label: 'Original', aspect: null },
    { key: 'square', label: 'Cuadrada (1:1)', aspect: 1 },
    { key: 'wide', label: 'Horizontal (16:9)', aspect: 16 / 9 },
    { key: 'portrait', label: 'Vertical (4:5)', aspect: 4 / 5 },
];

type ImageCropModalProps = {
    visible: boolean;
    imageUri: string | null;
    onCancel: () => void;
    onConfirm: (result: { uri: string; width: number; height: number }) => void;
};

export function ImageCropModal({ visible, imageUri, onCancel, onConfirm }: ImageCropModalProps) {
    const [originalSize, setOriginalSize] = useState<{ width: number; height: number } | null>(null);
    const [previewUri, setPreviewUri] = useState<string | null>(null);
    const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null);
    const [selectedPreset, setSelectedPreset] = useState('original');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!visible || !imageUri) return;

        Image.getSize(
            imageUri,
            (width, height) => {
                setOriginalSize({ width, height });
                setPreviewUri(imageUri);
                setPreviewSize({ width, height });
                setSelectedPreset('original');
            },
            (error) => console.error('Error reading image size:', error),
        );
    }, [visible, imageUri]);

    const applyPreset = async (preset: Preset) => {
        if (!imageUri || !originalSize) return;
        setSelectedPreset(preset.key);

        if (!preset.aspect) {
            setPreviewUri(imageUri);
            setPreviewSize(originalSize);
            return;
        }

        setProcessing(true);
        try {
            const { width, height } = originalSize;
            const currentAspect = width / height;

            let cropWidth = width;
            let cropHeight = height;

            if (currentAspect > preset.aspect) {
                cropHeight = height;
                cropWidth = height * preset.aspect;
            } else {
                cropWidth = width;
                cropHeight = width / preset.aspect;
            }

            const originX = (width - cropWidth) / 2;
            const originY = (height - cropHeight) / 2;

            const result = await ImageManipulator.manipulateAsync(
                imageUri,
                [{
                    crop: {
                        originX: Math.round(originX),
                        originY: Math.round(originY),
                        width: Math.round(cropWidth),
                        height: Math.round(cropHeight),
                    },
                }],
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
            );

            setPreviewUri(result.uri);
            setPreviewSize({ width: result.width, height: result.height });
        } catch (error) {
            console.error('Error cropping image:', error);
        } finally {
            setProcessing(false);
        }
    };

    const handleConfirm = () => {
        if (!previewUri || !previewSize) return;
        onConfirm({ uri: previewUri, width: previewSize.width, height: previewSize.height });
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <Pressable style={styles.backdrop} onPress={onCancel}>
                <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
                    <Text style={styles.title}>Editar imagen</Text>

                    <View style={styles.previewWrap}>
                        {previewUri && previewSize ? (
                            <Image
                                source={{ uri: previewUri }}
                                style={[styles.previewImage, { aspectRatio: previewSize.width / previewSize.height }]}
                                resizeMode="contain"
                            />
                        ) : (
                            <ActivityIndicator />
                        )}
                        {processing && (
                            <View style={styles.processingOverlay}>
                                <ActivityIndicator color="#fff" />
                            </View>
                        )}
                    </View>

                    <View style={styles.presetRow}>
                        {PRESETS.map((preset) => (
                            <Pressable
                                key={preset.key}
                                style={[styles.presetChip, selectedPreset === preset.key && styles.presetChipSelected]}
                                onPress={() => applyPreset(preset)}
                            >
                                <Text style={[styles.presetChipText, selectedPreset === preset.key && styles.presetChipTextSelected]}>
                                    {preset.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <View style={styles.actionsRow}>
                        <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={onCancel}>
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.actionButton, styles.confirmButton]}
                            onPress={handleConfirm}
                            disabled={processing}
                        >
                            <Text style={styles.confirmButtonText}>Usar esta imagen</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
    title: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
    previewWrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#f0f0f0', marginBottom: 12, justifyContent: 'center', alignItems: 'center', minHeight: 160 },
    previewImage: { width: '100%' },
    processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    presetChip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    presetChipSelected: { backgroundColor: '#111', borderColor: '#111' },
    presetChipText: { fontSize: 13, color: '#333' },
    presetChipTextSelected: { color: '#fff' },
    actionsRow: { flexDirection: 'row', gap: 10 },
    actionButton: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    cancelButton: { backgroundColor: '#f0f0f0' },
    cancelButtonText: { color: '#333', fontWeight: '600' },
    confirmButton: { backgroundColor: '#111' },
    confirmButtonText: { color: '#fff', fontWeight: '600' },
});