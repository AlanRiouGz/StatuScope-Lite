import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { initialsFromName } from '@/lib/format';
import { RadarMapCard, RadarMapPin, RadarMapPolygon } from '@/components/dashboard/RadarMapCard';
import { DetectionBanner } from '@/components/feedback/DetectionBanner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CardBase } from '@/components/patterns/CardBase';
import { SidebarItemKey, SidebarNavItem } from '@/components/Sidebar';
import { SummaryCountCard } from '@/components/users/SummaryCountCard';
import { MexicoStateBoundary, mexicoStateBoundaries } from '@/assets/maps/mexicoStateBoundaries';
import { useTranslation } from '@/i18n';
import { translateDiseaseName } from '@/lib/diseaseLocalization';
import { translateDashboardValue } from '@/lib/dashboardLocalization';
import {
  AnalyticsDiseaseDetail,
  DiseaseDetailOverlay,
} from '@/components/views/doctor/analytics/Sub-funcionalidades/DiseaseDetailOverlay';
import {
  AnalyticsZoneDetail,
  ZoneDetailOverlay,
} from '@/components/views/doctor/analytics/Sub-funcionalidades/ZoneDetailOverlay';
import {
  DoctorDashboardMapResponse,
  DoctorDashboardDiseaseCatalogItem,
  DoctorDashboardReportOutbreakResponse,
  DoctorDashboardReportResponse,
  DoctorDashboardStateMapItem,
  getDoctorDashboardDiseaseCatalog,
  getDoctorDashboardMap,
  getDoctorDashboardReport,
  getDoctorDashboardStateMap,
  getDoctorDashboardStateOutbreakMap,
  getDoctorDashboardStateReport,
} from '@/lib/doctorDashboard';

const doctorNavigationLinks = {
  dashboard: '/dashboard/doctor',
  diagnosis: '/diagnosis',
  analytics: '/analytics',
} as const;

const periodOptions = [
  { label: 'Last 7 Days', value: 7 },
  { label: 'Last 14 Days', value: 14 },
  { label: 'Last 30 Days', value: 30 },
] as const;

const radiusOptions = [35, 75, 150] as const;

type AnalyticsScope = 'municipal' | 'state';
type SectionStatus = 'idle' | 'loading' | 'success' | 'error';
type Translator = (key: string, params?: Record<string, string | number | null | undefined>) => string;

interface AnalyticsState {
  status: SectionStatus;
  localReport: DoctorDashboardReportResponse | null;
  stateReport: DoctorDashboardReportResponse | null;
  map: DoctorDashboardMapResponse | null;
  stateMap: DoctorDashboardStateMapItem[];
  diseaseCatalog: DoctorDashboardDiseaseCatalogItem[];
  stateOutbreakMap: DoctorDashboardMapResponse | null;
  error: string | null;
}

interface DiseaseAnalytics {
  disease: string;
  currentCases: number;
  localOutbreaks: number;
  recentOutbreaks: number;
  previousOutbreaks: number;
  stateCases: number;
  affectedLocations: number;
  growthPercent: number;
  risk: 'High' | 'Moderate' | 'Low';
}

export interface AnalyticsScreenProps {
  active?: SidebarItemKey;
  sectionLabel?: string;
  userName?: string;
  userId?: string;
  avatarText?: string;
  links?: Partial<Record<SidebarItemKey, string>>;
  sidebarItems?: SidebarNavItem[];
}

