// 앱의 현재 언어 — 기기 설정을 따르되 더보기에서 바꿀 수 있다. 화면은 useT() 로 문구를 얻는다
//
// 저장 키 하나(ppurin.locale). 'system' 이면 기기 언어(expo-localization)를 따른다.
// 바꾸면 구독 중인 화면이 전부 다시 그려진다(useSyncExternalStore). 서버·사전은 src/i18n/dict.ts 다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useCallback, useSyncExternalStore } from 'react';
import { isLocale, localeFromTag, translate, type Locale } from './dict.ts';

export type LocaleSetting = Locale | 'system';
const KEY = 'ppurin.locale';

let setting: LocaleSetting = 'system';
let listeners = new Set<() => void>();

function deviceLocale(): Locale {
  try {
    return localeFromTag(getLocales()[0]?.languageTag ?? getLocales()[0]?.languageCode);
  } catch {
    return 'ko';
  }
}

export function currentLocale(): Locale {
  return setting === 'system' ? deviceLocale() : setting;
}

export function currentSetting(): LocaleSetting {
  return setting;
}

function emit() {
  listeners.forEach((l) => l());
}

// 앱이 뜰 때 한 번. 저장된 값이 없으면 기기 언어다.
export async function loadLocaleSetting(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored === 'system' || isLocale(stored)) {
      setting = stored;
      emit();
    }
  } catch {
    // 못 읽으면 기기 언어
  }
}

export async function setLocaleSetting(next: LocaleSetting): Promise<void> {
  setting = next;
  emit();
  try {
    await AsyncStorage.setItem(KEY, next);
  } catch {
    // 저장 실패는 다음 실행에서 기기 언어로 돌아갈 뿐이다
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, currentLocale, currentLocale);
}

export function useLocaleSetting(): LocaleSetting {
  return useSyncExternalStore(subscribe, currentSetting, currentSetting);
}

// 화면이 쓰는 번역 함수. 언어가 바뀌면 새 함수가 온다.
export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const locale = useLocale();
  return useCallback((key: string, params?: Record<string, string | number>) => translate(locale, key, params), [locale]);
}

// 훅을 못 쓰는 곳(이벤트 핸들러 밖, 설정 객체)용
export function t(key: string, params?: Record<string, string | number>): string {
  return translate(currentLocale(), key, params);
}
