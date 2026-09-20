// EXPO_PUBLIC_* 환경 값을 한 곳에서 읽고 없으면 바로 터뜨린다. 빌드 시 인라인되므로 런타임 변경은 없다
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL 과 EXPO_PUBLIC_SUPABASE_ANON_KEY 가 필요하다. .env.example 을 보고 .env.local 을 만들어라.',
  );
}

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
} as const;
