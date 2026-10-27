import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Badge } from '../foundation/Badge';
import { ProgressBar } from '../foundation/ProgressBar';
import { CardBase } from '../patterns/CardBase';

export type StatCardStatus = 'positive' | 'danger' | 'warning' | 'neutral';

export interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  badge?: string;
  status?: StatCardStatus;
  trendText?: string;
  showProgress?: boolean;
  progressValue?: number;
  progressColor?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  isLoading?: boolean;
}

export function StatCard({
  title,
  value,
  subtitle,
  badge,
  status = 'neutral',
  trendText,
  showProgress = false,
  progressValue = 0,
  progressColor = '#0003B8',
  icon,
  style,
  isLoading = false,
}: StatCardProps) {
  const effectiveStatus = isLoading ? 'neutral' : status;
  const statusStyle = statusStyles[effectiveStatus];
  const tone =
    effectiveStatus === 'positive'
      ? 'success'
      : effectiveStatus === 'danger'
        ? 'critical'
        : effectiveStatus === 'warning'
          ? 'warning'
          : 'neutral';

  return (
    <CardBase style={[styles.card, { borderColor: statusStyle.border }, style]}>
      <View style={[styles.accentBar, { backgroundColor: statusStyle.accent }]} />
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
        </View>
        {isLoading ? <View style={styles.skeletonBadge} /> : badge ? <Badge label={badge} tone={tone} style={styles.badge} /> : null}
      </View>
      <View style={styles.valueRow}>
        {icon ? (
          <View style={[styles.iconContainer, { backgroundColor: statusStyle.iconBackground }]}>
            {icon}
          </View>
        ) : null}
        {isLoading ? (
          <View style={styles.skeletonValueBlock}>
            <View style={styles.skeletonValue} />
            <View style={[styles.skeletonValue, styles.skeletonValueShort]} />
          </View>
        ) : <Text style={styles.value}>{value}</Text>}
      </View>
      {isLoading ? (
        <View style={styles.skeletonSubtitleBlock}>
          <View style={styles.skeletonSubtitle} />
          <View style={[styles.skeletonSubtitle, styles.skeletonSubtitleShort]} />
        </View>
      ) : subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {!isLoading && trendText ? <Text style={styles.trendText}>{trendText}</Text> : null}
      {showProgress && !isLoading ? (
        <View style={styles.progressContainer}>
          <ProgressBar value={progressValue} color={progressColor} />
        </View>
      ) : null}
    </CardBase>
  );
}

const statusStyles: Record<StatCardStatus, {
  accent: string;
  border: string;
  iconBackground: string;
}> = {
  positive: {
    accent: '#22C55E',
    border: 'rgba(34, 197, 94, 0.22)',
    iconBackground: 'rgba(34, 197, 94, 0.10)',
  },
  danger: {
    accent: '#EF4444',
    border: 'rgba(239, 68, 68, 0.22)',
    iconBackground: 'rgba(239, 68, 68, 0.10)',
  },
  warning: {
    accent: '#F59E0B',
    border: 'rgba(245, 158, 11, 0.24)',
    iconBackground: 'rgba(245, 158, 11, 0.12)',
  },
  neutral: {
    accent: '#64748B',
    border: '#E2E8F0',
    iconBackground: '#F1F5F9',
  },
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 176,
    padding: 24,
    paddingTop: 22,
    borderRadius: 14,
    backgroundColor: '#FEFFFF',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.10,
    shadowRadius: 30,
    elevation: 5,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
    gap: 12,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#64748B',
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    flexShrink: 0,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  skeletonBadge: {
    width: 48,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#E8EEF6',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  value: {
    flexShrink: 1,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    color: '#0F172A',
  },
  skeletonValueBlock: {
    gap: 6,
  },
  skeletonValue: {
    width: '62%',
    height: 34,
    borderRadius: 999,
    backgroundColor: '#E8EEF6',
  },
  skeletonValueShort: {
    width: '48%',
  },
  subtitle: {
    marginTop: 14,
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
  },
  skeletonSubtitleBlock: {
    marginTop: 14,
    gap: 5,
  },
  skeletonSubtitle: {
    width: '78%',
    height: 12,
    borderRadius: 999,
    backgroundColor: '#E8EEF6',
  },
  skeletonSubtitleShort: {
    width: '58%',
  },
  trendText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    color: '#94A3B8',
  },
  progressContainer: {
    marginTop: 12,
  },
});
