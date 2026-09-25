// 가져오기(S18) — 엑셀·CSV 파일로 준돈 기록이나 내 행사 명부를 한 번에 넣는다(docs/02 §3.14)
//
// 단계는 대상 → 파일 → 열 매핑 → 미리보기 → 저장 → 완료다. 파싱·매핑·상태 판정·저장 계획은
// 전부 도메인 순수 함수(importFile·importPlan·importAmount)가 하고, 저장은 import/runner가 한다.
// 파일은 기기 안에서만 읽는다. 서버로 가는 것은 사람·행사·기록 행뿐이다.
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import type { EventType } from '../../src/domain/constants.ts';
import {
  ENCODING_LABEL,
  base64ToBytes,
  detectEncoding,
  encodingMismatch,
  fileKindOf,
  readTable,
  type Encoding,
  type FileKind,
} from '../../src/domain/importFile.ts';
import {
  COLUMN_ROLE_LABEL,
  buildRows,
  canSave,
  eventTypeLabelOf,
  guessMapping,
  issueLabel,
  mappingErrors,
  markSameNames,
  planSave,
  rowStatus,
  summarize,
  trimTable,
  type ColumnRole,
  type ImportRow,
  type ImportTarget,
  type Mapping,
  type Table,
} from '../../src/domain/importPlan.ts';
import { formatWon, formatWonShort } from '../../src/domain/money.ts';
import { displayName } from '../../src/domain/person.ts';
import { formatEventDate, todayISO } from '../../src/domain/title.ts';
import { emptyImportState, runImport, type ImportState } from '../../src/import/runner.ts';
import { useLedgerId } from '../../src/ledger/LedgerProvider';
import { queryKeys } from '../../src/lib/queryKeys';
import { listEvents, type EventRow } from '../../src/repositories/events';
import { listPeopleByNormalizedNames, type PersonBalance } from '../../src/repositories/people';
import { useTokens } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { Chip } from '../../src/ui/Chip';
import { Field } from '../../src/ui/Field';
import { LoadFailed } from '../../src/ui/LoadFailed';
import { Screen } from '../../src/ui/Screen';

type Step = 'target' | 'file' | 'mapping' | 'preview' | 'saving' | 'done';

const ROLE_CHOICES: ColumnRole[] = ['ignore', 'name', 'amount', 'type', 'date', 'memo'];
const FILE_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/comma-separated-values',
  'public.comma-separated-values-text',
];

