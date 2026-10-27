import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CardBase } from '@/components/patterns/CardBase';
import { DoctorDashboardAlert } from '@/components/views/doctor/dashboard/Sub-funcionalidades/types';
import { useTranslation } from '@/i18n';

interface AlertDetailOverlayProps {
  visible: boolean;
  alert: DoctorDashboardAlert | null;
  onClose: () => void;
}

export function AlertDetailOverlay({ visible, alert, onClose }: AlertDetailOverlayProps) {
  const { t } = useTranslation();

  if (!alert) return null;
  const accent = accentColor(alert.variant);
  const statusLabel = alert.confirmationStatus ?? alert.priority;
  const diseaseName = diseaseFromTitle(alert.title);
  const activeCasesText = alert.caseLabel
    ?? (alert.caseCount != null
      ? t(alert.caseCount === 1 ? 'common.units.case' : 'common.units.activeCases', { count: alert.caseCount.toLocaleString() })
      : alert.description.split('.')[0]);
  const clinicalRows = [
    { label: t('doctor.dashboard.alerts.activeCasesLabel'), value: activeCasesText, icon: 'activity' as const, color: accent },
    { label: t('doctor.dashboard.overlays.municipality'), value: alert.municipalityName ?? alert.area, icon: 'map-pin' as const, color: '#3D7FFF' },
    { label: t('doctor.dashboard.overlays.state'), value: alert.stateName ?? alert.area, icon: 'map' as const, color: '#8B5CF6' },
    { label: t('doctor.dashboard.overlays.status'), value: statusLabel, icon: 'check-circle' as const, color: statusAccent(alert.variant) },
    { label: t('doctor.dashboard.overlays.priority'), value: alert.priority, icon: 'flag' as const, color: priorityAccent(alert.variant) },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <CardBase style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>{t('doctor.dashboard.overlays.alertDetail')}</Text>
              <Text style={styles.title}>{alert.title}</Text>
              <Text style={styles.subtitle}>{alert.description}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.78}>
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.metricsGrid}>
              <MetricStat
                label={t('doctor.dashboard.overlays.currentValue')}
                value={diseaseName}
                accentColor={accent}
              />
              <MetricStat
                label={t('doctor.dashboard.overlays.signal')}
                value={statusLabel}
                accentColor={accent}
              />
            </View>

            <View style={styles.insightsSection}>
              <View style={styles.insightsHeader}>
                <Text style={styles.insightsTitle}>{t('doctor.dashboard.overlays.metricInsights')}</Text>
              </View>
              <View style={styles.insightsList}>
                {clinicalRows.map((row, index) => (
                  <View key={`${row.label}-${index}`} style={[styles.insightRow, { borderColor: `${row.color}1F` }]}>
                    <View style={[styles.insightRank, { borderColor: `${row.color}33`, backgroundColor: `${row.color}12` }]}>
                      <Feather name={row.icon} size={16} color={row.color} />
                    </View>
                    <View style={styles.insightCopy}>
                      <Text style={styles.insightTitle}>{row.label}</Text>
                      <Text style={styles.insightLocation}>{row.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </CardBase>
      </View>
    </Modal>
  );
}

function MetricStat({ label, value, accentColor }: { label: string; value: string; accentColor: string }) {
  return (
    <CardBase style={[styles.statCard, { borderColor: `${accentColor}24` }]}>
      <View style={[styles.statAccent, { backgroundColor: accentColor }]} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={2}>{value}</Text>
    </CardBase>
  );
}

function accentColor(variant: DoctorDashboardAlert['variant']) {
  if (variant === 'critical') return '#1E40AF';
  if (variant === 'warning') return '#3B82F6';
  if (variant === 'success') return '#93C5FD';
  if (variant === 'neutral') return '#64748B';
  return '#0003B8';
}

function statusAccent(variant: DoctorDashboardAlert['variant']) {
  if (variant === 'critical') return '#1E40AF';
  if (variant === 'warning') return '#3B82F6';
  return '#93C5FD';
}

function priorityAccent(variant: DoctorDashboardAlert['variant']) {
  if (variant === 'critical') return '#1E3A8A';
  if (variant === 'warning') return '#3B82F6';
  return '#93C5FD';
}

function diseaseFromTitle(title: string) {
  return title
    .replace(/^Actividad de\s+/i, '')
    .replace(/\s+activity$/i, '')
    .trim();
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.74)' },
  dialog: { width: '100%', maxWidth: 680, borderRadius: 24, padding: 0, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 18, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: '#1718C7', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, fontSize: 14, lineHeight: 22, color: '#70839B' },
  closeButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  body: { padding: 24, gap: 20 },
  metricsGrid: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    minHeight: 82,
    borderRadius: 16,
    padding: 16,
    paddingLeft: 20,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  statAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  statLabel: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: '#8A9AAF', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  statValue: { fontSize: 18, lineHeight: 24, fontWeight: '900', color: '#0F172A' },
  insightsSection: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  insightsHeader: {
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    justifyContent: 'center',
  },
  insightsTitle: { fontSize: 14, lineHeight: 18, fontWeight: '900', color: '#0F172A' },
  insightsList: { padding: 12, gap: 10 },
  insightRow: {
    minHeight: 64,
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
  insightCopy: { flex: 1, minWidth: 0 },
  insightTitle: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  insightLocation: { marginTop: 5, fontSize: 15, lineHeight: 20, fontWeight: '900', color: '#0F172A' },
});

export default AlertDetailOverlay;
