// Apple 로그인용 client secret(JWT)을 만든다 — Supabase의 Apple 프로바이더 Secret Key 칸에 넣는 값
//
// 애플은 OAuth client secret으로 고정 문자열이 아니라 서명된 JWT를 요구한다.
// Supabase 대시보드에는 Team ID·Key ID 칸이 없으므로 이 토큰을 직접 만들어 넣어야 한다.
// 유효기간은 최대 6개월이고 만료되면 웹 경로 로그인이 막히므로 그때 이 도구를 다시 돌린다.
//
// 사용법
//   node tools/apple-client-secret.mjs \
//     --team-id ABCDE12345 \
//     --key-id FGHIJ67890 \
//     --services-id com.cocobanana.ppurin.web \
//     --key ~/Downloads/AuthKey_FGHIJ67890.p8
//
// .p8 파일은 이 컴퓨터 밖으로 나가지 않는다. 출력된 토큰만 Supabase 대시보드에 붙여 넣는다.
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

const teamId = arg('team-id');
const keyId = arg('key-id');
const servicesId = arg('services-id');
const keyPathRaw = arg('key');
// 만료까지의 개월 수. 애플 상한은 6개월이다.
const months = Number(arg('months') ?? 6);

if (!teamId || !keyId || !servicesId || !keyPathRaw) {
  console.error('필요한 값이 빠졌다. --team-id --key-id --services-id --key 를 모두 넘겨라.');
  process.exit(1);
}
if (months < 1 || months > 6) {
  console.error('--months 는 1에서 6 사이여야 한다. 애플 상한이 6개월이다.');
  process.exit(1);
}

const keyPath = keyPathRaw.startsWith('~') ? keyPathRaw.replace('~', homedir()) : keyPathRaw;

let pem;
try {
  pem = readFileSync(keyPath, 'utf8');
} catch {
  console.error(`키 파일을 읽을 수 없다: ${keyPath}`);
  process.exit(1);
}
if (!pem.includes('BEGIN PRIVATE KEY')) {
  console.error('키 파일이 PKCS#8 PEM(-----BEGIN PRIVATE KEY-----)이 아니다. 애플에서 받은 .p8 원본인지 확인하라.');
  process.exit(1);
}

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const now = Math.floor(Date.now() / 1000);
const exp = now + Math.round(months * 30 * 24 * 60 * 60);

const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
const payload = {
  iss: teamId,
  iat: now,
  exp,
  aud: 'https://appleid.apple.com',
  sub: servicesId,
};

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

// ES256의 JWS 서명은 DER가 아니라 R||S 원시 형식이어야 한다. dsaEncoding으로 지정한다.
const signature = sign('sha256', Buffer.from(signingInput), {
  key: createPrivateKey(pem),
  dsaEncoding: 'ieee-p1363',
});

const token = `${signingInput}.${b64url(signature)}`;

console.log(token);
console.error(`\n만료: ${new Date(exp * 1000).toISOString().slice(0, 10)} (약 ${months}개월 뒤)`);
console.error('위 한 줄을 Supabase → Authentication → Sign In / Providers → Apple 의 Secret Key 칸에 붙여 넣어라.');
