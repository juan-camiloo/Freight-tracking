import { useEffect, useRef, useState } from 'react';

export default function useFormSearch<T>(searchFn: (q: string) => Promise<T>, delay = 250) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<T | null>(null);
  const [searching, setSearching] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(async () => {
      try {
        const res = await searchFn(searchQuery.trim());
        setResults(res);
      } catch (e) {
        setResults(null);
      } finally {
        setSearching(false);
      }
    }, delay);

    return () => window.clearTimeout(timeoutRef.current);
  }, [searchQuery, searchFn, delay]);

  return { searchQuery, setSearchQuery, results, searching } as const;
}
