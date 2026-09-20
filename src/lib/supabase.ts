// 앱에서 쓰는 Supabase 클라이언트. 세션은 AsyncStorage에 보관하고 supabase-js가 알아서 갱신한다
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDb, setDb } from './supabaseClient.ts';
import { env } from './env.ts';

export const supabase = createDb(env.supabaseUrl, env.supabaseAnonKey, AsyncStorage);

// 리포지토리가 db()로 꺼내 쓸 수 있도록 등록한다.
setDb(supabase);

export { SERVER_MAX_ROWS } from './supabaseClient.ts';
