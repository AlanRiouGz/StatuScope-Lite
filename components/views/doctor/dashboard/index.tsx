import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { RadarMapCard, RadarMapPolygon } from '@/components/dashboard/RadarMapCard';
import { AlertCard } from '@/components/feedback/AlertCard';
import { DiseaseBreakdownCard } from '@/components/dashboard/DiseaseBreakdownCard';
import { AlertDetailOverlay } from '@/components/views/doctor/dashboard/Sub-funcionalidades/AlertDetailOverlay';
import { EpidemiologicalReportOverlay, ReportSection } from '@/components/views/doctor/dashboard/Sub-funcionalidades/EpidemiologicalReportOverlay';
import { MapZoneDetailOverlay } from '@/components/views/doctor/dashboard/Sub-funcionalidades/MapZoneDetailOverlay';
import { MetricDetailOverlay } from '@/components/views/doctor/dashboard/Sub-funcionalidades/MetricDetailOverlay';
import {
  DoctorDashboardAlert,
  DoctorDashboardMetric,
  DoctorDashboardZone,
} from '@/components/views/doctor/dashboard/Sub-funcionalidades/types';
import { initialsFromName } from '@/lib/format';
import {
  DoctorDashboardAlertResponse,
  DoctorDashboardBreakdownResponse,
  DoctorDashboardDiseaseResponse,
  DoctorDashboardMapResponse,
  DoctorDashboardMetricResponse,
  DoctorDashboardStateMapItem,
  getDoctorDashboardAlerts,
  getDoctorDashboardLocalBreakdown,
  getDoctorDashboardMap,
  getDoctorDashboardMetrics,
  getDoctorDashboardStateBreakdown,
  getDoctorDashboardStateMap,
  getDoctorDashboardStateOutbreakMap,
} from '@/lib/doctorDashboard';
import { useTranslation } from '@/i18n';
import { translateDiseaseName } from '@/lib/diseaseLocalization';
import { translateDashboardBadge, translateDashboardValue } from '@/lib/dashboardLocalization';
import { MexicoStateBoundary, mexicoStateBoundaries } from '@/assets/maps/mexicoStateBoundaries';

const navigationLinks = {
  dashboard: '/dashboard/doctor',
  diagnosis: '/diagnosis',
  analytics: '/analytics',
} as const;

const outbreakRadiusOptions = [35, 75, 150] as const;
const dashboardMetricIds = [
  'active-cases-nearby',
  'highest-case-disease',
  'local-risk-level',
  'priority-municipality',
] as const;

type SectionStatus = 'idle' | 'loading' | 'success' | 'error';

interface SectionState<T> {
  status: SectionStatus;
  data: T | null;
  error: string | null;
}

function initialSectionState<T>(): SectionState<T> {
  return { status: 'idle', data: null, error: null };
}

