// 청첩장·부고장 만들기(S20) — 내 행사 하나에 붙는 초대장을 적고, 미리보고, 발행하고, 공유하고, 내린다
//
// 2A 범위(docs/08 §3.6). 칸은 종류별로 고정이다. 템플릿은 청첩장 '단정한 흰색'·'봄'(2026-10-07), 부고장은 하나.
// '봄'을 고르면 봄 전용 칸(인트로 문구·혼주 전화·교통 안내·참석 여부)이 더 열린다.
// 화면을 열면 초안 행을 바로 만든다 — 사진 경로에 초대장 id 가 필요하고, 저장을 깜빡해도 적은 것이
// 남아야 하기 때문이다. 발행 전에는 앱의 validateInvitation 이, 발행 규칙(무료 1건·3개월)은 서버가 막는다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  KIND_LABEL,
  emptyContent,
  expiryLabel,
  invitationKindForEvent,
  maxMonths,
  shareTitle,
  shareUrl,
  templatesFor,
  validateInvitation,
  type BankAccount,
  type FuneralContent,
  type InvitationContent,
  type InvitationKind,
  type WeddingContent,
} from '../../../src/domain/invitation.ts';
import { useT } from '../../../src/i18n';
import { LOCALES, LOCALE_LABEL } from '../../../src/i18n/dict.ts';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { confirmAction } from '../../../src/lib/confirm.ts';
import { isWeb } from '../../../src/lib/platform.ts';
import { queryKeys } from '../../../src/lib/queryKeys';
import { preparePhoto } from '../../../src/lib/preparePhoto.ts';
import { getEvent } from '../../../src/repositories/events';
import {
  createInvitation,
  deleteGuestbookEntry,
  getInvitationByEvent,
  listGuestbook,
  setGuestbookHidden,
  photoUrl,
  publishInvitation,
  deleteRsvp,
  listRsvp,
  removePhotos,
  unpublishInvitation,
  updateInvitation,
  uploadPhoto,
  type Invitation,
} from '../../../src/repositories/invitations.ts';
import { useTokens } from '../../../src/theme/tokens';
import { Button } from '../../../src/ui/Button';
import { Chip } from '../../../src/ui/Chip';
import { Field } from '../../../src/ui/Field';
import { summarizeRsvp } from '../../../src/domain/rsvp.ts';
import { LoadFailed } from '../../../src/ui/LoadFailed';
import { Screen } from '../../../src/ui/Screen';
import { useToast } from '../../../src/ui/ToastProvider';