function initialAnalyticsState(): AnalyticsState {
  return {
    status: 'idle',
    localReport: null,
    stateReport: null,
    map: null,
    stateMap: [],
    diseaseCatalog: [],
    stateOutbreakMap: null,
    error: null,
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startedBetween(outbreak: DoctorDashboardReportOutbreakResponse, start: Date, end: Date): boolean {
  const startedAt = safeDate(outbreak.startedAt);
  return !!startedAt && startedAt >= start && startedAt < end;
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function riskForDisease(item: Pick<DiseaseAnalytics, 'currentCases' | 'recentOutbreaks' | 'growthPercent'>): DiseaseAnalytics['risk'] {
  if (item.currentCases >= 100 || item.recentOutbreaks >= 4 || item.growthPercent >= 50) return 'High';
  if (item.currentCases >= 25 || item.recentOutbreaks >= 2 || item.growthPercent >= 15) return 'Moderate';
  return 'Low';
}

function riskColor(risk: string): string {
  if (risk === 'High') return '#EF4444';
  if (risk === 'Moderate') return '#F97316';
  return '#22C55E';
}

function locationKey(outbreak: DoctorDashboardReportOutbreakResponse): string {
  return outbreak.location || outbreak.scope || outbreak.id;
}

function buildDiseaseAnalytics(
  localOutbreaks: DoctorDashboardReportOutbreakResponse[],
  stateOutbreaks: DoctorDashboardReportOutbreakResponse[],
  periodDays: number,
  generatedAt: string | undefined,
): DiseaseAnalytics[] {
  const end = safeDate(generatedAt) ?? new Date();
  const recentStart = addDays(end, -periodDays);
  const previousStart = addDays(end, -periodDays * 2);
  const stateCases = new Map<string, number>();

  stateOutbreaks.forEach((outbreak) => {
    stateCases.set(outbreak.diseaseName, (stateCases.get(outbreak.diseaseName) ?? 0) + outbreak.caseCount);
  });

  const grouped = new Map<string, {
    currentCases: number;
    localOutbreaks: number;
    recentOutbreaks: number;
    previousOutbreaks: number;
    locations: Set<string>;
  }>();

  localOutbreaks.forEach((outbreak) => {
    const current = grouped.get(outbreak.diseaseName) ?? {
      currentCases: 0,
      localOutbreaks: 0,
      recentOutbreaks: 0,
      previousOutbreaks: 0,
      locations: new Set<string>(),
    };
    current.currentCases += outbreak.caseCount;
    current.localOutbreaks += 1;
    current.locations.add(locationKey(outbreak));
    if (startedBetween(outbreak, recentStart, end)) current.recentOutbreaks += 1;
    if (startedBetween(outbreak, previousStart, recentStart)) current.previousOutbreaks += 1;
    grouped.set(outbreak.diseaseName, current);
  });

  return Array.from(grouped.entries())
    .map(([disease, item]) => {
      const growthPercent = percentChange(item.recentOutbreaks, item.previousOutbreaks);
      const analytics = {
        disease,
        currentCases: item.currentCases,
        localOutbreaks: item.localOutbreaks,
        recentOutbreaks: item.recentOutbreaks,
        previousOutbreaks: item.previousOutbreaks,
        stateCases: stateCases.get(disease) ?? 0,
        affectedLocations: item.locations.size,
        growthPercent,
        risk: 'Low' as DiseaseAnalytics['risk'],
      };
      analytics.risk = riskForDisease(analytics);
      return analytics;
    })
    .sort((a, b) => (
      b.recentOutbreaks - a.recentOutbreaks
      || b.growthPercent - a.growthPercent
      || b.currentCases - a.currentCases
    ));
}

function buildTrendBuckets(
  outbreaks: DoctorDashboardReportOutbreakResponse[],
  generatedAt: string | undefined,
) {
  const end = safeDate(generatedAt) ?? new Date();
  const windows = [
    { label: '1-3d', startDaysAgo: 3, endDaysAgo: 1 },
    { label: '3-7d', startDaysAgo: 7, endDaysAgo: 3 },
    { label: '7-14d', startDaysAgo: 14, endDaysAgo: 7 },
    { label: '14-30d', startDaysAgo: 30, endDaysAgo: 14 },
  ];

  return windows.map((window) => {
    const start = addDays(end, -window.startDaysAgo);
    const stop = addDays(end, -window.endDaysAgo);
    const count = outbreaks.filter((outbreak) => startedBetween(outbreak, start, stop)).length;
    return {
      label: window.label,
      count,
    };
  });
}

function predictNextPeriodOutbreaks(
  outbreaks: DoctorDashboardReportOutbreakResponse[],
  periodDays: number,
  generatedAt: string | undefined,
): number {
  const end = safeDate(generatedAt) ?? new Date();
  const countBetweenDaysAgo = (startDaysAgo: number, endDaysAgo: number) => {
    const start = addDays(end, -startDaysAgo);
    const stop = addDays(end, -endDaysAgo);
    return outbreaks.filter((outbreak) => startedBetween(outbreak, start, stop)).length;
  };

  const last7 = countBetweenDaysAgo(7, 0);
  const days8to14 = countBetweenDaysAgo(14, 7);
  const days15to30 = countBetweenDaysAgo(30, 14);
  const weightedDailyRate = (last7 / 7) * 0.6
    + (days8to14 / 7) * 0.3
    + (days15to30 / 16) * 0.1;

  return Math.max(0, Math.round(weightedDailyRate * periodDays));
}

function sumCasesByDisease(outbreaks: DoctorDashboardReportOutbreakResponse[], diseaseName: string | null): number {
  if (!diseaseName) return 0;
  return outbreaks
    .filter((outbreak) => outbreak.diseaseName === diseaseName)
    .reduce((sum, outbreak) => sum + outbreak.caseCount, 0);
}

function buildRiskAssessment({
  selectedDisease,
  recentOutbreaks,
  previousOutbreaks,
  projectedNextPeriod,
  t,
}: {
  selectedDisease: DiseaseAnalytics | null;
  recentOutbreaks: number;
  previousOutbreaks: number;
  projectedNextPeriod: number;
  t: Translator;
}) {
  if (!selectedDisease) {
    return {
      summary: t('common.analytics.risk.summary.none'),
      elevating: [t('common.analytics.risk.factors.noSelection')],
      reducing: [t('common.analytics.risk.factors.noSelection')],
    };
  }

  const elevating: string[] = [];
  const reducing: string[] = [];

  if (recentOutbreaks > previousOutbreaks) {
    elevating.push(t('common.analytics.risk.factors.recentGrowth', {
      current: recentOutbreaks,
      previous: previousOutbreaks,
    }));
  } else {
    reducing.push(t('common.analytics.risk.factors.noRecentGrowth'));
  }

  if (selectedDisease.currentCases >= 100) {
    elevating.push(t('common.analytics.risk.factors.highCases', { count: selectedDisease.currentCases }));
  } else {
    reducing.push(t('common.analytics.risk.factors.containedCases', { count: selectedDisease.currentCases }));
  }

  if (selectedDisease.affectedLocations >= 3) {
    elevating.push(t('common.analytics.risk.factors.dispersed', { count: selectedDisease.affectedLocations }));
  } else {
    reducing.push(t('common.analytics.risk.factors.limitedSpread', { count: selectedDisease.affectedLocations }));
  }

  if (projectedNextPeriod > recentOutbreaks) {
    elevating.push(t('common.analytics.risk.factors.projectedIncrease', { count: projectedNextPeriod }));
  } else {
    reducing.push(t('common.analytics.risk.factors.stableProjection'));
  }

  return {
    summary: t(`common.analytics.risk.summary.${selectedDisease.risk.toLowerCase()}`, {
      disease: translateDiseaseName(t, selectedDisease.disease),
    }),
    elevating: (elevating.length ? elevating : [t('common.analytics.risk.factors.noElevating')]).slice(0, 3),
    reducing: (reducing.length ? reducing : [t('common.analytics.risk.factors.noReducing')]).slice(0, 3),
  };
}

function positionZones(zones: DoctorDashboardMapResponse['zones']): Array<DoctorDashboardMapResponse['zones'][number] & { top: string; left: string }> {
  if (zones.length === 0) return [];
  const geocoded = zones.filter((zone) => typeof zone.latitude === 'number' && typeof zone.longitude === 'number');
  if (geocoded.length === 0) {
    return zones.map((zone, index) => ({
      ...zone,
      top: `${30 + index * 8}%`,
      left: `${38 + index * 7}%`,
    }));
  }

  const latitudes = geocoded.map((zone) => zone.latitude as number);
  const longitudes = geocoded.map((zone) => zone.longitude as number);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.01);
  const lonRange = Math.max(maxLon - minLon, 0.01);

  return zones.map((zone) => {
    const latitude = typeof zone.latitude === 'number' ? zone.latitude : minLat + latRange / 2;
    const longitude = typeof zone.longitude === 'number' ? zone.longitude : minLon + lonRange / 2;
    return {
      ...zone,
      top: `${Math.max(12, Math.min(82, 18 + ((maxLat - latitude) / latRange) * 64))}%`,
      left: `${Math.max(12, Math.min(82, 18 + ((longitude - minLon) / lonRange) * 64))}%`,
    };
  });
}

function getMapCenter(zones: DoctorDashboardMapResponse['zones']) {
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

function getZoneBounds(zones: DoctorDashboardMapResponse['zones']) {
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

function getBoundsCenter(bounds: ReturnType<typeof getBoundaryBounds>) {
  if (!bounds) return null;
  return {
    latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
    longitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
  };
}

function buildStateOutbreakZones(
  outbreaks: DoctorDashboardReportOutbreakResponse[],
  center: { latitude: number; longitude: number } | null,
): DoctorDashboardMapResponse['zones'] {
  if (!center) return [];
  const filtered = outbreaks.filter((outbreak) => outbreak.diseaseName);
  const total = Math.max(filtered.length, 1);

  return filtered.map((outbreak, index) => {
    const ring = Math.floor(index / 10) + 1;
    const angle = (index / total) * Math.PI * 2 + ring * 0.45;
    const distance = 0.22 + ring * 0.1 + (index % 3) * 0.035;
    const latitude = center.latitude + Math.sin(angle) * distance;
    const longitude = center.longitude + Math.cos(angle) * distance;
    const borderColor = outbreak.caseCount >= 100
      ? '#EF4444'
      : outbreak.caseCount >= 25
        ? '#F97316'
        : '#22C55E';

    return {
      id: outbreak.id,
      name: outbreak.location,
      risk: outbreak.caseCount >= 100 ? 'High' : outbreak.caseCount >= 25 ? 'Moderate' : 'Low',
      disease: outbreak.diseaseName,
      cases: `${outbreak.caseCount}`,
      radius: 'State',
      priority: outbreak.confirmationStatus ?? 'Active',
      note: outbreak.location,
      recommendedAction: '',
      latitude,
      longitude,
      borderColor,
    };
  });
}

function reportFromStateMap(
  state: DoctorDashboardStateMapItem | null | undefined,
  stateOutbreakMap: DoctorDashboardMapResponse | null,
): DoctorDashboardReportResponse {
  const stateName = state?.stateName ?? null;
  return {
    scope: 'state',
    hospitalName: null,
    municipalityName: null,
    stateName,
    generatedAt: stateOutbreakMap?.generatedAt ?? new Date().toISOString(),
    outbreaks: (stateOutbreakMap?.zones ?? [])
      .filter((zone) => zone.id !== 'hospital-node')
      .map((zone) => ({
        id: zone.id,
        diseaseName: zone.disease,
        location: stateName ?? zone.stateName ?? zone.name,
        scope: 'STATE',
        caseCount: Number.parseInt(zone.cases, 10) || 0,
        confirmationStatus: zone.priority,
        startedAt: stateOutbreakMap?.generatedAt ?? null,
      })),
  };
}

async function loadStateReportWithFallback(
  state: DoctorDashboardStateMapItem,
  stateOutbreakMap: DoctorDashboardMapResponse | null,
) {
  try {
    return await getDoctorDashboardStateReport(state.stateId);
  } catch {
    return reportFromStateMap(state, stateOutbreakMap);
  }
}


export function AnalyticsScreen({
  active = 'analytics',
  sectionLabel = 'Analytics',
  userName,
  userId,
  avatarText,
  links = doctorNavigationLinks,
  sidebarItems,
}: AnalyticsScreenProps) {
  const router = useRouter();
  const { logout, profile } = useAuth();
  const { t } = useTranslation();
  const [periodDays, setPeriodDays] = useState<number>(14);
  const [radiusKm, setRadiusKm] = useState<number>(75);
  const [scope, setScope] = useState<AnalyticsScope>('municipal');
  const [analyticsState, setAnalyticsState] = useState<AnalyticsState>(initialAnalyticsState);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [selectedDiseaseName, setSelectedDiseaseName] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<AnalyticsZoneDetail | null>(null);
  const [selectedDisease, setSelectedDisease] = useState<AnalyticsDiseaseDetail | null>(null);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const [localReport, stateReport, map] = await Promise.all([
        getDoctorDashboardReport('local', radiusKm),
        getDoctorDashboardReport('state', radiusKm),
        getDoctorDashboardMap(radiusKm),
      ]);
      const [stateMap, diseaseCatalog] = await Promise.all([
        getDoctorDashboardStateMap(),
        getDoctorDashboardDiseaseCatalog(),
      ]);
      const stateKey = stateLookupKey(stateReport.stateName ?? localReport.stateName ?? '');
      const selectedState = stateMap.states.find((state) => stateLookupKey(state.stateName) === stateKey);
      const stateOutbreakMap = selectedState
        ? await getDoctorDashboardStateOutbreakMap(selectedState.stateId)
        : null;
      const selectedStateReport = selectedState
        ? await loadStateReportWithFallback(selectedState, stateOutbreakMap)
        : stateReport;
      setSelectedStateId(selectedState?.stateId ?? null);
      setAnalyticsState({
        status: 'success',
        localReport,
        stateReport: selectedStateReport,
        map,
        stateMap: stateMap.states,
        diseaseCatalog: diseaseCatalog.diseases,
        stateOutbreakMap,
        error: null,
      });
    } catch (error) {
      setAnalyticsState((current) => ({
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unable to load analytics.',
      }));
    }
  }, [radiusKm]);

  const loadStateAnalytics = useCallback(async (stateId: string) => {
    setSelectedStateId(stateId);
    setAnalyticsState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const selectedState = analyticsState.stateMap.find((state) => state.stateId === stateId) ?? null;
      const stateOutbreakMap = await getDoctorDashboardStateOutbreakMap(stateId);
      const stateReport = selectedState
        ? await loadStateReportWithFallback(selectedState, stateOutbreakMap)
        : reportFromStateMap(null, stateOutbreakMap);
      setAnalyticsState((current) => ({
        ...current,
        status: 'success',
        stateReport,
        stateOutbreakMap,
        error: null,
      }));
    } catch (error) {
      setAnalyticsState((current) => ({
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unable to load state analytics.',
      }));
    }
  }, [analyticsState.stateMap]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const localOutbreaks = analyticsState.localReport?.outbreaks ?? [];
  const stateOutbreaks = analyticsState.stateReport?.outbreaks ?? [];
  const selectedState = useMemo(
    () => analyticsState.stateMap.find((state) => state.stateId === selectedStateId) ?? null,
    [analyticsState.stateMap, selectedStateId],
  );
  const scopedOutbreaks = scope === 'municipal' ? localOutbreaks : stateOutbreaks;
  const diseaseAnalytics = useMemo(
    () => buildDiseaseAnalytics(scopedOutbreaks, stateOutbreaks, periodDays, analyticsState.localReport?.generatedAt),
    [analyticsState.localReport?.generatedAt, periodDays, scopedOutbreaks, stateOutbreaks],
  );
  const trendBuckets = useMemo(
    () => buildTrendBuckets(
      selectedDiseaseName
        ? scopedOutbreaks.filter((outbreak) => outbreak.diseaseName === selectedDiseaseName)
        : [],
      analyticsState.localReport?.generatedAt,
    ),
    [analyticsState.localReport?.generatedAt, scopedOutbreaks, selectedDiseaseName],
  );
  const selectedDiseaseOutbreaks = useMemo(
    () => (selectedDiseaseName
      ? scopedOutbreaks.filter((outbreak) => outbreak.diseaseName === selectedDiseaseName)
      : []),
    [scopedOutbreaks, selectedDiseaseName],
  );

  const diseaseOptions = useMemo(
    () => [...diseaseAnalytics].sort((a, b) => (
      translateDiseaseName(t, a.disease).localeCompare(translateDiseaseName(t, b.disease))
    )),
    [diseaseAnalytics, t],
  );
  useEffect(() => {
    if (!selectedDiseaseName) return;
    if (diseaseOptions.some((item) => item.disease === selectedDiseaseName)) return;
    setSelectedDiseaseName(null);
  }, [diseaseOptions, selectedDiseaseName]);

  const selectedDiseaseAnalytics = useMemo(
    () => (selectedDiseaseName ? diseaseAnalytics.find((item) => item.disease === selectedDiseaseName) ?? null : null),
    [diseaseAnalytics, selectedDiseaseName],
  );

  const recentOutbreaks = selectedDiseaseAnalytics?.recentOutbreaks ?? 0;
  const previousOutbreaks = selectedDiseaseAnalytics?.previousOutbreaks ?? 0;
  const currentCases = selectedDiseaseAnalytics?.currentCases ?? 0;
  const municipalDiseaseCases = useMemo(
    () => sumCasesByDisease(localOutbreaks, selectedDiseaseName),
    [localOutbreaks, selectedDiseaseName],
  );
  const stateDiseaseCases = useMemo(
    () => sumCasesByDisease(stateOutbreaks, selectedDiseaseName),
    [selectedDiseaseName, stateOutbreaks],
  );
  const growth = percentChange(recentOutbreaks, previousOutbreaks);
  const projectedNextPeriod = useMemo(
    () => predictNextPeriodOutbreaks(selectedDiseaseOutbreaks, periodDays, analyticsState.localReport?.generatedAt),
    [analyticsState.localReport?.generatedAt, periodDays, selectedDiseaseOutbreaks],
  );
  const selectedDiseaseLabel = selectedDiseaseAnalytics
    ? translateDiseaseName(t, selectedDiseaseAnalytics.disease)
    : t('common.analytics.none');
  const selectedStateBoundary = useMemo(
    () => getStateBoundary(selectedState?.stateName ?? analyticsState.stateReport?.stateName ?? analyticsState.localReport?.stateName),
    [analyticsState.localReport?.stateName, analyticsState.stateReport?.stateName, selectedState?.stateName],
  );
  const selectedStateBounds = useMemo(() => getBoundaryBounds(selectedStateBoundary), [selectedStateBoundary]);
  const selectedStateCenter = useMemo(() => getBoundsCenter(selectedStateBounds), [selectedStateBounds]);
  const stateSyntheticZones = useMemo(
    () => buildStateOutbreakZones(stateOutbreaks, selectedStateCenter),
    [selectedStateCenter, stateOutbreaks],
  );
  const activeMapZones = useMemo(
    () => (scope === 'state'
      ? stateSyntheticZones
      : analyticsState.map?.zones ?? []),
    [analyticsState.map?.zones, scope, stateSyntheticZones],
  );
  const activeMapGeneratedAt = scope === 'state'
    ? analyticsState.stateReport?.generatedAt ?? analyticsState.stateOutbreakMap?.generatedAt
    : analyticsState.map?.generatedAt ?? analyticsState.localReport?.generatedAt;

  const zoneDetails = useMemo<AnalyticsZoneDetail[]>(() => (
    activeMapZones
      .filter((zone) => (
        zone.id !== 'hospital-node'
        && selectedDiseaseName
        && zone.disease === selectedDiseaseName
      ))
      .slice(0, 8)
      .map((zone) => ({
      id: zone.id,
      name: zone.name,
      risk: translateDashboardValue(t, zone.risk),
      disease: translateDiseaseName(t, zone.disease),
      radius: translateDashboardValue(t, zone.radius),
      priority: translateDashboardValue(t, zone.priority),
      trend: t('common.analytics.zoneTrend', {
        disease: translateDiseaseName(t, zone.disease),
        cases: translateDashboardValue(t, zone.cases),
      }),
      note: zone.note,
    }))
  ), [activeMapZones, selectedDiseaseName, t]);

  const filteredMapZones = useMemo(() => (
    activeMapZones.filter((zone) => (
      selectedDiseaseName
      && zone.id === 'hospital-node'
      || (
        selectedDiseaseName
        && zone.disease === selectedDiseaseName
        && typeof zone.latitude === 'number'
        && typeof zone.longitude === 'number'
      )
    ))
  ), [activeMapZones, selectedDiseaseName]);
  const selectedPolygons = useMemo<RadarMapPolygon[]>(() => (
    scope === 'state' && selectedStateBoundary
      ? [{
        id: selectedStateBoundary.id,
        geometry: selectedStateBoundary.geometry,
        fillColor: 'rgba(0, 3, 184, 0.12)',
        strokeColor: '#0003B8',
        strokeWidth: 2,
      }]
      : []
  ), [scope, selectedStateBoundary]);
  const mapCenter = useMemo(
    () => (scope === 'state' ? selectedStateCenter : getMapCenter(filteredMapZones)),
    [filteredMapZones, scope, selectedStateCenter],
  );
  const mapBounds = useMemo(
    () => (
      scope === 'state'
        ? selectedStateBounds ?? getZoneBounds(filteredMapZones)
        : getRadiusBounds(mapCenter, analyticsState.map?.radiusKm) ?? getZoneBounds(filteredMapZones)
    ),
    [analyticsState.map?.radiusKm, filteredMapZones, mapCenter, scope, selectedStateBounds],
  );

  const mapPins = useMemo<RadarMapPin[]>(() => (
    positionZones(filteredMapZones).slice(0, 10).map((zone) => {
      const detail = zoneDetails.find((item) => item.id === zone.id) ?? null;
      return {
        id: zone.id,
        top: zone.top,
        left: zone.left,
        latitude: zone.latitude,
        longitude: zone.longitude,
        borderColor: zone.borderColor || riskColor(zone.risk),
        fillColor: '#FFFFFF',
        icon:
          zone.borderColor === '#0003B8' || zone.id === 'hospital-node' ? (
            <MaterialCommunityIcons name="hospital-box-outline" size={12} color="#0003B8" />
          ) : zone.borderColor === '#F97316' ? (
            <MaterialCommunityIcons name="virus-outline" size={14} color={zone.borderColor} />
          ) : zone.borderColor === '#22C55E' ? (
            <MaterialCommunityIcons name="check-circle-outline" size={14} color={zone.borderColor} />
          ) : (
            <MaterialCommunityIcons name="alert" size={16} color={zone.borderColor || '#EF4444'} />
          ),
        onPress: detail ? () => setSelectedZone(detail) : undefined,
      };
    })
  ), [filteredMapZones, zoneDetails]);

  const riskAssessment = buildRiskAssessment({
    selectedDisease: selectedDiseaseAnalytics,
    recentOutbreaks,
    previousOutbreaks,
    projectedNextPeriod,
    t,
  });

  const loading = analyticsState.status === 'loading' || analyticsState.status === 'idle';
  const empty = !loading && scopedOutbreaks.length === 0;
  const hasSelectedDisease = !!selectedDiseaseAnalytics;
  const legendItems = [
    { label: t('common.analytics.map.legend.highGrowth'), color: '#EF4444' },
    { label: t('common.analytics.map.legend.moderateSignal'), color: '#F97316' },
    { label: t('common.analytics.map.legend.hospitalRegion'), color: '#1718C7' },
  ];

  return (
    <DashboardLayout
      active={active}
      sectionLabel={sectionLabel}
      userName={userName ?? profile?.fullName ?? 'Doctor'}
      userId={userId ?? (profile?.hospitalName ? profile.hospitalName : profile?.email)}
      avatarText={avatarText ?? initialsFromName(profile?.fullName)}
      links={links}
      sidebarItems={sidebarItems}
    onLogout={async () => {
        await logout();
        router.replace('/login');
      }}
    >
      <>
        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.container}>
            <View style={styles.heroStrip}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>{t('common.analytics.hero.eyebrow')}</Text>
                <Text style={styles.heroTitle}>
                  {t('common.analytics.hero.doctorTitle')}
                </Text>
                <Text style={styles.heroDescription}>{t('common.analytics.hero.subtitle')}</Text>
              </View>
            </View>

            {analyticsState.status === 'error' ? (
              <DetectionBanner
                message={t('common.analytics.error', { error: analyticsState.error })}
                actionLabel={t('common.analytics.actions.retry')}
                onActionPress={loadAnalytics}
                style={styles.banner}
              />
            ) : null}

            <DiseaseSelector
              diseases={diseaseOptions}
              diseaseCatalog={analyticsState.diseaseCatalog}
              states={analyticsState.stateMap}
              selectedDiseaseName={selectedDiseaseName}
              selectedStateId={selectedStateId}
              onSelect={setSelectedDiseaseName}
              onStateSelect={(stateId) => {
                void loadStateAnalytics(stateId);
              }}
              loading={loading}
              scope={scope}
              onScopeChange={setScope}
              periodDays={periodDays}
              onPeriodChange={setPeriodDays}
              radiusKm={radiusKm}
              onRadiusChange={setRadiusKm}
              t={t}
            />

            {!hasSelectedDisease && !loading ? (
              <CardBase style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{t('common.analytics.selectionRequired.title')}</Text>
                <Text style={styles.emptyText}>{t('common.analytics.selectionRequired.text')}</Text>
              </CardBase>
            ) : null}

            {hasSelectedDisease ? <MethodologyCard t={t} /> : null}

            {hasSelectedDisease ? (
              <View style={styles.statsRow}>
                <SummaryCountCard
                  title={t('common.analytics.metrics.disease.title')}
                  value={loading ? '...' : selectedDiseaseLabel}
                  caption={t('common.analytics.metrics.disease.caption')}
                  variant="info"
                  icon={<MaterialCommunityIcons name="virus-outline" size={14} color="#0003B8" />}
                  style={styles.statCard}
                />
                <SummaryCountCard
                  title={t('common.analytics.metrics.newOutbreaks.title')}
                  value={loading ? '...' : formatNumber(recentOutbreaks)}
                  caption={t('common.analytics.metrics.newOutbreaks.caption', { days: periodDays })}
                  variant="info"
                  icon={<Feather name="activity" size={14} color="#0003B8" />}
                  style={styles.statCard}
                />
                <SummaryCountCard
                  title={t('common.analytics.metrics.previous.title')}
                  value={loading ? '...' : formatNumber(previousOutbreaks)}
                  caption={t('common.analytics.metrics.previous.caption', { days: periodDays })}
                  variant={growth >= 25 ? 'warning' : 'info'}
                  icon={<Feather name="trending-up" size={14} color="#0003B8" />}
                  style={styles.statCard}
                />
                <SummaryCountCard
                  title={t('common.analytics.metrics.prediction.title')}
                  value={loading ? '...' : formatNumber(projectedNextPeriod)}
                  caption={t('common.analytics.metrics.prediction.caption', { days: periodDays })}
                  variant={projectedNextPeriod > recentOutbreaks ? 'warning' : 'neutral'}
                  icon={<Feather name="radio" size={14} color="#0003B8" />}
                  style={styles.statCard}
                />
              </View>
            ) : null}

            {hasSelectedDisease && empty ? (
              <CardBase style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{t('common.analytics.empty.title')}</Text>
                <Text style={styles.emptyText}>{t('common.analytics.empty.text')}</Text>
              </CardBase>
            ) : hasSelectedDisease ? (
              <>
                <View style={styles.mainRow}>
                  <View style={styles.leftColumn}>
                    <RadarMapCard
                      title={t('common.analytics.map.title')}
                      subtitle={t('common.analytics.map.subtitle')}
                      legendItems={legendItems}
                      showHeader
                      showFooter
                      footerTextLeft={t('common.analytics.map.footerDisease', {
                        disease: selectedDiseaseLabel,
                        count: formatNumber(currentCases),
                      })}
                      footerTextRight={activeMapGeneratedAt ? t('common.analytics.map.updated', { date: new Date(activeMapGeneratedAt).toLocaleDateString() }) : undefined}
                      mapHeight={520}
                      mapCenterLatitude={mapCenter?.latitude}
                      mapCenterLongitude={mapCenter?.longitude}
                      mapZoom={scope === 'municipal' ? 10 : 7}
                      minZoom={scope === 'municipal' ? 10 : 6}
                      maxZoom={14}
                      mapBounds={mapBounds}
                      enablePan
                      surveillanceRadiusKm={scope === 'municipal' ? analyticsState.map?.radiusKm : undefined}
                      polygons={selectedPolygons}
                      pins={mapPins}
                      style={styles.mapCard}
                    />
                  </View>

                  <DiseaseSummaryCard
                    diseaseLabel={selectedDiseaseLabel}
                    municipalCases={municipalDiseaseCases}
                    stateCases={stateDiseaseCases}
                    recentOutbreaks={recentOutbreaks}
                    risk={selectedDiseaseAnalytics?.risk ?? 'Low'}
                    t={t}
                  />
                </View>

                <View style={styles.analysisGrid}>
                  <TrendCard buckets={trendBuckets} loading={loading} t={t} />
                  <RiskBalanceCard assessment={riskAssessment} t={t} />
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
        <ZoneDetailOverlay
          visible={selectedZone !== null}
          zone={selectedZone}
          onClose={() => setSelectedZone(null)}
        />
        <DiseaseDetailOverlay
          visible={selectedDisease !== null}
          disease={selectedDisease}
          onClose={() => setSelectedDisease(null)}
        />
      </>
    </DashboardLayout>
  );
}

function MethodologyCard({ t }: { t: Translator }) {
  const rows = [
    ['disease', 'award'],
    ['newOutbreaks', 'activity'],
    ['previous', 'clock'],
    ['prediction', 'radio'],
  ] as const;

  return (
    <CardBase style={styles.methodologyCard}>
      <View style={styles.methodologyHeader}>
        <View>
          <Text style={styles.cardEyebrow}>{t('common.analytics.methodology.eyebrow')}</Text>
          <Text style={styles.cardTitle}>{t('common.analytics.methodology.title')}</Text>
        </View>
        <Text style={styles.methodologyBadge}>
          {t('common.analytics.methodology.doctorUse')}
        </Text>
      </View>
      <View style={styles.methodologyGrid}>
        {rows.map(([key, icon]) => (
          <View key={key} style={styles.methodologyItem}>
            <View style={styles.methodologyIcon}>
              <Feather name={icon} size={15} color="#1718C7" />
            </View>
            <View style={styles.methodologyCopy}>
              <Text style={styles.methodologyTitle}>{t(`common.analytics.methodology.${key}.title`)}</Text>
              <Text style={styles.methodologyText}>{t(`common.analytics.methodology.${key}.text`)}</Text>
            </View>
          </View>
        ))}
      </View>
    </CardBase>
  );
}

function DiseaseSelector({
  diseases,
  diseaseCatalog,
  states,
  selectedDiseaseName,
  selectedStateId,
  onSelect,
  onStateSelect,
  loading,
  scope,
  onScopeChange,
  periodDays,
  onPeriodChange,
  radiusKm,
  onRadiusChange,
  t,
}: {
  diseases: DiseaseAnalytics[];
  diseaseCatalog: DoctorDashboardDiseaseCatalogItem[];
  states: DoctorDashboardStateMapItem[];
  selectedDiseaseName: string | null;
  selectedStateId: string | null;
  onSelect: (disease: string) => void;
  onStateSelect: (stateId: string) => void;
  loading: boolean;
  scope: AnalyticsScope;
  onScopeChange: (scope: AnalyticsScope) => void;
  periodDays: number;
  onPeriodChange: (periodDays: number) => void;
  radiusKm: number;
  onRadiusChange: (radiusKm: number) => void;
  t: Translator;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isStateOpen, setIsStateOpen] = useState(false);
  const [showDiseaseInfo, setShowDiseaseInfo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [hoveredDiseaseName, setHoveredDiseaseName] = useState<string | null>(null);
  const [hoveredStateId, setHoveredStateId] = useState<string | null>(null);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const normalizedStateQuery = stateSearchQuery.trim().toLocaleLowerCase();
  const selectedState = states.find((state) => state.stateId === selectedStateId) ?? null;
  const selectedDisease = diseases.find((item) => item.disease === selectedDiseaseName) ?? null;
  const filteredDiseases = useMemo(() => (
    normalizedQuery
      ? diseases.filter((item) => translateDiseaseName(t, item.disease).toLocaleLowerCase().includes(normalizedQuery))
      : diseases
  ), [diseases, normalizedQuery, t]);
  const filteredStates = useMemo(() => (
    normalizedStateQuery
      ? states.filter((state) => state.stateName.toLocaleLowerCase().includes(normalizedStateQuery))
      : states
  ), [normalizedStateQuery, states]);
  const availableDiseaseNames = useMemo(
    () => new Set(diseases.map((item) => item.disease)),
    [diseases],
  );

  useEffect(() => {
    if (!selectedDiseaseName || !selectedDisease) {
      setSearchQuery('');
      return;
    }
    setSearchQuery(translateDiseaseName(t, selectedDisease.disease));
  }, [selectedDisease, selectedDiseaseName, t]);

  return (
    <CardBase style={styles.selectorCard}>
      <View style={styles.selectorHeader}>
        <View>
          <Text style={styles.cardEyebrow}>{t('common.analytics.selector.eyebrow')}</Text>
          <Text style={styles.cardTitle}>{t('common.analytics.selector.title')}</Text>
        </View>
        <Text style={styles.selectorHint}>{t('common.analytics.selector.hint')}</Text>
      </View>
      <View style={styles.selectorControlsRow}>
        <View style={styles.scopeSwitcher}>
          {(['municipal', 'state'] as const).map((option) => {
            const selected = option === scope;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.scopeButton, selected ? styles.scopeButtonActive : null]}
                activeOpacity={0.8}
                onPress={() => onScopeChange(option)}
              >
                <Text style={[styles.scopeButtonText, selected ? styles.scopeButtonTextActive : null]}>
                  {t(`common.analytics.selector.scope.${option}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.selectorPeriodGroup}>
          <View style={styles.timeTabsShell}>
            {periodOptions.map((option) => {
              const selected = option.value === periodDays;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.timeTab, selected && styles.timeTabActive]}
                  onPress={() => onPeriodChange(option.value)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.timeTabText, selected && styles.timeTabTextActive]}>
                    {t(`common.analytics.periods.${option.value}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.rangeBlock}>
          <Text style={styles.rangeLabel}>{t('common.analytics.filters.radarRange')}</Text>
          <View style={styles.rangeButtons}>
            {scope === 'state' ? (
              <TouchableOpacity style={[styles.rangeButton, styles.rangeButtonActive]} activeOpacity={0.75}>
                <Text style={[styles.rangeButtonText, styles.rangeButtonTextActive]}>
                  {t('common.analytics.selector.scope.state')}
                </Text>
              </TouchableOpacity>
            ) : radiusOptions.map((radius) => {
              const selected = radius === radiusKm;
              return (
                <TouchableOpacity
                  key={radius}
                  style={[styles.rangeButton, selected && styles.rangeButtonActive]}
                  onPress={() => onRadiusChange(radius)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.rangeButtonText, selected && styles.rangeButtonTextActive]}>
                    {radius} km
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
      <View style={styles.selectorLabelRow}>
        <Text style={styles.selectorInlineLabel}>{t('common.analytics.selector.disease')}</Text>
        <TouchableOpacity
          style={[styles.infoButton, showDiseaseInfo ? styles.infoButtonActive : null]}
          activeOpacity={0.75}
          onPress={() => setShowDiseaseInfo((current) => !current)}
        >
          <Feather name="alert-circle" size={17} color={showDiseaseInfo ? '#64748B' : '#94A3B8'} />
        </TouchableOpacity>
      </View>
      {loading ? (
        <Text style={styles.mutedText}>{t('common.analytics.selector.loading')}</Text>
      ) : (
        <View style={styles.diseaseDropdown}>
          <View
            style={styles.diseaseDropdownButton}
          >
            <TextInput
              value={searchQuery}
              onChangeText={(value) => {
                setSearchQuery(value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={t('common.analytics.selector.searchPlaceholder')}
              placeholderTextColor="#94A3B8"
              style={styles.diseaseDropdownInput}
            />
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setIsOpen((current) => !current)}
              style={styles.diseaseDropdownIconButton}
            >
              <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#1718C7" />
            </TouchableOpacity>
          </View>
          {isOpen ? (
            <View style={styles.diseaseDropdownList}>
              {filteredDiseases.map((item) => {
                const selected = item.disease === selectedDiseaseName;
                const hovered = item.disease === hoveredDiseaseName;
                const label = translateDiseaseName(t, item.disease);
                return (
                  <Pressable
                    key={item.disease}
                    style={[
                      styles.diseaseDropdownOption,
                      hovered ? styles.diseaseDropdownOptionHovered : null,
                      selected ? styles.diseaseDropdownOptionActive : null,
                    ]}
                    onHoverIn={() => setHoveredDiseaseName(item.disease)}
                    onHoverOut={() => setHoveredDiseaseName(null)}
                    onPress={() => {
                      onSelect(item.disease);
                      setSearchQuery(label);
                      setIsOpen(false);
                    }}
                  >
                    <Text style={[styles.diseaseDropdownOptionText, selected ? styles.diseaseDropdownOptionTextActive : null]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
              {filteredDiseases.length === 0 ? (
                <Text style={styles.diseaseDropdownEmpty}>{t('common.analytics.selector.noResults')}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
      {scope === 'state' ? (
        <>
          <Text style={styles.selectorListTitle}>{t('common.analytics.selector.state')}</Text>
          <View style={styles.diseaseDropdown}>
            <View style={styles.diseaseDropdownButton}>
              <TextInput
                value={stateSearchQuery}
                onChangeText={(value) => {
                  setStateSearchQuery(value);
                  setIsStateOpen(true);
                }}
                onFocus={() => {
                  setStateSearchQuery(selectedState?.stateName ?? '');
                  setIsStateOpen(true);
                }}
                placeholder={selectedState?.stateName ?? t('common.analytics.selector.statePlaceholder')}
                placeholderTextColor="#94A3B8"
                style={styles.diseaseDropdownInput}
              />
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => setIsStateOpen((current) => !current)}
                style={styles.diseaseDropdownIconButton}
              >
                <Feather name={isStateOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#1718C7" />
              </TouchableOpacity>
            </View>
            {isStateOpen ? (
              <View style={styles.diseaseDropdownList}>
                {filteredStates.map((state) => {
                  const selected = state.stateId === selectedStateId;
                  const hovered = state.stateId === hoveredStateId;
                  return (
                    <Pressable
                      key={state.stateId}
                      style={[
                        styles.diseaseDropdownOption,
                        hovered ? styles.diseaseDropdownOptionHovered : null,
                        selected ? styles.diseaseDropdownOptionActive : null,
                      ]}
                      onHoverIn={() => setHoveredStateId(state.stateId)}
                      onHoverOut={() => setHoveredStateId(null)}
                      onPress={() => {
                        onStateSelect(state.stateId);
                        setStateSearchQuery(state.stateName);
                        setIsStateOpen(false);
                      }}
                    >
                      <Text style={[styles.diseaseDropdownOptionText, selected ? styles.diseaseDropdownOptionTextActive : null]}>
                        {state.stateName}
                      </Text>
                    </Pressable>
                  );
                })}
                {filteredStates.length === 0 ? (
                  <Text style={styles.diseaseDropdownEmpty}>{t('common.analytics.selector.noStates')}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </>
      ) : null}
      <Modal
        visible={showDiseaseInfo} transparent
        animationType="fade"
        onRequestClose={() => setShowDiseaseInfo(false)}
      >
        <View style={styles.infoModalOverlay}>
          <Pressable style={styles.infoModalBackdrop} onPress={() => setShowDiseaseInfo(false)} />
          <View style={styles.infoModalCard}>
            <View style={styles.infoModalHeader}>
              <Text style={styles.infoModalTitle}>{t('common.analytics.selector.infoTitle')}</Text>
              <TouchableOpacity
                style={styles.infoModalClose}
                activeOpacity={0.75}
                onPress={() => setShowDiseaseInfo(false)}
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.infoModalText}>{t('common.analytics.selector.info.system')}</Text>
            <ScrollView style={styles.infoDiseaseScroll} contentContainerStyle={styles.infoDiseaseList}>
              {diseaseCatalog.map((item) => {
                const isAvailableInSelection = availableDiseaseNames.has(item.name);
                return (
                <View key={item.id} style={styles.infoDiseaseItem}>
                  <Text style={styles.infoDiseaseName}>{translateDiseaseName(t, item.name)}</Text>
                  <Text style={styles.infoDiseaseMeta}>
                    {isAvailableInSelection
                      ? t('common.analytics.selector.availableHere')
                      : item.code}
                  </Text>
                </View>
                );
              })}
              {diseaseCatalog.length === 0 ? (
                <Text style={styles.infoModalText}>{t('common.analytics.selector.noResults')}</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </CardBase>
  );
}

function TrendCard({ buckets, loading, t }: { buckets: { label: string; count: number }[]; loading: boolean; t: Translator }) {
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <CardBase style={[styles.panelCard, styles.trendPanelCard]}>
      <Text style={styles.cardEyebrow}>{t('common.analytics.trend.eyebrow')}</Text>
      <Text style={styles.cardTitle}>{t('common.analytics.trend.title')}</Text>
      <View style={styles.trendWindowGrid}>
        {buckets.map((bucket) => (
          <View key={bucket.label} style={styles.trendWindowCard}>
            <View style={styles.trendWindowHeader}>
              <Text style={styles.trendWindowLabel}>{bucket.label}</Text>
              <Text style={styles.trendWindowValue}>{loading ? '...' : bucket.count}</Text>
            </View>
            <View style={styles.trendLineTrack}>
              <View
                style={[
                  styles.trendLineFill,
                  { width: loading ? '24%' : `${Math.max(8, (bucket.count / maxCount) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.trendWindowCaption}>{t('common.analytics.trend.windowCaption')}</Text>
          </View>
        ))}
      </View>
    </CardBase>
  );
}

function DiseaseSummaryCard({
  diseaseLabel,
  municipalCases,
  stateCases,
  recentOutbreaks,
  risk,
  t,
}: {
  diseaseLabel: string;
  municipalCases: number;
  stateCases: number;
  recentOutbreaks: number;
  risk: DiseaseAnalytics['risk'];
  t: Translator;
}) {
  return (
    <CardBase style={styles.diseaseSummaryCard}>
      <Text style={styles.cardEyebrow}>{t('common.analytics.diseaseSummary.eyebrow')}</Text>
      <Text style={styles.diseaseSummaryTitle}>{diseaseLabel}</Text>
      <Text style={styles.diseaseSummaryText}>
        {t('common.analytics.diseaseSummary.text', {
          disease: diseaseLabel,
          recent: recentOutbreaks,
        })}
      </Text>
      <View style={styles.diseaseSummaryMetrics}>
        <View style={styles.diseaseSummaryMetric}>
          <Text style={styles.diseaseSummaryMetricLabel}>{t('common.analytics.diseaseSummary.municipalCases')}</Text>
          <Text style={styles.diseaseSummaryMetricValue}>{formatNumber(municipalCases)}</Text>
        </View>
        <View style={styles.diseaseSummaryMetric}>
          <Text style={styles.diseaseSummaryMetricLabel}>{t('common.analytics.diseaseSummary.stateCases')}</Text>
          <Text style={styles.diseaseSummaryMetricValue}>{formatNumber(stateCases)}</Text>
        </View>
      </View>
      <View style={styles.diseaseSummaryRisk}>
        <View style={[styles.riskDot, { backgroundColor: riskColor(risk) }]} />
        <Text style={styles.diseaseSummaryRiskText}>{t(`common.analytics.risk.level.${risk.toLowerCase()}`)}</Text>
      </View>
    </CardBase>
  );
}

function RiskBalanceCard({
  assessment,
  t,
}: {
  assessment: { summary: string; elevating: string[]; reducing: string[] };
  t: Translator;
}) {
  return (
    <CardBase style={[styles.panelCard, styles.riskBalanceCard]}>
      <Text style={styles.cardEyebrow}>{t('common.analytics.risk.eyebrow')}</Text>
      <Text style={styles.cardTitle}>{t('common.analytics.risk.title')}</Text>
      <Text style={styles.riskSummaryText}>{assessment.summary}</Text>
      <View style={styles.riskColumns}>
        <View style={styles.riskColumn}>
          <Text style={[styles.riskColumnTitle, styles.riskColumnTitleRed]}>
            {t('common.analytics.risk.elevating')}
          </Text>
          <View style={styles.riskFactorList}>
            {assessment.elevating.map((factor) => (
              <View key={factor} style={styles.riskFactorItem}>
                <Feather name="arrow-up-right" size={15} color="#DC2626" />
                <Text style={styles.riskFactorText}>{factor}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.riskColumn}>
          <Text style={[styles.riskColumnTitle, styles.riskColumnTitleGreen]}>
            {t('common.analytics.risk.reducing')}
          </Text>
          <View style={styles.riskFactorList}>
            {assessment.reducing.map((factor) => (
              <View key={factor} style={styles.riskFactorItem}>
                <Feather name="arrow-down-right" size={15} color="#16A34A" />
                <Text style={styles.riskFactorText}>{factor}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </CardBase>
  );
}

export function DoctorAnalytics() {
  return <AnalyticsScreen />;
}

export default DoctorAnalytics;

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
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  timeTabsShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2F7',
    borderRadius: 14,
    padding: 4,
  },
  timeTab: {
    minWidth: 132,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  timeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  timeTabText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#64748B',
  },
  timeTabTextActive: {
    color: '#0003B8',
  },
  rangeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rangeLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#94A3B8',
  },
  rangeButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rangeButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 3, 184, 0.18)',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 82,
    alignItems: 'center',
  },
  rangeButtonActive: {
    backgroundColor: '#0003B8',
    borderColor: '#0003B8',
    shadowColor: '#0003B8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  rangeButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#0F172A',
  },
  rangeButtonTextActive: {
    color: '#FFFFFF',
  },
  banner: {
    borderRadius: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  emptyCard: {
    borderRadius: 24,
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: '#64748B',
  },
  mainRow: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'stretch',
  },
  leftColumn: {
    flex: 1,
    gap: 20,
  },
  mapCard: {
    minWidth: 0,
  },
  narrativeCard: {
    borderRadius: 24,
    padding: 20,
  },
  methodologyCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(23, 24, 199, 0.10)',
  },
  methodologyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  methodologyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(23, 24, 199, 0.08)',
    color: '#1718C7',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  methodologyGrid: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
  },
  methodologyItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
  },
  methodologyIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23, 24, 199, 0.08)',
  },
  methodologyCopy: {
    flex: 1,
    minWidth: 0,
  },
  methodologyTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  methodologyText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
  cardEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: '#1718C7',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  narrativeList: {
    gap: 12,
    marginTop: 16,
  },
  narrativeItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  narrativeDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    marginTop: 7,
  },
  narrativeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#526174',
  },
  selectorCard: {
    borderRadius: 24,
    padding: 20,
    zIndex: 20,
    elevation: 20,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  selectorHint: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    color: '#1718C7',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  selectorControlsRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    flexWrap: 'wrap',
  },
  selectorPeriodGroup: {
    flex: 1,
    alignItems: 'center',
    minWidth: 420,
  },
  scopeSwitcher: {
    flexDirection: 'row',
    gap: 10,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#EEF2F7',
    alignSelf: 'flex-start',
  },
  scopeButton: {
    minWidth: 128,
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  scopeButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  scopeButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    color: '#64748B',
  },
  scopeButtonTextActive: {
    color: '#0003B8',
  },
  selectorListTitle: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  selectorInlineLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  selectorLabelRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    position: 'relative',
    alignSelf: 'flex-start',
    zIndex: 18,
  },
  infoButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  infoButtonActive: {
    borderColor: '#94A3B8',
    backgroundColor: '#EEF2F7',
  },
  infoModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  infoModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  infoModalCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 30,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  infoModalTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
    color: '#0F172A',
  },
  infoModalClose: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  infoModalText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
    fontWeight: '700',
  },
  infoDiseaseScroll: {
    marginTop: 16,
    maxHeight: 280,
  },
  infoDiseaseList: {
    gap: 8,
    paddingBottom: 2,
  },
  infoDiseaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  infoDiseaseName: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
    color: '#0F172A',
  },
  infoDiseaseMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: '#64748B',
  },
  diseaseDropdown: {
    marginTop: 10,
    maxWidth: 420,
    position: 'relative',
    zIndex: 30,
  },
  diseaseDropdownButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  diseaseDropdownInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
    color: '#0F172A',
    paddingVertical: 0,
  },
  diseaseDropdownIconButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  diseaseDropdownList: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    zIndex: 40,
    elevation: 24,
    maxHeight: 280,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
  },
  diseaseDropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  diseaseDropdownOptionActive: {
    backgroundColor: '#EEF2FF',
  },
  diseaseDropdownOptionHovered: {
    backgroundColor: '#F1F5FF',
  },
  diseaseDropdownOptionText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    color: '#334155',
  },
  diseaseDropdownOptionTextActive: {
    color: '#0003B8',
  },
  diseaseDropdownEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    fontWeight: '700',
  },
  analysisGrid: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'stretch',
  },
  panelCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 24,
    padding: 20,
  },
  diseaseSummaryCard: {
    width: 360,
    borderRadius: 24,
    padding: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  diseaseSummaryTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: '#0F172A',
  },
  diseaseSummaryText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: '#64748B',
  },
  diseaseSummaryMetrics: {
    marginTop: 20,
    gap: 12,
  },
  diseaseSummaryMetric: {
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  diseaseSummaryMetricLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  diseaseSummaryMetricValue: {
    marginTop: 6,
    fontSize: 30,
    lineHeight: 36,
    color: '#0F172A',
    fontWeight: '900',
  },
  diseaseSummaryRisk: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  riskDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  diseaseSummaryRiskText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: '#334155',
  },
  trendPanelCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trendWindowGrid: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 12,
  },
  trendWindowCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trendWindowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  trendWindowLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: '#64748B',
  },
  trendWindowValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: '#0F172A',
  },
  trendLineTrack: {
    marginTop: 14,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  trendLineFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0003B8',
  },
  trendWindowCaption: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    color: '#94A3B8',
  },
  riskBalanceCard: {
    flex: 1.2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  riskSummaryText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    color: '#475569',
    fontWeight: '700',
  },
  riskColumns: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 14,
  },
  riskColumn: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  riskColumnTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  riskColumnTitleRed: {
    color: '#DC2626',
  },
  riskColumnTitleGreen: {
    color: '#16A34A',
  },
  riskFactorList: {
    gap: 10,
  },
  riskFactorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  riskFactorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
    fontWeight: '700',
  },
  mutedText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#70839B',
  },
});
