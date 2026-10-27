import { demoApi, DemoError } from './demo/service';

export class ApiError extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
    super(message); this.name = 'ApiError';
  }
}

// UI data adapter only: Lite has no network client, Firebase or live API mode.
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  try { return await demoApi<T>(path, init); }
  catch (error) {
    if (error instanceof DemoError) throw new ApiError(error.status, 'DEMO', error.message);
    throw error;
  }
}
