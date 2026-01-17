import { useCallback, useEffect, useRef, useState } from 'react';

export const useWakeLock = () => {
    const [isSupported, setIsSupported] = useState(false);
    const [released, setReleased] = useState<boolean | undefined>(undefined);
    const wakeLock = useRef<WakeLockSentinel | null>(null);

    // Check support
    useEffect(() => {
        if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
            setIsSupported(true);
        }
    }, []);

    const request = useCallback(async () => {
        if (!isSupported) return;
        if (document.visibilityState !== 'visible') return;

        try {
            wakeLock.current = await navigator.wakeLock.request('screen');

            // Sentinel 'release' event
            wakeLock.current.addEventListener('release', () => {
                console.log('Wake Lock released');
                setReleased(true);
            });

            console.log('Wake Lock acquired');
            setReleased(false);
        } catch (err: any) {
            console.error(`${err.name}, ${err.message}`);
        }
    }, [isSupported]);

    const release = useCallback(async () => {
        if (wakeLock.current) {
            await wakeLock.current.release();
            wakeLock.current = null;
        }
    }, []);

    // Re-acquire lock when page visibility becomes visible
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && released === true) {
                // If we previously had a lock and lost it (or it was released), try to get it back
                // But only if we intend to keep it. For now, let's just expose request/release
                // and let the consumer decide policy. 
                // ACTUALLY: The standard pattern is to re-request if we want it to persist.
                await request();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [request, released]);

    return { isSupported, request, release, released };
};
