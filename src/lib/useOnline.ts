// 네트워크 연결 상태. 오프라인 배너와 "다시 시도" 안내에 쓴다
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable이 null이면 아직 판정 전이므로 연결된 것으로 본다.
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  return online;
}
