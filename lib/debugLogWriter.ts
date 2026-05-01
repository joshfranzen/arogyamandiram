import { promises as fs } from 'fs';
import path from 'path';
import connectDB from '@/lib/db';
import User from '@/models/User';

type DebugLogPayload = Record<string, unknown>;

function makeLogId(iso: string): string {
  const ts = iso.replace(/[:.]/g, '-').slice(0, 24);
  return `${ts}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getUserLogId(userId: string): Promise<string> {
  await connectDB();
  const user = await User.findById(userId).select('username').lean();
  const username = (user as { username?: string } | null)?.username?.trim();
  return username ? username.toLowerCase() : userId;
}

export async function writeDebugLog(params: {
  userId: string;
  page: string;
  agent: string;
  payload: DebugLogPayload;
}): Promise<void> {
  if (process.env.NEXT_PUBLIC_DEBUG_MODE !== 'true') return;

  try {
    const nowIso = new Date().toISOString();
    const userLogId = await getUserLogId(params.userId);
    const dir = path.join(process.cwd(), '.debug-logs', userLogId, params.page, params.agent);
    await fs.mkdir(dir, { recursive: true });

    const normalizedPayload: DebugLogPayload = {
      ...params.payload,
      metadata: {
        ...((params.payload.metadata as Record<string, unknown> | undefined) ?? {}),
        username: userLogId,
        timestamp: (
          (params.payload.metadata as { timestamp?: string } | undefined)?.timestamp
          ?? nowIso
        ),
      },
      userRequest: {
        ...((params.payload.userRequest as Record<string, unknown> | undefined) ?? {}),
        requestedAt: (
          (params.payload.userRequest as { requestedAt?: string } | undefined)?.requestedAt
          ?? nowIso
        ),
      },
    };

    const filePath = path.join(dir, `${makeLogId(nowIso)}.json`);
    await fs.writeFile(filePath, JSON.stringify(normalizedPayload, null, 2), 'utf-8');
  } catch {
    // Debug logs are best-effort and should never break API responses.
  }
}
