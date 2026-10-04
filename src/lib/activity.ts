// 앱이 열릴 때 하루 한 번 "오늘 이 기기로 열었다"를 서버에 남긴다 — 관리자 통계의 재료 (0011)
//
// 남기는 것은 셋뿐이다. 기기 식별자(여기서 만든 무작위 값), 플랫폼, 오늘 날짜. 어디서 열었는지,
// 무엇을 눌렀는지는 남기지 않는다. 외부 분석 SDK 도 없다(처리방침). 실패해도 앱은 아무 말 없이 간다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { kstDay } from '../domain/kst.ts';
import { db } from './supabaseClient.ts';

const DEVICE_KEY = 'ppurin.device_id';
const LAST_KEY = 'ppurin.activity_last_day';

function randomId(): string {
  // 32자 16진. crypto 가 없는 환경(일부 RN)도 있어 Math.random 으로 만든다. 추적용이 아니라 충돌만 피하면 된다.
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i += 1) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

export async function deviceId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
    const fresh = randomId();
    await AsyncStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return randomId();
  }
}

export function platformName(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS;
  return 'web';
}


// 로그인된 상태에서 부른다. 같은 날 두 번 불러도 서버로는 한 번만 간다.
export async function recordActivityOncePerDay(now: Date = new Date()): Promise<void> {
  const day = kstDay(now);
  try {
    const last = await AsyncStorage.getItem(LAST_KEY);
    if (last === day) return;
  } catch {
    // 저장소를 못 읽으면 그냥 보낸다. 서버가 중복을 걸러 준다.
  }
  const id = await deviceId();
  const { error } = await db().rpc('record_activity', { p_device_id: id, p_platform: platformName() });
  if (error) return;
  try {
    await AsyncStorage.setItem(LAST_KEY, day);
  } catch {
    // 다음에 또 보내도 서버가 걸러 준다
  }
}
