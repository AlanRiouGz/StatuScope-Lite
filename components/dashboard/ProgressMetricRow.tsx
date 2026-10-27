import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ProgressBar } from '../foundation/ProgressBar';

export interface ProgressMetricRowProps {
  label: string;
  valueText: string;
  progress: number;
  barColor?: string;
  barHeight?: number;
  style?: ViewStyle;
}

export function ProgressMetricRow({
  label,
  valueText,
  progress,
  barColor = '#0003B8',
  barHeight = 6,
  style,
}: ProgressMetricRowProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.valueText}>{valueText}</Text>
      </View>
      <ProgressBar value={progress} color={barColor} height={barHeight} trackColor="'#EEF2F7'" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  valueText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#0003B8',
  },
});
