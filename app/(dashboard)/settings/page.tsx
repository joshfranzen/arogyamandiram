'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Bell, Key, Save, Settings, Target, User, Ruler, Activity, Flag, PersonStanding,
  Shield, Eye, EyeOff, CheckCircle2, Sparkles, Utensils, Dumbbell,
  Loader2, RefreshCw, Flame, Droplets, Scale, Moon,
  Mail, Plus, X, ListChecks, Pill, Zap, Trash2, Pencil, CheckSquare,
  Smartphone, RotateCcw, AlertCircle, SlidersHorizontal,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useUser } from '@/hooks/useUser';
import api from '@/lib/apiClient';
import { cn, formatWater } from '@/lib/utils';
import { getTargetsForUser } from '@/lib/health';
import DashboardPageShell from '@/components/layout/DashboardPageShell';
import Link from 'next/link';
import Image from 'next/image';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TodoTemplate { id: string; title: string; note: string; time: string; category: string; enabled: boolean; frequency?: number; baseItems?: Record<string, unknown>[]; }

// ─── Constants ────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'body' | 'targets' | 'customizations' | 'api-keys' | 'notifications' | 'email' | 'todos' | 'health-data';

const NAV_ITEMS: { key: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'profile',       label: 'Profile',        icon: User,          desc: 'Personal info & metrics' },
  { key: 'body',          label: 'Body',           icon: PersonStanding, desc: 'Composition & fitness' },
  { key: 'targets',       label: 'Targets',        icon: Target,        desc: 'Daily goals & macros' },
  { key: 'customizations', label: 'Customizations', icon: SlidersHorizontal, desc: 'Tracker-specific defaults' },
  { key: 'api-keys',      label: 'API Keys',       icon: Key,           desc: 'OpenAI & USDA keys' },
  { key: 'notifications', label: 'Notifications',  icon: Bell,          desc: 'Reminders & schedule' },
  { key: 'email',         label: 'Email',          icon: Mail,          desc: 'SMTP, IMAP & recipients' },
  { key: 'todos',         label: 'Daily Todos',    icon: CheckSquare,   desc: 'Recurring checklist' },
  { key: 'health-data',   label: 'Health Data',    icon: Smartphone,    desc: 'External health sync' },
];

const MAX_CUSTOM_WATER_GLASS_ML = 5000;
const DEFAULT_WATER_QUICK_AMOUNTS = [100, 250, 500, 750] as const;

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

const bodyTypeOptions = [
  {
    value: 'ectomorph',
    label: 'Lean frame',
    image: '/images/body-types/ectomorph.png',
  },
  {
    value: 'mesomorph',
    label: 'Athletic frame',
    image: '/images/body-types/mesomorph.png',
  },
  {
    value: 'endomorph',
    label: 'Soft frame',
    image: '/images/body-types/endomorph.png',
  },
] as const;

const bodyFatGuides = [
  { label: 'Very lean', range: '10-14%', value: 12, clue: 'Muscle lines visible, very little belly fat.' },
  { label: 'Lean', range: '15-19%', value: 17, clue: 'Some definition, small belly softness.' },
  { label: 'Average', range: '20-24%', value: 22, clue: 'No clear abs, moderate belly/chest fat.' },
  { label: 'Higher', range: '25-30%', value: 27, clue: 'Visible belly fat, chest and waist look fuller.' },
] as const;

// ─── Fat area tag input ────────────────────────────────────────────────────────

function FatAreaInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function add() {
    const trimmed = draft.trim().toLowerCase();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setDraft('');
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Existing areas as bullet points */}
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((area) => (
            <li key={area} className="flex items-center gap-2 rounded-lg bg-zinc-900/60 px-3 py-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="flex-1 text-sm capitalize text-zinc-200">{area}</span>
              <button type="button" onClick={() => onChange(value.filter((a) => a !== area))}
                className="text-zinc-600 hover:text-zinc-300 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="e.g. belly, arms, lower back…"
          className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
        <button type="button" onClick={add}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/20 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function SettingsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading, refetch } = useUser();

  const rawTab = searchParams.get('tab') as Tab | null;
  const validTabs: Tab[] = ['profile', 'body', 'targets', 'customizations', 'api-keys', 'notifications', 'email', 'todos', 'health-data'];
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
  const [dailySteps, setDailySteps] = useState('');
  const [idealDistance, setIdealDistance] = useState('');

  // ── Customizations state ───────────────────────────────────────────────────
  const [customizationsSaving, setCustomizationsSaving] = useState(false);
  const [customWaterAmounts, setCustomWaterAmounts] = useState<string[]>(DEFAULT_WATER_QUICK_AMOUNTS.map(String));

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
  const [timezone, setTimezone] = useState('');
  const [waterReminderEnabled, setWaterReminderEnabled] = useState(true);
  const [waterStartTime, setWaterStartTime] = useState('06:00');
  const [waterEndTime, setWaterEndTime] = useState('21:00');
  const [waterFrequencyMinutes, setWaterFrequencyMinutes] = useState(60);
  const [breakfastTime, setBreakfastTime] = useState('');
  const [lunchTime, setLunchTime] = useState('');
  const [dinnerTime, setDinnerTime] = useState('');
  const [sleepTime, setSleepTime] = useState('');
  const [workoutTime, setWorkoutTime] = useState('');
  const [weighInTime, setWeighInTime] = useState('');
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

  // ── Health Data state ──────────────────────────────────────────────────────
  const [hdEndpoint, setHdEndpoint] = useState('');
  const [hdApiKey, setHdApiKey] = useState('');
  const [hdShowApiKey, setHdShowApiKey] = useState(false);
  const [hdHasApiKey, setHdHasApiKey] = useState(false);
  const [hdEnabled, setHdEnabled] = useState(false);
  const [hdInterval, setHdInterval] = useState(60);
  const [hdLastSyncAt, setHdLastSyncAt] = useState<string | null>(null);
  const [hdLastSyncSource, setHdLastSyncSource] = useState<'manual' | 'auto' | ''>('');
  const [hdLastStatus, setHdLastStatus] = useState('');
  const [hdLastError, setHdLastError] = useState('');
  const [hdSaving, setHdSaving] = useState(false);
  const [hdSyncing, setHdSyncing] = useState(false);
  const [hdLoaded, setHdLoaded] = useState(false);
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
      setDailySteps((t as { dailySteps?: number }).dailySteps?.toString() || '8000');
      setIdealDistance((t as { idealDistance?: number }).idealDistance?.toString() || '5');
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
      const resolvedTimezone = s.reminderSchedule?.timezone || user.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      setTimezone(resolvedTimezone);
      const savedWater = s.reminderSchedule?.water;
      const rawWaterFrequency = savedWater?.frequencyMinutes ?? s.reminderSchedule?.waterFrequencyMinutes;
      const parsedWaterFrequency = Number(rawWaterFrequency);
      setWaterReminderEnabled(savedWater?.enabled ?? (s.reminderSchedule?.waterHourlyEnabled ?? true));
      setWaterStartTime(savedWater?.startTime || '06:00');
      setWaterEndTime(savedWater?.endTime || '21:00');
      setWaterFrequencyMinutes((previousFrequency) =>
        Number.isFinite(parsedWaterFrequency) && parsedWaterFrequency >= 15 && parsedWaterFrequency <= 240
          ? parsedWaterFrequency
          : previousFrequency
      );
      setBreakfastTime(s.reminderSchedule?.mealTimes?.breakfast || '');
      setLunchTime(s.reminderSchedule?.mealTimes?.lunch || '');
      setDinnerTime(s.reminderSchedule?.mealTimes?.dinner || '');
      setSleepTime(s.reminderSchedule?.sleepTime || '');
      setWorkoutTime(s.reminderSchedule?.workoutTime || '');
      setWeighInTime(s.reminderSchedule?.weighInTime || '');
      const savedQuickAmounts = s.customizations?.water?.quickAmountsMl;
      const normalizedQuickAmounts = Array.isArray(savedQuickAmounts) && savedQuickAmounts.length === 4
        ? savedQuickAmounts
        : DEFAULT_WATER_QUICK_AMOUNTS;
      setCustomWaterAmounts(normalizedQuickAmounts.map((value) => String(value)));
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

  // ── Load health data config when tab opens ─────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'health-data' || hdLoaded) return;
    void (async () => {
      const res = await api.getHealthDataConfig();
      if (res.success && res.data) {
        setHdEndpoint(res.data.endpoint || '');
        setHdHasApiKey(res.data.hasApiKey ?? false);
        setHdEnabled(res.data.enabled ?? false);
        setHdInterval(res.data.syncIntervalMinutes ?? 60);
        setHdLastSyncAt(res.data.lastSyncAt ?? null);
        setHdLastSyncSource(res.data.lastSyncSource ?? '');
        setHdLastStatus(res.data.lastSyncStatus || '');
        setHdLastError(res.data.lastSyncError || '');
      }
      setHdLoaded(true);
    })();
  }, [activeTab, hdLoaded]);

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
        dailySteps: parseInt(dailySteps) || 8000,
        idealDistance: parseFloat(idealDistance) || 5,
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
          if (t.dailySteps) setDailySteps(String(t.dailySteps));
          if (t.idealDistance) setIdealDistance(String(t.idealDistance));
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

  // ── Customizations save ────────────────────────────────────────────────────
  const saveCustomizations = async () => {
    const parsedAmounts = customWaterAmounts.map((value) => Number(value));
    const invalidAmount = parsedAmounts.some((value) =>
      !Number.isInteger(value) || value < 1 || value > MAX_CUSTOM_WATER_GLASS_ML
    );
    if (invalidAmount) {
      showToast(`Each water amount must be a whole number between 1 and ${MAX_CUSTOM_WATER_GLASS_ML} ml`, 'error');
      return;
    }

    setCustomizationsSaving(true);
    try {
      const res = await api.updateSettings({
        customizations: {
          water: {
            quickAmountsMl: parsedAmounts,
          },
        },
      });
      if (res.success) {
        showToast('Customizations saved', 'success');
        await refetch();
      } else {
        showToast(res.error || 'Failed to save customizations', 'error');
      }
    } catch {
      showToast('Failed to save customizations', 'error');
    } finally {
      setCustomizationsSaving(false);
    }
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
      const toMinutes = (timeValue: string) => {
        const [h, m] = timeValue.split(':').map((v) => parseInt(v, 10));
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        return h * 60 + m;
      };
      const startMinutes = toMinutes(waterStartTime);
      const endMinutes = toMinutes(waterEndTime);
      if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
        showToast('Water reminder start time must be before end time', 'error');
        return;
      }

      const res = await api.updateSettings({
        units,
        notifications: { water: waterNotif, meals: mealNotif, weighIn: weighInNotif, workout: workoutNotif, sleep: sleepNotif },
        reminderSchedule: {
          timezone,
          // Keep legacy flat frequency key for backward compatibility during migration.
          waterFrequencyMinutes,
          water: {
            enabled: waterReminderEnabled,
            startTime: waterStartTime,
            endTime: waterEndTime,
            frequencyMinutes: waterFrequencyMinutes,
          },
          mealTimes: { breakfast: breakfastTime, lunch: lunchTime, dinner: dinnerTime },
          sleepTime,
          workoutTime,
          weighInTime,
        },
      });
      if (res.success) {
        const updatedReminderSchedule = (res.data as { settings?: { reminderSchedule?: Record<string, unknown> } } | undefined)?.settings?.reminderSchedule;
        const updatedWater = updatedReminderSchedule?.water as Record<string, unknown> | undefined;
        const updatedRawFrequency = updatedWater?.frequencyMinutes ?? updatedReminderSchedule?.waterFrequencyMinutes;
        const updatedParsedFrequency = Number(updatedRawFrequency);
        if (Number.isFinite(updatedParsedFrequency) && updatedParsedFrequency >= 15 && updatedParsedFrequency <= 240) {
          setWaterFrequencyMinutes(updatedParsedFrequency);
        }
        showToast('Preferences saved', 'success');
        refetch();
      }
      else showToast(res.error || 'Failed to save', 'error');
    } catch { showToast('Failed to save preferences', 'error'); }
    finally { setPrefSaving(false); }
  };

  // ── Health Data save & sync ────────────────────────────────────────────────
  const saveHealthDataConfig = async () => {
    setHdSaving(true);
    try {
      const res = await api.saveHealthDataConfig({
        endpoint: hdEndpoint,
        ...(hdApiKey ? { apiKey: hdApiKey } : {}),
        enabled: hdEnabled,
        syncIntervalMinutes: hdInterval,
      });
      if (res.success) {
        showToast('Health data settings saved', 'success');
        setHdApiKey('');
        if (hdApiKey) setHdHasApiKey(true);
        setHdLoaded(false); // reload on next visit
      } else {
        showToast(res.error || 'Failed to save', 'error');
      }
    } catch { showToast('Failed to save health data settings', 'error'); }
    finally { setHdSaving(false); }
  };

  const triggerHealthSync = async () => {
    if (!hdEndpoint.trim()) { showToast('Enter an endpoint URL first', 'error'); return; }
    setHdSyncing(true);
    const requestedAt = new Date().toISOString();
    try {
      const res = await api.triggerHealthDataSync({ source: 'manual' });
      if (res.success && res.data) {
        const { schema, rowCount, syncActions } = res.data;
        setHdLastSyncAt(new Date().toISOString());
        setHdLastSyncSource('manual');
        setHdLastStatus('ok');
        setHdLastError('');
        showToast(`Synced ${rowCount} row${rowCount !== 1 ? 's' : ''} successfully`, 'success');
        if (process.env.NEXT_PUBLIC_DEBUG_MODE === 'true') {
          fetch('/api/debug-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              page: 'health-data',
              agent: 'sync',
              log: {
                userRequest: { endpoint: hdEndpoint, requestedAt },
                syncResult: { schema, rowCount, syncActions },
                metadata: {
                  timestamp: new Date().toISOString(),
                  status: 'success',
                },
              },
            }),
          }).catch(() => {});
        }
      } else {
        setHdLastSyncSource('manual');
        setHdLastStatus('error');
        setHdLastError(res.error || 'Unknown error');
        showToast(res.error || 'Sync failed', 'error');
        if (process.env.NEXT_PUBLIC_DEBUG_MODE === 'true') {
          fetch('/api/debug-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              page: 'health-data',
              agent: 'sync',
              log: {
                userRequest: { endpoint: hdEndpoint, requestedAt },
                syncResult: null,
                metadata: {
                  timestamp: new Date().toISOString(),
                  status: 'error',
                  error: res.error || 'Unknown error',
                },
              },
            }),
          }).catch(() => {});
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed';
      setHdLastSyncSource('manual');
      setHdLastStatus('error');
      setHdLastError(msg);
      showToast(msg, 'error');
    }
    finally { setHdSyncing(false); }
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

  const formulaTargets = user ? getTargetsForUser(user) : null;
  const openAiActive = !!user?.hasOpenAiKey;
  const fdcActive = !!user?.hasFdcKey;
  const hasSmtp = smtpConfigured || (user?.hasSmtp ?? false);
  const hasImap = imapConfigured || (user?.hasImap ?? false);
  const enabledCount = [waterNotif, mealNotif, weighInNotif, workoutNotif, sleepNotif].filter(Boolean).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6 lg:items-start lg:min-h-0">

      {/* ── Left nav — desktop ── */}
      <aside className="hidden lg:block lg:w-52 lg:shrink-0 lg:sticky lg:top-0 lg:self-start" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
        <div className="glass-card rounded-2xl p-2 overflow-y-auto" style={{ maxHeight: 'inherit' }}>
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
      <div className="min-w-0 flex-1 min-h-0 space-y-4 pb-10">

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
              <p className="mt-1 text-xs text-text-muted">Auto-detected from your last completed week (Mon-Sun).</p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {activityLevels.map((al) => (
                  <div key={al.value}
                    className={cn('rounded-2xl border px-3 py-3 text-left text-xs transition-all',
                      activityLevel === al.value ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400')}>
                    <p className={cn('font-semibold', activityLevel === al.value ? 'text-emerald-400' : 'text-zinc-200')}>{al.label}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-400">{al.desc}</p>
                  </div>
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

            <div className="flex justify-end">
              <button onClick={saveProfile} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50">
                {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" /> : <Save className="h-4 w-4" />}
                Save Profile
              </button>
            </div>
          </>
        )}

        {/* ══════ BODY COMPOSITION ══════ */}
        {activeTab === 'body' && (
          <>
            {/* Body Type */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2">
                <PersonStanding className="h-4 w-4 text-accent-cyan" />
                <h2 className="text-base font-semibold text-text-primary">Body Shape</h2>
              </div>
              <p className="mt-1 text-xs text-text-muted">Choose visually.</p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {bodyTypeOptions.map((bt) => (
                  <button key={bt.value} type="button" onClick={() => setBodyType(bt.value)}
                    className={cn('overflow-hidden rounded-2xl border text-left text-xs transition-all',
                      bodyType === bt.value ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700')}>
                    <div className="p-2">
                      <Image
                        src={bt.image}
                        alt={bt.label}
                        width={1024}
                        height={683}
                        className="h-40 w-full rounded-lg bg-white object-contain"
                      />
                    </div>
                    <p className={cn('px-3 py-2 font-semibold text-sm', bodyType === bt.value ? 'text-emerald-400' : 'text-zinc-200')}>{bt.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Body Fat */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-base font-semibold text-text-primary">Body Fat %</h2>
              <p className="mt-1 text-xs text-text-muted">Not sure of exact %? Pick the closest visual range first, then fine-tune if needed.</p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {bodyFatGuides.map((guide) => {
                  const selected = Number(bodyFat) === guide.value;
                  return (
                    <button
                      key={guide.label}
                      type="button"
                      onClick={() => setBodyFat(String(guide.value))}
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left text-xs transition-all',
                        selected
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn('text-sm font-semibold', selected ? 'text-emerald-400' : 'text-zinc-200')}>{guide.label}</p>
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300">{guide.range}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed">{guide.clue}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-text-muted">Exact body fat % (optional)</label>
                <input type="number" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)}
                  placeholder="e.g. 18" min={1} max={60}
                  className="glass-input mt-1 w-40 rounded-xl px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
              </div>
            </div>

            {/* Fat focus areas */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-base font-semibold text-text-primary">Where do you carry more fat?</h2>
              <p className="mt-1 text-xs text-text-muted">Type an area and press Enter — used to personalise your workout target zones.</p>
              <FatAreaInput value={fatFocusAreas} onChange={setFatFocusAreas} />
            </div>

            {/* Fitness Level */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-base font-semibold text-text-primary">Fitness Level</h2>
              <p className="mt-1 text-xs text-text-muted">Auto-detected from your last 14 days of workout logs.</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-sm capitalize text-zinc-300 font-medium">
                  {(user?.profile as { fitnessLevelDerived?: string } | undefined)?.fitnessLevelDerived ?? 'Not yet detected'}
                </span>
                <span className="text-xs text-zinc-500">Updates automatically</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={saveProfile} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50">
                {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </>
        )}

        {/* ══════ TARGETS ══════ */}
        {activeTab === 'targets' && (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Left: actions */}
              <div className="flex flex-col gap-4">
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
                        { label: 'Daily steps', value: `${(formulaTargets.dailySteps ?? 8000).toLocaleString()}` },
                        { label: 'Distance / day', value: `${formulaTargets.idealDistance ?? 5} km` },
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
                  <div>
                    <label className="text-xs font-medium text-text-muted">Daily Steps</label>
                    <input type="number" value={dailySteps} onChange={(e) => setDailySteps(e.target.value)}
                      className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted">Distance / day (km)</label>
                    <input type="number" step="0.1" value={idealDistance} onChange={(e) => setIdealDistance(e.target.value)}
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Left: info */}
              <div className="flex flex-col gap-4">
                <div className="glass-card rounded-2xl p-6 flex-1">
                  <p className="text-sm font-semibold text-text-primary">Where these keys are used</p>
                  <div className="mt-4 space-y-2">
                    {[
                      { icon: Sparkles, label: "Today's Plan", desc: 'Daily plan, insights, recommendations', href: '/todays-plan', color: 'text-accent-violet' },
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
                <p className="flex items-center gap-1.5 text-[11px] text-text-muted"><Shield className="h-3 w-3 text-accent-cyan shrink-0" /> AES-256 encrypted — never exposed to the browser</p>
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

        {/* ══════ CUSTOMIZATIONS ══════ */}
        {activeTab === 'customizations' && (
          <>
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-accent-cyan" />
                <h2 className="text-base font-semibold text-text-primary">Water tracker</h2>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Edit the four quick-add water buttons. The Water page will use these values directly instead of showing a separate custom button.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {customWaterAmounts.map((amount, index) => (
                    <div key={index}>
                      <label className="text-xs font-medium text-text-muted">Quick add {index + 1} (ml)</label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setCustomWaterAmounts((prev) => prev.map((item, itemIndex) => itemIndex === index ? e.target.value : item))}
                        min={1}
                        max={MAX_CUSTOM_WATER_GLASS_ML}
                        placeholder={`e.g. ${DEFAULT_WATER_QUICK_AMOUNTS[index]}`}
                        className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                  <p className="sm:col-span-2 text-[11px] text-text-muted">
                    Defaults are 100 ml, 250 ml, 500 ml, and 750 ml. Replace any slot with your actual bottle or glass amount.
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.02] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Preview</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {customWaterAmounts.map((amount, index) => {
                      const parsedAmount = Number(amount);
                      const displayAmount = Number.isInteger(parsedAmount) && parsedAmount > 0
                        ? formatWater(parsedAmount)
                        : 'Set amount';

                      return (
                        <div key={index} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                          <p className="text-[11px] uppercase tracking-wide text-text-muted">Button {index + 1}</p>
                          <p className="mt-1 text-sm font-semibold text-text-primary">{displayAmount}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={saveCustomizations} disabled={customizationsSaving}
                className="glass-button-primary flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
                {customizationsSaving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </>
        )}

        {/* ══════ NOTIFICATIONS ══════ */}
        {activeTab === 'notifications' && (
          <>
            {/* Units */}
            <div className="glass-card rounded-2xl p-6">
              <p className="text-sm font-semibold text-text-primary">Units</p>
              <p className="mt-1 text-xs text-text-muted">How weight and height are displayed across the app.</p>
              <div className="mt-4 grid grid-cols-2 gap-2 max-w-xs">
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

            {/* Reminder toggles */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Reminder notifications</p>
                  <p className="mt-1 text-xs text-text-muted">Control which reminders you receive by email.</p>
                </div>
                <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-text-muted">{enabledCount}/5 on</span>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { key: 'water',   label: 'Water reminders',        value: waterNotif,   set: setWaterNotif,   icon: Droplets, color: 'text-accent-cyan' },
                  { key: 'meals',   label: 'Meal logging reminders',  value: mealNotif,    set: setMealNotif,    icon: Utensils, color: 'text-accent-emerald' },
                  { key: 'weighIn', label: 'Daily weigh-in',          value: weighInNotif, set: setWeighInNotif, icon: Scale,    color: 'text-accent-amber' },
                  { key: 'workout', label: 'Workout reminders',       value: workoutNotif, set: setWorkoutNotif, icon: Dumbbell, color: 'text-accent-rose' },
                  { key: 'sleep',   label: 'Sleep reminders',         value: sleepNotif,   set: setSleepNotif,   icon: Moon,     color: 'text-accent-violet' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.02] px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]', item.color)}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className="truncate text-sm text-text-secondary">{item.label}</span>
                    </div>
                    <button type="button" onClick={() => item.set(!item.value)}
                      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200', item.value ? 'bg-accent-violet' : 'bg-white/[0.1]')}
                      aria-pressed={item.value}>
                      <span className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200', item.value && 'translate-x-5')} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Reminder schedule */}
            <div className="glass-card rounded-2xl p-6">
              <p className="text-sm font-semibold text-text-primary">Reminder schedule</p>
              <p className="mt-1 text-xs text-text-muted">Set the times for each reminder. Leave blank to disable that reminder.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Timezone */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-text-muted">Timezone</label>
                    <button type="button"
                      onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
                      className="text-[10px] text-accent-violet hover:underline">
                      Auto-detect
                    </button>
                  </div>
                  <input type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)}
                    placeholder="e.g. Asia/Kolkata"
                    className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-violet/50 transition-colors" />
                </div>
                {[
                  { label: 'Breakfast time',            value: breakfastTime, set: setBreakfastTime, key: 'breakfast' },
                  { label: 'Lunch time',                value: lunchTime,     set: setLunchTime,     key: 'lunch' },
                  { label: 'Dinner time',               value: dinnerTime,    set: setDinnerTime,    key: 'dinner' },
                  { label: 'Sleep reminder time',       value: sleepTime,     set: setSleepTime,     key: 'sleep' },
                  { label: 'Workout time',              value: workoutTime,   set: setWorkoutTime,   key: 'workout' },
                  { label: 'Weigh-in time (morning)',   value: weighInTime,   set: setWeighInTime,   key: 'weighIn' },
                ].map((t) => (
                  <div key={t.key}>
                    <label className="mb-1.5 block text-xs font-medium text-text-muted">{t.label}</label>
                    <input type="time" value={t.value} onChange={(e) => t.set(e.target.value)}
                      className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50 transition-colors" />
                    <p className="mt-1 text-[10px] text-text-muted">Last sent: {formatLastSent(lastSentAt[t.key]) || 'None'}</p>
                  </div>
                ))}
                {/* Water schedule */}
                <div className="sm:col-span-2 rounded-2xl bg-white/[0.02] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-sm font-medium text-text-secondary">Water reminders</span>
                      <p className="text-[10px] text-text-muted mt-0.5">Last sent: {formatLastSent(lastSentAt.water) || 'None'}</p>
                    </div>
                    <button type="button" onClick={() => setWaterReminderEnabled(!waterReminderEnabled)}
                      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200', waterReminderEnabled ? 'bg-accent-violet' : 'bg-white/[0.1]')}
                      aria-pressed={waterReminderEnabled}>
                      <span className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200', waterReminderEnabled && 'translate-x-5')} />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-1 text-[10px] text-text-muted sm:grid-cols-2">
                    <p>Before Breakfast: no water reminders 30 min prior</p>
                    <p>After Breakfast: resumes 60 min after meal</p>
                    <p>Before Lunch: no water reminders 30 min prior</p>
                    <p>After Lunch: resumes 60 min after meal</p>
                    <p>Before Dinner: no water reminders 30 min prior</p>
                    <p>After Dinner: resumes 60 min after meal</p>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-text-muted">Start time</label>
                      <input type="time" value={waterStartTime} onChange={(e) => setWaterStartTime(e.target.value)}
                        className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50 transition-colors" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-text-muted">End time</label>
                      <input type="time" value={waterEndTime} onChange={(e) => setWaterEndTime(e.target.value)}
                        className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50 transition-colors" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-text-muted">Frequency (minutes)</label>
                      <select
                        value={waterFrequencyMinutes}
                        onChange={(e) => setWaterFrequencyMinutes(Number(e.target.value))}
                        className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50 transition-colors"
                      >
                        {[15, 30, 45, 60, 90, 120].map((minutes) => (
                          <option key={minutes} value={minutes}>{minutes} min</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-text-muted">Default window is 06:00 to 21:00 in your timezone.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={savePreferences} disabled={prefSaving}
                className="glass-button-primary flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
                {prefSaving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </>
        )}

        {/* ══════ EMAIL ══════ */}
        {activeTab === 'email' && (
          <>
            {/* Setup status */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Recipients', done: emailChecklist.recipientListSaved },
                { label: 'SMTP',       done: emailChecklist.smtpSaved },
                { label: 'SMTP test',  done: emailChecklist.smtpTestSent },
                { label: 'IMAP',       done: emailChecklist.imapSaved },
                { label: 'IMAP test',  done: emailChecklist.imapTestSent },
                { label: 'IMAP reply', done: Boolean(emailChecklist.imapReplyVerifiedAt) },
              ].map((s) => (
                <span key={s.label} className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border',
                  s.done ? 'bg-accent-emerald/10 border-accent-emerald/20 text-accent-emerald' : 'bg-white/[0.03] border-white/[0.06] text-text-muted')}>
                  <CheckCircle2 className={cn('h-3 w-3', s.done ? 'text-accent-emerald' : 'text-text-muted opacity-30')} />
                  {s.label}
                </span>
              ))}
            </div>

            {/* Recipients */}
            <div className="glass-card rounded-2xl p-6">
              <p className="text-sm font-semibold text-text-primary">Recipients</p>
              <p className="mt-1 text-xs text-text-muted">Reminder and test emails go to this list.</p>
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
                  className="flex items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-5 py-2 text-sm font-semibold text-text-secondary hover:bg-white/[0.06] disabled:opacity-50">
                  {sendingTestEmail ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : 'Send Test Email'}
                </button>
                <button onClick={saveRecipientEmails} disabled={savingRecipients || sendingTestEmail}
                  className="glass-button-primary flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50">
                  {savingRecipients ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', cfg.configured ? 'bg-accent-emerald/15 text-accent-emerald' : 'bg-white/[0.04] text-text-muted')}>
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{cfg.label}</p>
                        <p className="text-[11px] text-text-muted">{cfg.desc}</p>
                      </div>
                    </div>
                    {cfg.configured && (
                      <span className="shrink-0 rounded-full bg-accent-emerald/10 px-2.5 py-1 text-[11px] font-medium text-accent-emerald">Configured</span>
                    )}
                  </div>
                  <div className="mt-4 space-y-3">
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

        {/* ══════ HEALTH DATA ══════ */}
        {activeTab === 'health-data' && (
          <>
            {/* Endpoint */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-text-primary">Health Data Source</h2>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Connect an external health data endpoint (mobile app, wearable, or custom API). The fetched data will be sent to the orchestrator to automatically update your health logs.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-text-muted">Endpoint URL</label>
                  <input
                    type="url"
                    value={hdEndpoint}
                    onChange={(e) => setHdEndpoint(e.target.value)}
                    placeholder="https://your-health-api.example.com/data"
                    className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-text-muted">
                    API Token / Bearer Key
                    {hdHasApiKey && !hdApiKey && (
                      <span className="ml-2 text-emerald-400">● Saved</span>
                    )}
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={hdShowApiKey ? 'text' : 'password'}
                      value={hdApiKey}
                      onChange={(e) => setHdApiKey(e.target.value)}
                      placeholder={hdHasApiKey ? '••••••••  (leave blank to keep existing)' : 'Optional — sent as Bearer token'}
                      className="glass-input w-full rounded-xl px-3 py-2 pr-10 text-sm bg-zinc-900 border border-zinc-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setHdShowApiKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {hdShowApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="text-xs font-medium text-text-muted">Auto-sync interval</label>
                    <select
                      value={hdInterval}
                      onChange={(e) => setHdInterval(Number(e.target.value))}
                      className="glass-input mt-1 rounded-xl px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 focus:ring-1 focus:ring-emerald-500 outline-none"
                    >
                      <option value={15}>Every 15 minutes</option>
                      <option value={30}>Every 30 minutes</option>
                      <option value={60}>Every hour</option>
                      <option value={180}>Every 3 hours</option>
                      <option value={360}>Every 6 hours</option>
                      <option value={720}>Every 12 hours</option>
                      <option value={1440}>Once a day</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <span className="text-xs text-text-muted">Auto-sync</span>
                    <button
                      type="button"
                      onClick={() => setHdEnabled((v) => !v)}
                      className={cn(
                        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
                        hdEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
                          hdEnabled ? 'translate-x-4' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveHealthDataConfig}
                  disabled={hdSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
                >
                  {hdSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={triggerHealthSync}
                  disabled={hdSyncing || !hdEndpoint.trim()}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-text-primary hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {hdSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Sync Now
                </button>
              </div>
            </div>

            {/* Last sync status */}
            {(hdLastSyncAt || hdLastStatus) && (
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-text-muted" />
                  <h2 className="text-base font-semibold text-text-primary">Last Sync</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {hdLastSyncAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Time</span>
                      <span className="text-sm text-zinc-300">{new Date(hdLastSyncAt).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Type</span>
                    <span className="text-sm text-zinc-300">
                      {hdLastSyncSource === 'auto'
                        ? 'Auto-sync (interval)'
                        : hdLastSyncSource === 'manual'
                          ? 'Manual (Sync Now)'
                          : 'Unknown (older sync record)'}
                    </span>
                  </div>
                  {hdLastStatus && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Status</span>
                      <div className="flex items-center gap-1.5">
                        {hdLastStatus === 'ok' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                        )}
                        <span className={cn('text-sm font-medium', hdLastStatus === 'ok' ? 'text-emerald-400' : 'text-rose-400')}>
                          {hdLastStatus === 'ok' ? 'Success' : 'Error'}
                        </span>
                      </div>
                    </div>
                  )}
                  {hdLastStatus === 'error' && hdLastError && (
                    <p className="text-xs text-rose-400 bg-rose-500/10 rounded-lg px-3 py-2">{hdLastError}</p>
                  )}
                </div>
              </div>
            )}

          </>
        )}

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
  { value: 'other',      label: 'Other',      icon: ListChecks,   color: 'text-zinc-400',    bgColor: 'bg-zinc-400/15',    barColor: 'bg-zinc-500' },
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
        const foodRes = await api.logFoodText(foodText, 'settings-todos');
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
    <div
      className="settings-page flex flex-col"
      style={{
        height: '100%',
        paddingTop: 'calc(var(--sat, env(safe-area-inset-top, 0px)) + 0.75rem)',
      }}
    >
      {/* Fixed header — never scrolls */}
      <div className="shrink-0 px-4 pb-3 sm:px-6 lg:px-6">
        <DashboardPageShell
          title="Settings"
          subtitle="Profile, targets, customizations, API keys, and preferences"
          icon={Settings}
          mobileVariant="minimal"
        />
      </div>

      {/* Scrollable content */}
      <div className="hide-scrollbar flex-1 overflow-y-auto px-4 sm:px-6 lg:px-6 pb-[max(3.25rem,calc(var(--sab,env(safe-area-inset-bottom,0px))+2.5rem))] lg:pb-8">
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
