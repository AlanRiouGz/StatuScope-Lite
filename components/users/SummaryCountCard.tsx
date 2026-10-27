import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

export type SummaryVariant = 'default' | 'info' | 'warning' | 'neutral';

export interface SummaryCountCardProps {
  title: string;
  value: string;
  variant?: SummaryVariant;
  icon?: React.ReactNode;
  caption?: string;
  valueAccent?: React.ReactNode;
  style?: ViewStyle;
}

const variantStyles = {
  default: {
    iconBg: 'rgba(0, 3, 184, 0.08)',
    iconColor: '#0003B8',
    valueColor: '#111827',
  },
  info: {
    iconBg: 'rgba(0, 3, 184, 0.08)',
    iconColor: '#0003B8',
    valueColor: '#111827',
  },
  warning: {
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    valueColor: '#111827',
  },
  neutral: {
    iconBg: '#F3F4F6',
    iconColor: '#6B7280',
    valueColor: '#111827',
  },
};

export function SummaryCountCard({
  title,
  value,
  variant = 'default',
  icon,
  caption,
  valueAccent,
  style,
}: SummaryCountCardProps) {
  const colors = variantStyles[variant];

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        {icon ? (
          <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }]}>
            {icon}
          </View>
        ) : null}
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.valueColor }]}>{value}</Text>
        {valueAccent ? <View style={styles.valueAccent}>{valueAccent}</View> : null}
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 3, 184, 0.05)',
    padding: 21,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconContainer: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  value: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  caption: {
    marginLeft: 6,
    marginBottom: 5,
    fontSize: 14,
    lineHeight: 20,
    color: '#94A3B8',
  },
  valueAccent: {
    marginLeft: 5,
    marginBottom: 6,
  },
});
