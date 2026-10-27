export interface DoctorDashboardAlert {
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

export interface DoctorDashboardMetric {
  id: string;
  title: string;
  value: string;
  badge?: string;
  status?: 'positive' | 'danger' | 'warning' | 'neutral';
  subtitle?: string;
  detailTitle: string;
  detailSummary: string;
  signalLabel: string;
  recommendedAction: string;
  iconKey?: 'trend';
  insights?: DoctorDashboardMetricInsight[];
}

export interface DoctorDashboardMetricInsight {
  title: string;
  location: string;
  cases: string;
  severity: string;
  color: string;
  meta?: string | null;
}

export interface DoctorDashboardZone {
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
  top: string;
  left: string;
  borderColor: string;
  latitude?: number | null;
  longitude?: number | null;
}
