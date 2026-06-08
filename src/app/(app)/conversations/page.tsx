import Link from 'next/link';

import { requireSeeker } from '@/lib/auth';
import { listConversations } from '@/lib/vault/conversations';

export const metadata = { title: 'Your conversations' };

export default async function ConversationsPage() {
  const user = await requireSeeker();
  const conversations = await listConversations(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Your conversations</h1>
          <p className="text-sm text-slate-500">
            Every chat with your care companion is saved here privately. Open one to revisit it.
          </p>
        </div>
        <Link
          href="/match"
          className="shrink-0 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          New conversation
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          <p>You don&apos;t have any saved conversations yet.</p>
          <Link href="/match" className="mt-3 inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">
            Find care
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/conversations/${c.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-teal-300"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-800">
                  {c.title?.trim() || 'Conversation'}
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {c.facilityCount > 0
                  ? `${c.facilityCount} program${c.facilityCount === 1 ? '' : 's'} matched`
                  : 'No programs matched yet'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
