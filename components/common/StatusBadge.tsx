import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../ui/COLORS';

type Props = { status?: string };

export default function StatusBadge({ status }: Props) {
  const s = (status ?? '').toLowerCase();
  const tone = s.includes('entreg') || s.includes('recibid') || s.includes('origin')
    ? { background: COLORS.greenSoft, text: COLORS.green }
    : s.includes('pending') || s.includes('waiting')
    ? { background: COLORS.blueSoft, text: COLORS.blue }
    : { background: COLORS.orangeSoft, text: COLORS.orange };

  return (
    <View style={[styles.pill, { backgroundColor: tone.background, borderColor: tone.text }]}> 
      <Text style={[styles.pillText, { color: tone.text }]}>{status || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '800' },
});
