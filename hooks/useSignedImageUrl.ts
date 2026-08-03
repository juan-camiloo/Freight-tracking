import { supabase } from '@/lib/URLs';
import { useEffect, useState } from 'react';

const BUCKET = 'news_img';
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hora
const CACHE_TTL_MS = 55 * 60 * 1000; // un poco menos que la expiración, para refrescar antes de que venza

type CacheEntry = {
    url: string;
    expiresAt: number;
};

const urlCache = new Map<string, CacheEntry>();

export function useSignedImageUrl(path: string | null | undefined, bucket: string = BUCKET) {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (!path) {
            setUrl(null);
            return;
        }

        const cached = urlCache.get(path);
        if (cached && cached.expiresAt > Date.now()) {
            setUrl(cached.url);
            return;
        }

        (async () => {
            const { data, error } = await supabase.storage
                .from(bucket)
                .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

            if (cancelled) return;

            if (error) {
                console.error('Error creating signed url for', path, error);
                setUrl(null);
                return;
            }

            if (data?.signedUrl) {
                urlCache.set(path, {
                    url: data.signedUrl,
                    expiresAt: Date.now() + CACHE_TTL_MS,
                });
                setUrl(data.signedUrl);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [path, bucket]);

    return url;
}