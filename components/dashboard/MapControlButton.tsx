import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { ViewStyle } from 'react-native';
import { IconButton } from '../foundation/IconButton';

export type MapControlButtonVariant = 'default' | 'primary' | 'ghost';

export interface MapControlButtonProps {
  icon?: 'plus' | 'minus' | 'settings';
  variant?: MapControlButtonVariant;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function MapControlButton({
  icon = 'plus',
  variant = 'default',
  disabled = false,
  onPress,
  style,
}: MapControlButtonProps) {
  const mappedVariant =
    variant === 'primary' ? 'primary' : variant === 'ghost' ? 'ghost' : 'secondary';

  const iconName = icon === 'minus' ? 'minus' : icon === 'settings' ? 'settings' : 'plus';

  return (
    <IconButton
      icon={<Feather name={iconName} size={18} color="#475569" />}
      variant={mappedVariant}
      onPress={onPress}
      disabled={disabled}
      style={style}
    />
  );
}
