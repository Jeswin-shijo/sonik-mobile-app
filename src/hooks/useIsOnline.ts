import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { apiBaseUrl } from '../config';

const PING_INTERVAL_MS = 15_000;

async function checkConnectivity(): Promise<boolean> {
  try {
    const res = await fetch(`${apiBaseUrl}/health`, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startPolling() {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(async () => {
      const online = await checkConnectivity();
      setIsOnline(online);
    }, PING_INTERVAL_MS);
  }

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => {
    checkConnectivity().then(setIsOnline);
    startPolling();

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkConnectivity().then(setIsOnline);
        startPolling();
      } else {
        stopPolling();
      }
    });

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, []);

  return isOnline;
}
