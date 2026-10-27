import type { DiagnosisEvaluation, UpdateDiagnosisEvaluationPayload, SubmitAssistantFeedbackPayload,
  UploadDiagnosisEvaluationFilePayload } from '../diagnosisEvaluation';
import { DEMO_EMAIL, DEMO_PASSWORD } from './config';
import { alerts, breakdown, demoProfile, diseases, makeEvaluation, makeOutbreaks, metrics, states, zones } from './data';

const SESSION_KEY = 'statuscope.lite.session.v1';
const EVALUATION_KEY = 'statuscope.lite.evaluation.v1';
let signedIn = false;
let evaluation: DiagnosisEvaluation | undefined;

export class DemoError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function readSession(key: string): string | null {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null; }
  catch { return null; }
}
function writeSession(key: string, value: string | null) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch { /* The demo still works in memory when browser storage is unavailable. */ }
}

export function restoreDemoProfile() {
  signedIn = signedIn || readSession(SESSION_KEY) === demoProfile.id;
  return signedIn ? structuredClone(demoProfile) : null;
}

export function loginDemo(email: string, password: string) {
  if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    throw new DemoError(401, 'Correo o contraseña de demostración incorrectos.');
  }
  signedIn = true;
  writeSession(SESSION_KEY, demoProfile.id);
  return structuredClone(demoProfile);
}

export function logoutDemo() {
  signedIn = false;
  evaluation = undefined;
  writeSession(SESSION_KEY, null);
  writeSession(EVALUATION_KEY, null);
}

function currentEvaluation() {
  if (!evaluation) {
    try {
      const stored = JSON.parse(readSession(EVALUATION_KEY) ?? 'null');
      if (stored?.id === 'demo-evaluation' && stored.patient && Array.isArray(stored.files)) evaluation = stored;
    } catch { /* Ignore an invalid saved demo. */ }
    evaluation ??= makeEvaluation();
  }
  return evaluation;
}

function saveEvaluation(value: DiagnosisEvaluation) {
  evaluation = { ...value, updatedAt: new Date().toISOString() };
  writeSession(EVALUATION_KEY, JSON.stringify(evaluation));
  return evaluation;
}

function parseBody<T>(init: RequestInit): T {
  try { return JSON.parse(String(init.body ?? '{}')) as T; }
  catch { throw new DemoError(400, 'Datos de demostración inválidos.'); }
}

// An exhaustive local adapter: unknown endpoints fail here and never fall through to fetch.
export async function demoApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!restoreDemoProfile()) throw new DemoError(401, 'Inicia sesión con la cuenta de demostración.');
  const value = handleRequest(path, init);
  return structuredClone(value) as T;
}

