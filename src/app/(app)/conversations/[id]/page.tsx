import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireSeeker } from '@/lib/auth';
import { getConversation } from '@/lib/vault/conversations';

export const metadata = { title: 'Conversation' };

// Assistant turns can carry a hidden quick-reply marker ([[chips]] A | B …) that the
// live chat parses out. Strip it here so the saved transcript reads cleanly.
function stripChips(content: string): string {
  const m = content.match(/\n*\[\[?\s*chips\s*\]?\]/i);
  return (m && m.index !== undefined ? content.slice(0, m.index) : content).trimEnd();
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSeeker();
  const convo = await getConversation(user.id, id);
  if (!convo) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/conversations" className="text-xs text-slate-500 underline hover:text-teal-700">
            ← All conversations
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-800">
            {convo.title?.trim() || 'Conversation'}
          </h1>
          <p className="text-xs text-slate-400">{new Date(convo.created_at).toLocaleString()}</p>
        </div>
        <Link
          href="/match"
          className="shrink-0 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          New conversation
        </Link>
      </div>

      {/* Transcript */}
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        {convo.messages.length === 0 && (
          <p className="text-sm text-slate-400">This conversation has no messages.</p>
        )}
        {convo.messages.map((m, i) => {
          const text = m.role === 'assistant' ? stripChips(m.content) : m.content;
          if (!text) return null;
          return (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-teal-700 px-4 py-2 text-sm text-white'
                    : 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-mist px-4 py-2 text-sm text-ink'
                }
              >
                {text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Matched programs snapshot */}
      {convo.facilities.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Programs matched in this conversation</h2>
          <div className="space-y-2">
            {convo.facilities.map((f) => (
              <div key={f.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <Link
                  href={`/programs/${f.id}`}
                  className="font-medium text-teal-700 hover:underline"
                >
                  {f.name}
                </Link>
                <p className="text-xs text-slate-500">{[f.city, f.state].filter(Boolean).join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
