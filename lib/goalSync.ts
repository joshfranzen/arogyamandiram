// ============================================
// Goal sync — keep `User.profile.goal` in step with weight vs targetWeight
// ============================================
//
// The user's goal direction is a derived fact: if current weight is meaningfully
// above the target weight, they're trying to lose; below, gain; within ±1 kg,
// maintain. We keep this in sync server-side so the UI's Goal selector and the
// AI plans always agree with the latest weight log.
//
// Called from:
// - app/api/weight/route.ts POST (every time the user logs a weight)
// - app/api/user/route.ts PUT (when profile fields are edited)

import User from '@/models/User';
import { deriveGoalDirection } from '@/app/api/ai/daily-plan/shared';

export async function syncGoalForUser(userId: unknown): Promise<void> {
  const user = await User.findById(userId)
    .select('profile.weight profile.targetWeight profile.goal')
    .lean() as { profile?: { weight?: number; targetWeight?: number; goal?: string } } | null;
  if (!user?.profile) return;
  const { weight, targetWeight, goal } = user.profile;
  const derived = deriveGoalDirection(weight, targetWeight, goal);
  if (derived !== goal) {
    await User.updateOne({ _id: userId }, { $set: { 'profile.goal': derived } });
  }
}