export default function ImportScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, space, font, radius } = useTokens();
  const params = useLocalSearchParams<{ target?: string; eventId?: string }>();

  const presetTarget = params.target === 'received' || params.target === 'given' ? params.target : null;
  const [target, setTarget] = useState<ImportTarget | null>(presetTarget);
  const [eventId, setEventId] = useState<string | null>(params.eventId ?? null);
  const [step, setStep] = useState<Step>(presetTarget && (presetTarget === 'given' || params.eventId) ? 'file' : 'target');

  const [fileName, setFileName] = useState('');
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [kind, setKind] = useState<FileKind>('xlsx');
  const [encoding, setEncoding] = useState<Encoding>('utf8');
  const [table, setTable] = useState<Table>([]);
  const [mapping, setMapping] = useState<Mapping>({ hasHeader: true, roles: [] });
  const [defaultDate, setDefaultDate] = useState(todayISO());
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [candidates, setCandidates] = useState<Map<string, PersonBalance[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // 중간 실패 뒤 이어서 재시도하려면 만든 것을 기억해야 한다(S02의 ref 패턴).
  const state = useRef<ImportState>(emptyImportState());

  // 명부 대상이면 내 행사를 고른다.
  const myEvents = useQuery({
    queryKey: queryKeys.events.list(ledgerId, { isMine: true, forImport: true }),
    queryFn: () => listEvents(ledgerId, { isMine: true }),
    enabled: target === 'received' && !eventId,
  });
  const chosenEvent = useQuery({
    queryKey: queryKeys.events.list(ledgerId, { isMine: true, forImport: true }),
    queryFn: () => listEvents(ledgerId, { isMine: true }),
    enabled: target === 'received' && Boolean(eventId),
    select: (page) => page.rows.find((e) => e.id === eventId) ?? null,
  });
  const eventType: EventType | null = (chosenEvent.data?.type as EventType | undefined) ?? null;

  // ---------------------------------------------------------------- 파일
  async function pickFile() {
    setError(null);
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: FILE_TYPES, copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      const k = fileKindOf(asset.name);
      if (!k) {
        setError('xlsx·xls·csv 파일만 읽을 수 있습니다.');
        return;
      }
      const base64 = await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
      const data = base64ToBytes(base64);
      const enc = k === 'csv' ? detectEncoding(data) : 'utf8';
      applyFile(asset.name, data, k, enc);
      setStep('mapping');
    } catch (e) {
      setError(`파일을 읽지 못했습니다. ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function applyFile(name: string, data: Uint8Array, k: FileKind, enc: Encoding) {
    const t = trimTable(readTable(data, k, enc));
    setFileName(name);
    setBytes(data);
    setKind(k);
    setEncoding(enc);
    setTable(t);
    setMapping(guessMapping(t));
  }

  function changeEncoding(enc: Encoding) {
    if (!bytes) return;
    applyFile(fileName, bytes, kind, enc);
  }

  // ---------------------------------------------------------------- 미리보기
  async function toPreview() {
    if (!target) return;
    setError(null);
    setBusy(true);
    try {
      const built = buildRows(table, mapping, { target, defaultDate, eventType });
      const keys = [...new Set(built.map((r) => r.nameKey).filter((k) => k.length > 0))];
      const found = await listPeopleByNormalizedNames(ledgerId, keys);
      const byKey = new Map<string, PersonBalance[]>();
      for (const p of found) {
        const key = p.name_normalized ?? '';
        byKey.set(key, [...(byKey.get(key) ?? []), p]);
      }
      const ids = new Map<string, string[]>([...byKey.entries()].map(([k, v]) => [k, v.map((p) => p.id as string)]));
      setCandidates(byKey);
      setRows(markSameNames(built, ids));
      state.current = emptyImportState();
      setStep('preview');
    } catch (e) {
      setError(`장부의 사람을 확인하지 못했습니다. ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function patchRow(index: number, next: Partial<ImportRow>) {
    setRows((prev) => prev.map((r) => (r.index === index ? { ...r, ...next } : r)));
  }

  // 파일 안 중복은 같은 이름 행 전부에 같은 선택을 적용한다. 행마다 따로 고르게 하면 어긋난다.
  function chooseDup(nameKey: string, choice: 'same' | 'different') {
    setRows((prev) => prev.map((r) => (r.nameKey === nameKey ? { ...r, dupChoice: choice } : r)));
  }

  const summary = useMemo(() => summarize(rows), [rows]);

  // ---------------------------------------------------------------- 저장
  async function save() {
    if (!target || !canSave(rows)) return;
    setError(null);
    setStep('saving');
    const items = planSave(rows, target);
    try {
      await runImport({
        ledgerId,
        target,
        eventId,
        items,
        state: state.current,
        onProgress: setProgress,
      });
      void queryClient.invalidateQueries({ queryKey: ['people'] });
      void queryClient.invalidateQueries({ queryKey: ['entries'] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      setStep('done');
    } catch (e) {
      // 만든 것은 state에 남아 있다. 다시 시도하면 끝난 행은 건너뛰고 이어서 간다.
      setError((e as Error).message);
    }
  }

  // ================================================================ 화면
  if (step === 'target') {
    return (
      <Screen scroll edges={{ top: false }}>
        <View style={{ gap: space.lg }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 20 }}>
            엑셀(xlsx·xls)이나 CSV 파일을 읽어 한 번에 넣습니다. 파일은 이 기기 안에서만 읽고 서버에 올리지 않습니다.
          </Text>
          <Choice
            title="준돈 가져오기"
            hint="남의 경조사에 낸 돈. 행마다 이름·금액·종류(·날짜·메모)를 읽고, 사람마다 남의 행사를 만들거나 기존 행사에 붙입니다."
            selected={target === 'given'}
            onPress={() => {
              setTarget('given');
              setEventId(null);
            }}
          />
          <Choice
            title="명부 가져오기"
            hint="내 행사(결혼식·돌잔치 등)에 받은 돈. 내 행사 하나를 고른 뒤 이름·금액(·메모)을 읽습니다."
            selected={target === 'received'}
            onPress={() => setTarget('received')}
          />
          {target === 'received' && (
            <View style={{ gap: space.sm }}>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>어느 행사의 명부인가요</Text>
              {myEvents.isLoading ? (
                <ActivityIndicator color={colors.textMuted} />
              ) : myEvents.isError ? (
                <LoadFailed title="행사를 불러오지 못했습니다" onRetry={() => void myEvents.refetch()} />
              ) : (myEvents.data?.rows.length ?? 0) === 0 ? (
                <View style={{ gap: space.sm }}>
                  <Text style={{ color: colors.textMuted, fontSize: font.caption }}>내 행사가 아직 없습니다.</Text>
                  <Button label="내 행사 만들기" variant="secondary" size="sm" onPress={() => router.push('/event/edit')} />
                </View>
              ) : (
                (myEvents.data?.rows ?? []).map((e: EventRow) => (
                  <Chip
                    key={e.id}
                    label={`${e.title} · ${formatEventDate(e.date, 'day')}`}
                    selected={eventId === e.id}
                    onPress={() => setEventId(e.id)}
                  />
                ))
              )}
            </View>
          )}
          <Button
            label="다음"
            disabled={!target || (target === 'received' && !eventId)}
            onPress={() => setStep('file')}
          />
        </View>
      </Screen>
    );
  }

  if (step === 'file') {
    return (
      <Screen scroll edges={{ top: false }}>
        <View style={{ gap: space.lg }}>
          <TargetLine target={target} eventTitle={chosenEvent.data?.title ?? null} />
          <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 20 }}>
            첫 행이 열 이름(이름·금액·구분 등)이면 자동으로 알아봅니다. 열 순서는 다음 단계에서 고칠 수 있습니다.
          </Text>
          <Button label="파일 고르기" onPress={() => void pickFile()} loading={busy} disabled={busy} />
          {error && <Text style={{ color: colors.danger, fontSize: font.caption }}>{error}</Text>}
        </View>
      </Screen>
    );
  }

  if (step === 'mapping') {
    const errors = mappingErrors(mapping);
    const header = mapping.hasHeader ? (table[0] ?? []) : [];
    const sampleRow = table[mapping.hasHeader ? 1 : 0] ?? [];
    const mismatch = kind === 'csv' && bytes ? encodingMismatch(bytes, encoding) : false;
    return (
      <Screen scroll edges={{ top: false }}>
        <View style={{ gap: space.lg }}>
          <TargetLine target={target} eventTitle={chosenEvent.data?.title ?? null} />
          <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '600' }} numberOfLines={1}>
            {fileName}
          </Text>

          {kind === 'csv' && (
            <View style={{ gap: space.sm }}>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>글자 인코딩</Text>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                {(['utf8', 'euckr'] as Encoding[]).map((enc) => (
                  <Chip key={enc} label={ENCODING_LABEL[enc]} selected={encoding === enc} onPress={() => changeEncoding(enc)} />
                ))}
              </View>
              {mismatch && (
                <Text style={{ color: colors.danger, fontSize: font.caption }}>
                  한글이 깨져 보이면 다른 인코딩을 골라 주세요.
                </Text>
              )}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Chip
              label={mapping.hasHeader ? '첫 행은 제목' : '첫 행부터 데이터'}
              selected={mapping.hasHeader}
              onPress={() => setMapping({ ...mapping, hasHeader: !mapping.hasHeader })}
            />
          </View>

          {mapping.roles.map((role, i) => (
            <View key={i} style={{ gap: space.xs, borderTopColor: colors.border, borderTopWidth: 1, paddingTop: space.md }}>
              <Text style={{ color: colors.text, fontSize: font.caption, fontWeight: '600' }} numberOfLines={1}>
                {String(header[i] ?? `${i + 1}번째 열`)}
                <Text style={{ color: colors.textMuted, fontWeight: '400' }}>  예) {String(sampleRow[i] ?? '')}</Text>
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {ROLE_CHOICES.map((r) => (
                    <Chip
                      key={r}
                      label={COLUMN_ROLE_LABEL[r]}
                      selected={role === r}
                      onPress={() => {
                        const roles = [...mapping.roles];
                        roles[i] = r;
                        setMapping({ ...mapping, roles });
                      }}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          ))}

          {target === 'given' && !mapping.roles.includes('date') && (
            <Field
              label="날짜 열이 없습니다. 전체에 적용할 날짜 (YYYY-MM-DD)"
              value={defaultDate}
              onChangeText={setDefaultDate}
              keyboardType="numbers-and-punctuation"
              hint={/^\d{4}-\d{2}-\d{2}$/.test(defaultDate) ? formatEventDate(defaultDate, 'day') : '날짜 형식이 맞지 않습니다.'}
            />
          )}

          {errors.map((e) => (
            <Text key={e} style={{ color: colors.danger, fontSize: font.caption }}>{e}</Text>
          ))}
          {error && <Text style={{ color: colors.danger, fontSize: font.caption }}>{error}</Text>}
          <Button
            label="미리보기"
            loading={busy}
            disabled={busy || errors.length > 0 || (target === 'given' && !/^\d{4}-\d{2}-\d{2}$/.test(defaultDate))}
            onPress={() => void toPreview()}
          />
          <Button label="다른 파일" variant="secondary" onPress={() => setStep('file')} />
        </View>
      </Screen>
    );
  }

  if (step === 'preview') {
    return (
      <Screen padded={false} edges={{ top: false }}>
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.index)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xxl }}
          ListHeaderComponent={
            <View style={{ gap: space.sm, paddingBottom: space.md }}>
              <TargetLine target={target} eventTitle={chosenEvent.data?.title ?? null} />
              <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>
                {summary.save}건 저장 · {summary.skip}건 건너뜀 · {summary.fix}건 수정 필요
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                저장될 합계 {formatWon(summary.totalAmount)}
                {summary.fix > 0 ? ' · 수정 필요가 0이 되어야 저장할 수 있습니다' : ''}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PreviewRow
              row={item}
              candidates={candidates.get(item.nameKey) ?? []}
              onPatch={(next) => patchRow(item.index, next)}
              onChooseDup={(choice) => chooseDup(item.nameKey, choice)}
            />
          )}
          ListFooterComponent={
            <View style={{ gap: space.sm, paddingTop: space.lg }}>
              {error && <Text style={{ color: colors.danger, fontSize: font.caption }}>{error}</Text>}
              <Button label={`${summary.save}건 저장`} disabled={!canSave(rows)} onPress={() => void save()} />
              <Button label="열 매핑으로" variant="secondary" onPress={() => setStep('mapping')} />
            </View>
          }
        />
      </Screen>
    );
  }

  if (step === 'saving') {
    return (
      <Screen edges={{ top: false }}>
        <View style={{ gap: space.lg, paddingTop: space.xl }}>
          <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>
            {error ? '저장이 멈췄습니다' : '저장하는 중'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: font.body }}>
            {progress.done} / {progress.total}
          </Text>
          <View style={{ backgroundColor: colors.bgSubtle, borderRadius: radius.sm, height: 8 }}>
            <View
              style={{
                backgroundColor: colors.accent,
                borderRadius: radius.sm,
                height: 8,
                width: `${progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)}%`,
              }}
            />
          </View>
          {error ? (
            <>
              <Text style={{ color: colors.danger, fontSize: font.caption, lineHeight: 20 }}>{error}</Text>
              <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 20 }}>
                끝난 행은 그대로 두고 멈춘 행부터 이어서 저장합니다. 앞 행을 다시 만들지 않습니다.
              </Text>
              <Button label="이어서 다시 시도" onPress={() => void save()} />
            </>
          ) : (
            <ActivityIndicator color={colors.textMuted} />
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={{ top: false }}>
      <View style={{ gap: space.lg, paddingTop: space.xl }}>
        <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>가져오기 완료</Text>
        <Text style={{ color: colors.textMuted, fontSize: font.body, lineHeight: 22 }}>
          {progress.total}건을 저장했습니다. 합계 {formatWon(summary.totalAmount)}.
          {'\n'}구분할 말 없이 저장된 동명이인은 사람 목록에서 "구분 없음"으로 표시됩니다.
        </Text>
        {target === 'received' && eventId ? (
          <Button label="행사 상세 보기" onPress={() => router.replace(`/event/${eventId}`)} />
        ) : (
          <Button label="홈으로" onPress={() => router.replace('/')} />
        )}
      </View>
    </Screen>
  );
}

