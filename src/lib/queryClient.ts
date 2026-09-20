// TanStack Query 클라이언트와 AsyncStorage 영속화 설정
// 오프라인에서 앱을 열어도 마지막으로 본 화면이 보이게 하는 것이 목적이다(docs/03 §7)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 오프라인 캐시가 의미를 가지려면 gcTime이 영속화 기간보다 길어야 한다.
      gcTime: 1000 * 60 * 60 * 24 * 7,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // 쓰기는 온라인 필수다. 큐에 쌓아 두지 않고 실패를 화면에 그대로 보여 준다.
      retry: 0,
      networkMode: 'online',
    },
  },
});

export const QUERY_CACHE_KEY = 'ppurin.query-cache';

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_CACHE_KEY,
  throttleTime: 2000,
});

export const persistOptions = {
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24 * 7,
  // 캐시 모양이 바뀌면 통째로 버린다. 스키마가 바뀔 때 이 값을 올린다.
  buster: 'v1',
};