export default function InvitationScreen() {
  const t = useT();
  const ledgerId = useLedgerId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { colors, space, font, radius } = useTokens();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const event = useQuery({
    queryKey: queryKeys.events.detail(ledgerId, eventId),
    queryFn: () => getEvent(ledgerId, eventId),
  });
  const kind: InvitationKind | null = event.data ? invitationKindForEvent(event.data.type) : null;

  const invitation = useQuery({
    queryKey: queryKeys.invitations.byEvent(ledgerId, eventId),
    queryFn: () => getInvitationByEvent(ledgerId, eventId),
  });

  // 초안이 없으면 바로 만든다. 한 번만 — 두 번 만들면 서버의 '행사 하나에 하나'에 걸린다.
  const creating = useRef(false);
  useEffect(() => {
    if (!kind || invitation.isLoading || invitation.data || creating.current) return;
    creating.current = true;
    createInvitation(ledgerId, { eventId, kind, content: emptyContent(kind) })
      .then((row) => queryClient.setQueryData(queryKeys.invitations.byEvent(ledgerId, eventId), row))
      .catch((error: Error) => toast.show({ message: `초안을 만들지 못했습니다 · ${error.message}`, durationMs: 4000 }))
      .finally(() => {
        creating.current = false;
      });
  }, [kind, invitation.isLoading, invitation.data, ledgerId, eventId, queryClient, toast]);

  const inv = invitation.data ?? null;

  // 화면의 내용. 고치는 중(dirty)이 아니면 서버 값을 따라간다 — 미리보기에서 돌아오거나 다른 기기에서
  // 고친 뒤에도 화면이 오래된 값을 들고 있지 않게 한다. 고치는 중에는 화면이 주인이다.
  const [content, setContent] = useState<InvitationContent | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const serverContent = inv?.content;
  useEffect(() => {
    if (!inv || dirty) return;
    const stored = serverContent as unknown as InvitationContent;
    setContent(stored && Object.keys(stored).length > 0 ? stored : emptyContent(inv.kind as InvitationKind));
    setTemplateId(inv.template_id);
  }, [inv, serverContent, dirty]);

  function patch(next: Partial<InvitationContent>) {
    setContent((prev) => (prev ? ({ ...prev, ...next } as InvitationContent) : prev));
    setDirty(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!inv || !content) throw new Error('아직 준비되지 않았습니다.');
      return updateInvitation(ledgerId, inv.id, { content, templateId: templateId ?? undefined });
    },
    onSuccess: (row) => {
      queryClient.setQueryData(queryKeys.invitations.byEvent(ledgerId, eventId), row);
      setDirty(false);
    },
    onError: (error: Error) => toast.show({ message: `저장하지 못했습니다 · ${error.message}`, durationMs: 4000 }),
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!inv || !content || !kind) throw new Error('아직 준비되지 않았습니다.');
      const v = validateInvitation(kind, content);
      if (!v.ok) {
        setErrors(v.errors);
        throw new Error('내용을 확인해 주세요.');
      }
      setErrors([]);
      await updateInvitation(ledgerId, inv.id, { content, templateId: templateId ?? undefined });
      return publishInvitation(inv.id, maxMonths(inv.plan as 'free' | 'premium'));
    },
    onSuccess: async () => {
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations.byEvent(ledgerId, eventId) });
      toast.show({ message: '발행했습니다. 링크를 공유해 보세요.' });
    },
    onError: (error: Error) => {
      if (error.message !== '내용을 확인해 주세요.') toast.show({ message: error.message, durationMs: 4000 });
    },
  });

  const unpublish = useMutation({
    mutationFn: async () => {
      if (!inv) return;
      await unpublishInvitation(inv.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations.byEvent(ledgerId, eventId) });
      toast.show({ message: '내렸습니다. 링크를 열면 더 이상 보이지 않습니다.' });
    },
    onError: (error: Error) => toast.show({ message: error.message, durationMs: 4000 }),
  });

  async function onUnpublish() {
    const ok = await confirmAction({
      title: '초대장을 내릴까요',
      message: '이미 보낸 링크를 열면 "찾을 수 없습니다"로 보입니다. 다시 발행할 수 있습니다.',
      confirmLabel: '내리기',
      destructive: true,
    });
    if (ok) unpublish.mutate();
  }

  async function onShare() {
    if (!inv || !content || !kind) return;
    const url = shareUrl(inv.slug);
    if (isWeb) {
      try {
        await navigator.clipboard.writeText(url);
        toast.show({ message: '링크를 복사했습니다.' });
      } catch {
        toast.show({ message: url, durationMs: 6000 });
      }
      return;
    }
    await Share.share({ title: shareTitle(kind, content), message: `${shareTitle(kind, content)}\n${url}`, url }).catch(() => {});
  }

  // 사진 — 고르면 바로 올린다. 경로에 초대장 id 가 들어가므로 초안이 있어야 한다.
  const [uploading, setUploading] = useState(false);
  async function pickAndUpload(slot: 'cover' | 'gallery') {
    if (!inv || !content || kind !== 'wedding') return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: slot === 'gallery',
      selectionLimit: slot === 'gallery' ? 10 : 1,
    });
    if (res.canceled || res.assets.length === 0) return;
    setUploading(true);
    try {
      const paths: string[] = [];
      const notices = new Set<string>();
      for (const [i, a] of res.assets.entries()) {
        // 큰 사진은 줄이고, 무거우면 압축하고, HEIC 는 JPEG 로. 바꿨으면 알린다(src/domain/photo.ts).
        const ready = await preparePhoto(a.uri, { width: a.width, height: a.height, bytes: a.fileSize, mimeType: a.mimeType });
        if (ready.notice) notices.add(ready.notice);
        const name = `${slot}-${Date.now()}-${i}.${ready.ext}`;
        paths.push(await uploadPhoto(ledgerId, inv.id, name, ready.bytes, ready.contentType));
      }
      if (notices.size) toast.show({ message: [...notices].join(' '), durationMs: 4500 });
      const w = content as WeddingContent;
      if (slot === 'cover') {
        if (w.cover) void removePhotos([w.cover]).catch(() => {});
        patch({ cover: paths[0] } as Partial<WeddingContent>);
      } else {
        patch({ gallery: [...(w.gallery ?? []), ...paths].slice(0, 20) } as Partial<WeddingContent>);
      }
    } catch (error) {
      toast.show({ message: (error as Error).message, durationMs: 4000 });
    } finally {
      setUploading(false);
    }
  }

  if (event.isError || invitation.isError) {
    return (
      <Screen>
        <LoadFailed title="초대장을 불러오지 못했습니다" onRetry={() => void invitation.refetch()} />
      </Screen>
    );
  }
  if (event.data && !kind) {
    return (
      <Screen>
        <Text style={{ color: colors.textMuted, fontSize: font.body }}>
          결혼식과 장례식에만 초대장을 만들 수 있습니다. 돌잔치는 곧 열립니다.
        </Text>
      </Screen>
    );
  }
  if (!inv || !content || !kind) {
    return (
      <Screen>
        <Text style={{ color: colors.textMuted, fontSize: font.body }}>준비 중…</Text>
      </Screen>
    );
  }

  const published = inv.status === 'published';
  const url = shareUrl(inv.slug);

  return (
    <Screen scroll>
      <View style={{ gap: space.lg, paddingBottom: space.xxl }}>
        <View>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{event.data?.title}</Text>
          <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>{KIND_LABEL[kind]}</Text>
        </View>

        {/* 발행 상태 */}
        <View style={{ backgroundColor: colors.bgSubtle, borderRadius: radius.lg, gap: space.sm, padding: space.lg }}>
          {published ? (
            <>
              <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>
                공개 중 · {expiryLabel(inv.expires_at)}
              </Text>
              <Text selectable style={{ color: colors.textMuted, fontSize: font.caption }}>{url}</Text>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>조회 {inv.view_count}회</Text>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                <Chip label={isWeb ? '링크 복사' : '공유'} selected onPress={() => void onShare()} />
                <Chip label="미리보기" selected={false} onPress={() => router.push(`/invitation/preview?id=${inv.id}`)} />
                <Chip label="내리기" selected={false} onPress={() => void onUnpublish()} />
              </View>
              {dirty && (
                <Text style={{ color: colors.danger, fontSize: font.caption }}>
                  고친 내용은 저장을 눌러야 공개 페이지에 반영됩니다.
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>
                {inv.status === 'expired' ? '기간이 끝났습니다' : inv.status === 'unpublished' ? '내려진 상태' : '초안'}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                발행하면 링크가 생기고 {maxMonths(inv.plan as 'free' | 'premium')}개월 동안 공개됩니다.
                {inv.plan === 'free' ? ' 무료는 한 번에 하나만 공개할 수 있습니다.' : ''}
              </Text>
            </>
          )}
        </View>

        {/* 템플릿 — 고르면 저장할 때 함께 바뀐다. 미리보기로 바로 확인한다 */}
        {templatesFor(kind).length > 1 && (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>템플릿</Text>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {templatesFor(kind).map((tp) => (
                <Chip
                  key={tp.id}
                  label={tp.name}
                  selected={(templateId ?? 'basic') === tp.id}
                  onPress={() => {
                    setTemplateId(tp.id);
                    setDirty(true);
                  }}
                />
              ))}
            </View>
            {templateId === 'spring' && (
              <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 20 }}>
                열면 표지 사진 위에 문구가 손글씨로 써지고, 사진이 드러난 뒤 아래로 내려 볼 수 있어요. 달력·카운트다운·교통 안내·참석 여부가 들어가요.
              </Text>
            )}
          </View>
        )}

        {/* 공개 페이지의 안내 글자 언어(오시는 길·계좌·방명록). 적은 내용은 그대로다. 한·영·일(2026-10-04) */}
        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>{t('inv.pageLanguage')}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {LOCALES.map((l) => (
              <Chip key={l} label={LOCALE_LABEL[l]} selected={(content.lang ?? 'ko') === l} onPress={() => patch({ lang: l })} />
            ))}
          </View>
        </View>

        {kind === 'wedding' && (content as WeddingContent).rsvp && <Rsvp invitationId={inv.id} />}
        <Guestbook invitationId={inv.id} />

        {kind === 'wedding' ? (
          <WeddingForm c={content as WeddingContent} patch={patch} onPick={pickAndUpload} uploading={uploading} spring={templateId === 'spring'} />
        ) : (
          <FuneralForm c={content as FuneralContent} patch={patch} />
        )}

        {errors.length > 0 && (
          <View style={{ gap: space.xs }}>
            {errors.map((e) => (
              <Text key={e} style={{ color: colors.danger, fontSize: font.caption }}>{e}</Text>
            ))}
          </View>
        )}

        <View style={{ gap: space.sm }}>
          <Button label={dirty ? '저장' : '저장됨'} variant="secondary" onPress={() => save.mutate()} disabled={!dirty} loading={save.isPending} />
          {!published && (
            <>
              <Button label="미리보기" variant="secondary" onPress={() => {
                if (dirty) save.mutate(undefined, { onSuccess: () => router.push(`/invitation/preview?id=${inv.id}`) });
                else router.push(`/invitation/preview?id=${inv.id}`);
              }} />
              <Button label={`발행하기 · ${maxMonths(inv.plan as 'free' | 'premium')}개월 공개`} onPress={() => publish.mutate()} loading={publish.isPending} />
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// 청첩장 칸
// ---------------------------------------------------------------------------
function WeddingForm({
  c,
  patch,
  onPick,
  uploading,
  spring,
}: {
  c: WeddingContent;
  patch: (next: Partial<WeddingContent>) => void;
  onPick: (slot: 'cover' | 'gallery') => void;
  uploading: boolean;
  spring: boolean;
}) {
  const { colors, space, font, radius } = useTokens();
  return (
    <View style={{ gap: space.lg }}>
      <Section title="신랑">
        <Field label="이름" value={c.groom.name} onChangeText={(v) => patch({ groom: { ...c.groom, name: v } })} placeholder="김철수" />
        <Field label="아버지" value={c.groom.father ?? ''} onChangeText={(v) => patch({ groom: { ...c.groom, father: v } })} placeholder="선택" />
        <Field label="어머니" value={c.groom.mother ?? ''} onChangeText={(v) => patch({ groom: { ...c.groom, mother: v } })} placeholder="선택" />
      </Section>
      <Section title="신부">
        <Field label="이름" value={c.bride.name} onChangeText={(v) => patch({ bride: { ...c.bride, name: v } })} placeholder="이영희" />
        <Field label="아버지" value={c.bride.father ?? ''} onChangeText={(v) => patch({ bride: { ...c.bride, father: v } })} placeholder="선택" />
        <Field label="어머니" value={c.bride.mother ?? ''} onChangeText={(v) => patch({ bride: { ...c.bride, mother: v } })} placeholder="선택" />
      </Section>
      <Section title="일시">
        <Field label="날짜" value={c.date} onChangeText={(v) => patch({ date: v })} placeholder="2027-05-01" keyboardType="numbers-and-punctuation" />
        <Field label="시간" value={c.time} onChangeText={(v) => patch({ time: v })} placeholder="12:30" keyboardType="numbers-and-punctuation" />
      </Section>
      <Section title="장소">
        <Field label="예식장" value={c.venue.name} onChangeText={(v) => patch({ venue: { ...c.venue, name: v } })} placeholder="더채플 앳 청담" />
        <Field label="홀" value={c.venue.hall ?? ''} onChangeText={(v) => patch({ venue: { ...c.venue, hall: v } })} placeholder="3층 그랜드홀 (선택)" />
        <Field label="주소" value={c.venue.address ?? ''} onChangeText={(v) => patch({ venue: { ...c.venue, address: v } })} placeholder="길찾기 버튼에 쓰입니다 (선택)" />
        {spring && (
          <Field label="예식장 전화" value={c.venue.phone ?? ''} onChangeText={(v) => patch({ venue: { ...c.venue, phone: v } })} placeholder="02-000-0000 (선택)" keyboardType="phone-pad" />
        )}
      </Section>
      <Section title="인사말">
        <Field label="" value={c.greeting ?? ''} onChangeText={(v) => patch({ greeting: v })} placeholder="저희 두 사람이…" multiline style={{ minHeight: 120, textAlignVertical: 'top' }} />
      </Section>
      <Section title="사진">
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label={c.cover ? '커버 사진 바꾸기' : '커버 사진 고르기'} selected onPress={() => onPick('cover')} />
          <Chip label={`갤러리 추가 (${c.gallery?.length ?? 0}/20)`} selected={false} onPress={() => onPick('gallery')} />
          {uploading && <Text style={{ color: colors.textMuted, fontSize: font.caption }}>올리는 중…</Text>}
        </View>
        {c.cover && <Text style={{ color: colors.textMuted, fontSize: font.caption }}>커버 사진이 있습니다. 미리보기에서 확인하세요.</Text>}
        {!!c.gallery?.length && (
          <Pressable onPress={() => patch({ gallery: [] })}>
            <Text style={{ color: colors.danger, fontSize: font.caption }}>갤러리 비우기</Text>
          </Pressable>
        )}
      </Section>
      <Section title="마음 전하실 곳">
        <Accounts accounts={c.accounts ?? []} withSide onChange={(accounts) => patch({ accounts })} />
      </Section>
      <Section title="연락처">
        <Field label="신랑" value={c.contact?.groom ?? ''} onChangeText={(v) => patch({ contact: { ...c.contact, groom: v } })} placeholder="010-0000-0000 (선택)" keyboardType="phone-pad" />
        <Field label="신부" value={c.contact?.bride ?? ''} onChangeText={(v) => patch({ contact: { ...c.contact, bride: v } })} placeholder="010-0000-0000 (선택)" keyboardType="phone-pad" />
      </Section>
      {spring && (
        <>
          <Section title="인트로 문구">
            <Field value={c.intro ?? ''} onChangeText={(v) => patch({ intro: v })} placeholder="We're getting married" maxLength={60} />
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>표지 사진 위에 손글씨로 써지는 한 줄이에요. 영문이 가장 예뻐요.</Text>
          </Section>
          <Section title="혼주 연락처">
            <Field label="신랑 아버지" value={c.parentPhones?.groomFather ?? ''} onChangeText={(v) => patch({ parentPhones: { ...c.parentPhones, groomFather: v } })} placeholder="010-0000-0000 (선택)" keyboardType="phone-pad" />
            <Field label="신랑 어머니" value={c.parentPhones?.groomMother ?? ''} onChangeText={(v) => patch({ parentPhones: { ...c.parentPhones, groomMother: v } })} placeholder="010-0000-0000 (선택)" keyboardType="phone-pad" />
            <Field label="신부 아버지" value={c.parentPhones?.brideFather ?? ''} onChangeText={(v) => patch({ parentPhones: { ...c.parentPhones, brideFather: v } })} placeholder="010-0000-0000 (선택)" keyboardType="phone-pad" />
            <Field label="신부 어머니" value={c.parentPhones?.brideMother ?? ''} onChangeText={(v) => patch({ parentPhones: { ...c.parentPhones, brideMother: v } })} placeholder="010-0000-0000 (선택)" keyboardType="phone-pad" />
          </Section>
          <Section title="교통 안내">
            <Field label="버스" value={c.transport?.bus ?? ''} onChangeText={(v) => patch({ transport: { ...c.transport, bus: v } })} placeholder="70-3, 5620 · 영등포구청 하차 (선택)" multiline style={{ minHeight: 64, textAlignVertical: 'top' }} />
            <Field label="지하철" value={c.transport?.subway ?? ''} onChangeText={(v) => patch({ transport: { ...c.transport, subway: v } })} placeholder="2,5호선 영등포구청역 4번출구 도보 3분 (선택)" multiline style={{ minHeight: 64, textAlignVertical: 'top' }} />
            <Field label="자가용" value={c.transport?.car ?? ''} onChangeText={(v) => patch({ transport: { ...c.transport, car: v } })} placeholder="맞은편 공영주차장 (선택)" multiline style={{ minHeight: 64, textAlignVertical: 'top' }} />
          </Section>
          <Section title="참석 여부 받기">
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Chip label="받기" selected={!!c.rsvp} onPress={() => patch({ rsvp: true })} />
              <Chip label="안 받기" selected={!c.rsvp} onPress={() => patch({ rsvp: false })} />
            </View>
            <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 20 }}>하객이 측·참석·인원·식사를 보내면 이 화면 위에 모여요.</Text>
          </Section>
        </>
      )}
      <View style={{ borderRadius: radius.md, backgroundColor: colors.bgSubtle, padding: space.md }}>
        <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 18 }}>
          날짜는 2027-05-01, 시간은 12:30 형식으로 적어 주세요. 달력 선택은 다음 판에 들어옵니다.
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 부고장 칸 — 10분 안에 끝나야 한다. 필수는 고인·상주·빈소·발인뿐이다.
// ---------------------------------------------------------------------------
function FuneralForm({ c, patch }: { c: FuneralContent; patch: (next: Partial<FuneralContent>) => void }) {
  const { colors, space, font } = useTokens();
  const mourners = c.chiefMourners;
  function setMourner(i: number, next: Partial<{ relation: string; name: string }>) {
    const list = mourners.map((m, j) => (j === i ? { ...m, ...next } : m));
    patch({ chiefMourners: list });
  }
  return (
    <View style={{ gap: space.lg }}>
      <Section title="고인">
        <Field label="호칭" value={c.deceased.title ?? ''} onChangeText={(v) => patch({ deceased: { ...c.deceased, title: v } })} placeholder="아버지 · 어머니 (선택)" />
        <Field label="성함" value={c.deceased.name} onChangeText={(v) => patch({ deceased: { ...c.deceased, name: v } })} placeholder="김영수" />
        <Field label="향년" value={c.deceased.age ? String(c.deceased.age) : ''} onChangeText={(v) => patch({ deceased: { ...c.deceased, age: v ? Number(v.replace(/\D/g, '')) || undefined : undefined } })} placeholder="82 (선택)" keyboardType="number-pad" />
      </Section>
      <Section title="상주">
        {mourners.map((m, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Field label={i === 0 ? '관계' : ''} value={m.relation} onChangeText={(v) => setMourner(i, { relation: v })} placeholder="아들" />
            </View>
            <View style={{ flex: 1.4 }}>
              <Field label={i === 0 ? '이름' : ''} value={m.name} onChangeText={(v) => setMourner(i, { name: v })} placeholder="김철수" />
            </View>
            <Pressable onPress={() => patch({ chiefMourners: mourners.filter((_, j) => j !== i) })} style={{ paddingBottom: space.md }} accessibilityLabel="상주 빼기">
              <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
        <Chip label="상주 추가" selected={false} onPress={() => patch({ chiefMourners: [...mourners, { relation: '', name: '' }] })} />
      </Section>
      <Section title="빈소">
        <Field label="장례식장" value={c.mortuary.name} onChangeText={(v) => patch({ mortuary: { ...c.mortuary, name: v } })} placeholder="서울아산병원 장례식장" />
        <Field label="호실" value={c.mortuary.room ?? ''} onChangeText={(v) => patch({ mortuary: { ...c.mortuary, room: v } })} placeholder="3호실 (선택)" />
        <Field label="주소" value={c.mortuary.address ?? ''} onChangeText={(v) => patch({ mortuary: { ...c.mortuary, address: v } })} placeholder="길찾기 버튼에 쓰입니다 (선택)" />
      </Section>
      <Section title="일정">
        <Field label="별세" value={c.passedAt ?? ''} onChangeText={(v) => patch({ passedAt: v })} placeholder="2026-11-01 03:20 (선택)" keyboardType="numbers-and-punctuation" />
        <Field label="발인" value={c.funeralAt} onChangeText={(v) => patch({ funeralAt: v })} placeholder="2026-11-03 08:00" keyboardType="numbers-and-punctuation" />
        <Field label="장지" value={c.burialPlace ?? ''} onChangeText={(v) => patch({ burialPlace: v })} placeholder="서울추모공원 (선택)" />
      </Section>
      <Section title="조의금 계좌">
        <Accounts accounts={c.accounts ?? []} withSide={false} onChange={(accounts) => patch({ accounts })} />
      </Section>
      <Section title="연락처·안내">
        <Field label="연락처" value={c.contact ?? ''} onChangeText={(v) => patch({ contact: v })} placeholder="010-0000-0000 (선택)" keyboardType="phone-pad" />
        <Field label="안내문" value={c.note ?? ''} onChangeText={(v) => patch({ note: v })} placeholder="조화는 정중히 사양합니다 (선택)" multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
      </Section>
      <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 18 }}>
        일시는 2026-11-03 08:00 형식으로 적어 주세요.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 방명록 — 하객이 공개 페이지에서 남긴 말. 주인은 숨기거나 지운다. 숨긴 것은 전광판에서 빠진다.
// ---------------------------------------------------------------------------
function Rsvp({ invitationId }: { invitationId: string }) {
  const { colors, space, font, radius } = useTokens();
  const queryClient = useQueryClient();
  const toast = useToast();
  const key = ['rsvp', invitationId] as const;
  const list = useQuery({ queryKey: key, queryFn: () => listRsvp(invitationId) });
  const remove = useMutation({
    mutationFn: (id: string) => deleteRsvp(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.show({ message: e.message, durationMs: 4000 }),
  });
  const rows = list.data ?? [];
  if (list.isLoading) return null;
  const sum = summarizeRsvp(rows);
  const mealLabel: Record<string, string> = { yes: '식사', no: '식사 안 함', unknown: '식사 미정' };
  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>참석 여부 {rows.length ? `· ${rows.length}건` : ''}</Text>
      {rows.length === 0 ? (
        <Text style={{ color: colors.textMuted, fontSize: font.caption }}>하객이 공개 페이지에서 보낸 응답이 여기 모여요.</Text>
      ) : (
        <>
          <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, gap: space.xs }}>
            <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '800' }}>참석 {sum.attendingPeople}명</Text>
            <Text style={{ color: colors.textMuted, fontSize: font.body }}>
              신랑측 {sum.bySide.groom}명 · 신부측 {sum.bySide.bride}명 · 불참 {sum.absentResponses}건
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: font.body }}>
              식사 {sum.meal.yes}명 · 안 함 {sum.meal.no}명 · 미정 {sum.meal.unknown}명
            </Text>
          </View>
          {rows.map((r) => (
            <View key={r.id} style={{ backgroundColor: colors.bgSubtle, borderRadius: radius.md, padding: space.md, gap: space.xs }}>
              <Text style={{ color: colors.text, fontSize: font.body }}>
                <Text style={{ fontWeight: '700' }}>{r.name}</Text>  {r.side === 'groom' ? '신랑측' : '신부측'} · {r.attending ? `참석 ${r.party_size}명${r.meal ? ` · ${mealLabel[r.meal] ?? ''}` : ''}` : '불참'}
              </Text>
              {r.message ? <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{r.message}</Text> : null}
              <Pressable
                onPress={() =>
                  void confirmAction({ title: '이 응답을 지울까요', message: `${r.name} · 되돌릴 수 없어요.`, confirmLabel: '지우기', destructive: true }).then((ok) => {
                    if (ok) remove.mutate(r.id);
                  })
                }
              >
                <Text style={{ color: colors.danger, fontSize: font.caption }}>지우기</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function Guestbook({ invitationId }: { invitationId: string }) {
  const { colors, space, font, radius } = useTokens();
  const queryClient = useQueryClient();
  const toast = useToast();
  const key = ['guestbook', invitationId] as const;
  const list = useQuery({ queryKey: key, queryFn: () => listGuestbook(invitationId) });
  const hide = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => setGuestbookHidden(id, hidden),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.show({ message: e.message, durationMs: 4000 }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteGuestbookEntry(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.show({ message: e.message, durationMs: 4000 }),
  });
  const rows = list.data ?? [];
  if (list.isLoading) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>방명록 {rows.length ? `· ${rows.length}` : ''}</Text>
      {rows.length === 0 ? (
        <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
          하객이 공개 페이지에서 남긴 메시지가 여기 모입니다. 공개 페이지 맨 위에서 전광판처럼 돌아갑니다.
        </Text>
      ) : (
        rows.map((g) => (
          <View key={g.id} style={{ backgroundColor: colors.bgSubtle, borderRadius: radius.md, padding: space.md, gap: space.xs, opacity: g.hidden ? 0.5 : 1 }}>
            <Text style={{ color: colors.text, fontSize: font.body }}>
              <Text style={{ fontWeight: '700' }}>{g.name}</Text>  {g.message}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Pressable onPress={() => hide.mutate({ id: g.id, hidden: !g.hidden })}>
                <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{g.hidden ? '다시 보이기' : '숨기기'}</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  void confirmAction({ title: '이 메시지를 지울까요', message: `${g.name} · 되돌릴 수 없습니다.`, confirmLabel: '지우기', destructive: true }).then((ok) => {
                    if (ok) remove.mutate(g.id);
                  })
                }
              >
                <Text style={{ color: colors.danger, fontSize: font.caption }}>지우기</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 공통 조각
// ---------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, space, font } = useTokens();
  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>{title}</Text>
      {children}
    </View>
  );
}

function Accounts({
  accounts,
  withSide,
  onChange,
}: {
  accounts: BankAccount[];
  withSide: boolean;
  onChange: (next: BankAccount[]) => void;
}) {
  const { colors, space, font } = useTokens();
  function set(i: number, next: Partial<BankAccount>) {
    onChange(accounts.map((a, j) => (j === i ? { ...a, ...next } : a)));
  }
  return (
    <View style={{ gap: space.md }}>
      {accounts.map((a, i) => (
        <View key={i} style={{ gap: space.xs, backgroundColor: colors.bgSubtle, borderRadius: 8, padding: space.md }}>
          {withSide && (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Chip label="신랑 측" selected={a.side === 'groom'} onPress={() => set(i, { side: 'groom' })} />
              <Chip label="신부 측" selected={a.side === 'bride'} onPress={() => set(i, { side: 'bride' })} />
            </View>
          )}
          <Field label="은행" value={a.bank} onChangeText={(v) => set(i, { bank: v })} placeholder="국민은행" />
          <Field label="계좌번호" value={a.number} onChangeText={(v) => set(i, { number: v })} placeholder="123456-01-234567" keyboardType="numbers-and-punctuation" />
          <Field label="예금주" value={a.holder} onChangeText={(v) => set(i, { holder: v })} placeholder="김철수" />
          <Pressable onPress={() => onChange(accounts.filter((_, j) => j !== i))}>
            <Text style={{ color: colors.danger, fontSize: font.caption }}>이 계좌 빼기</Text>
          </Pressable>
        </View>
      ))}
      {accounts.length < 6 && (
        <Chip label="계좌 추가" selected={false} onPress={() => onChange([...accounts, { side: withSide ? 'groom' : undefined, holder: '', bank: '', number: '' }])} />
      )}
    </View>
  );
}
