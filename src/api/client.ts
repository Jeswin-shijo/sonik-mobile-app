import { apiBaseUrl } from '../config';
import type { ApiErrorPayload, AuthView } from '../types';

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export async function requestJson<T>(path: string, init?: RequestInit) {
  const { headers, ...requestInit } = init ?? {};

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...requestInit,
    headers: {
      'Content-Type': 'application/json',
      ...((headers ?? {}) as Record<string, string>),
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | T
    | ApiErrorPayload
    | null;

  if (!response.ok) {
    const payloadMessage = (payload as ApiErrorPayload | null)?.message;
    const message = Array.isArray(payloadMessage)
      ? payloadMessage.join(', ')
      : payloadMessage;

    throw new ApiRequestError(response.status, message || 'Request failed.');
  }

  return payload as T;
}

export function getFriendlyError(error: unknown, view: AuthView) {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return view === 'login'
        ? 'Email or password did not match.'
        : 'Please sign in again to continue.';
    }

    if (error.status === 409) {
      return 'An account with this email already exists.';
    }

    if (error.status === 400) {
      return 'Please check the details and try again.';
    }
  }

  return 'Sonik could not complete that action right now.';
}