function formatSyncTime(value: string | undefined, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (!value) return t('doctor.dashboard.map.lastSyncPending');
  return t('doctor.dashboard.map.lastSync', {
    time: new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function positionZones(zones: DoctorDashboardMapResponse['zones']): DoctorDashboardZone[] {
  if (zones.length === 0) return [];

  const zonesWithCoordinates = zones.filter(
    (zone) => typeof zone.latitude === 'number' && typeof zone.longitude === 'number',
  );
  if (zonesWithCoordinates.length === 0) {
    return zones.map((zone, index) => ({
      ...zone,
      top: `${32 + index * 8}%`,
      left: `${44 + index * 6}%`,
      borderColor: zone.borderColor || (index === 0 ? '#0003B8' : '#F97316'),
    }));
  }

  const latitudes = zonesWithCoordinates.map((zone) => zone.latitude as number);
  const longitudes = zonesWithCoordinates.map((zone) => zone.longitude as number);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.01);
  const lonRange = Math.max(maxLon - minLon, 0.01);

  return zones.map((zone, index) => {
    const latitude = typeof zone.latitude === 'number' ? zone.latitude : minLat + latRange / 2;
    const longitude = typeof zone.longitude === 'number' ? zone.longitude : minLon + lonRange / 2;
    const top = 18 + ((maxLat - latitude) / latRange) * 64;
    const left = 18 + ((longitude - minLon) / lonRange) * 64;

    return {
      ...zone,
      top: `${Math.max(12, Math.min(82, top))}%`,
      left: `${Math.max(12, Math.min(82, left))}%`,
      borderColor: zone.borderColor || (index === 0 ? '#0003B8' : '#F97316'),
    };
  });
}

function statusLabel(value: string | undefined, t: (key: string) => string): string {
  if (value === 'CONFIRMED') return t('common.statuses.confirmed');
  if (value === 'SUSPECTED') return t('common.statuses.suspected');
  return value ?? '';
}

function describeAlert(
  alert: DoctorDashboardAlert,
  t: (key: string, params?: Record<string, string | number>) => string,
): DoctorDashboardAlert {
  const match = alert.description.match(/^([\d,]+) active cases? in (.+)\. Status: (.+)\.$/);
  const rawDiseaseName = alert.title.replace(/ activity$/, '');
  const diseaseName = translateDiseaseName(t, rawDiseaseName);
  if (!match) {
    return {
      ...alert,
      title: t('doctor.dashboard.alerts.activityTitle', { disease: diseaseName }),
      priority: translateDashboardValue(t, alert.priority),
    };
  }

  const [, count, area, status] = match;
  return {
    ...alert,
    title: t('doctor.dashboard.alerts.activityTitle', {
      disease: diseaseName,
    }),
    description: t('doctor.dashboard.alerts.activityDescription', {
      cases: t('common.units.activeCases', { count }),
      area,
      status: statusLabel(status, t),
    }),
    priority: translateDashboardValue(t, alert.priority),
    caseLabel: alert.caseLabel ? translateDashboardValue(t, alert.caseLabel) : undefined,
    confirmationStatus: alert.confirmationStatus ? statusLabel(alert.confirmationStatus, t) : undefined,
  };
}

function toMetric(
  metric: DoctorDashboardMetricResponse,
  t: (key: string, params?: Record<string, string | number>) => string,
  hospitalName?: string | null,
): DoctorDashboardMetric {
  const translatedTitle = t(`doctor.dashboard.metrics.${metric.id}.title`);
  const title = metric.id === 'hospital-profile' && hospitalName
    ? hospitalName
    : translatedTitle;
  const value = metric.id === 'highest-case-disease'
    ? translateDiseaseName(t, metric.value)
    : translateDashboardValue(t, metric.value);

  return {
    id: metric.id,
    title,
    value,
    badge: translateDashboardBadge(t, metric.badge ?? undefined),
    status: metric.status ?? 'neutral',
    subtitle: t(`doctor.dashboard.metrics.${metric.id}.subtitle`) || (metric.subtitle ?? undefined),
    detailTitle: title,
    detailSummary: t(`doctor.dashboard.metrics.${metric.id}.detailSummary`),
    signalLabel: t(`doctor.dashboard.metrics.${metric.id}.signalLabel`),
    recommendedAction: t(`doctor.dashboard.metrics.${metric.id}.recommendedAction`),
    iconKey: metric.iconKey ?? undefined,
    insights: metric.insights?.map((insight) => ({
      ...insight,
      title: translateDiseaseName(t, insight.title),
      severity: translateDashboardValue(t, insight.severity),
      cases: translateDashboardValue(t, insight.cases),
      meta: insight.meta ? translateDashboardValue(t, insight.meta) : insight.meta,
    })),
  };
}

function placeholderMetrics(
  t: (key: string, params?: Record<string, string | number>) => string,
  hospitalName?: string | null,
): DoctorDashboardMetric[] {
  return dashboardMetricIds.map((id) => {
    const title = t(`doctor.dashboard.metrics.${id}.title`);

    return {
      id,
      title,
      value: '',
      badge: '',
      status: 'neutral',
      subtitle: t(`doctor.dashboard.metrics.${id}.subtitle`),
      detailTitle: title,
      detailSummary: t(`doctor.dashboard.metrics.${id}.detailSummary`),
      signalLabel: t(`doctor.dashboard.metrics.${id}.signalLabel`),
      recommendedAction: t(`doctor.dashboard.metrics.${id}.recommendedAction`),
    };
  });
}

function formatSurroundingsLabel(
  municipalityName: string | null | undefined,
  fallback: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (!municipalityName) return fallback;
  return t('doctor.dashboard.diseaseBreakdown.municipalitySurroundings', { municipality: municipalityName });
}

function buildReportSection({
  title,
  contextLabel,
  contextValue,
  rows,
  totalCases,
  t,
}: {
  title: string;
  contextLabel: string;
  contextValue: string;
  rows: DoctorDashboardDiseaseResponse[];
  totalCases: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}): ReportSection {
  return {
    title,
    contextLabel,
    contextValue,
    totalCases,
    rows: rows.map((row) => ({
      disease: translateDiseaseName(t, row.diseaseName),
      cases: row.caseCount,
      outbreaks: row.outbreakCount,
    })),
  };
}

function buildDiseaseRows(
  diseases: DoctorDashboardDiseaseResponse[],
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  return diseases.map((disease) => ({
    id: disease.diseaseName,
    label: translateDiseaseName(t, disease.diseaseName).toUpperCase(),
    valueText: t(disease.caseCount === 1 ? 'common.units.case' : 'common.units.cases', {
      count: formatNumber(disease.caseCount),
    }),
    progress: disease.progress,
    barColor: '#1718C7',
    barHeight: 12,
  }));
}

function getMapCenter(zones: DoctorDashboardZone[]) {
  const hospitalNode = zones.find(
    (zone) => zone.id === 'hospital-node' && typeof zone.latitude === 'number' && typeof zone.longitude === 'number',
  );
  if (hospitalNode && typeof hospitalNode.latitude === 'number' && typeof hospitalNode.longitude === 'number') {
    return { latitude: hospitalNode.latitude, longitude: hospitalNode.longitude };
  }

  const geocodedZones = zones.filter(
    (zone) => typeof zone.latitude === 'number' && typeof zone.longitude === 'number',
  );
  if (geocodedZones.length === 0) return null;

  return {
    latitude: geocodedZones.reduce((sum, zone) => sum + (zone.latitude as number), 0) / geocodedZones.length,
    longitude: geocodedZones.reduce((sum, zone) => sum + (zone.longitude as number), 0) / geocodedZones.length,
  };
}

function shortStateName(name: string): string {
  const aliases: Record<string, string> = {
    'Coahuila de Zaragoza': 'Coahuila',
    'Michoacan de Ocampo': 'Michoacan',
    'Michoacán de Ocampo': 'Michoacán',
    'Veracruz de Ignacio de la Llave': 'Veracruz',
    'Mexico': 'México',
  };
  return aliases[name] ?? name;
}

function stateLookupKey(name: string): string {
  const aliases: Record<string, string> = {
    'Coahuila de Zaragoza': 'Coahuila',
    'Michoacan de Ocampo': 'Michoacan',
    'Michoacán de Ocampo': 'Michoacán',
    'Veracruz de Ignacio de la Llave': 'Veracruz',
    'Mexico': 'Mexico',
    'México': 'Mexico',
  };
  return (aliases[name] ?? shortStateName(name))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getStateBoundary(stateName: string | undefined | null) {
  if (!stateName) return undefined;
  const targetKey = stateLookupKey(stateName);
  return mexicoStateBoundaries.find((boundary) => stateLookupKey(boundary.name) === targetKey);
}

function getZoneBounds(zones: DoctorDashboardZone[]) {
  const geocodedZones = zones.filter(
    (zone) => typeof zone.latitude === 'number' && typeof zone.longitude === 'number',
  );
  if (geocodedZones.length === 0) return undefined;

  const latitudes = geocodedZones.map((zone) => zone.latitude as number);
  const longitudes = geocodedZones.map((zone) => zone.longitude as number);
  const latitudePadding = Math.max(0.12, (Math.max(...latitudes) - Math.min(...latitudes)) * 0.18);
  const longitudePadding = Math.max(0.12, (Math.max(...longitudes) - Math.min(...longitudes)) * 0.18);

  return {
    minLatitude: Math.min(...latitudes) - latitudePadding,
    maxLatitude: Math.max(...latitudes) + latitudePadding,
    minLongitude: Math.min(...longitudes) - longitudePadding,
    maxLongitude: Math.max(...longitudes) + longitudePadding,
  };
}

function getBoundaryBounds(boundary: MexicoStateBoundary | undefined) {
  if (!boundary) return undefined;
  const points = boundary.geometry.coordinates.flat(2);
  if (points.length === 0) return undefined;

  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  const latitudePadding = Math.max(0.1, (Math.max(...latitudes) - Math.min(...latitudes)) * 0.12);
  const longitudePadding = Math.max(0.1, (Math.max(...longitudes) - Math.min(...longitudes)) * 0.12);

  return {
    minLatitude: Math.min(...latitudes) - latitudePadding,
    maxLatitude: Math.max(...latitudes) + latitudePadding,
    minLongitude: Math.min(...longitudes) - longitudePadding,
    maxLongitude: Math.max(...longitudes) + longitudePadding,
  };
}

function getRadiusBounds(
  center: { latitude: number; longitude: number } | null,
  radiusKm: number | undefined,
) {
  if (!center || typeof radiusKm !== 'number') return undefined;
  const latitudePadding = radiusKm / 111;
  const longitudePadding = radiusKm / (111 * Math.cos(center.latitude * Math.PI / 180));

  return {
    minLatitude: center.latitude - latitudePadding,
    maxLatitude: center.latitude + latitudePadding,
    minLongitude: center.longitude - longitudePadding,
    maxLongitude: center.longitude + longitudePadding,
  };
}

function metricAccentColor(status?: DoctorDashboardMetric['status']) {
  if (status === 'danger') return '#1E40AF';
  if (status === 'warning') return '#3B82F6';
  if (status === 'positive') return '#93C5FD';
  return '#64748B';
}

function metricIcon(metric: DoctorDashboardMetric, isLoading = false) {
  const color = isLoading ? metricAccentColor('neutral') : metricAccentColor(metric.status);
  const iconName = metric.id === 'active-cases-nearby'
    ? 'activity'
    : metric.id === 'highest-case-disease'
      ? 'trending-up'
      : metric.id === 'local-risk-level'
        ? 'alert-triangle'
        : metric.id === 'priority-municipality'
          ? 'map-pin'
          : 'bar-chart-2';

  return <Feather name={iconName} size={18} color={color} />;
}

function SkeletonLine({ width, height = 12, style }: { width: number | string; height?: number; style?: object }) {
  return <View style={[styles.skeletonLine, { width, height }, style]} />;
}

function RetryOverlay({
  label,
  onRetry,
}: {
  label: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.retryOverlay}>
      <TouchableOpacity style={styles.retryButton} activeOpacity={0.82} onPress={onRetry}>
        <Feather name="refresh-cw" size={18} color="#0003B8" />
        <Text style={styles.retryText}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

function MapSkeleton({ width }: { width?: number }) {
  return <View style={[styles.mapSkeleton, width ? { width, flex: undefined } : null]} />;
}

function AlertsSkeleton({ width, title }: { width?: number; title: string }) {
  return (
    <View style={[styles.alertsPanel, width ? { width } : null]}>
      <View style={styles.alertsHeader}>
        <Text style={styles.alertsTitle}>{title}</Text>
        <View style={styles.sectionHeaderRule} />
      </View>
      <View style={styles.alertsList}>
        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.alertSkeletonItem}>
            <SkeletonLine width="48%" height={16} />
            <SkeletonLine width="84%" />
            <SkeletonLine width="64%" />
          </View>
        ))}
      </View>
    </View>
  );
}

