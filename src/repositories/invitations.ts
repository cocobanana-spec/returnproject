// 청첩장·부고장 저장소 — 테이블 읽고 쓰기, 발행·내리기 RPC, 사진 올리기
//
// 화면은 이 모듈만 부른다. 규칙(무료 1건·3개월, 내 행사만, 종류 일치)은 서버(0009)가 지키고
// 여기서는 그 오류를 화면 문구로 바꾼다(types.ts 의 MESSAGES 와 같은 방식).
import { db } from '../lib/supabaseClient.ts';
import type { Tables, TablesInsert } from '../db/database.types.ts';
import type { InvitationContent, InvitationKind } from '../domain/invitation.ts';
import { unwrap } from './types.ts';

export type Invitation = Tables<'invitations'>;

const COLS = 'id, ledger_id, event_id, kind, template_id, slug, content, status, published_at, expires_at, plan, view_count, created_by, created_at, updated_at';

// 행사에 붙은 청첩장. 없으면 null — 행사 하나에 하나다.
export async function getInvitationByEvent(ledgerId: string, eventId: string): Promise<Invitation | null> {
  const rows = unwrap(
    await db().from('invitations').select(COLS).eq('ledger_id', ledgerId).eq('event_id', eventId).limit(1),
  );
  return (rows[0] as Invitation | undefined) ?? null;
}

export async function getInvitation(ledgerId: string, id: string): Promise<Invitation | null> {
  const rows = unwrap(await db().from('invitations').select(COLS).eq('ledger_id', ledgerId).eq('id', id).limit(1));
  return (rows[0] as Invitation | undefined) ?? null;
}

// 장부의 청첩장 전부. 더보기·행사 목록의 표시용.
export async function listInvitations(ledgerId: string): Promise<Invitation[]> {
  return unwrap(
    await db().from('invitations').select(COLS).eq('ledger_id', ledgerId).order('created_at', { ascending: false }),
  ) as Invitation[];
}

export async function createInvitation(
  ledgerId: string,
  input: { eventId: string; kind: InvitationKind; templateId?: string; content: InvitationContent },
): Promise<Invitation> {
  const row: TablesInsert<'invitations'> = {
    ledger_id: ledgerId,
    event_id: input.eventId,
    kind: input.kind,
    template_id: input.templateId ?? 'basic',
    content: input.content as unknown as TablesInsert<'invitations'>['content'],
  };
  const rows = unwrap(await db().from('invitations').insert(row).select(COLS));
  return rows[0] as Invitation;
}

// 내용·템플릿만 고친다. 발행 열은 RPC 로만 바뀐다(서버 가드).
export async function updateInvitation(
  ledgerId: string,
  id: string,
  patch: { content?: InvitationContent; templateId?: string },
): Promise<Invitation> {
  const rows = unwrap(
    await db()
      .from('invitations')
      .update({
        ...(patch.content ? { content: patch.content as unknown as TablesInsert<'invitations'>['content'] } : {}),
        ...(patch.templateId ? { template_id: patch.templateId } : {}),
      })
      .eq('ledger_id', ledgerId)
      .eq('id', id)
      .select(COLS),
  );
  return rows[0] as Invitation;
}

export async function deleteInvitation(ledgerId: string, id: string): Promise<void> {
  unwrap(await db().from('invitations').delete().eq('ledger_id', ledgerId).eq('id', id));
}

export async function publishInvitation(
  id: string,
  months: number,
): Promise<{ slug: string; published_at: string; expires_at: string }> {
  const rows = unwrap(await db().rpc('publish_invitation', { p_invitation_id: id, p_months: months }));
  const r = rows[0];
  if (!r) throw new Error('발행 결과가 비어 있습니다.');
  return r;
}

export async function unpublishInvitation(id: string): Promise<void> {
  unwrap(await db().rpc('unpublish_invitation', { p_invitation_id: id }));
}

// ---------------------------------------------------------------------------
// 사진 — 버킷 invitations, 경로 {ledger_id}/{invitation_id}/{이름}. 공개 읽기.
// ---------------------------------------------------------------------------
export function photoPath(ledgerId: string, invitationId: string, name: string): string {
  return `${ledgerId}/${invitationId}/${name}`;
}

export async function uploadPhoto(
  ledgerId: string,
  invitationId: string,
  name: string,
  bytes: Uint8Array,
  contentType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<string> {
  const path = photoPath(ledgerId, invitationId, name);
  const { error } = await db().storage.from('invitations').upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`사진을 올리지 못했습니다. ${error.message}`);
  return path;
}

export async function removePhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await db().storage.from('invitations').remove(paths);
  if (error) throw new Error(`사진을 지우지 못했습니다. ${error.message}`);
}

// 공개 URL. 워커의 assetUrl 과 같은 규칙이어야 미리보기와 공개 페이지가 같은 그림을 본다.
export function photoUrl(path: string): string {
  return db().storage.from('invitations').getPublicUrl(path).data.publicUrl;
}
