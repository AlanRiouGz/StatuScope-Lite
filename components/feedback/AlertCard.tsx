import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

export type AlertCardVariant = 'critical' | 'warning' | 'success' | 'info' | 'neutral';

export interface AlertCardProps {
  title: string;
  description: string;
  variant?: AlertCardVariant;
  style?: ViewStyle;
}

const variantStyles = {
  critical: {
    bar: '#F05252',
    background: '#FEF2F2',
    title: '#991B1B',
    text: '#B91C1C',
    icon: 'alert-circle' as const,
  },
  warning: {
    bar: '#F59E0B',
    background: '#FFFBEB',
    title: '#92400E',
    text: '#B45309',
    icon: 'alert-triangle' as const,
  },
  success: {
    bar: '#22C55E',
    background: '#F0FDF4',
    title: '#166534',
    text: '#15803D',
    icon: 'check-circle' as const,
  },
  info: {
    bar: '#3D7FFF',
    background: '#EFF6FF',
    title: '#1D4ED8',
    text: '#2563EB',
    icon: 'info' as const,
  },
  neutral: {
    bar: '#8A9AAF',
    background: '#F8FAFC',
    title: '#334155',
    text: '#475569',
    icon: 'refresh-cw' as const,
  },
};

export function AlertCard({
  title,
  description,
  variant = 'info',
  style,
}: AlertCardProps) {
  const colors = variantStyles[variant];

  return (
    <View style={[styles.card, { backgroundColor: colors.background }, style]}>
      <View style={[styles.indicator, { backgroundColor: colors.bar }]} />
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Feather name={colors.icon} size={16} color={colors.bar} />
          <Text style={[styles.title, { color: colors.title }]}>{title}</Text>
        </View>
        <Text style={[styles.description, { color: colors.text }]}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 10,
    paddingVertical: 18,
    paddingRight: 18,
    alignItems: 'stretch',
    overflow: 'hidden',
    width: '100%',
  },
  indicator: {
    width: 4,
    borderRadius: 2,
    marginRight: 18,
    marginLeft: 0,
  },
  content: {
    flex: 1,
    paddingLeft: 2,
    paddingRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.9,
  },
});
