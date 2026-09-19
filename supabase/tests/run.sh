#!/usr/bin/env bash
# 로컬 Postgres에 auth 스텁 + 0001_init.sql + RLS 검증을 순서대로 적용하는 러너
# Docker가 없는 환경에서 마이그레이션을 수정 없이 그대로 실행 검증하기 위한 것이다.
# 사용법: supabase/tests/run.sh [--keep]   (--keep이면 검증 후에도 서버를 띄워 둔다)

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

PGBIN="${PGBIN:-$(brew --prefix postgresql@17 2>/dev/null || echo /usr/local)/bin}"
PGDATA="${PPURIN_PGDATA:-${TMPDIR:-/tmp}/ppurin-pgdata}"
PGPORT="${PPURIN_PGPORT:-55432}"
PGSOCK="$PGDATA/sock"
DBNAME=ppurin_test
KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1

for bin in initdb pg_ctl psql createdb dropdb; do
  [ -x "$PGBIN/$bin" ] || { echo "postgres 바이너리를 찾을 수 없다: $PGBIN/$bin"; exit 1; }
done

export PGHOST="$PGSOCK" PGPORT PGUSER=postgres

started_here=0
stop_server() {
  if [ "$started_here" = 1 ] && [ "$KEEP" = 0 ]; then
    "$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
}
trap stop_server EXIT

if [ ! -d "$PGDATA/base" ]; then
  echo "== 테스트 클러스터 생성 ($PGDATA)"
  rm -rf "$PGDATA"
  mkdir -p "$PGDATA"
  LC_ALL=en_US.UTF-8 "$PGBIN/initdb" -D "$PGDATA" -U postgres -E UTF8 \
    --locale=en_US.UTF-8 >/dev/null
fi
mkdir -p "$PGSOCK"

if ! "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
  echo "== 서버 기동 (port $PGPORT)"
  "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/server.log" \
    -o "-p $PGPORT -k $PGSOCK -c listen_addresses=localhost" start >/dev/null
  started_here=1
  for _ in $(seq 1 30); do
    "$PGBIN/pg_isready" -q && break
    sleep 0.3
  done
fi

echo "== 데이터베이스 재생성"
"$PGBIN/dropdb" --if-exists "$DBNAME" >/dev/null
"$PGBIN/createdb" "$DBNAME" >/dev/null

run() {
  "$PGBIN/psql" -v ON_ERROR_STOP=1 -q -X -d "$DBNAME" -f "$1"
}

echo "== 1/3 auth 스텁"
run "$HERE/00_auth_stub.sql"

echo "== 2/3 마이그레이션 0001_init.sql (수정 없이 그대로)"
run "$ROOT/supabase/migrations/0001_init.sql"

echo "== 3/3 RLS 교차 검증"
if run "$HERE/01_rls_test.sql"; then
  echo ""
  echo "== 전부 통과"
  rc=0
else
  rc=$?
  echo ""
  echo "== 검증 실패 (psql exit=$rc)"
fi

if [ "$KEEP" = 1 ]; then
  echo "== 서버를 유지한다: postgresql://postgres@localhost:$PGPORT/$DBNAME (소켓 $PGSOCK)"
  echo "   내리려면: $PGBIN/pg_ctl -D $PGDATA -m fast stop"
fi

exit $rc
