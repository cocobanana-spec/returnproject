# 메일 발송 (가입 확인 · 비밀번호 재설정)

## 왜 바꿔야 하나

Supabase 내장 메일 발송은 **시간당 몇 건**으로 제한된다. 이 제한은 메일이 늦게 가는 정도가
아니다. **가입 API 자체가 429로 거부되어 신규 가입이 통째로 막힌다**(2026-09-24 실측).

```
{"status":429,"code":"over_email_send_rate_limit","message":"email rate limit exceeded"}
```

소셜 로그인(Apple·Google)은 메일을 보내지 않으므로 영향이 없다. **막히는 것은 메일 가입과
비밀번호 재설정뿐이다.** 앱이 실제로 메일을 보내는 곳은 두 군데다.

| 무엇 | 코드 | Supabase 템플릿 |
|---|---|---|
| 가입 확인 | `signUpWithEmail` (`src/auth/email.ts`) | Confirm signup |
| 비밀번호 재설정 | `resetPasswordForEmail` (같은 파일) | Reset password |

## 지금 할 것 — Resend 로 `noreply@ppurin.com` 에서 보낸다 (2026-10-04 개정)

> 처음 쓴 판은 "도메인이 없으니 Gmail SMTP" 였다. 사장님 개인 Gmail 주소가 발신자로 찍히는
> 방식이라 사장님이 되물었다. 그 사이 `ppurin.com` 을 샀으므로 우리 주소로 보낸다.

| | Gmail SMTP (옛 안) | **Resend + ppurin.com** |
|---|---|---|
| 발신자 | 개인 Gmail 주소가 그대로 보임 | `noreply@ppurin.com` |
| 무료 한도 | 하루 500통 | 하루 100통 · 월 3,000통 (유료 월 20달러부터 5만 통) |
| 준비 | 앱 비밀번호 | 가입 + DNS 레코드 3개 (Cloudflare 에 붙여 넣기) |
| 스팸 평판 | 구글 서버라 좋음 | 도메인 인증(SPF·DKIM)이 되므로 좋음 |

하루 100통은 초기에 충분하다. 넘길 즈음이면 유료로 올릴 이유가 생긴 것이다.

### 1. Resend 가입과 도메인 등록 (사장님, 5분)
1. `resend.com` 가입. 무료다.
2. Domains → Add Domain → `ppurin.com` 입력. 지역은 아무거나(메일 발송 서버 위치일 뿐이다).
3. DNS 레코드 3개가 나온다. **DKIM(TXT) 1개, SPF 용 MX·TXT** 형태다. 이 화면을 열어 둔다.

### 2. Cloudflare 에 레코드 넣기 (사장님, 5분)
Cloudflare → `ppurin.com` → DNS → Records → Add record. Resend 가 보여 준 레코드를 **이름·종류·값 그대로** 셋 다 넣는다.
- 이름 칸은 Resend 가 `resend._domainkey` 처럼 짧게 보여 주면 그대로, `resend._domainkey.ppurin.com` 처럼 길게 보여 주면 `ppurin.com` 을 뺀 앞부분만 넣는다. Cloudflare 가 뒤를 붙인다.
- **Proxy 상태는 "DNS only"(회색 구름)** 로 둔다. 주황 구름이면 메일 인증이 안 된다.
- 다 넣고 Resend 화면에서 Verify 를 누른다. 몇 분 안에 Verified 가 된다.

### 3. API 키 (사장님, 1분)
Resend → API Keys → Create. 권한은 Sending access 면 된다. **키는 한 번만 보인다.** 복사해 둔다.

### 4. Supabase 에 넣기 (사장님, 2분)
Authentication → Emails → **SMTP Settings** → Enable Custom SMTP.

