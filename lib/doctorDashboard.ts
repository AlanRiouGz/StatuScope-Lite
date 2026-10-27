import { api } from './api';

function radiusQuery(radiusKm?: number) {
  return typeof radiusKm === 'number' ? `?radiusKm=${encodeURIComponent(String(radiusKm))}` : '';
}

export interface DoctorDashboardMetricResponse {
  id: string;
  title: string;
  value: string;
  badge?: string | null;
  status?: 'positive' | 'danger' | 'warning' | 'neutral' | null;
  subtitle?: string | null;
  detailSummary: string;
  signalLabel: string;
  recommendedAction: string;
  iconKey?: 'trend' | null;
  insights?: DoctorDashboardMetricInsightResponse[] | null;
}

export interface DoctorDashboardMetricInsightResponse {
  title: string;
  location: string;
  cases: string;
  severity: string;
  color: string;
  meta?: string | null;
}

export interface DoctorDashboardDiseaseResponse {
  diseaseName: string;
  caseCount: number;
  outbreakCount: number;
  progress: number;
}

export interface DoctorDashboardAlertResponse {
  id: string;
  title: string;
  description: string;
  variant: 'critical' | 'warning' | 'success' | 'info' | 'neutral';
  area: string;
  priority: string;
  recommendedAction: string;
  caseCount?: number | null;
  caseLabel?: string | null;
  confirmationStatus?: string | null;
  municipalityName?: string | null;
  stateName?: string | null;
}

export interface DoctorDashboardZoneResponse {
  id: string;
  name: string;
  risk: string;
  disease: string;
  cases: string;
  radius: string;
  priority: string;
  note: string;
  recommendedAction: string;
  municipalityName?: string | null;
  stateName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  borderColor: string;
}

export interface DoctorDashboardSummary {
  hospitalName: string;
  municipalityName?: string | null;
  stateName?: string | null;
  radiusKm: number;
  generatedAt: string;
  metrics: DoctorDashboardMetricResponse[];
  diseaseBreakdown: DoctorDashboardDiseaseResponse[];
  stateDiseaseBreakdown: DoctorDashboardDiseaseResponse[];
  alerts: DoctorDashboardAlertResponse[];
  zones: DoctorDashboardZoneResponse[];
}

export interface DoctorDashboardMetricsResponse {
  metrics: DoctorDashboardMetricResponse[];
  hospitalName?: string | null;
}

export interface DoctorDashboardMapResponse {
  zones: DoctorDashboardZoneResponse[];
  diseaseBreakdown: DoctorDashboardDiseaseResponse[];
  generatedAt: string;
  radiusKm: number;
}

export interface DoctorDashboardStateMapItem {
  stateId: string;
  stateName: string;
  latitude: number;
  longitude: number;
  outbreakCount: number;
  caseCount: number;
}

export interface DoctorDashboardStateMapResponse {
  states: DoctorDashboardStateMapItem[];
}

export interface DoctorDashboardDiseaseCatalogItem {
  id: string;
  code: string;
  name: string;
}

export interface DoctorDashboardDiseaseCatalogResponse {
  diseases: DoctorDashboardDiseaseCatalogItem[];
}

export interface DoctorDashboardAlertsResponse {
  alerts: DoctorDashboardAlertResponse[];
}

export interface DoctorDashboardBreakdownResponse {
  diseaseBreakdown: DoctorDashboardDiseaseResponse[];
  stateName?: string | null;
  municipalityName?: string | null;
}

export type DoctorDashboardReportScope = 'local' | 'state' | 'both';

export interface DoctorDashboardReportOutbreakResponse {
  id: string;
  diseaseName: string;
  location: string;
  scope: string;
  caseCount: number;
  confirmationStatus?: string | null;
  startedAt?: string | null;
}

export interface DoctorDashboardReportResponse {
  scope: DoctorDashboardReportScope;
  hospitalName?: string | null;
  municipalityName?: string | null;
  stateName?: string | null;
  generatedAt: string;
  outbreaks: DoctorDashboardReportOutbreakResponse[];
}

export async function getDoctorDashboardSummary(radiusKm?: number): Promise<DoctorDashboardSummary> {
  return api<DoctorDashboardSummary>(`/doctor/dashboard/summary${radiusQuery(radiusKm)}`);
}

export async function getDoctorDashboardMetrics(radiusKm?: number): Promise<DoctorDashboardMetricsResponse> {
  return api<DoctorDashboardMetricsResponse>(`/doctor/dashboard/metrics${radiusQuery(radiusKm)}`);
}

export async function getDoctorDashboardMap(radiusKm?: number): Promise<DoctorDashboardMapResponse> {
  return api<DoctorDashboardMapResponse>(`/doctor/dashboard/map${radiusQuery(radiusKm)}`);
}

export async function getDoctorDashboardStateMap(): Promise<DoctorDashboardStateMapResponse> {
  return api<DoctorDashboardStateMapResponse>('/doctor/dashboard/map/states');
}

export async function getDoctorDashboardDiseaseCatalog(): Promise<DoctorDashboardDiseaseCatalogResponse> {
  return api<DoctorDashboardDiseaseCatalogResponse>('/doctor/dashboard/diseases');
}

export async function getDoctorDashboardStateOutbreakMap(stateId: string): Promise<DoctorDashboardMapResponse> {
  return api<DoctorDashboardMapResponse>(`/doctor/dashboard/map/states/${stateId}/outbreaks`);
}

export async function getDoctorDashboardAlerts(radiusKm?: number): Promise<DoctorDashboardAlertsResponse> {
  return api<DoctorDashboardAlertsResponse>(`/doctor/dashboard/alerts${radiusQuery(radiusKm)}`);
}

export async function getDoctorDashboardLocalBreakdown(radiusKm?: number): Promise<DoctorDashboardBreakdownResponse> {
  return api<DoctorDashboardBreakdownResponse>(`/doctor/dashboard/disease-breakdown/local${radiusQuery(radiusKm)}`);
}

export async function getDoctorDashboardStateBreakdown(radiusKm?: number): Promise<DoctorDashboardBreakdownResponse> {
  return api<DoctorDashboardBreakdownResponse>(`/doctor/dashboard/disease-breakdown/state${radiusQuery(radiusKm)}`);
}

export async function getDoctorDashboardReport(scope: DoctorDashboardReportScope, radiusKm?: number): Promise<DoctorDashboardReportResponse> {
  return api<DoctorDashboardReportResponse>(`/doctor/dashboard/reports/${scope}${radiusQuery(radiusKm)}`);
}

export async function getDoctorDashboardStateReport(stateId: string): Promise<DoctorDashboardReportResponse> {
  return api<DoctorDashboardReportResponse>(`/doctor/dashboard/reports/states/${encodeURIComponent(stateId)}`);
}
