// 네트워크 연결 상태. 오프라인 배너와 "다시 시도" 안내에 쓴다
//
// isInternetReachable은 신뢰하지 않는다. iOS 시뮬레이터에서 실제로 연결돼 있는데도 false로
// 떨어져 로그인·저장 버튼을 통째로 막는 것을 확인했다. 연결 여부(isConnected)만 본다.
// 실제 요청 실패는 각 화면이 오류로 받아 "다시 시도"를 보여 주므로 이중으로 막을 필요가 없다.
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // null이면 아직 판정 전이므로 연결된 것으로 본다.
      setOnline(state.isConnected !== false);
    });
    return unsubscribe;
  }, []);

  return online;
}
