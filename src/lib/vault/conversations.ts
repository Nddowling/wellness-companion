import 'server-only';

import { createVaultClient, isVaultEnabled } from '@/lib/supabase/vault';
import type { Json } from '@/types/database';

// PHI data-access for seeker chat transcripts (vault_conversations). Like the rest
// of the vault, every call goes through createVaultClient() (service-role, RLS-
// bypassing) and is scoped to a single auth_user_id. When the vault is gated off
// (no signed BAA), saves no-op and reads return empty — the chat still works, but
// nothing is persisted.

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type MatchedFacilitySnapshot = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

export type ConversationSummary = {
  id: string;
  title: string | null;
  created_at: string;
  facilityCount: number;
};

export type ConversationDetail = {
  id: string;
  title: string | null;
  created_at: string;
  messages: ChatMessage[];
  facilities: MatchedFacilitySnapshot[];
};

/**
 * Create or update a conversation transcript, scoped to its owner. Returns the id
 * (a fresh uuid on insert). No-ops to null when the vault is disabled.
 */
export async function upsertConversation(params: {
  id?: string | null;
  authUserId: string;
  title?: string | null;
  messages: ChatMessage[];
  matchId?: string | null;
  matchedFacilities?: MatchedFacilitySnapshot[];
  faceSheet?: Record<string, unknown>;
}): Promise<string | null> {
  if (!isVaultEnabled()) return params.id ?? null;
  const vault = createVaultClient();

  const fields = {
    title: params.title ?? null,
    messages: params.messages as unknown as Json,
    match_id: params.matchId ?? null,
    matched_facilities: (params.matchedFacilities ?? []) as unknown as Json,
    face_sheet: (params.faceSheet ?? {}) as Json,
  };

  if (params.id) {
    const { data } = await vault
      .from('vault_conversations')
      .update(fields)
      .eq('id', params.id)
      .eq('auth_user_id', params.authUserId) // never touch another account's row
      .select('id')
      .maybeSingle();
    if (data?.id) return data.id;
    // Row missing (e.g. created before the vault was enabled) — fall through to insert.
  }

  const { data, error } = await vault
    .from('vault_conversations')
    .insert({ auth_user_id: params.authUserId, ...fields })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id;
}

/** Every conversation for an account, newest first (for the history list). */
export async function listConversations(authUserId: string): Promise<ConversationSummary[]> {
  if (!isVaultEnabled()) return [];
  const vault = createVaultClient();
  const { data } = await vault
    .from('vault_conversations')
    .select('id, title, created_at, matched_facilities')
    .eq('auth_user_id', authUserId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    created_at: c.created_at,
    facilityCount: Array.isArray(c.matched_facilities) ? c.matched_facilities.length : 0,
  }));
}

/** One conversation (transcript + matched-program snapshot), scoped to its owner. */
export async function getConversation(
  authUserId: string,
  id: string
): Promise<ConversationDetail | null> {
  if (!isVaultEnabled()) return null;
  const vault = createVaultClient();
  const { data } = await vault
    .from('vault_conversations')
    .select('id, title, created_at, messages, matched_facilities')
    .eq('id', id)
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    created_at: data.created_at,
    messages: (Array.isArray(data.messages) ? data.messages : []) as unknown as ChatMessage[],
    facilities: (Array.isArray(data.matched_facilities)
      ? data.matched_facilities
      : []) as unknown as MatchedFacilitySnapshot[],
  };
}
