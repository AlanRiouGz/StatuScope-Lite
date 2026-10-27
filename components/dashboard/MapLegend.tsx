import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

export interface MapLegendItem {
  label: string;
  color: string;
  value?: string;
}

export interface MapLegendProps {
  items: MapLegendItem[];
  orientation?: 'vertical' | 'horizontal';
  style?: ViewStyle;
}

export function MapLegend({
  items,
  orientation = 'vertical',
  style,
}: MapLegendProps) {
  const isHorizontal = orientation === 'horizontal';

  return (
    <View style={[styles.container, isHorizontal && styles.containerHorizontal, style]}>
      {items.map((item, index) => (
        <View
          key={index}
          style={[styles.item, isHorizontal && styles.itemHorizontal]}
        >
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={styles.label}>{item.label}</Text>
          {item.value && <Text style={styles.value}>{item.value}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  containerHorizontal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemHorizontal: {
    marginRight: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  label: {
    fontSize: 11,
    lineHeight: 16,
    color: '#6B7280',
  },
  value: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 6,
  },
});
