import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

export interface CardBaseProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function CardBase({ children, style }: CardBaseProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FCFDFE',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
});
