import { isAbortError as isAbortErrorUtil } from '@/utils/errorHandling';
import { useCallback } from 'react';

export default function useAbortErrorHandler() {
  const isAbortError = useCallback((error: unknown) => isAbortErrorUtil(error), []);
  return { isAbortError } as const;
}
