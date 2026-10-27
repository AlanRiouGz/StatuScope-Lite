import { beforeEach, describe, expect, it, vi } from 'vitest';
import { demoApi, loginDemo, logoutDemo, restoreDemoProfile } from '../../../lib/demo/service';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../../../lib/demo/config';
import { api, ApiError } from '../../../lib/api';
import type { DiagnosisEvaluation } from '../../../lib/diagnosisEvaluation';
import type { DoctorDashboardMapResponse, DoctorDashboardReportResponse, DoctorDashboardMetricsResponse } from '../../../lib/doctorDashboard';

vi.mock('@/i18n/language', () => ({ getCurrentLanguage: () => 'es' }));
vi.mock('@/lib/demo/config', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../lib/demo/config')>(), DEMO_MODE: true,
}));

beforeEach(() => { logoutDemo(); vi.restoreAllMocks(); });

describe('Standalone doctor demo', () => {
  it('rejects invalid credentials and does not allow requests without login', async () => {
    expect(() => loginDemo(DEMO_EMAIL, 'wrong')).toThrow();
    expect(restoreDemoProfile()).toBeNull();
    await expect(api('/doctor/dashboard/metrics')).rejects.toMatchObject({ status: 401 });
  });
  it('logs in only as a doctor, and logout removes the session', () => {
    expect(loginDemo(' MEDICO@STATUSCOPE.DEMO ', DEMO_PASSWORD).roles).toEqual(['DOCTOR']);
    expect(restoreDemoProfile()?.email).toBe(DEMO_EMAIL);
    logoutDemo();
    expect(restoreDemoProfile()).toBeNull();
  });
  it('serves dashboard, map, catalog and reports without fetch or Firebase', async () => {
    loginDemo(DEMO_EMAIL, DEMO_PASSWORD);
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
    const endpoints = [
      '/auth/me', '/doctor/dashboard/summary', '/doctor/dashboard/metrics', '/doctor/dashboard/map',
      '/doctor/dashboard/map/states', '/doctor/dashboard/map/states/demo-puebla/outbreaks',
      '/doctor/dashboard/diseases', '/doctor/dashboard/alerts', '/doctor/dashboard/disease-breakdown/local',
      '/doctor/dashboard/disease-breakdown/state', '/doctor/dashboard/reports/local',
      '/doctor/dashboard/reports/state', '/doctor/dashboard/reports/both', '/doctor/dashboard/reports/states/demo-cdmx',
      '/diagnosis/diseases?query=dengue&limit=8', '/diagnosis/evaluations/current',
      '/diagnosis/assistant/evaluations/demo-evaluation/thread',
    ];
    for (const path of endpoints) expect(await api(path)).toBeDefined();
    expect(network).not.toHaveBeenCalled();
  });
  it('keeps radius, reports and metrics consistent and separates state selection', async () => {
    loginDemo(DEMO_EMAIL, DEMO_PASSWORD);
    const small = await demoApi<DoctorDashboardMapResponse>('/doctor/dashboard/map?radiusKm=10');
    const big = await demoApi<DoctorDashboardMapResponse>('/doctor/dashboard/map?radiusKm=150');
    expect(big.zones.length).toBeGreaterThan(small.zones.length);
    const report = await demoApi<DoctorDashboardReportResponse>('/doctor/dashboard/reports/local?radiusKm=10');
    const metrics = await demoApi<DoctorDashboardMetricsResponse>('/doctor/dashboard/metrics?radiusKm=10');
    expect(Number(metrics.metrics[0].value)).toBe(report.outbreaks.reduce((sum, item) => sum + item.caseCount, 0));
    const state = await demoApi<DoctorDashboardReportResponse>('/doctor/dashboard/reports/states/demo-puebla');
    expect(state.stateName).toBe('Puebla');
    expect(state.outbreaks.every(item => item.location === 'Puebla')).toBe(true);
  });
  it('saves manual forms, confirms a manual selection, and resets after logout', async () => {
    loginDemo(DEMO_EMAIL, DEMO_PASSWORD);
    const updated = await demoApi<DiagnosisEvaluation>('/diagnosis/evaluations/demo-evaluation', {
      method: 'PUT', body: JSON.stringify({ patientFullName: 'Paciente ficticio modificado', birthDate: '1990-01-01', sex: 'other', symptomsText: 'Texto de ejemplo' }),
    });
    expect(updated.patient.fullName).toBe('Paciente ficticio modificado');
    const final = await demoApi<DiagnosisEvaluation>('/diagnosis/evaluations/demo-evaluation/assistant-feedback', {
      method: 'POST', body: JSON.stringify({ finalDecisionSource: 'DOCTOR_ONLY', finalDiseaseId: 'demo-dengue' }),
    });
    expect(final.finalDiseaseName).toBe('Dengue');
    expect(final.status).toBe('CONFIRMED');
    logoutDemo(); loginDemo(DEMO_EMAIL, DEMO_PASSWORD);
    expect((await demoApi<DiagnosisEvaluation>('/diagnosis/evaluations/current')).patient.fullName).toBe('Paciente de ejemplo');
  });
  it('blocks AI, administration and unknown operations instead of contacting a server', async () => {
    loginDemo(DEMO_EMAIL, DEMO_PASSWORD);
    const network = vi.spyOn(globalThis, 'fetch');
    await expect(api('/diagnosis/assistant/messages', { method: 'POST' })).rejects.toMatchObject({ status: 403 });
    await expect(api('/admin/users')).rejects.toMatchObject({ status: 403 });
    await expect(api('/missing')).rejects.toBeInstanceOf(ApiError);
    expect(network).not.toHaveBeenCalled();
  });
  it('retains attachment metadata only and returns independent copies', async () => {
    loginDemo(DEMO_EMAIL, DEMO_PASSWORD);
    const uploaded = await demoApi<DiagnosisEvaluation>('/diagnosis/evaluations/demo-evaluation/files', {
      method: 'POST', body: JSON.stringify({ fileName: 'demo.txt', mimeType: 'text/plain', fileSizeBytes: 4, contentBase64: 'dGVzdA==' }),
    });
    expect(uploaded.files).toHaveLength(1);
    expect(JSON.stringify(uploaded)).not.toContain('dGVzdA==');
    uploaded.patient.fullName = 'Outside mutation';
    expect((await demoApi<DiagnosisEvaluation>('/diagnosis/evaluations/current')).patient.fullName).toBe('Paciente de ejemplo');
  });
});
