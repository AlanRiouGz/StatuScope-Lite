import { AppLanguage } from '@/i18n/language';

export type LocalityRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface AssistantSuggestion {
  id?: string;
  messageId?: string;
  diseaseId?: string | null;
  displayName: string;
  rankOrder: number;
  confidence?: number | null;
  rationale?: string | null;
  localityRiskLevel?: LocalityRiskLevel | null;
  primary: boolean;
}

export interface AssistantMessage {
  id?: string;
  clientId?: string;
  role: 'user' | 'assistant';
  content: string;
  contentByLanguage?: Partial<Record<AppLanguage, string>>;
  createdAt?: string;
  kind?: 'manual' | 'analysisPrompt' | 'assistant';
  promptKey?: string;
  promptParams?: Record<string, string | number | null | undefined>;
  sourceLanguage?: AppLanguage;
  suggestions?: AssistantSuggestion[];
}

export interface PatientContext {
  ageYears?: number;
  sex?: string;
  symptoms?: string;
}

export interface OutbreakSummary {
  diseaseName: string;
  municipalityName?: string | null;
  stateName?: string | null;
  regionName?: string | null;
  caseCount: number;
  startedAt: string;
}

export interface AssistantContext {
  stateName?: string | null;
  regionName?: string | null;
  outbreaks: OutbreakSummary[];
}

export interface AssistantRequest {
  evaluationId?: string;
  messages: AssistantMessage[];
  patientContext?: PatientContext;
}

export interface AssistantResponse {
  reply: string;
  replyByLanguage?: Partial<Record<AppLanguage, string>>;
  contextUsed: AssistantContext;
  messageId?: string | null;
  suggestions?: AssistantSuggestion[];
}

export interface AssistantThread {
  id: string;
  evaluationId: string;
  createdAt: string;
  updatedAt: string;
  messages: AssistantMessage[];
  contextUsed: AssistantContext | null;
}

export interface AssistantTranslationRequest {
  targetLanguage: AppLanguage;
  messages: Array<{
    clientId: string;
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface AssistantTranslationResponse {
  translations: Array<{
    clientId: string;
    content: string;
  }>;
}
