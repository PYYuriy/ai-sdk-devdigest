import type { UIMessage } from 'ai';
import db from '@/lib/db';
import {
  deleteSession,
  getMessages,
  getSession,
  renameSession,
  replaceMessages,
} from '@/lib/chats';

type Ctx = { params: Promise<{ id: string }> };

// Fetch a session's messages (plus the session metadata).
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const session = getSession(db, id);
  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }
  return Response.json({ session, messages: getMessages(db, id) });
}

// Rename a session: { title: string }.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { title } = (await req.json()) as { title?: string };
  if (typeof title !== 'string') {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }
  const session = renameSession(db, id, title);
  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }
  return Response.json(session);
}

// Replace a session's messages with a full snapshot: { messages: UIMessage[] }.
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!getSession(db, id)) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }
  const { messages } = (await req.json()) as { messages?: UIMessage[] };
  if (!Array.isArray(messages)) {
    return Response.json({ error: 'messages must be an array' }, { status: 400 });
  }
  replaceMessages(db, id, messages);
  return Response.json({ session: getSession(db, id) });
}

// Delete a session and its messages.
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const deleted = deleteSession(db, id);
  if (!deleted) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
