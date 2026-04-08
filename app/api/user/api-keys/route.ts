// ============================================
// /api/user/api-keys - Manage User API Keys
// ============================================
// Keys are encrypted with AES-256 before storage.

import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { encrypt } from '@/lib/encryption';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

// PUT /api/user/api-keys - Save/update API keys
export async function PUT(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const { openai, fdcApiKey } = await req.json();

    await connectDB();

    const updateData: Record<string, string> = {};

    if (openai !== undefined) {
      updateData['apiKeys.openai'] = openai ? encrypt(openai) : '';
    }
    if (fdcApiKey !== undefined) {
      updateData['apiKeys.fdcApiKey'] = fdcApiKey ? encrypt(fdcApiKey) : '';
    }

    await User.findByIdAndUpdate(userId, { $set: updateData });

    return maskedResponse(
      {
        hasOpenAiKey: Boolean(openai),
        hasFdcKey: Boolean(fdcApiKey),
      },
      { message: 'API keys saved securely' }
    );
  } catch (err) {
    console.error('[API Keys Error]:', err);
    return errorResponse('Failed to save API keys', 500);
  }
}

// DELETE /api/user/api-keys - Remove specific API key
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const { key } = await req.json(); // 'openai' or 'fdc'

    await connectDB();

    const updateData: Record<string, string> = {};

    if (key === 'openai') {
      updateData['apiKeys.openai'] = '';
    } else if (key === 'fdc') {
      updateData['apiKeys.fdcApiKey'] = '';
    } else {
      return errorResponse('Invalid key type', 400);
    }

    await User.findByIdAndUpdate(userId, { $set: updateData });

    return maskedResponse(null, { message: `${key} API key removed` });
  } catch (err) {
    console.error('[API Keys Delete Error]:', err);
    return errorResponse('Failed to remove API key', 500);
  }
}
