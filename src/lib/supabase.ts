// 앱·웹에서 쓰는 Supabase 클라이언트. 세션은 AsyncStorage에 보관하고 supabase-js가 알아서 갱신한다
//
// **웹에서도 AsyncStorage를 그대로 쓴다.** 이 패키지는 웹용 구현(lib/module/AsyncStorage.js)이
// localStorage 를 감싼 것이고, 네이티브 구현은 AsyncStorage.native.js 로 따로 있어 번들러가
// 플랫폼에 맞게 고른다. 그래서 저장소 때문에 분기할 필요가 없다.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDb, setDb } from './supabaseClient.ts';
import { env } from './env.ts';
import { isWeb } from './platform.ts';

export const supabase = createDb(env.supabaseUrl, env.supabaseAnonKey, AsyncStorage, {
  // 웹은 OAuth·메일 링크가 주소창으로 돌아온다. supabase-js 가 코드를 읽어 교환하게 둔다.
  detectSessionInUrl: isWeb,
});

// 리포지토리가 db()로 꺼내 쓸 수 있도록 등록한다.
setDb(supabase);

export { SERVER_MAX_ROWS } from './supabaseClient.ts';