function BreakdownSkeleton({ title, buttonLabel }: { title: string; buttonLabel: string }) {
  return (
    <View style={[styles.breakdownCard, styles.breakdownSkeleton]}>
      <View style={styles.breakdownSkeletonHeader}>
        <Text style={styles.breakdownSkeletonTitle}>{title}</Text>
        <View style={styles.sectionHeaderRule} />
      </View>
      <View style={styles.breakdownSkeletonRows}>
        {[0, 1, 2, 3, 4].map((item) => (
          <View key={item} style={styles.breakdownSkeletonRow}>
            <View style={styles.breakdownSkeletonLabels}>
              <SkeletonLine width="34%" height={13} />
              <SkeletonLine width={92} height={13} />
            </View>
            <SkeletonLine width="100%" height={12} />
          </View>
        ))}
      </View>
      <View style={styles.breakdownSkeletonSummary}>
        <SkeletonLine width="100%" />
        <SkeletonLine width="82%" />
      </View>
      <View style={styles.breakdownSkeletonButton}>
        <Text style={styles.breakdownSkeletonButtonText}>{buttonLabel}</Text>
      </View>
    </View>
  );
}

export function DoctorDashboard() {
  const router = useRouter();
  const { logout, profile } = useAuth();
  const { t } = useTranslation();
  const [metricsState, setMetricsState] = useState<SectionState<{
    metrics: DoctorDashboardMetricResponse[];
    hospitalName?: string | null;
  }>>(initialSectionState);
  const [mapState, setMapState] = useState<SectionState<DoctorDashboardMapResponse>>(initialSectionState);
  const [alertsState, setAlertsState] = useState<SectionState<{ alerts: DoctorDashboardAlertResponse[] }>>(initialSectionState);
  const [localBreakdownState, setLocalBreakdownState] = useState<SectionState<DoctorDashboardBreakdownResponse>>(initialSectionState);
  const [stateBreakdownState, setStateBreakdownState] = useState<SectionState<DoctorDashboardBreakdownResponse>>(initialSectionState);
  const [gridWidth, setGridWidth] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState<DoctorDashboardMetric | null>(null);
  const [selectedZone, setSelectedZone] = useState<DoctorDashboardZone | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<DoctorDashboardAlert | null>(null);
  const [isMoreAlertsOpen, setIsMoreAlertsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isStateExplorerOpen, setIsStateExplorerOpen] = useState(false);
  const [selectedState, setSelectedState] = useState<DoctorDashboardStateMapItem | null>(null);
  const [stateMapState, setStateMapState] = useState<SectionState<{ states: DoctorDashboardStateMapItem[] }>>(initialSectionState);
  const [stateOutbreakMapState, setStateOutbreakMapState] = useState<SectionState<DoctorDashboardMapResponse>>(initialSectionState);
  const [isMapHovered, setIsMapHovered] = useState(false);
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(75);
  const gridGap = 16;
  const metricWidth = gridWidth > 0 ? (gridWidth - gridGap * 3) / 4 : undefined;
  const mapWidth = metricWidth ? metricWidth * 2 + gridGap : undefined;

  const loadMetrics = useCallback(async () => {
    setMetricsState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await getDoctorDashboardMetrics(selectedRadiusKm);
      setMetricsState({ status: 'success', data, error: null });
    } catch (error) {
      setMetricsState((current) => ({
        status: 'error',
        data: current.data,
        error: error instanceof Error ? error.message : 'Unable to load dashboard metrics.',
      }));
    }
  }, [selectedRadiusKm]);

  const loadMap = useCallback(async () => {
    setMapState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await getDoctorDashboardMap(selectedRadiusKm);
      setMapState({ status: 'success', data, error: null });
    } catch (error) {
      setMapState((current) => ({
        status: 'error',
        data: current.data,
        error: error instanceof Error ? error.message : 'Unable to load map data.',
      }));
    }
  }, [selectedRadiusKm]);

  const loadAlerts = useCallback(async () => {
    setAlertsState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await getDoctorDashboardAlerts(selectedRadiusKm);
      setAlertsState({ status: 'success', data, error: null });
    } catch (error) {
      setAlertsState((current) => ({
        status: 'error',
        data: current.data,
        error: error instanceof Error ? error.message : 'Unable to load alerts.',
      }));
    }
  }, [selectedRadiusKm]);

  const loadLocalBreakdown = useCallback(async () => {
    setLocalBreakdownState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await getDoctorDashboardLocalBreakdown(selectedRadiusKm);
      setLocalBreakdownState({ status: 'success', data, error: null });
    } catch (error) {
      setLocalBreakdownState((current) => ({
        status: 'error',
        data: current.data,
        error: error instanceof Error ? error.message : 'Unable to load local breakdown.',
      }));
    }
  }, [selectedRadiusKm]);

  const loadStateBreakdown = useCallback(async () => {
    setStateBreakdownState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await getDoctorDashboardStateBreakdown();
      setStateBreakdownState({ status: 'success', data, error: null });
    } catch (error) {
      setStateBreakdownState((current) => ({
        status: 'error',
        data: current.data,
        error: error instanceof Error ? error.message : 'Unable to load state breakdown.',
      }));
    }
  }, []);

  const loadStateMap = useCallback(async () => {
    setStateMapState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await getDoctorDashboardStateMap();
      setStateMapState({ status: 'success', data, error: null });
    } catch (error) {
      setStateMapState((current) => ({
        status: 'error',
        data: current.data,
        error: error instanceof Error ? error.message : 'Unable to load state map.',
      }));
    }
  }, []);

  const loadStateOutbreakMap = useCallback(async (state: DoctorDashboardStateMapItem) => {
    setSelectedState(state);
    setStateOutbreakMapState({ status: 'loading', data: null, error: null });
    try {
      const data = await getDoctorDashboardStateOutbreakMap(state.stateId);
      setStateOutbreakMapState({ status: 'success', data, error: null });
    } catch (error) {
      setStateOutbreakMapState({
        status: 'error',
        data: null,
        error: error instanceof Error ? error.message : 'Unable to load state outbreaks.',
      });
    }
  }, []);

  const openStateExplorer = useCallback(() => {
    setIsStateExplorerOpen(true);
    setSelectedState(null);
    setStateOutbreakMapState(initialSectionState());
    void loadStateMap();
  }, [loadStateMap]);

  useEffect(() => {
    void loadMetrics();
    void loadMap();
    void loadAlerts();
    void loadLocalBreakdown();
    void loadStateBreakdown();
  }, [loadAlerts, loadLocalBreakdown, loadMap, loadMetrics, loadStateBreakdown]);

  const hospitalName = metricsState.data?.hospitalName ?? profile?.hospitalName ?? profile?.email;
  const topMetrics = useMemo(
    () => {
      const metrics = metricsState.data?.metrics ?? [];
      return metrics.length > 0
        ? metrics.map((metric) => toMetric(metric, t, hospitalName))
        : placeholderMetrics(t, hospitalName);
    },
    [hospitalName, metricsState.data?.metrics, t],
  );
  const isMetricsLoading = metricsState.status === 'loading' || metricsState.status === 'idle';
  const alerts = useMemo(
    () => (alertsState.data?.alerts ?? []).map((alert) => describeAlert(alert, t)),
    [alertsState.data?.alerts, t],
  );
  const visibleAlerts = useMemo(() => alerts.slice(0, 4), [alerts]);
  const remainingAlerts = useMemo(() => alerts.slice(4), [alerts]);
  const mapZones = useMemo(
    () => positionZones(mapState.data?.zones ?? []).map((zone) => ({
      ...zone,
      risk: translateDashboardValue(t, zone.risk),
      disease: translateDiseaseName(t, zone.disease),
      cases: translateDashboardValue(t, zone.cases),
      radius: translateDashboardValue(t, zone.radius),
      priority: translateDashboardValue(t, zone.priority),
    })),
    [mapState.data?.zones, t],
  );
  const mapCenter = useMemo(() => getMapCenter(mapZones), [mapZones]);
  const localMapBounds = useMemo(
    () => getRadiusBounds(mapCenter, mapState.data?.radiusKm),
    [mapCenter, mapState.data?.radiusKm],
  );
  const stateOutbreakZones = useMemo(
    () => positionZones(stateOutbreakMapState.data?.zones ?? []).map((zone) => ({
      ...zone,
      stateName: zone.stateName ?? selectedState?.stateName,
      risk: translateDashboardValue(t, zone.risk),
      disease: translateDiseaseName(t, zone.disease),
      cases: translateDashboardValue(t, zone.cases),
      radius: translateDashboardValue(t, zone.radius),
      priority: translateDashboardValue(t, zone.priority),
    })),
    [selectedState?.stateName, stateOutbreakMapState.data?.zones, t],
  );
  const selectedStateCenter = useMemo(
    () => selectedState ? { latitude: selectedState.latitude, longitude: selectedState.longitude } : getMapCenter(stateOutbreakZones),
    [selectedState, stateOutbreakZones],
  );
  const selectedStateBoundary = useMemo(() => getStateBoundary(selectedState?.stateName), [selectedState?.stateName]);
  const selectedStateBounds = useMemo(
    () => getBoundaryBounds(selectedStateBoundary) ?? getZoneBounds(stateOutbreakZones),
    [selectedStateBoundary, stateOutbreakZones],
  );
  const totalCases = useMemo(
    () => localBreakdownState.data?.diseaseBreakdown.reduce((total, disease) => total + disease.caseCount, 0) ?? 0,
    [localBreakdownState.data?.diseaseBreakdown],
  );
  const totalStateCases = useMemo(
    () => stateBreakdownState.data?.diseaseBreakdown.reduce((total, disease) => total + disease.caseCount, 0) ?? 0,
    [stateBreakdownState.data?.diseaseBreakdown],
  );
  const stateName = localBreakdownState.data?.stateName
    ?? stateBreakdownState.data?.stateName
    ?? t('doctor.dashboard.diseaseBreakdown.hospitalRegion');
  const localBreakdownContext = formatSurroundingsLabel(
    localBreakdownState.data?.municipalityName,
    stateName,
    t,
  );
  const localReportSection = useMemo(
    () => buildReportSection({
      title: t('doctor.dashboard.diseaseBreakdown.localTitle'),
      contextLabel: t('doctor.dashboard.diseaseBreakdown.outbreakContext'),
      contextValue: localBreakdownContext,
      rows: localBreakdownState.data?.diseaseBreakdown ?? [],
      totalCases,
      t,
    }),
    [localBreakdownContext, localBreakdownState.data?.diseaseBreakdown, t, totalCases],
  );
  const stateReportSection = useMemo(
    () => buildReportSection({
      title: t('doctor.dashboard.diseaseBreakdown.stateTitle'),
      contextLabel: t('doctor.dashboard.diseaseBreakdown.stateContext'),
      contextValue: stateName,
      rows: stateBreakdownState.data?.diseaseBreakdown ?? [],
      totalCases: totalStateCases,
      t,
    }),
    [stateBreakdownState.data?.diseaseBreakdown, stateName, t, totalStateCases],
  );

  return (
    <DashboardLayout
      active="dashboard"
      sectionLabel={t('doctor.dashboard.sectionLabel')}
      userName={profile?.fullName ?? 'Doctor'}
      userId={hospitalName}
      avatarText={initialsFromName(profile?.fullName)}
      links={navigationLinks}
      onLogout={async () => { await logout(); router.replace('/login'); }}
    >
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isMapHovered}
      >
        <View style={styles.container}>
        <View style={styles.heroStrip}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>{t('doctor.dashboard.hero.eyebrow')}</Text>
            <Text style={styles.heroTitle}>{t('doctor.dashboard.hero.title')}</Text>
            <Text style={styles.heroDescription}>{t('doctor.dashboard.hero.description')}</Text>
          </View>
          <View style={styles.radiusControlGroup}>
            <Text style={styles.radiusControlLabel}>{t('doctor.dashboard.radiusControl.label')}</Text>
            <View style={styles.radiusButtons}>
              {outbreakRadiusOptions.map((radius) => {
                const isActive = radius === selectedRadiusKm;
                return (
                  <TouchableOpacity
                    key={radius}
                    style={[styles.radiusSegment, isActive ? styles.radiusSegmentActive : null]}
                    activeOpacity={0.82}
                    onPress={() => setSelectedRadiusKm(radius)}
                  >
                    <Text style={[styles.radiusSegmentText, isActive ? styles.radiusSegmentTextActive : null]}>
                      {radius} km
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
        <View
          style={styles.metricsRow}
          onLayout={(event: LayoutChangeEvent) => {
            const nextWidth = event.nativeEvent.layout.width;
            if (Math.abs(nextWidth - gridWidth) > 1) {
              setGridWidth(nextWidth);
            }
          }}
        >
          {metricsState.status === 'error' ? (
            topMetrics.map((metric) => (
              <View
                key={metric.id}
                style={[styles.retryHost, metricWidth ? { width: metricWidth } : styles.metricTouchable]}
              >
                <StatCard
                  title={metric.title}
                  value={metric.value}
                  badge={metric.badge}
                  status={metric.status}
                  subtitle={metric.subtitle}
                  style={[styles.metricCard, metricWidth ? { width: undefined, flex: undefined } : null]}
                  icon={metricIcon(metric, !metricsState.data)}
                  isLoading={!metricsState.data}
                />
                <RetryOverlay label={t('doctor.dashboard.retry')} onRetry={loadMetrics} />
              </View>
            ))
          ) : topMetrics.map((metric) => (
            <TouchableOpacity
              key={metric.id}
              activeOpacity={0.84}
              onPress={() => setSelectedMetric(metric)}
              disabled={isMetricsLoading}
              style={metricWidth ? { width: metricWidth } : styles.metricTouchable}
            >
              <StatCard
                title={metric.title}
                value={metric.value}
                badge={metric.badge}
                status={metric.status}
                subtitle={metric.subtitle}
                style={[styles.metricCard, metricWidth ? { width: undefined, flex: undefined } : null]}
                icon={metricIcon(metric, isMetricsLoading)}
                isLoading={isMetricsLoading}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.mainGrid}>
          {mapState.status === 'loading' || mapState.status === 'idle' ? (
            <MapSkeleton width={mapWidth} />
          ) : mapState.status === 'error' ? (
            <View style={[styles.retryHost, mapWidth ? { width: mapWidth } : styles.mapCard]}>
              <MapSkeleton />
              <RetryOverlay label={t('doctor.dashboard.retry')} onRetry={loadMap} />
            </View>
          ) : (
            <RadarMapCard
              title={t('doctor.dashboard.map.title')}
              showOverlayPanel
              overlayTitle={t('doctor.dashboard.map.overlayTitle').toUpperCase()}
              overlayBadgeLabel={t('doctor.dashboard.map.secure').toUpperCase()}
              overlayItems={(mapState.data?.diseaseBreakdown ?? []).slice(0, 3).map((disease, index) => ({
                label: translateDiseaseName(t, disease.diseaseName),
                value: formatNumber(disease.caseCount),
                color: index === 0 ? '#1E40AF' : index === 1 ? '#3B82F6' : '#0003B8',
              }))}
              showControls
              legendItems={[
                { label: t('doctor.dashboard.map.highRisk'), color: '#1E40AF' },
                { label: t('doctor.dashboard.map.emerging'), color: '#3B82F6' },
                { label: t('doctor.dashboard.map.lowRisk'), color: '#93C5FD' },
                { label: t('doctor.dashboard.map.hospitalNode'), color: '#0003B8' },
              ]}
              footerTextLeft="© OpenStreetMap contributors"
              footerTextRight={formatSyncTime(mapState.data?.generatedAt, t)}
              mapCenterLatitude={mapCenter?.latitude}
              mapCenterLongitude={mapCenter?.longitude}
              mapZoom={10}
              minZoom={10}
              maxZoom={14}
              mapBounds={localMapBounds}
              enablePan
              onMapHoverChange={setIsMapHovered}
              surveillanceRadiusKm={mapState.data?.radiusKm}
              bottomRightActionLabel={t('doctor.dashboard.map.viewOtherStates')}
              onBottomRightActionPress={openStateExplorer}
              pins={mapZones.map((zone) => ({
                id: zone.id,
                top: zone.top,
                left: zone.left,
                latitude: zone.latitude,
                longitude: zone.longitude,
                borderColor: zone.borderColor,
                fillColor: '#FFFFFF',
                icon:
                  zone.borderColor === '#0003B8' ? (
                    <MaterialCommunityIcons name="hospital-box-outline" size={12} color="#0003B8" />
                  ) : zone.borderColor === '#F97316' ? (
                    <MaterialCommunityIcons name="virus-outline" size={14} color={zone.borderColor} />
                  ) : zone.borderColor === '#22C55E' ? (
                    <MaterialCommunityIcons name="check-circle-outline" size={14} color={zone.borderColor} />
                  ) : (
                    <MaterialCommunityIcons name="alert" size={16} color={zone.borderColor} />
                  ),
                onPress: () => setSelectedZone(zone),
              }))}
              style={[styles.mapCard, mapWidth ? { width: mapWidth, flex: undefined } : null]}
            />
          )}

          {alertsState.status === 'loading' || alertsState.status === 'idle' ? (
            <AlertsSkeleton width={mapWidth} title={t('doctor.dashboard.alerts.title')} />
          ) : alertsState.status === 'error' ? (
            <View style={[styles.retryHost, mapWidth ? { width: mapWidth } : null]}>
              <AlertsSkeleton title={t('doctor.dashboard.alerts.title')} />
              <RetryOverlay label={t('doctor.dashboard.retry')} onRetry={loadAlerts} />
            </View>
          ) : (
            <View
              style={[styles.alertsPanel, mapWidth ? { width: mapWidth } : null]}
            >
              <View style={styles.alertsHeader}>
                <Text style={styles.alertsTitle}>{t('doctor.dashboard.alerts.title')}</Text>
                <View style={styles.sectionHeaderRule} />
              </View>
              <View style={styles.alertsList}>
                {alerts.length === 0 ? (
                  <AlertCard
                    title={t('doctor.dashboard.alerts.emptyTitle')}
                    description={t('doctor.dashboard.alerts.emptyDescription')}
                    variant="neutral"
                    style={styles.alertCard}
                  />
                ) : (
                  <>
                    {visibleAlerts.map((alert) => (
                      <TouchableOpacity
                        key={alert.id}
                        activeOpacity={0.8}
                        onPress={() => setSelectedAlert(alert)}
                      >
                        <AlertCard
                          title={alert.title}
                          description={alert.description}
                          variant={alert.variant}
                          style={styles.alertCard}
                        />
                      </TouchableOpacity>
                    ))}
                    {remainingAlerts.length > 0 ? (
                      <TouchableOpacity
                        style={styles.moreAlertsButton}
                        activeOpacity={0.82}
                        onPress={() => setIsMoreAlertsOpen(true)}
                      >
                        <Feather name="list" size={17} color="#0003B8" />
                        <Text style={styles.moreAlertsText}>{t('doctor.dashboard.alerts.showMore')}</Text>
                        <View style={styles.moreAlertsBadge}>
                          <Text style={styles.moreAlertsBadgeText}>{remainingAlerts.length}</Text>
                        </View>
                      </TouchableOpacity>
                    ) : null}
                  </>
                )}
              </View>
            </View>
          )}

        </View>

        <View style={styles.breakdownGrid}>
          {localBreakdownState.status === 'loading' || localBreakdownState.status === 'idle' ? (
            <BreakdownSkeleton
              title={t('doctor.dashboard.diseaseBreakdown.localTitle')}
              buttonLabel={t('doctor.dashboard.diseaseBreakdown.exportReport')}
            />
          ) : localBreakdownState.status === 'error' ? (
            <View style={[styles.retryHost, styles.breakdownRetryHost]}>
              <BreakdownSkeleton
                title={t('doctor.dashboard.diseaseBreakdown.localTitle')}
                buttonLabel={t('doctor.dashboard.diseaseBreakdown.exportReport')}
              />
              <RetryOverlay label={t('doctor.dashboard.retry')} onRetry={loadLocalBreakdown} />
            </View>
          ) : (
            <DiseaseBreakdownCard
              title={t('doctor.dashboard.diseaseBreakdown.localTitle')}
              rows={buildDiseaseRows(localBreakdownState.data?.diseaseBreakdown ?? [], t)}
              summaryItems={[
                { label: t('doctor.dashboard.diseaseBreakdown.totalActiveCases'), value: formatNumber(totalCases) },
                { label: t('doctor.dashboard.diseaseBreakdown.outbreakContext'), value: localBreakdownContext },
              ]}
              buttonLabel={t('doctor.dashboard.diseaseBreakdown.exportReport')}
              onButtonPress={() => setIsReportOpen(true)}
              style={styles.breakdownCard}
            />
          )}

          {stateBreakdownState.status === 'loading' || stateBreakdownState.status === 'idle' ? (
            <BreakdownSkeleton
              title={t('doctor.dashboard.diseaseBreakdown.stateTitle')}
              buttonLabel={t('doctor.dashboard.diseaseBreakdown.exportReport')}
            />
          ) : stateBreakdownState.status === 'error' ? (
            <View style={[styles.retryHost, styles.breakdownRetryHost]}>
              <BreakdownSkeleton
                title={t('doctor.dashboard.diseaseBreakdown.stateTitle')}
                buttonLabel={t('doctor.dashboard.diseaseBreakdown.exportReport')}
              />
              <RetryOverlay label={t('doctor.dashboard.retry')} onRetry={loadStateBreakdown} />
            </View>
          ) : (
            <DiseaseBreakdownCard
              title={t('doctor.dashboard.diseaseBreakdown.stateTitle')}
              rows={buildDiseaseRows(stateBreakdownState.data?.diseaseBreakdown ?? [], t)}
              summaryItems={[
                { label: t('doctor.dashboard.diseaseBreakdown.totalStateCases'), value: formatNumber(totalStateCases) },
                { label: t('doctor.dashboard.diseaseBreakdown.stateContext'), value: stateName },
              ]}
              buttonLabel={t('doctor.dashboard.diseaseBreakdown.exportReport')}
              onButtonPress={() => setIsReportOpen(true)}
              style={styles.breakdownCard}
            />
          )}
        </View>
        </View>
      </ScrollView>
      <MetricDetailOverlay visible={selectedMetric !== null} metric={selectedMetric} onClose={() => setSelectedMetric(null)} />
      <MapZoneDetailOverlay visible={selectedZone !== null} zone={selectedZone} onClose={() => setSelectedZone(null)} />
      <AlertDetailOverlay visible={selectedAlert !== null} alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      <MoreAlertsOverlay
        visible={isMoreAlertsOpen}
        alerts={remainingAlerts}
        onClose={() => setIsMoreAlertsOpen(false)}
        onSelectAlert={(alert) => {
          setIsMoreAlertsOpen(false);
          setSelectedAlert(alert);
        }}
        t={t}
      />
      <EpidemiologicalReportOverlay
        visible={isReportOpen}
        hospitalName={hospitalName}
        generatedAt={mapState.data?.generatedAt}
        localSection={localReportSection}
        stateSection={stateReportSection}
        onClose={() => setIsReportOpen(false)}
        radiusKm={selectedRadiusKm}
      />
      <StateOutbreakExplorer
        visible={isStateExplorerOpen}
        states={stateMapState.data?.states ?? []}
        statesStatus={stateMapState.status}
        selectedState={selectedState}
        selectedStateCenter={selectedStateCenter}
        selectedStateBounds={selectedStateBounds}
        stateZones={stateOutbreakZones}
        stateMapStatus={stateOutbreakMapState.status}
        onClose={() => setIsStateExplorerOpen(false)}
        onRetryStates={loadStateMap}
        onSelectState={(state) => { void loadStateOutbreakMap(state); }}
        onBack={() => {
          setSelectedState(null);
          setStateOutbreakMapState(initialSectionState());
        }}
        onZonePress={setSelectedZone}
        onMapHoverChange={setIsMapHovered}
        t={t}
      />
    </DashboardLayout>
  );
}

function StateOutbreakExplorer({
  visible,
  states,
  statesStatus,
  selectedState,
  selectedStateCenter,
  selectedStateBounds,
  stateZones,
  stateMapStatus,
  onClose,
  onRetryStates,
  onSelectState,
  onBack,
  onZonePress,
  onMapHoverChange,
  t,
}: {
  visible: boolean;
  states: DoctorDashboardStateMapItem[];
  statesStatus: SectionStatus;
  selectedState: DoctorDashboardStateMapItem | null;
  selectedStateCenter: { latitude: number; longitude: number } | null;
  selectedStateBounds?: { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number };
  stateZones: DoctorDashboardZone[];
  stateMapStatus: SectionStatus;
  onClose: () => void;
  onRetryStates: () => void;
  onSelectState: (state: DoctorDashboardStateMapItem) => void;
  onBack: () => void;
  onZonePress: (zone: DoctorDashboardZone) => void;
  onMapHoverChange: (isHovering: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const mexicoCenter = { latitude: 23.6345, longitude: -102.5528 };
  const statesByName = useMemo(() => new Map(
    states.map((state) => [stateLookupKey(state.stateName), state]),
  ), [states]);
  const selectedBoundary = useMemo(() => getStateBoundary(selectedState?.stateName), [selectedState?.stateName]);
  const selectorPolygons = useMemo<RadarMapPolygon[]>(() => mexicoStateBoundaries.map((boundary) => {
    const state = statesByName.get(stateLookupKey(boundary.name));
    const hasOutbreaks = (state?.outbreakCount ?? 0) > 0;
    return {
      id: boundary.id,
      geometry: boundary.geometry,
      fillColor: hasOutbreaks ? 'rgba(0, 3, 184, 0.08)' : 'rgba(100, 116, 139, 0.04)',
      strokeColor: hasOutbreaks ? 'rgba(0, 3, 184, 0.42)' : 'rgba(100, 116, 139, 0.24)',
      strokeWidth: hasOutbreaks ? 1.3 : 1,
    };
  }), [statesByName]);
  const selectedPolygons = useMemo<RadarMapPolygon[]>(() => (
    selectedBoundary
      ? [{
        id: selectedBoundary.id,
        geometry: selectedBoundary.geometry,
        fillColor: 'rgba(0, 3, 184, 0.12)',
        strokeColor: '#0003B8',
        strokeWidth: 2,
      }]
      : []
  ), [selectedBoundary]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.stateExplorerOverlay}>
        <Pressable style={styles.stateExplorerBackdrop} onPress={onClose} />
        <View style={styles.stateExplorerCard}>
          <View style={styles.stateExplorerHeader}>
            <View>
              <Text style={styles.stateExplorerEyebrow}>
                {selectedState ? t('doctor.dashboard.map.stateOutbreaks') : t('doctor.dashboard.map.stateSelector')}
              </Text>
              <Text style={styles.stateExplorerTitle}>
                {selectedState ? shortStateName(selectedState.stateName) : t('doctor.dashboard.map.viewOtherStates')}
              </Text>
            </View>
            <View style={styles.stateExplorerActions}>
              {selectedState ? (
                <TouchableOpacity style={styles.stateExplorerSecondaryButton} onPress={onBack} activeOpacity={0.75}>
                  <Feather name="arrow-left" size={16} color="#0003B8" />
                  <Text style={styles.stateExplorerSecondaryText}>{t('doctor.dashboard.map.backToStates')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.75}>
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          {selectedState ? (
            stateMapStatus === 'loading' ? (
              <MapSkeleton />
            ) : stateMapStatus === 'error' ? (
              <View style={styles.stateExplorerError}>
                <RetryOverlay label={t('doctor.dashboard.retry')} onRetry={() => onSelectState(selectedState)} />
              </View>
            ) : (
              <RadarMapCard
                title={shortStateName(selectedState.stateName)}
                showControls
                showFooter
                footerTextLeft="© OpenStreetMap contributors"
                footerTextRight={t('doctor.dashboard.map.stateOutbreakCount', {
                  count: formatNumber(stateZones.length),
                })}
                mapHeight={720}
                mapCenterLatitude={selectedStateCenter?.latitude}
                mapCenterLongitude={selectedStateCenter?.longitude}
                mapZoom={7}
                minZoom={6}
                maxZoom={13}
                mapBounds={selectedStateBounds}
                enablePan
                onMapHoverChange={onMapHoverChange}
                polygons={selectedPolygons}
                pins={stateZones.map((zone) => ({
                  id: zone.id,
                  latitude: zone.latitude,
                  longitude: zone.longitude,
                  borderColor: zone.borderColor,
                  fillColor: '#FFFFFF',
                  icon: zone.borderColor === '#22C55E'
                    ? <MaterialCommunityIcons name="check-circle-outline" size={14} color={zone.borderColor} />
                    : zone.borderColor === '#F97316'
                      ? <MaterialCommunityIcons name="virus-outline" size={14} color={zone.borderColor} />
                      : <MaterialCommunityIcons name="alert" size={16} color={zone.borderColor} />,
                  onPress: () => onZonePress(zone),
                }))}
              />
            )
          ) : statesStatus === 'loading' ? (
            <MapSkeleton />
          ) : statesStatus === 'error' ? (
            <View style={styles.stateExplorerError}>
              <RetryOverlay label={t('doctor.dashboard.retry')} onRetry={onRetryStates} />
            </View>
          ) : (
            <RadarMapCard
              title={t('doctor.dashboard.map.stateSelector')}
              showControls
              showFooter
              footerTextLeft="© OpenStreetMap contributors"
              footerTextRight={t('doctor.dashboard.map.selectStateHint')}
              mapHeight={720}
              mapCenterLatitude={mexicoCenter.latitude}
              mapCenterLongitude={mexicoCenter.longitude}
              mapZoom={5}
              minZoom={5}
              maxZoom={12}
              enablePan
              onMapHoverChange={onMapHoverChange}
              polygons={selectorPolygons}
              pins={states.map((state) => ({
                id: state.stateId,
                latitude: state.latitude,
                longitude: state.longitude,
                borderColor: state.outbreakCount > 0 ? '#0003B8' : '#64748B',
                fillColor: '#FFFFFF',
                label: shortStateName(state.stateName),
                icon: <Feather name="map-pin" size={13} color={state.outbreakCount > 0 ? '#0003B8' : '#64748B'} />,
                onPress: () => onSelectState(state),
              }))}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function MoreAlertsOverlay({
  visible,
  alerts,
  onClose,
  onSelectAlert,
  t,
}: {
  visible: boolean;
  alerts: DoctorDashboardAlert[];
  onClose: () => void;
  onSelectAlert: (alert: DoctorDashboardAlert) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.moreAlertsOverlay}>
        <Pressable style={styles.stateExplorerBackdrop} onPress={onClose} />
        <View style={styles.moreAlertsCard}>
          <View style={styles.moreAlertsHeader}>
            <View>
              <Text style={styles.stateExplorerEyebrow}>{t('doctor.dashboard.alerts.moreEyebrow')}</Text>
              <Text style={styles.stateExplorerTitle}>{t('doctor.dashboard.alerts.moreTitle')}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.75}>
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.moreAlertsList} showsVerticalScrollIndicator={false}>
            {alerts.map((alert) => (
              <TouchableOpacity key={alert.id} activeOpacity={0.82} onPress={() => onSelectAlert(alert)}>
                <AlertCard
                  title={alert.title}
                  description={alert.description}
                  variant={alert.variant}
                  style={styles.alertCard}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 32,
  },
  container: {
    padding: 24,
    gap: 24,
  },
  heroStrip: {
    paddingHorizontal: 24,
    paddingVertical: 22,
    borderRadius: 24,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 3, 184, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000F6B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 26,
    elevation: 4,
  },
  heroCopy: {
    flex: 1,
    paddingRight: 24,
  },
  heroEyebrow: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#0003B8',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    maxWidth: 720,
  },
  heroDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
    maxWidth: 760,
  },
  radiusControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  radiusControlLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    color: '#8A9AAF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  radiusButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radiusSegment: {
    height: 48,
    minWidth: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 3, 184, 0.18)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusSegmentActive: {
    backgroundColor: '#0003B8',
    borderColor: '#0003B8',
    shadowColor: '#0003B8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 5,
  },
  radiusSegmentText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  radiusSegmentTextActive: {
    color: '#FFFFFF',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
  },
  metricTouchable: {
    flex: 1,
  },
  retryHost: {
    position: 'relative',
    overflow: 'hidden',
  },
  retryOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.72)',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 3, 184, 0.14)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  retryText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#0003B8',
  },
  skeletonLine: {
    borderRadius: 999,
    backgroundColor: '#E8EEF6',
  },
  skeletonSpaced: {
    marginTop: 14,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 26,
    gap: 12,
  },
  metricSkeleton: {
    flex: 1,
    minHeight: 176,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FEFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 26,
    elevation: 3,
  },
  mapSkeleton: {
    flex: 1,
    height: 560,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 3, 184, 0.05)',
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  skeletonMapOverlay: {
    position: 'absolute',
    top: 24,
    left: 24,
    width: 214,
    padding: 16,
    gap: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
  },
  skeletonMapOverlayHeader: {
    gap: 10,
  },
  skeletonMapOverlayTitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  skeletonMapOverlayBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 3, 184, 0.08)',
  },
  skeletonMapOverlayBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    color: '#0003B8',
  },
  skeletonPinLarge: {
    position: 'absolute',
    top: '42%',
    left: '52%',
    width: 220,
    height: 160,
    borderRadius: 999,
    backgroundColor: 'rgba(226, 232, 240, 0.85)',
  },
  skeletonPinSmall: {
    position: 'absolute',
    top: '28%',
    left: '60%',
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  skeletonMapFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 58,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  alertSkeletonItem: {
    minHeight: 96,
    gap: 12,
    padding: 20,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 4,
    borderLeftColor: '#E2E8F0',
  },
  breakdownSkeleton: {
    backgroundColor: '#FFFFFF',
  },
  breakdownSkeletonHeader: {
    marginBottom: 16,
  },
  breakdownSkeletonTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionHeaderRule: {
    width: 72,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 3, 184, 0.14)',
    marginTop: 10,
  },
  breakdownSkeletonRows: {
    marginBottom: 24,
    gap: 22,
  },
  breakdownSkeletonRow: {
    gap: 10,
  },
  breakdownSkeletonLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  breakdownSkeletonSummary: {
    paddingTop: 22,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 18,
    gap: 14,
  },
  breakdownSkeletonButton: {
    minHeight: 52,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 3, 184, 0.10)',
  },
  breakdownSkeletonButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: '#0003B8',
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: 'rgba(0, 3, 184, 0.12)',
  },
  loadingText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#000F6B',
  },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  errorTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  errorText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    color: '#1D4ED8',
  },
  mainGrid: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  mapCard: {
    flexShrink: 0,
    alignSelf: 'stretch',
  },
  alertsPanel: {
    flexShrink: 0,
    backgroundColor: '#FCFDFE',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 26,
    elevation: 3,
    alignSelf: 'stretch',
  },
  alertsHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  alertsTitle: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '700',
    color: '#0F172A',
  },
  alertsList: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
    flexDirection: 'column',
  },
  alertCard: {
    width: '100%',
    minHeight: 0,
  },
  moreAlertsButton: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 3, 184, 0.16)',
    backgroundColor: '#EEF2FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  moreAlertsText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    color: '#0003B8',
  },
  moreAlertsBadge: {
    minWidth: 26,
    height: 24,
    borderRadius: 999,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  moreAlertsBadgeText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
    color: '#0003B8',
  },
  breakdownGrid: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'stretch',
  },
  breakdownCard: {
    flex: 1,
    width: undefined,
    minHeight: 540,
  },
  breakdownRetryHost: {
    flex: 1,
    minHeight: 540,
  },
  stateExplorerOverlay: {
    flex: 1,
    padding: 28,
    justifyContent: 'center',
  },
  stateExplorerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  stateExplorerCard: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 34,
    elevation: 6,
  },
  stateExplorerHeader: {
    minHeight: 76,
    paddingHorizontal: 22,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  stateExplorerEyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    color: '#0003B8',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  stateExplorerTitle: {
    marginTop: 4,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  stateExplorerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stateExplorerSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 3, 184, 0.14)',
    backgroundColor: '#F8FAFC',
  },
  stateExplorerSecondaryText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    color: '#0003B8',
  },
  stateExplorerError: {
    flex: 1,
    minHeight: 620,
    position: 'relative',
    backgroundColor: '#F8FAFC',
  },
  moreAlertsOverlay: {
    flex: 1,
    padding: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreAlertsCard: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '86%',
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 42,
    elevation: 6,
  },
  moreAlertsHeader: {
    minHeight: 84,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  moreAlertsList: {
    padding: 24,
    gap: 14,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
});

export default DoctorDashboard;
