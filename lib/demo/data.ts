import type {
  DoctorDashboardAlertResponse, DoctorDashboardDiseaseCatalogItem,
  DoctorDashboardMetricResponse, DoctorDashboardReportOutbreakResponse,
  DoctorDashboardZoneResponse,
} from '../doctorDashboard';
import type { DiagnosisEvaluation } from '../diagnosisEvaluation';
import type { UserProfile } from '@/contexts/AuthContext';
import { DEMO_EMAIL } from './config';

export const demoProfile: UserProfile = {
  id: 'demo-doctor', email: DEMO_EMAIL, fullName: 'Dra. Elena Demo',
  hospitalId: 'demo-hospital', hospitalName: 'Hospital StatuScope Demo',
  roles: ['DOCTOR'], privileges: [],
};

export const diseases: DoctorDashboardDiseaseCatalogItem[] = [
  { id: 'demo-dengue', code: 'A90', name: 'Dengue' },
  { id: 'demo-influenza', code: 'J10', name: 'Influenza' },
  { id: 'demo-covid', code: 'U07.1', name: 'COVID-19' },
  { id: 'demo-gastro', code: 'A09', name: 'Gastroenteritis' },
];

export const states = [
  { stateId: 'demo-veracruz', stateName: 'Veracruz', latitude: 19.1738, longitude: -96.1342 },
  { stateId: 'demo-puebla', stateName: 'Puebla', latitude: 19.0414, longitude: -98.2063 },
  { stateId: 'demo-cdmx', stateName: 'Ciudad de México', latitude: 19.4326, longitude: -99.1332 },
];

export interface DemoOutbreak extends DoctorDashboardReportOutbreakResponse {
  stateId: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
}

export function makeOutbreaks(now = Date.now()): DemoOutbreak[] {
  return states.flatMap((state, stateIndex) => Array.from({ length: 24 }, (_, index) => ({
    id: `${state.stateId}-outbreak-${index}`,
    diseaseName: diseases[index % diseases.length].name,
    location: stateIndex === 0 ? ['Veracruz', 'Boca del Río', 'Medellín de Bravo'][index % 3] : state.stateName,
    scope: index % 3 === 0 ? 'LOCAL' : 'STATE',
    caseCount: 4 + ((index * 7 + stateIndex * 3) % 32),
    confirmationStatus: index % 4 === 0 ? 'SUSPECTED' : 'CONFIRMED',
    startedAt: new Date(now - (index * 2 + 1) * 86400000).toISOString(),
    stateId: state.stateId, distanceKm: [8, 22, 48, 68, 95, 120][index % 6],
    latitude: state.latitude + (index % 4 - 1.5) * 0.035,
    longitude: state.longitude + (Math.floor(index / 4) - 2.5) * 0.025,
  })));
}

export function breakdown(outbreaks: DemoOutbreak[]) {
  const total = outbreaks.reduce((sum, item) => sum + item.caseCount, 0);
  return diseases.map(disease => {
    const matches = outbreaks.filter(item => item.diseaseName === disease.name);
    const caseCount = matches.reduce((sum, item) => sum + item.caseCount, 0);
    return { diseaseName: disease.name, caseCount, outbreakCount: matches.length,
      progress: total ? Math.round(caseCount / total * 100) : 0 };
  });
}

export function zones(outbreaks: DemoOutbreak[]): DoctorDashboardZoneResponse[] {
  return outbreaks.map((item, index) => ({
    id: item.id, name: `${item.location} · Zona ${index + 1}`, risk: index % 3 === 0 ? 'High' : 'Moderate',
    disease: item.diseaseName, cases: String(item.caseCount), radius: `${item.distanceKm} km`,
    priority: index % 3 === 0 ? 'High' : 'Medium', note: 'Escenario ficticio para explorar el mapa.',
    recommendedAction: 'Abrir el detalle y consultar los datos de ejemplo.',
    municipalityName: item.location, stateName: states.find(s => s.stateId === item.stateId)?.stateName,
    latitude: item.latitude, longitude: item.longitude,
    borderColor: index % 3 === 0 ? '#EF4444' : '#F97316',
  }));
}

export function alerts(outbreaks: DemoOutbreak[]): DoctorDashboardAlertResponse[] {
  return outbreaks.slice(0, 6).map((item, index) => ({
    id: `alert-${item.id}`, title: `${item.diseaseName} · ${item.location}`,
    description: `${item.caseCount} casos ficticios para demostrar el panel.`,
    variant: index % 2 === 0 ? 'warning' : 'info', area: item.location,
    priority: index % 2 === 0 ? 'High' : 'Medium', recommendedAction: 'Consultar el reporte de demostración.',
    caseCount: item.caseCount, caseLabel: 'Casos de ejemplo', confirmationStatus: item.confirmationStatus,
    municipalityName: item.location, stateName: 'Veracruz',
  }));
}

export function metrics(outbreaks: DemoOutbreak[]): DoctorDashboardMetricResponse[] {
  const total = outbreaks.reduce((sum, item) => sum + item.caseCount, 0);
  const highestDisease = breakdown(outbreaks).sort((a, b) => b.caseCount - a.caseCount)[0]?.diseaseName ?? 'Dengue';
  return [
    ['active-cases-nearby', 'Casos activos cercanos', String(total), 'Casos ficticios incluidos en los reportes.'],
    ['highest-case-disease', 'Enfermedad con más casos', highestDisease, 'Enfermedad con mayor conteo en los datos de ejemplo.'],
    ['local-risk-level', 'Nivel de riesgo local', 'Moderate', 'Nivel ilustrativo para demostrar la tarjeta.'],
    ['priority-municipality', 'Municipio prioritario', 'Veracruz', 'Municipio de ejemplo del hospital demo.'],
  ].map(([id, title, value, detailSummary]) => ({
    id, title, value, badge: 'DEMO', status: 'neutral', subtitle: 'Datos ficticios', detailSummary,
    signalLabel: 'Demostración', recommendedAction: 'Explorar los detalles del panel.',
    insights: outbreaks.slice(0, 3).map(item => ({ title: item.diseaseName, location: item.location,
      cases: String(item.caseCount), severity: 'Demo', color: '#0003B8' })),
  }));
}

export function makeEvaluation(now = new Date().toISOString()): DiagnosisEvaluation {
  return {
    id: 'demo-evaluation', status: 'IN_PROGRESS', symptomsText: 'Caso ficticio: malestar general y fiebre referida.',
    clinicalNotes: 'Solo demostración de la interfaz.', createdAt: now, updatedAt: now,
    finalizedAt: null, finalDiseaseId: null, finalDiseaseName: null, finalDiagnosisLabel: null,
    finalDecisionSource: null, doctorFeedbackNotes: null,
    patient: { id: 'demo-patient', fullName: 'Paciente de ejemplo', sex: 'female',
      birthDate: '1994-05-12', ageYears: null, weightKg: null, heightCm: null },
    event: null, recommendedTests: [], files: [],
  };
}
