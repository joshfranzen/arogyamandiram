'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Bell, Key, Save, Settings, Target, User, Ruler, Activity, Flag, PersonStanding,
  Shield, Eye, EyeOff, CheckCircle2, Sparkles, Utensils, Dumbbell,
  Loader2, RefreshCw, Flame, Droplets, Drumstick, Cookie, ChefHat, Scale, Timer, Moon,
  Mail, Plus, X, ListChecks, Pill, Zap, Trash2, Pencil,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useUser } from '@/hooks/useUser';
import api from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { getTargetsForUser } from '@/lib/health';
import DashboardPageShell from '@/components/layout/DashboardPageShell';
import StatCard from '@/components/ui/StatCard';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TodoTemplate { id: string; title: string; note: string; time: string; category: string; enabled: boolean; frequency?: number; baseItems?: Record<string, unknown>[]; }

// ─── Constants ────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'targets' | 'api-keys' | 'preferences' | 'todos';

const NAV_ITEMS: { key: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'profile',     label: 'Profile',      icon: User,         desc: 'Personal info & body composition' },
  { key: 'targets',     label: 'Targets',      icon: Target,       desc: 'Daily goals & macros' },
  { key: 'api-keys',    label: 'API Keys',     icon: Key,          desc: 'OpenAI & USDA Food keys' },
  { key: 'preferences', label: 'Preferences',  icon: Bell,         desc: 'Units, reminders & email' },
  { key: 'todos',       label: 'Daily Todos',  icon: ListChecks,   desc: 'Recurring daily checklist items' },
];

const activityLevels = [
  { value: 'sedentary',   label: 'Sedentary',   desc: 'Little or no exercise' },
  { value: 'light',       label: 'Light',        desc: '1–3 days/week' },
  { value: 'moderate',    label: 'Moderate',     desc: '3–5 days/week' },
  { value: 'active',      label: 'Active',       desc: '6–7 days/week' },
  { value: 'very_active', label: 'Very Active',  desc: 'Intense daily exercise' },
];

