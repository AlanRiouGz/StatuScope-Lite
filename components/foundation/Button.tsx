import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle, TextStyle } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'surface';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'chip' | 'icon';

export interface ButtonProps {
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

const variantStyles: Record<
  ButtonVariant,
  { backgroundColor: string; borderColor: string; textColor: string }
> = {
  primary: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
    textColor: '#FFFFFF',
  },
  secondary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    textColor: '#4B5563',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    textColor: '#6B7280',
  },
  danger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
    textColor: '#DC2626',
  },
  surface: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    textColor: '#374151',
  },
};

const sizeStyles: Record<
  ButtonSize,
  { paddingVertical: number; paddingHorizontal: number; borderRadius: number; minHeight: number }
> = {
  sm: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, minHeight: 36 },
  md: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, minHeight: 44 },
  lg: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, minHeight: 48 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, minHeight: 32 },
  icon: { paddingVertical: 0, paddingHorizontal: 0, borderRadius: 10, minHeight: 36 },
};

const textSizes: Record<ButtonSize, number> = {
  sm: 13,
  md: 14,
  lg: 15,
  chip: 13,
  icon: 16,
};

export function Button({
  label,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  leadingIcon,
  trailingIcon,
  children,
  onPress,
  style,
  labelStyle,
}: ButtonProps) {
  const colors = variantStyles[variant];
  const metrics = sizeStyles[size];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          backgroundColor: disabled ? '#F9FAFB' : colors.backgroundColor,
          borderColor: disabled ? '#E5E7EB' : colors.borderColor,
          paddingVertical: metrics.paddingVertical,
          paddingHorizontal: metrics.paddingHorizontal,
          borderRadius: metrics.borderRadius,
          minHeight: metrics.minHeight,
          minWidth: size === 'icon' ? metrics.minHeight : undefined,
        },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {leadingIcon ? <View style={styles.iconSlot}>{leadingIcon}</View> : null}
      {children || label ? (
        <Text
          style={[
            styles.label,
            {
              color: disabled ? '#9CA3AF' : colors.textColor,
              fontSize: textSizes[size],
            },
            labelStyle,
          ]}
        >
          {children || label}
        </Text>
      ) : null}
      {trailingIcon ? <View style={styles.iconSlot}>{trailingIcon}</View> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 8,
  },
  disabled: {
    opacity: 0.9,
  },
  label: {
    fontWeight: '600',
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
