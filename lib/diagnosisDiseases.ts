import { api } from './api';

export interface DiagnosisDiseaseOption {
  id: string;
  code: string;
  name: string;
}

export async function searchDiagnosisDiseases(
  query: string,
  limit = 8,
): Promise<DiagnosisDiseaseOption[]> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set('query', query.trim());
  }
  params.set('limit', String(limit));

  return api<DiagnosisDiseaseOption[]>(`/diagnosis/diseases?${params.toString()}`);
}