| 칸 | 값 |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` (글자 그대로) |
| Password | 3 에서 만든 API 키 |
| Sender email | `noreply@ppurin.com` |
| Sender name | `뿌린대로거두리라` |

### 5. 발송 제한 올리기 (사장님, 1분)
커스텀 SMTP 를 켜도 Supabase 쪽 제한은 따로 남는다. Authentication → **Rate Limits** →
"Rate limit for sending emails" 를 시간당 **30** 으로 올린다. Resend 무료 한도(하루 100)를
한 시간에 다 쓰지 않도록 잡은 값이다. 유료로 올리면 같이 올린다.

### 6. 확인 (나)
**실제로 가입해 본다.** 설정 화면이 저장됐다는 것만으로는 아무것도 증명되지 않는다.
모르는 메일 주소로 가입해 확인 메일이 오는지, 발신자가 `noreply@ppurin.com` 인지, 링크를 눌렀을 때
앱이나 웹으로 돌아오는지, 스팸함으로 가지 않는지 본다.

### 덤 — 받는 메일도 `@ppurin.com` 으로
Cloudflare 의 Email Routing(무료)을 켜면 `support@ppurin.com` 으로 온 메일을 사장님 Gmail 로
넘겨 준다. 랜딩·처리방침의 문의 주소를 개인 Gmail 대신 이것으로 바꿀 수 있다. 메일 발송과는
별개이니 나중에 해도 된다.

## 메일 본문 (한국어 + 영어, 2026-10-04 개정)

Supabase 기본 템플릿은 영문이다. Authentication → Emails → 각 템플릿 → **Source** 탭에 아래를 붙여 넣는다.
`{{ .ConfirmationURL }}` 은 Supabase 가 채우는 자리다. **철자를 바꾸면 링크가 사라진다.**

한 메일에 한국어를 먼저, 영어를 아래에 둔다. 사용자별로 언어를 가르는 것은 다국어 작업 때
한다 — 앱이 가입할 때 `user_metadata.lang` 을 보내면 템플릿에서 `{{ if eq .Data.lang "en" }}` 으로
가를 수 있다(Supabase 템플릿은 Go 템플릿이고 `.Data` 가 사용자 메타데이터다).

### Confirm signup — 제목

```
뿌린대로거두리라 가입을 확인해 주세요 · Confirm your email
```

### Confirm signup — 본문

```html
<div style="font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#111;line-height:1.6">
  <h2 style="margin:0 0 8px">가입을 확인해 주세요</h2>
  <p>아래 버튼을 누르면 가입이 끝나고 바로 장부를 쓸 수 있습니다.</p>
  <p style="margin:20px 0">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;padding:12px 22px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:700">
      가입 확인하기 · Confirm email
    </a>
  </p>
  <p style="color:#666;font-size:14px">
    버튼이 눌리지 않으면 아래 주소를 브라우저에 붙여 넣으세요.<br>
    {{ .ConfirmationURL }}
  </p>
  <p style="color:#666;font-size:14px">
    본인이 가입한 적이 없다면 이 메일을 지우시면 됩니다. 아무 일도 일어나지 않습니다.
  </p>
  <hr style="border:0;border-top:1px solid #e6e6e6;margin:24px 0">
  <h3 style="margin:0 0 6px;color:#444">Confirm your email</h3>
  <p style="color:#444">Tap the button above to finish signing up. If the button does not work, paste the link above into your browser.</p>
  <p style="color:#666;font-size:14px">If you did not sign up, you can ignore this email. Nothing will happen.</p>
  <p style="color:#999;font-size:13px;margin-top:24px">뿌린대로거두리라 · 경조사로 주고받은 마음을 사람 단위로</p>
</div>
```

### Reset password — 제목

```
뿌린대로거두리라 비밀번호 재설정 · Reset your password
```

### Reset password — 본문

```html
<div style="font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#111;line-height:1.6">
  <h2 style="margin:0 0 8px">비밀번호를 새로 정하세요</h2>
  <p>아래 버튼을 누르면 새 비밀번호를 입력하는 화면이 열립니다.</p>
  <p style="margin:20px 0">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;padding:12px 22px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:700">
      비밀번호 재설정하기 · Reset password
    </a>
  </p>
  <p style="color:#666;font-size:14px">
    버튼이 눌리지 않으면 아래 주소를 브라우저에 붙여 넣으세요.<br>
    {{ .ConfirmationURL }}
  </p>
  <p style="color:#666;font-size:14px">
    본인이 요청한 적이 없다면 이 메일을 지우시면 됩니다. <strong>비밀번호는 그대로입니다.</strong>
  </p>
  <hr style="border:0;border-top:1px solid #e6e6e6;margin:24px 0">
  <h3 style="margin:0 0 6px;color:#444">Reset your password</h3>
  <p style="color:#444">Tap the button above to choose a new password. If the button does not work, paste the link above into your browser.</p>
  <p style="color:#666;font-size:14px">If you did not request this, ignore this email. <strong>Your password stays the same.</strong></p>
  <p style="color:#999;font-size:13px;margin-top:24px">뿌린대로거두리라 · 경조사로 주고받은 마음을 사람 단위로</p>
</div>
```

## 걸리는 것

| 증상 | 원인 |
|---|---|
| `over_email_send_rate_limit` | 커스텀 SMTP 가 아직 꺼져 있거나 Rate Limits 를 안 올렸다 |
| Resend 가 Domain not verified | DNS 레코드가 덜 들어갔거나 주황 구름(프록시)으로 넣었다 |
| Supabase 가 SMTP 인증 거부 | Username 이 `resend` 가 아니거나 API 키가 틀렸다 |
| 메일은 가는데 링크가 열리지 않음 | Redirect URLs 에 그 주소가 없다. `checklist.md` 의 복귀 주소 6종을 확인한다 |
| 스팸함으로 감 | 도메인 Verify 전에 보냈다. Verified 뒤 다시 본다 |