const goals = [
  { value: 'lose',     label: 'Lose Weight', desc: 'Calorie deficit' },
  { value: 'maintain', label: 'Maintain',    desc: 'Stay current' },
  { value: 'gain',     label: 'Gain Weight', desc: 'Calorie surplus' },
];

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function SettingsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading, refetch } = useUser();

  const rawTab = searchParams.get('tab') as Tab | null;
  const validTabs: Tab[] = ['profile', 'targets', 'api-keys', 'preferences', 'todos'];
  const [activeTab, setActiveTabState] = useState<Tab>(
    rawTab && validTabs.includes(rawTab) ? rawTab : 'profile'
  );

  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab);
    router.replace(`/settings?tab=${tab}`, { scroll: false });
  };

  // ── Profile state ──────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [goal, setGoal] = useState('maintain');
  const [targetWeight, setTargetWeight] = useState('');
  const [bodyType, setBodyType] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [fatFocusAreas, setFatFocusAreas] = useState<string[]>([]);

  // ── Targets state ──────────────────────────────────────────────────────────
  const [targetsSaving, setTargetsSaving] = useState(false);
  const [regeneratingPlan, setRegeneratingPlan] = useState(false);
  const [recalculatingTargets, setRecalculatingTargets] = useState(false);
  const [dailyCalories, setDailyCalories] = useState('');
  const [dailyWater, setDailyWater] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  // ── API Keys state ─────────────────────────────────────────────────────────
  const [apiKeysSaving, setApiKeysSaving] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [fdcKey, setFdcKey] = useState('');
  const [showOpenai, setShowOpenai] = useState(false);
  const [showFdc, setShowFdc] = useState(false);

  // ── Preferences state ──────────────────────────────────────────────────────
  const [prefSaving, setPrefSaving] = useState(false);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [waterNotif, setWaterNotif] = useState(true);
  const [mealNotif, setMealNotif] = useState(true);
  const [weighInNotif, setWeighInNotif] = useState(true);
  const [workoutNotif, setWorkoutNotif] = useState(true);
  const [sleepNotif, setSleepNotif] = useState(true);
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [savingRecipients, setSavingRecipients] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [waterHourlyEnabled, setWaterHourlyEnabled] = useState(true);
  const [breakfastTime, setBreakfastTime] = useState('08:00');
  const [lunchTime, setLunchTime] = useState('13:00');
  const [dinnerTime, setDinnerTime] = useState('20:00');
  const [sleepTime, setSleepTime] = useState('22:30');
  const [lastSentAt, setLastSentAt] = useState<Record<string, string>>({});
  const [emailChecklist, setEmailChecklist] = useState({
    smtpSaved: false, smtpTestSent: false, imapSaved: false, imapTestSent: false,
    recipientListSaved: false, imapReplyVerifiedAt: '', lastUpdatedAt: '',
  });
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [imapUser, setImapUser] = useState('');
  const [imapPass, setImapPass] = useState('');
  const [showImapPass, setShowImapPass] = useState(false);
  const [savingImap, setSavingImap] = useState(false);
  const [imapConfigured, setImapConfigured] = useState(false);
  const imapPollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imapPollingStartedAtRef = useRef<number | null>(null);
  const imapPollingInFlightRef = useRef(false);
  const hasShownImapVerifiedToastRef = useRef(false);

  // ── Populate all state from user ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // Profile
    setUsername(user.username || '');
    const p = user.profile;
    if (p) {
      setName(p.name || '');
      if (p.dateOfBirth) {
        const d = String(p.dateOfBirth);
        setDateOfBirth(d.includes('T') ? d.split('T')[0] : d);
        setAge('');
      } else {
        setDateOfBirth('');
        setAge(p.age?.toString() || '');
      }
      setGender(p.gender || 'male');
      setHeight(p.height?.toString() || '');
      setWeight(p.weight?.toString() || '');
      setActivityLevel(p.activityLevel || 'moderate');
      setGoal(p.goal || 'maintain');
      setTargetWeight(p.targetWeight?.toString() || '');
      setBodyType((p as { bodyType?: string }).bodyType || '');
      setBodyFat((p as { bodyFat?: number }).bodyFat?.toString() || '');
      setFatFocusAreas((p as { fatFocusAreas?: string[] }).fatFocusAreas || []);
    }

    // Targets
    if (user.targets) {
      const t = user.targets;
      setDailyCalories(t.dailyCalories?.toString() || '');
      setDailyWater(t.dailyWater?.toString() || '');
      setProtein(t.protein?.toString() || '');
      setCarbs(t.carbs?.toString() || '');
      setFat(t.fat?.toString() || '');
    }

    // Preferences
    if (user.settings) {
      const s = user.settings;
      setUnits(s.units || 'metric');
      setWaterNotif(s.notifications?.water ?? true);
      setMealNotif(s.notifications?.meals ?? true);
      setWeighInNotif(s.notifications?.weighIn ?? true);
      setWorkoutNotif(s.notifications?.workout ?? true);
      setSleepNotif(s.notifications?.sleep ?? true);
      const saved = s.recipientEmails?.length ? s.recipientEmails : (s.ccEmails?.length ? s.ccEmails : []);
      setRecipientEmails(Array.from(new Set(saved.map((e: string) => e.trim().toLowerCase()))));
      setTimezone(s.reminderSchedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata');
      setWaterHourlyEnabled(s.reminderSchedule?.waterHourlyEnabled ?? true);
      setBreakfastTime(s.reminderSchedule?.mealTimes?.breakfast || '08:00');
      setLunchTime(s.reminderSchedule?.mealTimes?.lunch || '13:00');
      setDinnerTime(s.reminderSchedule?.mealTimes?.dinner || '20:00');
      setSleepTime(s.reminderSchedule?.sleepTime || '22:30');
      const lsa = s.reminderSchedule?.lastSentAt ?? {};
      setLastSentAt({
        water: String(lsa.water ?? ''), breakfast: String(lsa.breakfast ?? ''),
        lunch: String(lsa.lunch ?? ''), dinner: String(lsa.dinner ?? ''),
        sleep: String(lsa.sleep ?? ''), workout: String(lsa.workout ?? ''),
        weighIn: String(lsa.weighIn ?? ''),
      });
      setEmailChecklist({
        smtpSaved: s.emailSetupChecklist?.smtpSaved ?? false,
        smtpTestSent: s.emailSetupChecklist?.smtpTestSent ?? false,
        imapSaved: s.emailSetupChecklist?.imapSaved ?? false,
        imapTestSent: s.emailSetupChecklist?.imapTestSent ?? false,
        recipientListSaved: s.emailSetupChecklist?.recipientListSaved ?? false,
        imapReplyVerifiedAt: s.emailSetupChecklist?.imapReplyVerifiedAt || '',
        lastUpdatedAt: s.emailSetupChecklist?.lastUpdatedAt || '',
      });
      if (s.emailSettings?.smtp) setSmtpUser(s.emailSettings.smtp.user ?? '');
      if (s.emailSettings?.imap) setImapUser(s.emailSettings.imap.user ?? '');
    }
    if (user.hasSmtp) setSmtpConfigured(true);
    if (user.hasImap) setImapConfigured(true);
  }, [user]);

  useEffect(() => () => { stopImapVerificationPolling(); }, []);

  useEffect(() => {
    const shouldPoll = emailChecklist.imapTestSent && !emailChecklist.imapReplyVerifiedAt;
    if (shouldPoll) void startImapVerificationPolling(false, emailChecklist.lastUpdatedAt || undefined);
    else stopImapVerificationPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailChecklist.imapTestSent, emailChecklist.imapReplyVerifiedAt, emailChecklist.lastUpdatedAt]);

  // ── IMAP polling helpers ───────────────────────────────────────────────────
  const stopImapVerificationPolling = () => {
    if (imapPollingIntervalRef.current) { clearInterval(imapPollingIntervalRef.current); imapPollingIntervalRef.current = null; }
    imapPollingStartedAtRef.current = null;
    imapPollingInFlightRef.current = false;
  };

  const checkImapVerificationNow = async () => {
    if (imapPollingInFlightRef.current) return false;
    imapPollingInFlightRef.current = true;
    const res = await api.verifyImapTestReply();
    imapPollingInFlightRef.current = false;
    if (!res.success) return false;
    if (res.data?.verified) {
      const verifiedAt = res.data.verifiedAt || new Date().toISOString();
      setEmailChecklist((prev) => ({ ...prev, imapReplyVerifiedAt: verifiedAt, imapTestSent: true }));
      if (!hasShownImapVerifiedToastRef.current) {
        showToast('IMAP verification complete. Reply processing is working.', 'success');
        hasShownImapVerifiedToastRef.current = true;
      }
      stopImapVerificationPolling();
      refetch();
      return true;
    }
    return false;
  };

  const startImapVerificationPolling = async (forceRestart = false, startedAtIso?: string) => {
    if (imapPollingIntervalRef.current && !forceRestart) return;
    stopImapVerificationPolling();
    hasShownImapVerifiedToastRef.current = false;
    const ms = startedAtIso ? new Date(startedAtIso).getTime() : Date.now();
    imapPollingStartedAtRef.current = Number.isNaN(ms) ? Date.now() : ms;
    const found = await checkImapVerificationNow();
    if (found) return;
    imapPollingIntervalRef.current = setInterval(async () => {
      const f = await checkImapVerificationNow();
      if (f) return;
      if (Date.now() - (imapPollingStartedAtRef.current ?? Date.now()) >= 10 * 60 * 1000)
        stopImapVerificationPolling();
    }, 60_000);
  };

  // ── Profile save ───────────────────────────────────────────────────────────
  const saveProfile = async () => {
    setSaving(true);
    try {
      if (username.trim()) {
        const un = username.trim().toLowerCase().replace(/\s+/g, '_');
        if (un.length < 3) { showToast('Username must be at least 3 characters', 'error'); return; }
        if (!/^[a-z0-9_]+$/.test(un)) { showToast('Username can only contain letters, numbers, and underscores', 'error'); return; }
      }
      const profilePayload: Record<string, unknown> = {
        name, gender, height: parseFloat(height), weight: parseFloat(weight),
        activityLevel, goal, targetWeight: parseFloat(targetWeight),
        ...(bodyType ? { bodyType } : {}),
        ...(bodyFat && !isNaN(parseFloat(bodyFat)) ? { bodyFat: parseFloat(bodyFat) } : {}),
        fatFocusAreas,
      };
      if (dateOfBirth) profilePayload.dateOfBirth = dateOfBirth;
      else if (age) profilePayload.age = parseInt(age, 10);
      const normalizedUsername = username.trim() ? username.trim().toLowerCase().replace(/\s+/g, '_') : undefined;
      const res = await api.updateUser({ profile: profilePayload, ...(normalizedUsername && { username: normalizedUsername }) });
      if (res.success) {
        showToast('Profile updated', 'success');
        const updated = res.data as { username?: string } | undefined;
        if (updated?.username) setUsername(updated.username);
        await refetch();
      } else {
        showToast(res.error || 'Failed to save', 'error');
      }
    } catch { showToast('Failed to save profile', 'error'); }
    finally { setSaving(false); }
  };

  // ── Targets save ───────────────────────────────────────────────────────────
  const saveTargets = async () => {
    setTargetsSaving(true);
    try {
      const res = await api.updateTargets({
        dailyCalories: parseInt(dailyCalories), dailyWater: parseInt(dailyWater),
        protein: parseInt(protein), carbs: parseInt(carbs), fat: parseInt(fat),
      });
      if (res.success) { showToast('Targets updated', 'success'); refetch(); }
      else showToast(res.error || 'Failed to save', 'error');
    } catch { showToast('Failed to save targets', 'error'); }
    finally { setTargetsSaving(false); }
  };

  const recalculateTargetsFromProfile = async () => {
    setRecalculatingTargets(true);
    try {
      const res = await api.recalculateTargets();
      if (res.success && res.data) {
        showToast('Targets recalculated from your profile', 'success');
        await refetch();
        const t = (res.data as { targets?: Record<string, number> })?.targets;
        if (t) {
          setDailyCalories(String(t.dailyCalories ?? ''));
          setDailyWater(String(t.dailyWater ?? ''));
          setProtein(String(t.protein ?? ''));
          setCarbs(String(t.carbs ?? ''));
          setFat(String(t.fat ?? ''));
        }
      } else showToast(res.error || 'Failed to recalculate', 'error');
    } catch { showToast('Failed to recalculate targets', 'error'); }
    finally { setRecalculatingTargets(false); }
  };

  const regenerateHealthPlan = async () => {
    setRegeneratingPlan(true);
    try {
      const res = await api.generateHealthPlan();
      if (res.success && res.data) {
        showToast('AI health plan updated', 'success');
        refetch();
        const data = res.data as { explanations?: Record<string, string> };
        if (data.explanations && Object.keys(data.explanations).length > 0) {
          const first = Object.entries(data.explanations)[0];
          showToast(first[1], 'info');
        }
      } else showToast(res.error || 'Failed to generate health plan', 'error');
    } catch { showToast('Failed to generate health plan', 'error'); }
    finally { setRegeneratingPlan(false); }
  };

  // ── API Keys save ──────────────────────────────────────────────────────────
  const saveApiKeys = async () => {
    setApiKeysSaving(true);
    try {
      const keys: Record<string, string> = {};
      if (openaiKey) keys.openai = openaiKey;
      if (fdcKey) keys.fdcApiKey = fdcKey;
      if (Object.keys(keys).length === 0) { showToast('No keys to save', 'info'); return; }
      const res = await api.saveApiKeys(keys);
      if (res.success) {
        showToast('API keys saved securely', 'success');
        setOpenaiKey(''); setFdcKey(''); refetch();
      } else showToast(res.error || 'Failed to save keys', 'error');
    } catch { showToast('Failed to save API keys', 'error'); }
    finally { setApiKeysSaving(false); }
  };

  // ── Preferences save ───────────────────────────────────────────────────────
  const savePreferences = async () => {
    setPrefSaving(true);
    try {
      const res = await api.updateSettings({
        units,
        notifications: { water: waterNotif, meals: mealNotif, weighIn: weighInNotif, workout: workoutNotif, sleep: sleepNotif },
        reminderSchedule: {
          timezone, waterHourlyEnabled,
          mealTimes: { breakfast: breakfastTime, lunch: lunchTime, dinner: dinnerTime },
          sleepTime,
        },
      });
      if (res.success) { showToast('Preferences saved', 'success'); refetch(); }
      else showToast(res.error || 'Failed to save', 'error');
    } catch { showToast('Failed to save preferences', 'error'); }
    finally { setPrefSaving(false); }
  };

  function addRecipientEmail() {
    const email = recipientInput.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    if (recipientEmails.includes(email)) { setRecipientInput(''); return; }
    setRecipientEmails([...recipientEmails, email]);
    setRecipientInput('');
  }

  const saveRecipientEmails = async () => {
    setSavingRecipients(true);
    try {
      const res = await api.updateSettings({ recipientEmails });
      if (res.success) {
        showToast('Recipients saved', 'success');
        setEmailChecklist((prev) => ({ ...prev, recipientListSaved: true }));
        refetch();
      } else showToast(res.error || 'Failed to save', 'error');
    } catch { showToast('Failed to save recipients', 'error'); }
    finally { setSavingRecipients(false); }
  };

  const sendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const saveRes = await api.updateSettings({ recipientEmails });
      if (!saveRes.success) { showToast(saveRes.error || 'Failed to save recipients', 'error'); return; }
      const testRes = await api.sendEmailTest('smtp_test');
      if (testRes.success) {
        setEmailChecklist((prev) => ({ ...prev, smtpTestSent: true, recipientListSaved: true }));
        showToast('SMTP test email sent. Check all recipients.', 'success');
        refetch();
      } else showToast(testRes.error || 'Failed to send test email', 'error');
    } catch { showToast('Failed to send test email', 'error'); }
    finally { setSendingTestEmail(false); }
  };

  const saveSmtpSettings = async () => {
    setSavingSmtp(true);
    try {
      const smtp: Record<string, unknown> = { user: smtpUser };
      if (smtpPass) smtp.pass = smtpPass;
      const res = await api.saveEmailSettings({ smtp });
      if (res.success) {
        const smtpTestSent = Boolean((res.data as { emailTest?: { smtpTestSent?: boolean } })?.emailTest?.smtpTestSent);
        const testError = (res.data as { emailTest?: { error?: string } })?.emailTest?.error;
        setEmailChecklist((prev) => ({ ...prev, smtpSaved: true, smtpTestSent }));
        if (testError) showToast(testError, 'error');
        else showToast(res.message || 'SMTP settings saved and test email sent', 'success');
        setSmtpPass(''); setSmtpConfigured(true); refetch();
      } else showToast(res.error || 'Failed to save SMTP', 'error');
    } catch { showToast('Failed to save SMTP settings', 'error'); }
    finally { setSavingSmtp(false); }
  };

  const saveImapSettings = async () => {
    setSavingImap(true);
    try {
      const imap: Record<string, unknown> = { user: imapUser };
      if (imapPass) imap.pass = imapPass;
      const res = await api.saveEmailSettings({ imap });
      if (res.success) {
        const imapTestSent = Boolean((res.data as { emailTest?: { imapTestSent?: boolean } })?.emailTest?.imapTestSent);
        const testError = (res.data as { emailTest?: { error?: string } })?.emailTest?.error;
        setEmailChecklist((prev) => ({ ...prev, imapSaved: true, imapTestSent }));
        if (testError) showToast(testError, 'error');
        else showToast(res.message || 'IMAP settings saved and test email sent', 'success');
        setImapPass(''); setImapConfigured(true); refetch();
        if (imapTestSent) {
          const startedAt = new Date().toISOString();
          setEmailChecklist((prev) => ({ ...prev, lastUpdatedAt: startedAt }));
          await startImapVerificationPolling(true, startedAt);
        }
      } else showToast(res.error || 'Failed to save IMAP', 'error');
    } catch { showToast('Failed to save IMAP settings', 'error'); }
    finally { setSavingImap(false); }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  function formatLastSent(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dStr = d.toLocaleDateString('en-CA');
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (dStr === todayStr) return `Today at ${time}`;
    if (dStr === yesterday.toLocaleDateString('en-CA')) return `Yesterday at ${time}`;
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${time}`;
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex gap-6">
        <div className="hidden w-52 shrink-0 lg:block">
          <CardSkeleton className="h-64" />
        </div>
        <div className="flex-1 space-y-4">
          <CardSkeleton className="h-48" />
          <CardSkeleton className="h-64" />
          <CardSkeleton className="h-48" />
        </div>
      </div>
    );
  }

  const currentTargets = user?.targets;
  const formulaTargets = user ? getTargetsForUser(user) : null;
  const openAiActive = !!user?.hasOpenAiKey;
  const fdcActive = !!user?.hasFdcKey;
  const hasSmtp = smtpConfigured || (user?.hasSmtp ?? false);
  const hasImap = imapConfigured || (user?.hasImap ?? false);
  const enabledCount = [waterNotif, mealNotif, weighInNotif, workoutNotif, sleepNotif].filter(Boolean).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6 lg:items-start">

      {/* ── Left nav — desktop ── */}
      <aside className="hidden lg:flex lg:w-52 lg:shrink-0 lg:flex-col">
        <div className="glass-card sticky top-4 rounded-2xl p-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all',
                activeTab === item.key
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
              )}
            >
              <item.icon className={cn('h-4 w-4 shrink-0', activeTab === item.key ? 'text-emerald-400' : 'text-zinc-500')} />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{item.label}</p>
                <p className="mt-0.5 truncate text-[10px] opacity-60">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Top tab bar — mobile ── */}
      <div className="flex overflow-x-auto gap-2 pb-1 lg:hidden">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveTab(item.key)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === item.key
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-transparent bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {/* ── Content area ── */}
      <div className="min-w-0 flex-1 space-y-4">

        {/* ══════ PROFILE ══════ */}
        {activeTab === 'profile' && (
          <>
            {/* Personal */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-text-primary">Personal</h2>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-text-muted">Full Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Username</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. john_doe" minLength={3} maxLength={30}
                    className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  <p className="mt-1 text-xs text-zinc-400">Letters, numbers, underscores only.</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Date of birth</label>
                  <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="glass-input date-input mt-1 w-full rounded-xl px-3 py-2 text-left text-sm bg-zinc-900 border border-zinc-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  {dateOfBirth && (
                    <p className="mt-1 text-xs text-zinc-400">Age: {(() => {
                      const birth = new Date(dateOfBirth); const today = new Date();
                      let a = today.getFullYear() - birth.getFullYear();
                      const m = today.getMonth() - birth.getMonth();
                      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a -= 1;
                      return a;
                    })()} years</p>
                  )}
                </div>
                {!dateOfBirth && (
                  <div>
                    <label className="text-xs font-medium text-text-muted">Age (if no birth date)</label>
                    <input type="number" value={age} onChange={(e) => setAge(e.target.value)} min={10} max={120} placeholder="25"
                      className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-text-muted">Gender</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)}
                    className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Body metrics */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-accent-cyan" />
                <h2 className="text-base font-semibold text-text-primary">Body metrics</h2>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  { label: 'Height (cm)', value: height, set: setHeight },
                  { label: 'Current Weight (kg)', value: weight, set: setWeight, step: 0.1 },
                  { label: 'Target Weight (kg)', value: targetWeight, set: setTargetWeight, step: 0.1 },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="text-xs font-medium text-text-muted">{f.label}</label>
                    <input type="number" value={f.value} onChange={(e) => f.set(e.target.value)} step={f.step ?? 1}
                      className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                ))}
              </div>
            </div>

            {/* Activity */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent-rose" />
                <h2 className="text-base font-semibold text-text-primary">Activity level</h2>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {activityLevels.map((al) => (
                  <button key={al.value} type="button" onClick={() => setActivityLevel(al.value)}
                    className={cn('rounded-2xl border px-3 py-3 text-left text-xs transition-all',
                      activityLevel === al.value ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700')}>
                    <p className={cn('font-semibold', activityLevel === al.value ? 'text-emerald-400' : 'text-zinc-200')}>{al.label}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-400">{al.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Goal */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-accent-emerald" />
                <h2 className="text-base font-semibold text-text-primary">Goal</h2>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {goals.map((g) => (
                  <button key={g.value} type="button" onClick={() => setGoal(g.value)}
                    className={cn('rounded-2xl border px-4 py-3 text-left text-xs transition-all',
                      goal === g.value ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700')}>
                    <p className={cn('font-semibold', goal === g.value ? 'text-emerald-400' : 'text-zinc-200')}>{g.label}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-400">{g.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Body Composition */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2">
                <PersonStanding className="h-4 w-4 text-accent-cyan" />
                <h2 className="text-base font-semibold text-text-primary">Body Composition</h2>
              </div>
              <p className="mt-1 text-xs text-text-muted">Helps AI personalize your workout and nutrition plans.</p>
              <div className="mt-4">
                <label className="text-xs font-medium text-text-muted">Body Type</label>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    { value: 'ectomorph', label: 'Ectomorph', desc: 'Lean & hard to gain' },
                    { value: 'mesomorph', label: 'Mesomorph', desc: 'Athletic & muscular' },
                    { value: 'endomorph', label: 'Endomorph', desc: 'Stores fat easily' },
                  ].map((bt) => (
                    <button key={bt.value} type="button" onClick={() => setBodyType(bt.value)}
                      className={cn('rounded-2xl border px-3 py-3 text-left text-xs transition-all',
                        bodyType === bt.value ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700')}>
                      <p className={cn('font-semibold', bodyType === bt.value ? 'text-emerald-400' : 'text-zinc-200')}>{bt.label}</p>
                      <p className="mt-0.5 text-[10px] text-zinc-400">{bt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-text-muted">Body Fat % (optional)</label>
                <input type="number" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} placeholder="e.g. 18" min={1} max={60}
                  className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none sm:w-40" />
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-text-muted">Where do you want to focus fat loss?</label>
                <p className="mt-0.5 text-[10px] text-zinc-500">Select up to 3 areas</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['belly', 'thighs', 'arms', 'chest', 'overall'] as const).map((area) => {
                    const selected = fatFocusAreas.includes(area);
                    const disabled = !selected && fatFocusAreas.length >= 3;
                    return (
                      <button key={area} type="button" disabled={disabled}
                        onClick={() => setFatFocusAreas((prev) => selected ? prev.filter((a) => a !== area) : [...prev, area])}
                        className={cn('rounded-full border px-3 py-1.5 text-xs capitalize transition-all',
                          selected ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                            : disabled ? 'cursor-not-allowed border-zinc-800 text-zinc-600 opacity-50'
                              : 'border-zinc-700 text-zinc-400 hover:border-zinc-500')}>
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-text-muted">Fitness Level</label>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs capitalize text-zinc-300">
                    {(user?.profile as { fitnessLevelDerived?: string } | undefined)?.fitnessLevelDerived ?? 'Not yet detected'}
                  </span>
                  <span className="text-[10px] text-zinc-500">Auto-updated from your workout logs</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={saveProfile} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50">
                {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" /> : <Save className="h-4 w-4" />}
                Save Profile
              </button>
            </div>
          </>
        )}

        {/* ══════ TARGETS ══════ */}
        {activeTab === 'targets' && (
          <>
            {/* Stat summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard icon={Flame} label="Calories" value={`${currentTargets?.dailyCalories ?? '—'}`} subtitle="kcal/day" iconColor="text-accent-amber" />
              <StatCard icon={Droplets} label="Water" value={`${currentTargets?.dailyWater ?? '—'}`} subtitle="ml/day" iconColor="text-accent-cyan" />
              <StatCard icon={Drumstick} label="Protein" value={`${currentTargets?.protein ?? '—'}`} subtitle="g/day" iconColor="text-accent-violet" />
              <StatCard icon={Cookie} label="Carbs" value={`${currentTargets?.carbs ?? '—'}`} subtitle="g/day" iconColor="text-accent-amber" />
              <StatCard icon={ChefHat} label="Fat" value={`${currentTargets?.fat ?? '—'}`} subtitle="g/day" iconColor="text-accent-rose" />
              <StatCard icon={Scale} label="Ideal Weight" value={`${currentTargets?.idealWeight ?? '—'}`} subtitle="kg" iconColor="text-accent-emerald" />
              <StatCard icon={Timer} label="Workout" value={`${currentTargets?.dailyWorkoutMinutes ?? '—'}`} subtitle="min/day" iconColor="text-accent-cyan" />
              <StatCard icon={Flame} label="Burn Goal" value={`${currentTargets?.dailyCalorieBurn ?? '—'}`} subtitle="kcal/day" iconColor="text-accent-amber" />
              <StatCard icon={Moon} label="Sleep" value={`${currentTargets?.sleepHours ?? '—'}`} subtitle="hours/night" iconColor="text-accent-violet" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Left: actions */}
              <div className="flex flex-col gap-4">
                <div className="glass-card rounded-2xl p-6">
                  <p className="text-sm font-semibold text-text-primary">How targets work</p>
                  <p className="mt-2 text-xs leading-relaxed text-text-muted">
                    Targets are calculated from your profile using BMR/TDEE for calories, weight and activity for water, and age for sleep. Updating your profile recalculates them automatically.
                  </p>
                </div>

                <div className="glass-card rounded-2xl p-6">
                  <p className="text-sm font-semibold text-text-primary">Recalculate from profile</p>
                  <p className="mt-2 text-xs text-text-muted">Refresh all targets using your current profile data.</p>
                  <button type="button" onClick={recalculateTargetsFromProfile} disabled={recalculatingTargets}
                    className="mt-4 flex w-fit items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-white/[0.06] disabled:opacity-50">
                    {recalculatingTargets ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Recalculate
                  </button>
                </div>

                {user?.hasOpenAiKey && (
                  <div className="glass-card rounded-2xl border border-accent-violet/20 bg-accent-violet/5 p-6">
                    <p className="text-sm font-semibold text-text-primary">AI Health Plan</p>
                    <p className="mt-2 text-xs text-text-muted">Generate personalized targets based on your profile.</p>
                    <button type="button" onClick={regenerateHealthPlan} disabled={regeneratingPlan}
                      className="glass-button-primary mt-4 flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50">
                      {regeneratingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Regenerate plan
                    </button>
                  </div>
                )}

                {formulaTargets && (
                  <div className="glass-card rounded-2xl p-6">
                    <p className="text-sm font-semibold text-text-primary">From your profile (formula-based)</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      {[
                        { label: 'Ideal weight', value: `${formulaTargets.idealWeight} kg` },
                        { label: 'Workout (min/day)', value: String(formulaTargets.dailyWorkoutMinutes) },
                        { label: 'Calorie burn', value: `${formulaTargets.dailyCalorieBurn} kcal` },
                        { label: 'Sleep target', value: `${formulaTargets.sleepHours} h` },
                      ].map((r) => (
                        <div key={r.label} className="rounded-xl bg-white/[0.03] p-3">
                          <span className="text-xs text-text-muted">{r.label}</span>
                          <p className="mt-1 font-semibold text-text-primary">{r.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: editable targets */}
              <div className="glass-card flex flex-col rounded-2xl p-6 space-y-6">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Daily targets</p>
                  <p className="mt-1 text-xs text-text-muted">These values are used across your dashboard and trackers.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    { label: 'Daily Calories (kcal)', value: dailyCalories, set: setDailyCalories },
                    { label: 'Daily Water (ml)', value: dailyWater, set: setDailyWater },
                    { label: 'Protein (g)', value: protein, set: setProtein },
                    { label: 'Carbs (g)', value: carbs, set: setCarbs },
                  ].map((f) => (
                    <div key={f.label}>
                      <label className="text-xs font-medium text-text-muted">{f.label}</label>
                      <input type="number" value={f.value} onChange={(e) => f.set(e.target.value)}
                        className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm" />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-text-muted">Fat (g)</label>
                    <input type="number" value={fat} onChange={(e) => setFat(e.target.value)}
                      className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm" />
                  </div>
                </div>

                {protein && carbs && fat && (
                  <div className="rounded-2xl bg-white/[0.02] p-4">
                    <p className="text-xs font-semibold text-text-primary">Macro split</p>
                    <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-white/[0.04]">
                      {(() => {
                        const total = (parseInt(protein) || 0) * 4 + (parseInt(carbs) || 0) * 4 + (parseInt(fat) || 0) * 9;
                        const pPct = total > 0 ? (((parseInt(protein) || 0) * 4) / total) * 100 : 33;
                        const cPct = total > 0 ? (((parseInt(carbs) || 0) * 4) / total) * 100 : 33;
                        const fPct = total > 0 ? (((parseInt(fat) || 0) * 9) / total) * 100 : 34;
                        return (<>
                          <div className="bg-accent-violet" style={{ width: `${pPct}%` }} />
                          <div className="bg-accent-amber" style={{ width: `${cPct}%` }} />
                          <div className="bg-accent-rose" style={{ width: `${fPct}%` }} />
                        </>);
                      })()}
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-text-muted">
                      <span className="text-accent-violet">Protein {Math.round((((parseInt(protein) || 0) * 4) / ((parseInt(protein) || 0) * 4 + (parseInt(carbs) || 0) * 4 + (parseInt(fat) || 0) * 9)) * 100 || 0)}%</span>
                      <span className="text-accent-amber">Carbs {Math.round((((parseInt(carbs) || 0) * 4) / ((parseInt(protein) || 0) * 4 + (parseInt(carbs) || 0) * 4 + (parseInt(fat) || 0) * 9)) * 100 || 0)}%</span>
                      <span className="text-accent-rose">Fat {Math.round((((parseInt(fat) || 0) * 9) / ((parseInt(protein) || 0) * 4 + (parseInt(carbs) || 0) * 4 + (parseInt(fat) || 0) * 9)) * 100 || 0)}%</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button onClick={saveTargets} disabled={targetsSaving}
                    className="glass-button-primary flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
                    {targetsSaving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                    Save Targets
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════ API KEYS ══════ */}
        {activeTab === 'api-keys' && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard icon={Sparkles} label="OpenAI" value={openAiActive ? 'Active' : 'Not connected'} subtitle="Meal ideas, workout plan, insights" iconColor={openAiActive ? 'text-accent-emerald' : 'text-text-muted'} className={cn(!openAiActive && 'opacity-90')} />
              <StatCard icon={Utensils} label="USDA FoodData Central" value={fdcActive ? 'Active' : 'Not connected'} subtitle="300k+ foods — free key at fdc.nal.usda.gov" iconColor={fdcActive ? 'text-accent-emerald' : 'text-text-muted'} className={cn(!fdcActive && 'opacity-90')} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Left: security info */}
              <div className="flex flex-col gap-4">
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-start gap-3">
                    <Shield className="mt-0.5 h-5 w-5 shrink-0 text-accent-cyan" />
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Encrypted storage</p>
                      <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                        Keys are encrypted with AES-256 before storage. They are never sent to the browser — only boolean flags are returned.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-6 flex-1">
                  <p className="text-sm font-semibold text-text-primary">Where these keys are used</p>
                  <div className="mt-4 space-y-2">
                    {[
                      { icon: Sparkles, label: 'Insights', desc: 'Daily plan, insights, recommendations', href: '/ai-insights', color: 'text-accent-violet' },
                      { icon: Utensils, label: 'Food', desc: 'AI meal ideas + USDA food search', href: '/food', color: 'text-accent-emerald' },
                      { icon: Dumbbell, label: 'Workout', desc: 'AI workout plan generation', href: '/workout', color: 'text-accent-rose' },
                    ].map((item) => (
                      <div key={item.href} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3">
                        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04]', item.color)}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary">{item.label}</p>
                          <p className="text-[11px] text-text-muted">{item.desc}</p>
                        </div>
                        <Link href={item.href} className="ml-auto text-xs font-medium text-accent-violet hover:underline">Open</Link>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: key inputs */}
              <div className="glass-card flex flex-col rounded-2xl p-6 space-y-5">
                {[
                  {
                    label: 'OpenAI API Key', active: openAiActive, show: showOpenai,
                    toggleShow: () => setShowOpenai(!showOpenai), value: openaiKey,
                    set: setOpenaiKey, placeholder: openAiActive ? '••••••••••••••••' : 'sk-...',
                    hint: 'Required for AI-powered meal suggestions, workout plans, and insights.',
                  },
                  {
                    label: 'USDA FoodData Central API Key', active: fdcActive, show: showFdc,
                    toggleShow: () => setShowFdc(!showFdc), value: fdcKey,
                    set: setFdcKey, placeholder: fdcActive ? '••••••••••••••••' : 'Your FDC API key',
                    hint: 'Required for food search. Get a free key at fdc.nal.usda.gov/api-key-signup',
                  },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{k.label}</span>
                      {k.active && (
                        <span className="flex items-center gap-1 rounded-md bg-accent-emerald/10 px-2 py-0.5 text-[10px] font-medium text-accent-emerald">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-text-muted">{k.hint}</p>
                    <div className="relative mt-3">
                      <input type={k.show ? 'text' : 'password'} value={k.value}
                        onChange={(e) => k.set(e.target.value)} placeholder={k.placeholder}
                        className="glass-input w-full rounded-xl px-3 py-2 pr-10 text-sm" />
                      <button type="button" onClick={k.toggleShow}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                        {k.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pt-4">
                  <button onClick={saveApiKeys} disabled={apiKeysSaving}
                    className="glass-button-primary flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
                    {apiKeysSaving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                    Save Keys
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════ PREFERENCES ══════ */}
        {activeTab === 'preferences' && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard icon={Scale} label="Units" value={units === 'metric' ? 'Metric' : 'Imperial'} subtitle={units === 'metric' ? 'kg, cm' : 'lbs, in'} iconColor="text-accent-violet" />
              <StatCard icon={Bell} label="Reminders" value={`${enabledCount}/5 enabled`} subtitle="Water, meals, weigh-in, workout, sleep" iconColor={enabledCount > 0 ? 'text-accent-emerald' : 'text-text-muted'} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Units */}
              <div className="glass-card rounded-2xl p-6">
                <p className="text-sm font-semibold text-text-primary">Units</p>
                <p className="mt-2 text-xs text-text-muted">Choose how weight and height are displayed across the app.</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {(['metric', 'imperial'] as const).map((u) => (
                    <button key={u} type="button" onClick={() => setUnits(u)}
                      className={cn('rounded-2xl border px-4 py-3 text-left transition-all',
                        units === u ? 'border-accent-violet/30 bg-accent-violet/10 text-accent-violet'
                          : 'border-white/[0.06] bg-white/[0.03] text-text-muted hover:bg-white/[0.05]')}>
                      <p className="text-sm font-semibold capitalize">{u}</p>
                      <p className="mt-0.5 text-[11px] opacity-80">{u === 'metric' ? 'kg, cm' : 'lbs, in'}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notifications */}
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Reminder notifications</p>
                    <p className="mt-1 text-xs text-text-muted">Control what you get nudged about.</p>
                  </div>
                  <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-text-muted">{enabledCount}/5 on</span>
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    { key: 'water', label: 'Water reminders', value: waterNotif, set: setWaterNotif, icon: Droplets, color: 'text-accent-cyan' },
                    { key: 'meals', label: 'Meal logging reminders', value: mealNotif, set: setMealNotif, icon: Utensils, color: 'text-accent-emerald' },
                    { key: 'weighIn', label: 'Daily weigh-in', value: weighInNotif, set: setWeighInNotif, icon: Scale, color: 'text-accent-amber' },
                    { key: 'workout', label: 'Workout reminders', value: workoutNotif, set: setWorkoutNotif, icon: Dumbbell, color: 'text-accent-rose' },
                    { key: 'sleep', label: 'Sleep reminders', value: sleepNotif, set: setSleepNotif, icon: Moon, color: 'text-accent-violet' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.02] px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]', item.color)}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <span className="truncate text-sm font-medium text-text-secondary">{item.label}</span>
                      </div>
                      <button type="button" onClick={() => item.set(!item.value)}
                        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200', item.value ? 'bg-accent-violet' : 'bg-white/[0.1]')}
                        aria-pressed={item.value}>
                        <span className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200', item.value && 'translate-x-5')} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={savePreferences} disabled={prefSaving}
                    className="glass-button-primary flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
                    {prefSaving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </div>
              </div>
            </div>

            {/* Recipients */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-accent-violet shrink-0" />
                <p className="text-sm font-semibold text-text-primary">Recipients</p>
              </div>
              <p className="mt-1.5 text-xs text-text-muted">Reminder and test emails are sent to this list.</p>
              <div className="mt-3 flex gap-2">
                <input type="email" value={recipientInput} onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addRecipientEmail()} placeholder="email@example.com"
                  className="min-w-0 flex-1 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-violet/50 transition-colors" />
                <button type="button" onClick={addRecipientEmail}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-violet/10 text-accent-violet hover:bg-accent-violet/20 transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {recipientEmails.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recipientEmails.map((email) => (
                    <span key={email} className="flex items-center gap-1 rounded-full bg-white/[0.05] border border-white/[0.06] px-2.5 py-1 text-[11px] text-text-secondary">
                      {email}
                      <button type="button" onClick={() => setRecipientEmails(recipientEmails.filter((e) => e !== email))}
                        className="text-text-muted hover:text-text-primary transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={sendTestEmail} disabled={sendingTestEmail || savingRecipients}
                  className="flex min-w-[130px] items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-5 py-2 text-sm font-semibold text-text-secondary hover:bg-white/[0.06] disabled:opacity-50">
                  {sendingTestEmail ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : 'Send Test Email'}
                </button>
                <button onClick={saveRecipientEmails} disabled={savingRecipients || sendingTestEmail}
                  className="glass-button-primary flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50">
                  {savingRecipients ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </div>

            {/* Reminder schedule + checklist */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="glass-card rounded-2xl p-6">
                <p className="text-sm font-semibold text-text-primary">Reminder schedule</p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-text-muted">Timezone</label>
                    <input type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Kolkata"
                      className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-violet/50 transition-colors" />
                  </div>
                  {[
                    { label: 'Breakfast time', value: breakfastTime, set: setBreakfastTime, key: 'breakfast' },
                    { label: 'Lunch time', value: lunchTime, set: setLunchTime, key: 'lunch' },
                    { label: 'Dinner time', value: dinnerTime, set: setDinnerTime, key: 'dinner' },
                    { label: 'Sleep reminder time', value: sleepTime, set: setSleepTime, key: 'sleep' },
                  ].map((t) => (
                    <div key={t.key}>
                      <label className="mb-1.5 block text-xs font-medium text-text-muted">{t.label}</label>
                      <input type="time" value={t.value} onChange={(e) => t.set(e.target.value)}
                        className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50 transition-colors" />
                      <p className="mt-1 text-[11px] text-text-muted">Last sent: {formatLastSent(lastSentAt[t.key]) || 'None'}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/[0.02] px-4 py-3">
                  <span className="text-sm font-medium text-text-secondary">Water reminders every 30 min</span>
                  <button type="button" onClick={() => setWaterHourlyEnabled(!waterHourlyEnabled)}
                    className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200', waterHourlyEnabled ? 'bg-accent-violet' : 'bg-white/[0.1]')}
                    aria-pressed={waterHourlyEnabled}>
                    <span className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200', waterHourlyEnabled && 'translate-x-5')} />
                  </button>
                </div>
                <p className="mt-2 px-1 text-[11px] text-text-muted">Last sent: {formatLastSent(lastSentAt.water) || 'None'}</p>
              </div>

              <div className="glass-card rounded-2xl p-6">
                <p className="text-sm font-semibold text-text-primary">Configuration checklist</p>
                <p className="mt-1 text-xs text-text-muted">Save SMTP/IMAP and recipients. Reply to the IMAP test email with "1000 ml water" to verify.</p>
                <div className="mt-4 space-y-2">
                  {[
                    { key: 'recipientListSaved', label: 'Recipient list saved', value: emailChecklist.recipientListSaved },
                    { key: 'smtpSaved', label: 'SMTP saved', value: emailChecklist.smtpSaved },
                    { key: 'smtpTestSent', label: 'SMTP test email sent', value: emailChecklist.smtpTestSent },
                    { key: 'imapSaved', label: 'IMAP saved', value: emailChecklist.imapSaved },
                    { key: 'imapTestSent', label: 'IMAP test email sent', value: emailChecklist.imapTestSent },
                    { key: 'imapReplyVerifiedAt', label: 'IMAP reply verified', value: Boolean(emailChecklist.imapReplyVerifiedAt) },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between rounded-2xl bg-white/[0.02] px-4 py-3">
                      <span className="text-sm text-text-secondary">{item.label}</span>
                      <span className={cn('text-xs font-semibold', item.value ? 'text-accent-emerald' : 'text-text-muted')}>
                        {item.value ? 'Done' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
                {emailChecklist.imapReplyVerifiedAt && (
                  <p className="mt-3 text-xs text-accent-emerald">Verified at: {new Date(emailChecklist.imapReplyVerifiedAt).toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* SMTP + IMAP */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[
                {
                  label: 'SMTP', desc: 'Sends reminders to your recipient list', configured: hasSmtp,
                  emailUser: smtpUser, setEmailUser: setSmtpUser, pass: smtpPass, setPass: setSmtpPass,
                  showPass: showSmtpPass, toggleShow: () => setShowSmtpPass(!showSmtpPass),
                  saving: savingSmtp, onSave: saveSmtpSettings, btnLabel: 'Save SMTP',
                },
                {
                  label: 'IMAP', desc: 'Reads your replies and auto-logs them', configured: hasImap,
                  emailUser: imapUser, setEmailUser: setImapUser, pass: imapPass, setPass: setImapPass,
                  showPass: showImapPass, toggleShow: () => setShowImapPass(!showImapPass),
                  saving: savingImap, onSave: saveImapSettings, btnLabel: 'Save IMAP',
                },
              ].map((cfg) => (
                <div key={cfg.label} className={cn('glass-card rounded-2xl p-5 flex flex-col transition-all duration-300', cfg.configured && 'border border-accent-emerald/30')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', cfg.configured ? 'bg-accent-emerald/15 text-accent-emerald' : 'bg-white/[0.04] text-accent-emerald')}>
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{cfg.label}</p>
                        <p className="mt-0.5 text-xs text-text-muted">{cfg.desc}</p>
                      </div>
                    </div>
                    {cfg.configured && (
                      <span className="shrink-0 rounded-full bg-accent-emerald/10 px-2.5 py-1 text-[11px] font-medium text-accent-emerald">Configured</span>
                    )}
                  </div>
                  <div className="mt-4 space-y-2.5">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-text-muted">Email</label>
                      <input type="email" value={cfg.emailUser} onChange={(e) => cfg.setEmailUser(e.target.value)} placeholder="you@gmail.com"
                        className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-violet/50 transition-colors" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-text-muted">Password</label>
                      <div className="relative">
                        <input type={cfg.showPass ? 'text' : 'password'} value={cfg.pass} onChange={(e) => cfg.setPass(e.target.value)}
                          placeholder={cfg.configured ? '•••••••• (leave blank to keep)' : 'App password'}
                          className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-violet/50 transition-colors" />
                        <button type="button" onClick={cfg.toggleShow}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors">
                          {cfg.showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button onClick={cfg.onSave} disabled={cfg.saving}
                      className="glass-button-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
                      {cfg.saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                      {cfg.btnLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══════ TODOS ══════ */}
        {activeTab === 'todos' && <TodosSettingsTab />}

      </div>
    </div>
  );
}

// ─── Todos Settings Tab Component ────────────────────────────────────────────

const TODO_CATEGORIES = [
  { value: 'food',       label: 'Food',       icon: Utensils,     color: 'text-sky-400',     bgColor: 'bg-sky-400/15',     barColor: 'bg-sky-500' },
  { value: 'supplement', label: 'Supplement', icon: Zap,          color: 'text-emerald-400', bgColor: 'bg-emerald-400/15', barColor: 'bg-emerald-500' },
  { value: 'medicine',   label: 'Medicine',   icon: Pill,         color: 'text-rose-400',    bgColor: 'bg-rose-400/15',    barColor: 'bg-rose-500' },
  { value: 'habit',      label: 'Habit',      icon: Flame,        color: 'text-amber-400',   bgColor: 'bg-amber-400/15',   barColor: 'bg-amber-500' },
  { value: 'other',      label: 'Other',      icon: CheckSquare,  color: 'text-zinc-400',    bgColor: 'bg-zinc-400/15',    barColor: 'bg-zinc-500' },
];

const todoInputCls = [
  'w-full rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600',
  'bg-zinc-950/80 border border-zinc-800/80',
  'transition-colors duration-150',
  'focus:border-zinc-600 focus:outline-none focus:ring-0',
  '[&:focus-visible]:outline-none',
].join(' ');

function TodoForm({
  values, onChange, onSubmit, onCancel, saving, submitLabel,
}: {
  values: { title: string; note: string; time: string; category: string; frequency: number };
  onChange: (f: { title: string; note: string; time: string; category: string; frequency: number }) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  const showFrequency = values.category === 'supplement' || values.category === 'medicine';
  return (
    <div className="mt-3 rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-5 space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Title</label>
        <input
          type="text" value={values.title} maxLength={80}
          onChange={(e) => onChange({ ...values, title: e.target.value })}
          placeholder="e.g. Vitamin D capsule"
          className={todoInputCls}
          autoComplete="off"
          style={{ outline: 'none', boxShadow: 'none' }}
        />
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Note <span className="normal-case font-normal text-zinc-600">(optional)</span>
        </label>
        <input
          type="text" value={values.note} maxLength={160}
          onChange={(e) => onChange({ ...values, note: e.target.value })}
          placeholder="e.g. Take with water after meal"
          className={todoInputCls}
          autoComplete="off"
          style={{ outline: 'none', boxShadow: 'none' }}
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Category</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TODO_CATEGORIES.map((c) => {
            const CatIcon = c.icon;
            const active = values.category === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onChange({ ...values, category: c.value, frequency: 1 })}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all',
                  active
                    ? `border-transparent ${c.bgColor} ${c.color}`
                    : 'border-zinc-800 bg-zinc-950/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                )}
              >
                <CatIcon className={cn('h-4 w-4 shrink-0', active ? c.color : 'text-zinc-600')} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Frequency — only for supplement / medicine */}
      {showFrequency && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            How many times per day?
          </label>
          <div className="flex gap-2">
            {FREQUENCY_OPTIONS.map((opt) => {
              const active = values.frequency === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ ...values, frequency: opt.value })}
                  className={cn(
                    'flex flex-col items-center rounded-lg border px-3 py-2 text-xs font-medium transition-all min-w-[52px]',
                    active
                      ? 'border-emerald-600 bg-emerald-500/10 text-emerald-300'
                      : 'border-zinc-800 bg-zinc-950/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                  )}
                >
                  <span className="text-sm font-bold">{opt.label}</span>
                  <span className="text-[10px] mt-0.5 leading-none">{opt.desc}</span>
                </button>
              );
            })}
          </div>
          {values.frequency > 1 && (
            <p className="text-[11px] text-zinc-600">
              This will show {values.frequency} checkboxes on your daily todos — one per dose.
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          Cancel
        </button>
        <button type="button" onClick={onSubmit} disabled={saving}
          className="glass-button-primary flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50">
          {saving
            ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            : <CheckSquare className="h-3.5 w-3.5" />
          }
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

const EMPTY_FORM = { title: '', note: '', time: '', category: 'other', frequency: 1 };

const FREQUENCY_OPTIONS = [
  { value: 1, label: '1×', desc: 'Once' },
  { value: 2, label: '2×', desc: 'Twice' },
  { value: 3, label: '3×', desc: '3 times' },
  { value: 4, label: '4×', desc: '4 times' },
  { value: 5, label: '5×', desc: '5 times' },
];

function TodosSettingsTab() {
  const [templates, setTemplates] = useState<TodoTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getTodoTemplates();
      if (res.success && res.data) setTemplates((res.data.templates ?? []) as TodoTemplate[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!form.title.trim()) { showToast('Title is required', 'error'); return; }
    setAdding(true);
    try {
      let baseItems: Record<string, unknown>[] = [];
      if (form.category === 'food') {
        const foodText = [form.title, form.note].filter(Boolean).join(': ');
        const foodRes = await api.logFoodText(foodText);
        if (foodRes.success && foodRes.data?.items?.length) {
          baseItems = foodRes.data.items as Record<string, unknown>[];
          showToast(`Parsed ${baseItems.length} food item${baseItems.length !== 1 ? 's' : ''} — nutrition auto-saved`, 'success');
        }
        // food parse failure is non-blocking — save template without baseItems
      }
      const res = await api.createTodoTemplate({ ...form, baseItems });
      if (res.success) {
        showToast('Todo added', 'success');
        setForm(EMPTY_FORM);
        setShowForm(false);
        await load();
      } else {
        showToast(res.error || 'Failed to add', 'error');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    if (!editForm.title.trim()) { showToast('Title is required', 'error'); return; }
    const res = await api.updateTodoTemplate({ id: editId, ...editForm });
    if (res.success) {
      showToast('Saved', 'success');
      setEditId(null);
      await load();
    } else {
      showToast(res.error || 'Failed to update', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const res = await api.deleteTodoTemplate(id);
    if (res.success) {
      showToast('Deleted', 'success');
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } else {
      showToast(res.error || 'Failed to delete', 'error');
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, enabled } : t));
    await api.updateTodoTemplate({ id, enabled });
  };

  return (
    <div className="glass-card rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Daily Todos</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Recurring checklist — resets fresh every day.
          </p>
        </div>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors ring-1 ring-emerald-500/20">
            <Plus className="h-3.5 w-3.5" />
            Add item
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <TodoForm
          values={form}
          onChange={setForm}
          onSubmit={handleAdd}
          onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); }}
          saving={adding}
          submitLabel="Add"
        />
      )}

      {/* List */}
      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/60">
              <CheckSquare className="h-6 w-6 text-zinc-600" />
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-400">No items yet</p>
            <p className="mt-1 text-xs text-zinc-600">Add supplements, medicines, habits, or food routines.</p>
          </div>
        ) : (
          templates.map((t) => {
            const cfg = TODO_CATEGORIES.find((c) => c.value === t.category) ?? TODO_CATEGORIES[4];
            const CatIcon = cfg.icon;
            const isEditing = editId === t.id;
            return (
              <div key={t.id} className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/30 transition-colors hover:border-zinc-700/80">
                {isEditing ? (
                  <div className="p-1">
                    <TodoForm
                      values={editForm}
                      onChange={setEditForm}
                      onSubmit={handleSaveEdit}
                      onCancel={() => setEditId(null)}
                      saving={false}
                      submitLabel="Save"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-3.5 py-3">
                      {/* Icon */}
                      <div className={cn(
                        'shrink-0 h-9 w-9 rounded-lg flex items-center justify-center',
                        t.enabled ? cfg.bgColor : 'bg-zinc-800/60'
                      )}>
                        <CatIcon className={cn('h-4 w-4', t.enabled ? cfg.color : 'text-zinc-600')} />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cn(
                            'text-sm font-semibold',
                            t.enabled ? 'text-zinc-100' : 'text-zinc-500 line-through'
                          )}>
                            {t.title}
                          </span>
                          {(t.category === 'supplement' || t.category === 'medicine') && (t.frequency ?? 1) > 1 && (
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', cfg.bgColor, cfg.color)}>
                              {t.frequency}× daily
                            </span>
                          )}
                          {t.category === 'food' && Array.isArray(t.baseItems) && t.baseItems.length > 0 && (
                            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">
                              {t.baseItems.length} item{t.baseItems.length !== 1 ? 's' : ''} parsed
                            </span>
                          )}
                        </div>
                        {t.note && (
                          <p className="mt-0.5 text-xs text-zinc-500 truncate">{t.note}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button type="button"
                          title={t.enabled ? 'Disable' : 'Enable'}
                          onClick={() => handleToggleEnabled(t.id, !t.enabled)}
                          className={cn(
                            'rounded-lg p-1.5 transition-colors',
                            t.enabled
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-zinc-800 text-zinc-600 hover:bg-zinc-700 hover:text-zinc-400'
                          )}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button"
                          title="Edit"
                          onClick={() => { setEditId(t.id); setEditForm({ title: t.title, note: t.note, time: t.time, category: t.category, frequency: t.frequency ?? 1 }); }}
                          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button"
                          title="Delete"
                          onClick={() => handleDelete(t.id)}
                          className="rounded-lg p-1.5 text-zinc-600 hover:bg-rose-500/10 hover:text-rose-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Page (wraps in Suspense for useSearchParams) ─────────────────────────────

export default function SettingsPage() {
  return (
    <div className="animate-fade-in flex flex-col max-lg:mobile-dash cards-stack-desktop settings-page">
      <DashboardPageShell
        title="Settings"
        subtitle="Profile, targets, API keys & preferences"
        icon={Settings}
        mobileVariant="card"
      />
      <div className="mobile-fade-up mobile-dash-px lg:px-0 mt-4" style={{ animationDelay: '80ms' }}>
        <Suspense fallback={
          <div className="flex gap-6">
            <div className="hidden w-52 shrink-0 lg:block"><CardSkeleton className="h-64" /></div>
            <div className="flex-1 space-y-4"><CardSkeleton className="h-48" /><CardSkeleton className="h-64" /></div>
          </div>
        }>
          <SettingsInner />
        </Suspense>
      </div>
    </div>
  );
}
