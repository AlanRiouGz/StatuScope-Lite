import React from 'react';
import { ViewStyle } from 'react-native';
import { Button, ButtonVariant } from './Button';

export interface IconButtonProps {
  icon: React.ReactNode;
  variant?: ButtonVariant;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function IconButton({
  icon,
  variant = 'secondary',
  disabled = false,
  onPress,
  style,
}: IconButtonProps) {
  return (
    <Button
      size="icon"
      variant={variant}
      disabled={disabled}
      onPress={onPress}
      style={style}
    >
      {icon}
    </Button>
  );
}
