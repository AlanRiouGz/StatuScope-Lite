import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CardBase } from '@/components/patterns/CardBase';
import { useTranslation } from '@/i18n';

export interface AnalyticsZoneDetail {
  id: string;
  name: string;
  risk: string;
  disease: string;
  radius: string;
  priority: string;
  trend: string;
  note: string;
}

interface ZoneDetailOverlayProps {
  visible: boolean;
  zone: AnalyticsZoneDetail | null;
  onClose: () => void;
}

export function ZoneDetailOverlay({ visible, zone, onClose }: ZoneDetailOverlayProps) {
  const { t } = useTranslation();
  if (!zone) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <CardBase style={styles.dialog}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>{t('common.analytics.overlays.zoneDetail')}</Text>
              <Text style={styles.title}>{zone.name}</Text>
              <Text style={styles.subtitle}>{zone.note}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.75}>
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.metricsGrid}>
            <MetricCard label={t('common.analytics.overlays.riskLevel')} value={zone.risk} />
            <MetricCard label={t('common.analytics.overlays.primaryDisease')} value={zone.disease} />
            <MetricCard label={t('common.analytics.overlays.radius')} value={zone.radius} />
            <MetricCard label={t('common.analytics.overlays.priority')} value={zone.priority} />
          </View>

          <CardBase style={styles.noteCard}>
            <Text style={styles.noteTitle}>{t('common.analytics.overlays.observedTrend')}</Text>
            <Text style={styles.noteText}>{zone.trend}</Text>
          </CardBase>
        </CardBase>
      </View>
    </Modal>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <CardBase style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </CardBase>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.74)',
  },
  dialog: {
    width: '100%',
    maxWidth: 640,
    borderRadius: 24,
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: '#1718C7',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: '#70839B',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 24,
  },
  metricCard: {
    width: '48%',
    borderRadius: 16,
    padding: 14,
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: '#8A9AAF',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  noteCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 18,
    padding: 16,
  },
  noteTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    color: '#1718C7',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#526174',
  },
});

export default ZoneDetailOverlay;
