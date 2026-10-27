import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

export type DetectionBannerVariant = 'info' | 'warning' | 'critical';

export interface DetectionBannerProps {
  message: string;
  actionLabel?: string;
  variant?: DetectionBannerVariant;
  onActionPress?: () => void;
  style?: ViewStyle;
}

const variantStyles = {
  info: {
    background: 'rgba(0, 3, 184, 0.08)',
    iconColor: '#0003B8',
    messageColor: '#0003B8',
  },
  warning: {
    background: '#FEF3C7',
    iconColor: '#B45309',
    messageColor: '#92400E',
  },
  critical: {
    background: '#FEE2E2',
    iconColor: '#DC2626',
    messageColor: '#991B1B',
  },
};

export function DetectionBanner({
  message,
  actionLabel,
  variant = 'info',
  onActionPress,
  style,
}: DetectionBannerProps) {
  const colors = variantStyles[variant];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, style]}>
      <Feather name="alert-triangle" size={16} color={colors.iconColor} style={styles.icon} />
      <Text style={[styles.message, { color: colors.messageColor }]}>{message}</Text>
      {actionLabel ? (
        <TouchableOpacity onPress={onActionPress} activeOpacity={0.75}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  action: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#0003B8',
    textDecorationLine: 'underline',
    marginLeft: 12,
  },
});
