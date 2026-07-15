import { redirect } from 'next/navigation';

export const metadata = { title: 'My care' };

export default function ConversationsPage() {
  redirect('/me');
}
