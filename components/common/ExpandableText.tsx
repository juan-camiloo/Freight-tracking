import { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleProp, Text, TextStyle, View } from 'react-native';

const BASE_LINES = 2;       // nivel 0 (colapsado)
const FIRST_EXPAND_LINES = 6; // nivel 1
const READ_MORE_LABEL = 'Mostrar más';
const READ_LESS_LABEL = ' Mostrar menos';

type ExpandableTextProps = {
    text: string;
    level: number;                 // 0 = colapsado, 1, 2, 3... niveles de expansión
    onExpand: () => void;          // pedir siguiente nivel
    onCollapse: () => void;        // volver a nivel 0
    textStyle: StyleProp<TextStyle>;
    accentStyle: StyleProp<TextStyle>;
    fontSize?: number;
    onTruncationChange?: (isTruncated: boolean) => void;
};

// 2, 6, 12, 24, 48, 96... (se duplica a partir del nivel 1)
function maxLinesForLevel(level: number) {
    if (level <= 0) return BASE_LINES;
    return FIRST_EXPAND_LINES * Math.pow(2, level - 1);
}

export function ExpandableText({
    text,
    level,
    onExpand,
    onCollapse,
    textStyle,
    accentStyle,
    fontSize = 14,
    onTruncationChange,
}: ExpandableTextProps) {
    const [containerWidth, setContainerWidth] = useState(0);

    const handleLayout = (event: LayoutChangeEvent) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0 && Math.abs(width - containerWidth) > 1) {
            setContainerWidth(width);
        }
    };

    const avgCharWidth = fontSize * 0.55;
    const charsPerLine = containerWidth > 0 ? Math.floor(containerWidth / avgCharWidth) : 0;

    // Truncamiento "base" (a 2 líneas): decide si el texto necesita el sistema de expansión en absoluto.
    // No depende del nivel actual, para no romper la lógica que usa NewsItem (isPressableWrapper).
    const baseMaxChars = charsPerLine * BASE_LINES;
    const isInitiallyTruncated = containerWidth > 0 && text.length > baseMaxChars;

    // Límite del nivel actual: ¿todavía queda más texto por mostrar en el próximo nivel?
    const maxChars = charsPerLine * maxLinesForLevel(level);
    const canExpandFurther = containerWidth > 0 && text.length > maxChars;

    useEffect(() => {
        onTruncationChange?.(isInitiallyTruncated);
    }, [isInitiallyTruncated]);

    // Caso 1: el texto nunca necesitó truncarse (cabe en 2 líneas)
    if (!isInitiallyTruncated) {
        return (
            <View onLayout={handleLayout}>
                <Text style={textStyle}>{text}</Text>
            </View>
        );
    }

    // Caso 2: en el nivel actual todavía hay más texto -> mostrar "Mostrar más"
    if (canExpandFurther) {
        const reserve = READ_MORE_LABEL.length + 2;
        const cut = text.slice(0, Math.max(maxChars - reserve, 0)).trimEnd();

        return (
            <View onLayout={handleLayout}>
                <Text style={textStyle}>
                    {cut}
                    {'… '}
                    <Text style={accentStyle} onPress={onExpand}>
                        {READ_MORE_LABEL}
                    </Text>
                </Text>
            </View>
        );
    }

    return (
        <View onLayout={handleLayout}>
            <Text style={textStyle}>
                {text}
                <Text style={accentStyle} onPress={onCollapse}>
                    {READ_LESS_LABEL}
                </Text>
            </Text>
        </View>
    );
}