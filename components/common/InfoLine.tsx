import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type InfoLineProps = { label: string; value: string };

export default function InfoLine({ label, value }: InfoLineProps) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLineLabel}>{label}</Text>
      <Text style={styles.infoLineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingBottom: 10 },
  infoLineLabel: { flex: 1, color: '#8f9bb0', fontSize: 12, fontWeight: '700' },
  infoLineValue: { flex: 1, color: '#121212', fontSize: 13, fontWeight: '600', textAlign: 'right' },
});
