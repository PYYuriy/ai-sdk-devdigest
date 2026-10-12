import db from '@/lib/db';
import { createSession, listSessions } from '@/lib/chats';

// List all chat sessions (most recently updated first).
export function GET() {
  return Response.json(listSessions(db));
}

// Create a new chat session. Optional { title, agentId } in the body.
export async function POST(req: Request) {
  let body: { title?: string; agentId?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    // Empty/invalid body is fine — create a default session.
  }
  const session = createSession(db, {
    title: body.title,
    agentId: body.agentId ?? null,
  });
  return Response.json(session, { status: 201 });
}
