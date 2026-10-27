import { api } from './api';

export interface DiagnosisEvaluationFile {
  id: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  fileSizeBytes: number | null;
  documentType: string | null;
  uploadedAt: string;
}

export interface DiagnosisRecommendedTest {
  id: string;
  testName: string;
  reason: string | null;
  source: string | null;
  sortOrder: number;
}

export interface DiagnosisEvaluationPatient {
  id: string;
  fullName: string;
  sex: string;
  birthDate: string;
  ageYears: number | null;
  weightKg: number | null;
  heightCm: number | null;
}

export interface DiagnosisEvaluationEvent {
  id: string;
  diseaseName: string | null;
  diseaseCode: string | null;
  status: string;
  startedAt: string;
}

export interface DiagnosisEvaluation {
  id: string;
  status: string;
  symptomsText: string;
  clinicalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  finalDiseaseId: string | null;
  finalDiseaseName: string | null;
  finalDiagnosisLabel: string | null;
  finalDecisionSource: string | null;
  doctorFeedbackNotes: string | null;
  patient: DiagnosisEvaluationPatient;
  event: DiagnosisEvaluationEvent | null;
  recommendedTests: DiagnosisRecommendedTest[];
  files: DiagnosisEvaluationFile[];
}

export type AssistantFeedbackDecision =
  | 'ASSISTANT_ACCEPTED'
  | 'ASSISTANT_REJECTED_DOCTOR_OVERRIDE'
  | 'DOCTOR_ONLY';

export interface SubmitAssistantFeedbackPayload {
  finalDecisionSource: AssistantFeedbackDecision;
  finalDiagnosisLabel?: string;
  doctorFeedbackNotes?: string;
  acceptedAssistantMessageId?: string;
  finalDiseaseId?: string;
}

export interface UpdateDiagnosisEvaluationPayload {
  patientFullName: string;
  birthDate: string;
  sex: string;
  symptomsText: string;
}

export interface UploadDiagnosisEvaluationFilePayload {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  documentType?: string;
  contentBase64: string;
}

export async function createDiagnosisEvaluation(
  payload: UpdateDiagnosisEvaluationPayload,
): Promise<DiagnosisEvaluation> {
  return api<DiagnosisEvaluation>('/diagnosis/evaluations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDiagnosisEvaluation(
  evaluationId: string,
  payload: UpdateDiagnosisEvaluationPayload,
): Promise<DiagnosisEvaluation> {
  return api<DiagnosisEvaluation>(`/diagnosis/evaluations/${evaluationId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateDiagnosisEvaluationStatus(
  evaluationId: string,
  status: 'IN_PROGRESS' | 'CONFIRMED' | 'REJECTED',
): Promise<DiagnosisEvaluation> {
  return api<DiagnosisEvaluation>(`/diagnosis/evaluations/${evaluationId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function uploadDiagnosisEvaluationFile(
  evaluationId: string,
  payload: UploadDiagnosisEvaluationFilePayload,
): Promise<DiagnosisEvaluation> {
  return api<DiagnosisEvaluation>(`/diagnosis/evaluations/${evaluationId}/files`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCurrentDiagnosisEvaluation(): Promise<DiagnosisEvaluation> {
  return api<DiagnosisEvaluation>('/diagnosis/evaluations/current');
}

export async function submitAssistantFeedback(
  evaluationId: string,
  payload: SubmitAssistantFeedbackPayload,
): Promise<DiagnosisEvaluation> {
  return api<DiagnosisEvaluation>(`/diagnosis/evaluations/${evaluationId}/assistant-feedback`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
