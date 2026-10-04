// 관리자 통계(S21) — 총 회원, 활성 사용자, 플랫폼별 설치(첫 실행), 최근 30일 접속 추이
//
// 보여 주기만 한다. 숫자는 서버의 admin_stats() 가 만들고, 관리자가 아니면 서버가 거부한다(0011).
// "다운로드 수"는 App Store 의 숫자라 여기에는 없다. 첫 실행 기기 수를 설치 추정치로 보여 주고
// 그렇게 적는다.
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { db } from '../../src/lib/supabaseClient.ts';
import { useTokens } from '../../src/theme/tokens';
import { LoadFailed } from '../../src/ui/LoadFailed';
import { Screen } from '../../src/ui/Screen';

type Tri = { today: number; week: number; month: number };
type Stats = {
  as_of: string;
  users_total: number;
  active: Tri;
  active_by_platform: Record<string, Tri>;
  installs_by_platform: Record<string, Tri & { total: number }>;
  daily_active: { day: string; users: number }[];
  content: { ledgers: number; entries: number; published_invitations: number };
};

const PLATFORM_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android', web: '웹' };

async function fetchStats(): Promise<Stats> {
  const { data, error } = await db().rpc('admin_stats');
  if (error) throw new Error(error.message.includes('not_admin') ? '관리자만 볼 수 있습니다.' : error.message);
  return data as unknown as Stats;
}

export default function AdminScreen() {
  const { colors, space, font, radius } = useTokens();
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: fetchStats, staleTime: 60_000 });

  if (stats.isError) {
    return (
      <Screen>
        <LoadFailed title={(stats.error as Error).message} onRetry={() => void stats.refetch()} />
      </Screen>
    );
  }
  if (!stats.data) {
    return (
      <Screen>
        <Text style={{ color: colors.textMuted, fontSize: font.body }}>불러오는 중…</Text>
      </Screen>
    );
  }
  const s = stats.data;
  const platforms = ['ios', 'android', 'web'];
  const maxDaily = Math.max(1, ...s.daily_active.map((d) => d.users));

  return (
    <Screen scroll>
      <View style={{ gap: space.lg, paddingBottom: space.xxl }}>
        <View>
          <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>관리자</Text>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{s.as_of} 기준 · 한국 시간</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Tile label="총 회원" value={s.users_total} />
          <Tile label="오늘 활성" value={s.active.today} accent />
        </View>

        <Card title="접속자 (로그인한 사용자, 중복 없음)">
          <Row cells={['', '오늘', '7일', '30일']} head />
          <Row cells={['전체', s.active.today, s.active.week, s.active.month]} />
          {platforms.map((p) => {
            const t = s.active_by_platform[p];
            return <Row key={p} cells={[PLATFORM_LABEL[p] ?? p, t?.today ?? 0, t?.week ?? 0, t?.month ?? 0]} muted />;
          })}
        </Card>

        <Card title="설치 — 첫 실행 기기 수 (추정)">
          <Row cells={['', '오늘', '7일', '30일', '누적']} head />
          {platforms.map((p) => {
            const t = s.installs_by_platform[p];
            return <Row key={p} cells={[PLATFORM_LABEL[p] ?? p, t?.today ?? 0, t?.week ?? 0, t?.month ?? 0, t?.total ?? 0]} />;
          })}
          <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: space.sm, lineHeight: 18 }}>
            처음 실행한 기기를 셉니다. 실제 다운로드 수는 App Store Connect · Google Play Console 의 숫자가 정확합니다.
          </Text>
        </Card>

        <Card title="최근 30일 일별 접속자">
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 80 }}>
            {s.daily_active.map((d) => (
              <View
                key={d.day}
                accessibilityLabel={`${d.day} ${d.users}명`}
                style={{
                  flex: 1,
                  height: Math.max(2, Math.round((d.users / maxDaily) * 80)),
                  backgroundColor: d.day === s.as_of ? colors.accent : colors.border,
                  borderRadius: 2,
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs }}>
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{s.daily_active[0]?.day.slice(5)}</Text>
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>최대 {maxDaily}명</Text>
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{s.as_of.slice(5)}</Text>
          </View>
        </Card>

        <Card title="콘텐츠">
          <Row cells={['장부', s.content.ledgers]} />
          <Row cells={['기록', s.content.entries]} />
          <Row cells={['공개 중인 초대장', s.content.published_invitations]} />
        </Card>

        <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 18 }}>
          접속은 앱을 연 날짜·플랫폼만 남깁니다. 어디서 열었는지, 무엇을 눌렀는지는 기록하지 않습니다.
        </Text>
      </View>
    </Screen>
  );

  function Tile({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgSubtle, borderRadius: radius.lg, padding: space.lg }}>
        <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{label}</Text>
        <Text style={{ color: accent ? colors.given : colors.text, fontSize: font.display, fontWeight: '700' }}>
          {value.toLocaleString('ko-KR')}
        </Text>
      </View>
    );
  }

  function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <View style={{ backgroundColor: colors.bgSubtle, borderRadius: radius.lg, padding: space.lg, gap: space.xs }}>
        <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700', marginBottom: space.xs }}>{title}</Text>
        {children}
      </View>
    );
  }

  function Row({ cells, head = false, muted = false }: { cells: (string | number)[]; head?: boolean; muted?: boolean }) {
    return (
      <View style={{ flexDirection: 'row', paddingVertical: 4 }}>
        {cells.map((c, i) => (
          <Text
            key={i}
            style={{
              flex: i === 0 ? 1.4 : 1,
              textAlign: i === 0 ? 'left' : 'right',
              color: head || muted ? colors.textMuted : colors.text,
              fontSize: head ? font.caption : font.body,
              fontVariant: ['tabular-nums'],
            }}
          >
            {typeof c === 'number' ? c.toLocaleString('ko-KR') : c}
          </Text>
        ))}
      </View>
    );
  }
}
