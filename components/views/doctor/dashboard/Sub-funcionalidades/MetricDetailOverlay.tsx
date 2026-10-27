import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CardBase } from '@/components/patterns/CardBase';
import { DoctorDashboardMetric } from '@/components/views/doctor/dashboard/Sub-funcionalidades/types';
import { useTranslation } from '@/i18n';

interface MetricDetailOverlayProps {
  visible: boolean;
  metric: DoctorDashboardMetric | null;
  onClose: () => void;
}

export function MetricDetailOverlay({ visible, metric, onClose }: MetricDetailOverlayProps) {
  const { t } = useTranslation();

  if (!metric) return null;
  const insightCriteria = t(`doctor.dashboard.metrics.${metric.id}.insightCriteria`);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <CardBase style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>{t('doctor.dashboard.overlays.clinicalMetric')}</Text>
              <Text style={styles.title}>{metric.detailTitle}</Text>
              <Text style={styles.subtitle}>{metric.detailSummary}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.78}>
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.metricsGrid}>
              <MetricStat label={t('doctor.dashboard.overlays.currentValue')} value={metric.value} accentColor={accentColor(metric.status)} />
              <MetricStat label={t('doctor.dashboard.overlays.signal')} value={metric.signalLabel} accentColor={accentColor(metric.status)} />
            </View>

            {metric.insights && metric.insights.length > 0 ? (
              <View style={styles.insightsSection}>
                <View style={styles.insightsHeader}>
                  <View style={styles.insightsHeaderCopy}>
                    <Text style={styles.insightsTitle}>{t('doctor.dashboard.overlays.metricInsights')}</Text>
                    {insightCriteria ? (
                      <Text style={styles.insightsCriteria}>{insightCriteria}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.insightsList}>
                  {metric.insights.map((insight, index) => (
                    <View key={`${insight.title}-${insight.location}-${index}`} style={styles.insightRow}>
                      <View style={[styles.insightRank, { borderColor: `${insight.color}33`, backgroundColor: `${insight.color}12` }]}>
                        <Text style={[styles.insightRankText, { color: insight.color }]}>{index + 1}</Text>
                      </View>
                      <View style={styles.insightCopy}>
                        <Text style={styles.insightTitle}>{insight.title}</Text>
                        <Text style={styles.insightLocation}>{insight.location}</Text>
                      </View>
                      <View style={styles.insightMeta}>
                        <Text style={[styles.insightCases, { color: insight.color }]}>{insight.cases}</Text>
                        <Text style={styles.insightSeverity}>{insight.meta ?? insight.severity}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </CardBase>
      </View>
    </Modal>
  );
}

function MetricStat({ label, value, accentColor }: { label: string; value: string; accentColor: string }) {
  return (
    <CardBase style={[styles.statCard, { borderColor: `${accentColor}22` }]}>
      <View style={[styles.statAccent, { backgroundColor: accentColor }]} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </CardBase>
  );
}

function accentColor(status?: DoctorDashboardMetric['status']) {
  if (status === 'danger') return '#1E40AF';
  if (status === 'warning') return '#3B82F6';
  if (status === 'positive') return '#93C5FD';
  return '#0003B8';
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.74)' },
  dialog: { width: '100%', maxWidth: 760, maxHeight: '86%', borderRadius: 24, padding: 0, overflow: 'hidden' },
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
  headerCopy: { flex: 1 },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: '#1718C7',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, fontSize: 14, lineHeight: 22, color: '#70839B' },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  body: { padding: 24, gap: 20 },
  metricsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, paddingLeft: 20, borderWidth: 1, overflow: 'hidden' },
  statAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: '#8A9AAF',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  statValue: { fontSize: 18, lineHeight: 24, fontWeight: '900', color: '#0F172A' },
  insightsSection: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  insightsHeader: {
    minHeight: 62,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insightsHeaderCopy: { flex: 1 },
  insightsTitle: { fontSize: 14, lineHeight: 18, fontWeight: '900', color: '#0F172A' },
  insightsCriteria: { marginTop: 4, fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#64748B' },
  insightsList: { padding: 12, gap: 10 },
  insightRow: {
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  insightRank: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightRankText: { fontSize: 13, lineHeight: 16, fontWeight: '900' },
  insightCopy: { flex: 1, minWidth: 0 },
  insightTitle: { fontSize: 14, lineHeight: 18, fontWeight: '900', color: '#0F172A' },
  insightLocation: { marginTop: 4, fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#64748B' },
  insightMeta: { alignItems: 'flex-end', maxWidth: 150 },
  insightCases: { fontSize: 13, lineHeight: 18, fontWeight: '900' },
  insightSeverity: { marginTop: 4, fontSize: 11, lineHeight: 14, fontWeight: '700', color: '#64748B' },
});

export default MetricDetailOverlay;