function Choice({ title, hint, selected, onPress }: { title: string; hint: string; selected: boolean; onPress: () => void }) {
  const { colors, space, font, radius } = useTokens();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        borderColor: selected ? colors.text : colors.border,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        gap: space.xs,
        padding: space.lg,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 18 }}>{hint}</Text>
    </Pressable>
  );
}

function TargetLine({ target, eventTitle }: { target: ImportTarget | null; eventTitle: string | null }) {
  const { colors, font } = useTokens();
  const text = target === 'received' ? `명부 가져오기 · ${eventTitle ?? '내 행사'}` : '준돈 가져오기';
  return <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{text}</Text>;
}

const STATUS_LABEL = { ok: '정상', warn: '확인', fix: '수정 필요', skip: '건너뜀' } as const;

function PreviewRow({
  row,
  candidates,
  onPatch,
  onChooseDup,
}: {
  row: ImportRow;
  candidates: PersonBalance[];
  onPatch: (next: Partial<ImportRow>) => void;
  onChooseDup: (choice: 'same' | 'different') => void;
}) {
  const { colors, space, font, radius } = useTokens();
  const status = rowStatus(row);
  const tone = status === 'fix' ? colors.danger : status === 'warn' ? colors.received : colors.textMuted;
  const inLedger = row.issues.includes('same_name_in_ledger');
  const inFile = row.issues.includes('same_name_in_file');
  const needsLabelField = !row.skip && ((inLedger && row.attachTo === null) || (inFile && row.dupChoice === 'different'));

  return (
    <View
      style={{
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        gap: space.xs,
        opacity: row.skip ? 0.5 : 1,
        paddingVertical: space.md,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.sm }}>
        <Text style={{ color: colors.textMuted, fontSize: font.caption, width: 28 }}>{row.index}</Text>
        <Text style={{ color: colors.text, flex: 1, fontSize: font.body, fontWeight: '600' }} numberOfLines={1}>
          {row.name || '(이름 없음)'}
          {row.label.trim() ? ` · ${row.label.trim()}` : ''}
        </Text>
        <Text style={{ color: row.amount === null ? colors.danger : colors.text, fontSize: font.body, fontWeight: '700' }}>
          {row.amount === null ? row.amountText || '—' : formatWonShort(row.amount)}
        </Text>
        <View style={{ backgroundColor: colors.bgSubtle, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ color: tone, fontSize: font.caption - 2 }}>{STATUS_LABEL[status]}</Text>
        </View>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: font.caption }} numberOfLines={1}>
        {eventTypeLabelOf(row.type)}
        {row.date ? ` · ${formatEventDate(row.date, 'day')}` : ''}
        {row.memo ? ` · ${row.memo}` : ''}
      </Text>
      {row.issues.map((issue) => (
        <Text key={issue} style={{ color: tone, fontSize: font.caption }}>
          · {issueLabel(row, issue)}
        </Text>
      ))}

      {!row.skip && inLedger && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {candidates.map((c) => (
            <Chip
              key={c.id as string}
              label={`기존 ${displayName(c)}`}
              selected={row.attachTo === c.id}
              onPress={() => onPatch({ attachTo: row.attachTo === c.id ? null : (c.id as string) })}
            />
          ))}
          <Chip label="새 사람" selected={row.attachTo === null} onPress={() => onPatch({ attachTo: null })} />
        </View>
      )}
      {!row.skip && inFile && (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Chip label="같은 사람" selected={row.dupChoice === 'same'} onPress={() => onChooseDup('same')} />
          <Chip label="다른 사람" selected={row.dupChoice === 'different'} onPress={() => onChooseDup('different')} />
        </View>
      )}
      {needsLabelField && (
        <Field
          value={row.label}
          onChangeText={(next) => onPatch({ label: next })}
          maxLength={30}
          placeholder="구분할 말 (예: 회사, 고등학교) — 필수"
        />
      )}
      {!row.skip && row.issues.includes('bad_amount') && (
        <Field
          value={row.amountText}
          onChangeText={(next) => {
            // 금액을 고치면 도메인 함수로 다시 읽는다. 숫자 판단은 화면이 하지 않는다.
            const rebuilt = buildRows([[row.name, next]], { hasHeader: false, roles: ['name', 'amount'] }, {
              target: 'given',
              defaultDate: row.date ?? '',
              eventType: null,
            })[0];
            onPatch({
              amountText: next,
              amount: rebuilt?.amount ?? null,
              issues: rebuilt?.amount === null || rebuilt?.amount === undefined
                ? row.issues
                : row.issues.filter((i) => i !== 'bad_amount'),
            });
          }}
          keyboardType="numbers-and-punctuation"
          placeholder="금액 고치기 (예: 100,000)"
        />
      )}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label={row.skip ? '되살리기' : '건너뛰기'} selected={row.skip} onPress={() => onPatch({ skip: !row.skip })} />
      </View>
    </View>
  );
}
