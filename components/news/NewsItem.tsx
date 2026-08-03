import { ExpandableText } from '@/components/common/ExpandableText';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NEWS_CATEGORY, type NewsCategoryKey } from './NEWS_CATEGORY';
import { NEWS_TEXT } from './NEWS_TEXT';
import { NEWS_SPACING, NEWS_THEME } from './NEWS_THEME';

type NewsItemProps = {
  title: string;
  content: string;
  category: NewsCategoryKey;
  relativeTime: string;
  expansionLevel: number;
  imagePath: string | null;
  onPress: () => void;
  onExpand: () => void;
  onCollapse: () => void;
};

export function NewsItem({
  title,
  content,
  category,
  relativeTime,
  expansionLevel,
  imagePath,
  onPress,
  onExpand,
  onCollapse,
}: NewsItemProps) {
  const categoryStyle = NEWS_CATEGORY[category];
  const signedUrl = useSignedImageUrl(imagePath);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const expanded = expansionLevel > 0;

  // Solo se puede tocar la fila completa cuando no está truncada Y tiene imagen.
  // Si está truncada, la única zona interactiva es el "Mostrar más" dentro de ExpandableText.
  const isPressableWrapper = !isTruncated && !!signedUrl;

  return (
    <View>
      <View style={styles.newsRow} pointerEvents="box-none">
        <View style={[styles.leadingIcon, { backgroundColor: categoryStyle.iconBackground }]}>
          <Ionicons name={categoryStyle.icon} size={18} color={categoryStyle.color} />
        </View>

        <View style={styles.copy}>
          <Text style={NEWS_TEXT.title} numberOfLines={expanded ? undefined : 2}>
            {title}
          </Text>

          <ExpandableText
            text={content}
            level={expansionLevel}
            onExpand={onExpand}
            onCollapse={onCollapse}
            textStyle={NEWS_TEXT.body}
            accentStyle={styles.accentInline}
            onTruncationChange={setIsTruncated}
          />

          {expanded && signedUrl && (
            <Image
              source={{ uri: signedUrl }}
              style={[styles.expandedImage, aspectRatio ? { aspectRatio } : styles.expandedImageFallback]}
              contentFit="contain"
              transition={150}
              onLoad={(event) => {
                const { width, height } = event.source;
                if (width && height) setAspectRatio(width / height);
              }}
            />
          )}

          <Text style={NEWS_TEXT.caption}>{relativeTime}</Text>
        </View>

        {!expanded && signedUrl && (
          <Image source={{ uri: signedUrl }} style={styles.topThumbnail} contentFit="cover" transition={150} />
        )}
      </View>

      {isPressableWrapper && (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={title}
          style={({ pressed }) => [
            StyleSheet.absoluteFill,
            styles.pressOverlay,
            pressed && styles.newsItemPressed,
          ]}
        />
      )}

      <View style={styles.separator} />
    </View>
  );
}

const styles = StyleSheet.create({
  newsItemPressed: {
    backgroundColor: NEWS_THEME.pressed,
  },
  newsRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: NEWS_SPACING.iconGap,
    paddingHorizontal: NEWS_SPACING.rowHorizontal,
    paddingVertical: NEWS_SPACING.rowVertical,
  },
  leadingIcon: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
    borderRadius: 16,
    height: 32,
    marginTop: 1,
    width: 32,
  },
  copy: {
    flex: 1,
    gap: NEWS_SPACING.titleGap,
    minWidth: 0,
  },
  accentInline: {
    fontWeight: '600',
    color: NEWS_THEME.accent,
  },
  topThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginLeft: NEWS_SPACING.iconGap,
    backgroundColor: NEWS_THEME.divider,
    flexShrink: 0,
  },
  expandedImage: {
    width: '100%',
    borderRadius: 12,
    marginTop: NEWS_SPACING.titleGap,
    backgroundColor: NEWS_THEME.divider,
  },
  expandedImageFallback: {
    height: 180,
  },
  separator: {
    backgroundColor: NEWS_THEME.divider,
    height: StyleSheet.hairlineWidth,
    marginHorizontal: NEWS_SPACING.rowHorizontal,
  },
  pressOverlay: {
    zIndex: 1,
  },
});