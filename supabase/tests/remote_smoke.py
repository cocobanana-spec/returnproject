# 실제 Supabase 프로젝트에서 스키마·RLS·RPC·Edge Function이 도는지 확인하는 스모크 검증
#
# 로컬 검증(run.sh)은 auth 스텁 위에서 돌기 때문에 호스티드 환경의 권한·확장·로케일 차이를 잡지 못한다.
# 이 스크립트는 진짜 계정을 만들어 REST·RPC·Edge Function을 호출하고, 끝나면 만든 것을 전부 지운다.
# 테스트 계정 생성·삭제에 service role 키가 필요하므로 환경변수로 받는다. 저장소에 키를 두지 않는다.
#
# 사용법
#   export SUPABASE_URL=https://<ref>.supabase.co
#   export SUPABASE_ANON_KEY=...
#   export SUPABASE_SERVICE_ROLE_KEY=...      # supabase projects api-keys --project-ref <ref>
#   python3 supabase/tests/remote_smoke.py

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
ANON = os.environ.get("SUPABASE_ANON_KEY", "")
SVC = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
PW = "Ppurin-Smoke-2026!"

if not (URL and ANON and SVC):
    sys.exit("SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY 를 모두 설정해야 한다.")

ok = fail = 0


def check(name, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  PASS  {name}")
    else:
        fail += 1
        print(f"  FAIL  {name}  {detail}")


def req(method, path, token, body=None, extra=None):
    headers = {"apikey": ANON, "Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if extra:
        headers.update(extra)
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(URL + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=40) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def make_user(email):
    st, body = req("POST", "/auth/v1/admin/users", SVC,
                   {"email": email, "password": PW, "email_confirm": True,
                    "user_metadata": {"name": email.split("@")[0]}})
    assert st in (200, 201), (st, body)
    return body["id"]


def sign_in(email):
    st, body = req("POST", "/auth/v1/token?grant_type=password", ANON, {"email": email, "password": PW})
    assert st == 200, (st, body)
    return body["access_token"]


def my_ledger(token, uid):
    st, rows = req("GET", f"/rest/v1/ledger_members?select=ledger_id&user_id=eq.{uid}", token)
    assert st == 200 and rows, (st, rows)
    return rows[0]["ledger_id"]


tag = uuid.uuid4().hex[:8]
created = []

try:
    print("== 0. 익명 역할 차단")
    for table in ("ledgers", "ledger_members", "people", "events", "entries"):
        st, body = req("GET", f"/rest/v1/{table}?select=*", ANON)
        check(f"anon은 {table}를 읽을 수 없다", st >= 400, f"{st} {body}")

    print("== 1. 첫 로그인에 개인 장부가 생긴다")
    ea = f"smoke-a-{tag}@ppurin-test.kr"
    ua = make_user(ea)
    created.append(ua)
    ta = sign_in(ea)
    st, rows = req("GET", f"/rest/v1/ledger_members?select=ledger_id,role,display_name&user_id=eq.{ua}", ta)
    check("구성원 1행 자동 생성", st == 200 and len(rows) == 1, f"{st} {rows}")
    check("역할이 owner", bool(rows) and rows[0]["role"] == "owner", str(rows))
    la = rows[0]["ledger_id"]

    print("== 2. 초대 코드 발급 (pgcrypto 경로)")
    st, code = req("POST", "/rest/v1/rpc/create_invite_code", ta, {"p_ledger_id": la})
    check("create_invite_code 성공", st == 200 and isinstance(code, str) and len(code) == 8, f"{st} {code}")
    check("혼동 문자 0/O/1/I 없음", isinstance(code, str) and not set(code) & set("0O1I"), str(code))

    print("== 3. 한글 이름 정규화 (로케일)")
    st, person = req("POST", "/rest/v1/people", ta,
                     {"ledger_id": la, "name": " 김 철수 ", "relation_group": "friend"},
                     {"Prefer": "return=representation"})
    check("사람 생성 성공", st in (200, 201) and person, f"{st} {person}")
    normalized = person[0]["name_normalized"] if person else None
    check("공백을 뺀 '김철수'로 정규화", normalized == "김철수", f"실제값 {normalized!r}")

    print("== 4. 장부 격리와 합류")
    eb = f"smoke-b-{tag}@ppurin-test.kr"
    ub = make_user(eb)
    created.append(ub)
    tb = sign_in(eb)
    st, rows = req("GET", "/rest/v1/people?select=id", tb)
    check("합류 전에는 남의 사람이 보이지 않는다", st == 200 and rows == [], f"{st} {rows}")
    st, rows = req("PATCH", f"/rest/v1/people?id=eq.{person[0]['id']}", tb, {"name": "탈취"},
                   {"Prefer": "return=representation"})
    check("교차 수정은 0건 처리된다", st in (200, 204) and not rows, f"{st} {rows}")
    st, joined = req("POST", "/rest/v1/rpc/join_ledger", tb, {"p_code": code})
    check("초대 코드로 합류", st == 200 and joined == la, f"{st} {joined}")
    st, rows = req("GET", f"/rest/v1/ledger_members?select=ledger_id,role&user_id=eq.{ub}", tb)
    check("빈 개인 장부가 정리되어 1권", st == 200 and len(rows) == 1 and rows[0]["ledger_id"] == la, f"{st} {rows}")
    st, again = req("POST", "/rest/v1/rpc/join_ledger", tb, {"p_code": code})
    check("소비된 코드는 재사용 불가", st >= 400, f"{st} {again}")

    print("== 5. 구성원 제거 규칙")
    st, body = req("POST", "/rest/v1/rpc/remove_member", tb, {"p_ledger_id": la, "p_user_id": ua})
    check("member는 남을 제거할 수 없다", st >= 400, f"{st} {body}")
    st, body = req("POST", "/rest/v1/rpc/remove_member", tb, {"p_ledger_id": la, "p_user_id": ub})
    check("구성원이 둘이면 탈퇴할 수 있다", st in (200, 204), f"{st} {body}")
    st, body = req("POST", "/rest/v1/rpc/remove_member", ta, {"p_ledger_id": la, "p_user_id": ua})
    check("마지막 구성원은 탈퇴할 수 없다", st >= 400, f"{st} {body}")

    print("== 6. Edge Function delete-account — 혼자 쓰던 장부")
    st, body = req("POST", "/functions/v1/delete-account", ta)
    check("함수가 200을 돌려준다", st == 200 and body == {"ok": True}, f"{st} {body}")
    st, _ = req("GET", f"/auth/v1/admin/users/{ua}", SVC)
    check("계정이 삭제된다", st == 404, str(st))
    if st == 404:
        created.remove(ua)
    st, rows = req("GET", f"/rest/v1/ledgers?select=id&id=eq.{la}", SVC)
    check("혼자 쓰던 장부도 사라진다", st == 200 and rows == [], f"{st} {rows}")

    print("== 7. 앱 밖에서 계정이 지워져도 고아 장부가 남지 않는다")
    ec = f"smoke-c-{tag}@ppurin-test.kr"
    uc = make_user(ec)
    created.append(uc)
    tc = sign_in(ec)
    lc = my_ledger(tc, uc)
    req("POST", "/rest/v1/people", tc, {"ledger_id": lc, "name": "고아가될사람"})
    st, _ = req("DELETE", f"/auth/v1/admin/users/{uc}", SVC)
    created.remove(uc)
    st, rows = req("GET", f"/rest/v1/ledgers?select=id&id=eq.{lc}", SVC)
    check("구성원이 사라진 장부는 삭제된다", st == 200 and rows == [], f"{st} {rows}")
    st, rows = req("GET", "/rest/v1/people?select=name&name=eq." + urllib.parse.quote("고아가될사람"), SVC)
    check("그 장부의 사람도 남지 않는다", st == 200 and rows == [], f"{st} {rows}")

    print("== 8. 공유 장부의 owner가 앱 밖에서 지워지면 승계된다")
    ed = f"smoke-d-{tag}@ppurin-test.kr"
    ee = f"smoke-e-{tag}@ppurin-test.kr"
    ud, ue = make_user(ed), make_user(ee)
    created += [ud, ue]
    td, te = sign_in(ed), sign_in(ee)
    ld = my_ledger(td, ud)
    st, code2 = req("POST", "/rest/v1/rpc/create_invite_code", td, {"p_ledger_id": ld})
    req("POST", "/rest/v1/rpc/join_ledger", te, {"p_code": code2})
    req("POST", "/rest/v1/people", td, {"ledger_id": ld, "name": "남아야하는사람"})
    st, _ = req("DELETE", f"/auth/v1/admin/users/{ud}", SVC)
    created.remove(ud)
    st, rows = req("GET", f"/rest/v1/ledgers?select=id&id=eq.{ld}", te)
    check("공유 장부는 남는다", st == 200 and len(rows) == 1, f"{st} {rows}")
    st, rows = req("GET", f"/rest/v1/ledger_members?select=user_id,role&ledger_id=eq.{ld}", te)
    check("남은 구성원이 owner를 승계한다", st == 200 and len(rows) == 1 and rows[0]["role"] == "owner", f"{st} {rows}")
    st, code3 = req("POST", "/rest/v1/rpc/create_invite_code", te, {"p_ledger_id": ld})
    check("승계된 owner가 초대 코드를 낼 수 있다", st == 200 and isinstance(code3, str), f"{st} {code3}")

    print("== 9. 데이터 RPC의 장부 가드 (마이그레이션 0003)")
    # 두 장부에 동시에 속한 사용자가 현재 장부 밖의 행을 건드리지 못해야 한다.
    # RLS는 두 장부를 모두 허용하므로 정책이 아니라 함수 안의 검사가 막는다.
    ef = f"smoke-f-{tag}@ppurin-test.kr"
    uf = make_user(ef)
    created.append(uf)
    tf = sign_in(ef)
    lf = my_ledger(tf, uf)
    st, own = req("POST", "/rest/v1/people", tf, {"ledger_id": lf, "name": "내장부사람"},
                  {"Prefer": "return=representation"})
    check("자기 장부에 사람을 만든다", st in (200, 201) and own, f"{st} {own}")
    st, code4 = req("POST", "/rest/v1/rpc/create_invite_code", te, {"p_ledger_id": ld})
    req("POST", "/rest/v1/rpc/join_ledger", tf, {"p_code": code4})
    st, rows = req("GET", f"/rest/v1/ledger_members?select=ledger_id&user_id=eq.{uf}", tf)
    check("두 장부의 구성원이 된다", st == 200 and len(rows) == 2, f"{st} {rows}")
    st, body = req("POST", "/rest/v1/rpc/delete_person", tf,
                   {"p_ledger_id": ld, "p_id": own[0]["id"]})
    check("현재 장부 밖의 사람은 지워지지 않는다", st >= 400 and "wrong_ledger" in str(body), f"{st} {body}")
    st, rows = req("GET", f"/rest/v1/people?select=id&id=eq.{own[0]['id']}", tf)
    check("그 사람은 그대로 남는다", st == 200 and len(rows) == 1, f"{st} {rows}")
    st, rows = req("POST", "/rest/v1/rpc/event_summary", tf, {"p_ledger_id": ld, "p_event_id": own[0]["id"]})
    check("현재 장부 밖의 집계는 빈 결과다", st == 200 and rows == [], f"{st} {rows}")

finally:
    print("== 정리")
    for user_id in created:
        st, _ = req("DELETE", f"/auth/v1/admin/users/{user_id}", SVC)
        print(f"  테스트 계정 삭제 {user_id[:8]} → {st}")
    st, rows = req("GET", "/rest/v1/ledgers?select=id", SVC)
    print(f"  남은 장부 {len(rows) if isinstance(rows, list) else rows}권")

print(f"\n요약  통과 {ok} · 실패 {fail}")
sys.exit(1 if fail else 0)
