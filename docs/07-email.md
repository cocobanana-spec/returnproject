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

## 지금 할 것 — Gmail SMTP (무료, 도메인 불필요)

도메인을 사기 전까지의 답이다. **하루 약 500통**까지 보낼 수 있고, 보내는 서버가 Gmail
자신이라 SPF·DKIM이 저절로 맞아 스팸함으로 덜 빠진다. Resend·SendGrid 같은 서비스는
발신 도메인 인증을 요구하므로 도메인이 없으면 쓸 수 없다.

### 1. 앱 비밀번호 만들기

Gmail 계정 비밀번호를 그대로 넣으면 안 된다. 구글이 거부한다.

1. Google 계정 → 보안 → **2단계 인증**을 켠다. 켜야 다음 항목이 보인다.
2. 같은 화면에서 **앱 비밀번호**로 들어간다.
3. 이름은 아무거나(예: `ppurin-supabase`) 적고 만든다.
4. 공백 없이 붙은 **16자리**가 나온다. 이 화면을 닫으면 다시 볼 수 없다.

### 2. Supabase에 넣기

Authentication → Emails → **SMTP Settings** → Enable Custom SMTP.

| 칸 | 값 |
|---|---|
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | 보내는 Gmail 주소 |
| Password | 위에서 만든 16자리 앱 비밀번호 |
| Sender email | 같은 Gmail 주소 |
| Sender name | `뿌린대로거두리라` |

> Sender email 은 Username 과 **같아야 한다.** 다른 주소를 적으면 Gmail 이 바꿔 버리거나
> 거부한다.

### 3. 발송 제한 올리기

커스텀 SMTP 를 켜도 Supabase 쪽 제한은 따로 남는다. Authentication → **Rate Limits** →
"Rate limit for sending emails" 를 시간당 100 정도로 올린다. Gmail 의 하루 500통 안에서
움직이도록 잡는 것이 안전하다.

### 4. 확인

**실제로 가입해 본다.** 설정 화면이 저장됐다는 것만으로는 아무것도 증명되지 않는다.
모르는 메일 주소로 가입해 확인 메일이 오는지, 링크를 눌렀을 때 앱이나 웹으로 돌아오는지 본다.
스팸함도 본다.

## 나중에 — 도메인을 사면 Resend 로

도메인이 생기면 `noreply@<도메인>` 으로 보내는 편이 낫다. 개인 Gmail 주소가 발신자로 찍히지
않고, 하루 한도도 훨씬 크다. Resend 무료 구간이 하루 100통·월 3,000통이라 초기에는 충분하다.
웹 주소 변경과 같이 하면 된다(`checklist.md` 의 "웹 주소 바꾸기").

## 메일 본문 (한국어)

Supabase 기본 템플릿은 영문이다. Authentication → Emails → 각 템플릿에서 아래로 바꾼다.
`{{ .ConfirmationURL }}` 은 Supabase 가 채우는 자리다. **철자를 바꾸면 링크가 사라진다.**

### Confirm signup — 제목

```
뿌린대로거두리라 가입을 확인해 주세요
```

### Confirm signup — 본문

```html
<h2>가입을 확인해 주세요</h2>
<p>아래 버튼을 누르면 가입이 끝나고 바로 장부를 쓸 수 있습니다.</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:12px 22px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:700">
    가입 확인하기
  </a>
</p>
<p style="color:#666;font-size:14px">
  버튼이 눌리지 않으면 아래 주소를 브라우저에 붙여 넣으세요.<br>
  {{ .ConfirmationURL }}
</p>
<p style="color:#666;font-size:14px">
  본인이 가입한 적이 없다면 이 메일을 지우시면 됩니다. 아무 일도 일어나지 않습니다.
</p>
<p style="color:#999;font-size:13px">뿌린대로거두리라 · 경조사로 주고받은 마음을 사람 단위로</p>
```

### Reset password — 제목

```
뿌린대로거두리라 비밀번호 재설정
```

### Reset password — 본문

```html
<h2>비밀번호를 새로 정하세요</h2>
<p>아래 버튼을 누르면 새 비밀번호를 입력하는 화면이 열립니다.</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:12px 22px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:700">
    비밀번호 재설정하기
  </a>
</p>
<p style="color:#666;font-size:14px">
  버튼이 눌리지 않으면 아래 주소를 브라우저에 붙여 넣으세요.<br>
  {{ .ConfirmationURL }}
</p>
<p style="color:#666;font-size:14px">
  본인이 요청한 적이 없다면 이 메일을 지우시면 됩니다. <strong>비밀번호는 그대로입니다.</strong>
</p>
<p style="color:#999;font-size:13px">뿌린대로거두리라 · 경조사로 주고받은 마음을 사람 단위로</p>
```

## 걸리는 것

| 증상 | 원인 |
|---|---|
| `over_email_send_rate_limit` | 커스텀 SMTP 가 아직 꺼져 있거나 Rate Limits 를 안 올렸다 |
| Gmail 이 인증 거부 | 계정 비밀번호를 넣었다. 앱 비밀번호여야 한다 |
| 메일은 가는데 링크가 열리지 않음 | Redirect URLs 에 그 주소가 없다. `checklist.md` 의 복귀 주소 6종을 확인한다 |
| 스팸함으로 감 | 발신 주소와 SMTP 계정이 다르면 그렇다. 둘을 같게 맞춘다 |
