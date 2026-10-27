import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

export type BadgeTone =
  | 'critical'
  | 'success'
  | 'warning'
  | 'neutral'
  | 'info'
  | 'role'
  | 'high'
  | 'medium'
  | 'low';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  style?: ViewStyle;
}

const toneStyles: Record<BadgeTone, { background: string; text: string }> = {
  critical: { background: '#FDEBEC', text: '#F04B4B' },
  success: { background: '#DDF8E8', text: '#35B56A' },
  warning: { background: '#FFF1CC', text: '#E9A400' },
  neutral: { background: '#F3F4F6', text: '#6B7280' },
  info: { background: '#DBEAFE', text: '#2563EB' },
  role: { background: '#EEF2FF', text: '#1D4ED8' },
  high: { background: '#FDEBEC', text: '#F04B4B' },
  medium: { background: '#FFF1CC', text: '#E9A400' },
  low: { background: '#DDF8E8', text: '#35B56A' },
};

export function Badge({ label, tone = 'neutral', style }: BadgeProps) {
  const colors = toneStyles[tone];

  return (
    <View style={[styles.badge, { backgroundColor: colors.background }, style]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