function handleRequest(path: string, init: RequestInit): unknown {
  const url = new URL(path, 'https://demo.invalid');
  const route = url.pathname;
  const method = (init.method ?? 'GET').toUpperCase();
  if (route.startsWith('/admin/')) throw new DemoError(403, 'Esta demo solo incluye el perfil de médico.');
  if (route === '/auth/me' && method === 'GET') return demoProfile;
  if (route === '/diagnosis/diseases' && method === 'GET') {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const query = normalize(url.searchParams.get('query') ?? '');
    const limit = Math.max(1, Math.min(250, Number(url.searchParams.get('limit')) || 8));
    return diseases.filter(item => normalize(`${item.name} ${item.code}`).includes(query)).slice(0, limit);
  }
  if (route.startsWith('/doctor/dashboard/') && method === 'GET') {
    const all = makeOutbreaks();
    const stateMatch = route.match(/\/states\/([^/]+)/);
    const state = states.find(item => item.stateId === stateMatch?.[1]) ?? states[0];
    if (stateMatch && !states.some(item => item.stateId === stateMatch[1])) throw new DemoError(404, 'Estado no disponible en esta demo.');
    const radiusKm = Math.max(1, Math.min(500, Number(url.searchParams.get('radiusKm')) || 75));
    const stateOutbreaks = all.filter(item => item.stateId === state.stateId);
    const local = stateOutbreaks.filter(item => item.distanceKm <= radiusKm);
    const common = { hospitalName: demoProfile.hospitalName, municipalityName: 'Veracruz', stateName: state.stateName,
      generatedAt: new Date().toISOString(), radiusKm };
    if (route === '/doctor/dashboard/diseases') return { diseases };
    if (route === '/doctor/dashboard/map/states') return { states: states.map(item => {
      const matches = all.filter(outbreak => outbreak.stateId === item.stateId);
      return { ...item, outbreakCount: matches.length, caseCount: matches.reduce((sum, outbreak) => sum + outbreak.caseCount, 0) };
    }) };
    if (route === '/doctor/dashboard/metrics') return { ...common, metrics: metrics(local) };
    if (route === '/doctor/dashboard/alerts') return { alerts: alerts(local) };
    if (route === '/doctor/dashboard/map' || /^\/doctor\/dashboard\/map\/states\/[^/]+\/outbreaks$/.test(route)) {
      const items = stateMatch ? stateOutbreaks : local;
      return { ...common, zones: zones(items), diseaseBreakdown: breakdown(items) };
    }
    if (/^\/doctor\/dashboard\/disease-breakdown\/(local|state)$/.test(route)) {
      return { ...common, diseaseBreakdown: breakdown(route.endsWith('/state') ? stateOutbreaks : local) };
    }
    if (/^\/doctor\/dashboard\/reports\/(local|state|both|states\/[^/]+)$/.test(route)) {
      const scope = route.endsWith('/local') ? 'local' : route.endsWith('/both') ? 'both' : 'state';
      return { ...common, scope, outbreaks: scope === 'local' ? local : stateOutbreaks };
    }
    if (route === '/doctor/dashboard/summary') return { ...common, metrics: metrics(local),
      diseaseBreakdown: breakdown(local), stateDiseaseBreakdown: breakdown(stateOutbreaks), alerts: alerts(local), zones: zones(local) };
  }
  if (route === '/diagnosis/assistant/evaluations/demo-evaluation/thread' && method === 'GET') {
    return { evaluationId: 'demo-evaluation', messages: [], contextUsed: null };
  }
  if (route.startsWith('/diagnosis/assistant/')) throw new DemoError(403, 'La inteligencia artificial está deshabilitada en la demo.');
  if (route === '/diagnosis/evaluations/current' && method === 'GET') return currentEvaluation();
  if ((route === '/diagnosis/evaluations' && method === 'POST') ||
      (route === '/diagnosis/evaluations/demo-evaluation' && method === 'PUT')) {
    const body = parseBody<UpdateDiagnosisEvaluationPayload>(init);
    const current = route === '/diagnosis/evaluations' ? makeEvaluation() : currentEvaluation();
    return saveEvaluation({ ...current, symptomsText: body.symptomsText,
      patient: { ...current.patient, fullName: body.patientFullName, birthDate: body.birthDate, sex: body.sex } });
  }
  if (route === '/diagnosis/evaluations/demo-evaluation/status' && method === 'POST') {
    const { status } = parseBody<{ status: string }>(init);
    if (!['IN_PROGRESS', 'CONFIRMED', 'REJECTED'].includes(status)) throw new DemoError(400, 'Estado inválido.');
    return saveEvaluation({ ...currentEvaluation(), status, finalizedAt: status === 'IN_PROGRESS' ? null : new Date().toISOString() });
  }
  if (route === '/diagnosis/evaluations/demo-evaluation/assistant-feedback' && method === 'POST') {
    const body = parseBody<SubmitAssistantFeedbackPayload>(init);
    if (body.finalDecisionSource !== 'DOCTOR_ONLY') throw new DemoError(403, 'Solo está disponible el registro manual en esta demo.');
    const disease = diseases.find(item => item.id === body.finalDiseaseId);
    const label = disease?.name ?? body.finalDiagnosisLabel?.trim();
    if (!label) throw new DemoError(400, 'Selecciona una enfermedad o escribe una etiqueta.');
    return saveEvaluation({ ...currentEvaluation(), status: 'CONFIRMED', finalizedAt: new Date().toISOString(),
      finalDecisionSource: 'DOCTOR_ONLY', finalDiseaseId: disease?.id ?? null, finalDiseaseName: disease?.name ?? null,
      finalDiagnosisLabel: label, doctorFeedbackNotes: body.doctorFeedbackNotes ?? null });
  }
  if (route === '/diagnosis/evaluations/demo-evaluation/files' && method === 'POST') {
    const body = parseBody<UploadDiagnosisEvaluationFilePayload>(init);
    const current = currentEvaluation();
    // Only file metadata is retained; no document is transmitted or stored.
    return saveEvaluation({ ...current, files: [...current.files, {
      id: `demo-file-${current.files.length + 1}`, fileName: body.fileName, mimeType: body.mimeType,
      storageKey: 'demo-metadata-only', fileSizeBytes: body.fileSizeBytes,
      documentType: body.documentType ?? null, uploadedAt: new Date().toISOString(),
    }] });
  }
  throw new DemoError(404, 'Esta operación no está disponible en la demo de médico.');
}
