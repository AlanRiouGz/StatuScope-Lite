import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

export type AvatarTone = 'default' | 'doctor' | 'neutral';
export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  initials: string;
  tone?: AvatarTone;
  size?: AvatarSize;
  style?: ViewStyle;
}

const toneStyles = {
  default: { bg: '#DBEAFE', text: '#1D4ED8' },
  doctor: { bg: '#DCFCE7', text: '#16A34A' },
  neutral: { bg: '#F3F4F6', text: '#6B7280' },
};

const sizeStyles = {
  sm: { size: 28, fontSize: 10 },
  md: { size: 36, fontSize: 12 },
  lg: { size: 44, fontSize: 14 },
};

export function Avatar({
  initials,
  tone = 'default',
  size = 'md',
  style,
}: AvatarProps) {
  const colors = toneStyles[tone];
  const metrics = sizeStyles[size];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          width: metrics.size,
          height: metrics.size,
          borderRadius: metrics.size / 2,
        },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize: metrics.fontSize, color: colors.text }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '600',
  },
});
