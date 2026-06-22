import { TFunction } from 'i18next';

export function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || (error.message && String(error.message).toLowerCase().includes('aborted')))
  );
}

export async function resolveErrorMessage(response: Response | null | undefined, fallbackMessage: string, t?: TFunction) {
  if (!response) return t ? t(fallbackMessage) : fallbackMessage;

  try {
    const text = await response.text();
    if (!text) return t ? t(fallbackMessage) : fallbackMessage;

    try {
      const payload = JSON.parse(text);
      if (payload) {
        if (typeof payload.error_key === 'string') {
          return t ? t(payload.error_key, payload.error_params ?? {}) : payload.error_key;
        }
        if (typeof payload.message === 'string') return payload.message;
        if (typeof payload.error === 'string') return payload.error;
      }
    } catch (e) {
      // not JSON
      return text || (t ? t(fallbackMessage) : fallbackMessage);
    }
  } catch (e) {
    // ignore
  }

  return t ? t(fallbackMessage) : fallbackMessage;
}
