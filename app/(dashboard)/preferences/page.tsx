'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Droplets, Dumbbell, Eye, EyeOff, Mail, Moon, Plus, Save, Scale, Utensils, X } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useUser } from '@/hooks/useUser';
import api from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import DashboardPageShell from '@/components/layout/DashboardPageShell';
import StatCard from '@/components/ui/StatCard';

export default function PreferencesPage() {
  const { user, loading, refetch } = useUser();
  const [saving, setSaving] = useState(false);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [waterNotif, setWaterNotif] = useState(true);
  const [mealNotif, setMealNotif] = useState(true);
  const [weighInNotif, setWeighInNotif] = useState(true);
  const [workoutNotif, setWorkoutNotif] = useState(true);
  const [sleepNotif, setSleepNotif] = useState(true);

  // Recipient emails state
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
    smtpSaved: false,
    smtpTestSent: false,
    imapSaved: false,
    imapTestSent: false,
    recipientListSaved: false,
    imapReplyVerifiedAt: '',
    lastUpdatedAt: '',
  });

  // SMTP state
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);

  // IMAP state
  const [imapUser, setImapUser] = useState('');
  const [imapPass, setImapPass] = useState('');
  const [showImapPass, setShowImapPass] = useState(false);
  const [savingImap, setSavingImap] = useState(false);
  const [imapConfigured, setImapConfigured] = useState(false);
  const imapPollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imapPollingStartedAtRef = useRef<number | null>(null);
  const imapPollingInFlightRef = useRef(false);
  const hasShownImapVerifiedToastRef = useRef(false);

  const stopImapVerificationPolling = () => {
    if (imapPollingIntervalRef.current) {
      clearInterval(imapPollingIntervalRef.current);
      imapPollingIntervalRef.current = null;
    }
    imapPollingStartedAtRef.current = null;
    imapPollingInFlightRef.current = false;
  };

  const checkImapVerificationNow = async () => {
    if (imapPollingInFlightRef.current) return false;
    imapPollingInFlightRef.current = true;
    const res = await api.verifyImapTestReply();
    imapPollingInFlightRef.current = false;
    if (!res.success) return false;
    const verified = Boolean(res.data?.verified);
    const verifiedAt = res.data?.verifiedAt || new Date().toISOString();
    if (verified) {
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
    const startedAtMs = startedAtIso ? new Date(startedAtIso).getTime() : Date.now();
    imapPollingStartedAtRef.current = Number.isNaN(startedAtMs) ? Date.now() : startedAtMs;
    const foundOnImmediateCheck = await checkImapVerificationNow();
    if (foundOnImmediateCheck) return;

    imapPollingIntervalRef.current = setInterval(async () => {
      const found = await checkImapVerificationNow();
      if (found) return;

      const startedAt = imapPollingStartedAtRef.current ?? Date.now();
      const elapsed = Date.now() - startedAt;
      // 10 minutes total with one check per minute.
      if (elapsed >= 10 * 60 * 1000) {
        stopImapVerificationPolling();
      }
    }, 60_000);
  };

  useEffect(() => {
    if (!user?.settings) return;
    const s = user.settings;
    setUnits(s.units || 'metric');
    setWaterNotif(s.notifications?.water ?? true);
    setMealNotif(s.notifications?.meals ?? true);
    setWeighInNotif(s.notifications?.weighIn ?? true);
    setWorkoutNotif(s.notifications?.workout ?? true);
    setSleepNotif(s.notifications?.sleep ?? true);

    const savedRecipients = s.recipientEmails?.length
      ? s.recipientEmails
      : (s.ccEmails?.length ? s.ccEmails : []);
    setRecipientEmails(Array.from(new Set(savedRecipients.map((e) => e.trim().toLowerCase()))));

    setTimezone(s.reminderSchedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata');
    setWaterHourlyEnabled(s.reminderSchedule?.waterHourlyEnabled ?? true);
    setBreakfastTime(s.reminderSchedule?.mealTimes?.breakfast || '08:00');
    setLunchTime(s.reminderSchedule?.mealTimes?.lunch || '13:00');
    setDinnerTime(s.reminderSchedule?.mealTimes?.dinner || '20:00');
    setSleepTime(s.reminderSchedule?.sleepTime || '22:30');

    const lsa = s.reminderSchedule?.lastSentAt ?? {};
    setLastSentAt({
      water:     String(lsa.water     ?? ''),
      breakfast: String(lsa.breakfast ?? ''),
      lunch:     String(lsa.lunch     ?? ''),
      dinner:    String(lsa.dinner    ?? ''),
      sleep:     String(lsa.sleep     ?? ''),
      workout:   String(lsa.workout   ?? ''),
      weighIn:   String(lsa.weighIn   ?? ''),
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

    const es = s.emailSettings;
    if (es?.smtp) {
      setSmtpUser(es.smtp.user ?? '');
    }
    if (es?.imap) {
      setImapUser(es.imap.user ?? '');
    }
    if (user.hasSmtp) setSmtpConfigured(true);
    if (user.hasImap) setImapConfigured(true);
  }, [user]);

  useEffect(() => {
    return () => {
      stopImapVerificationPolling();
    };
  }, []);

  useEffect(() => {
    const shouldPoll = emailChecklist.imapTestSent && !emailChecklist.imapReplyVerifiedAt;
    if (shouldPoll) {
      const startedAt = emailChecklist.lastUpdatedAt || undefined;
      void startImapVerificationPolling(false, startedAt);
    } else {
      stopImapVerificationPolling();
    }
  }, [emailChecklist.imapTestSent, emailChecklist.imapReplyVerifiedAt, emailChecklist.lastUpdatedAt]);

  const savePreferences = async () => {
    setSaving(true);
    try {
      const res = await api.updateSettings({
        units,
        notifications: {
          water: waterNotif,
          meals: mealNotif,
          weighIn: weighInNotif,
          workout: workoutNotif,
          sleep: sleepNotif,
        },
        reminderSchedule: {
          timezone,
          waterHourlyEnabled,
          mealTimes: {
            breakfast: breakfastTime,
            lunch: lunchTime,
            dinner: dinnerTime,
          },
          sleepTime,
        },
      });
      if (res.success) {
        showToast('Preferences saved', 'success');
        refetch();
      } else {
        showToast(res.error || 'Failed to save', 'error');
      }
    } catch {
      showToast('Failed to save preferences', 'error');
    } finally {
      setSaving(false);
    }
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
      }
      else showToast(res.error || 'Failed to save', 'error');
    } catch {
      showToast('Failed to save recipients', 'error');
    } finally {
      setSavingRecipients(false);
    }
  };

  const sendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      // Persist current recipient list before sending test email.
      const saveRes = await api.updateSettings({ recipientEmails });
      if (!saveRes.success) {
        showToast(saveRes.error || 'Failed to save recipients', 'error');
        return;
      }

      const testRes = await api.sendEmailTest('smtp_test');
      if (testRes.success) {
        setEmailChecklist((prev) => ({ ...prev, smtpTestSent: true, recipientListSaved: true }));
        showToast('SMTP test email sent. Check all recipients.', 'success');
        refetch();
      } else {
        showToast(testRes.error || 'Failed to send test email', 'error');
      }
    } catch {
      showToast('Failed to send test email', 'error');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const saveSmtpSettings = async () => {
    setSavingSmtp(true);
    try {
      const smtp: Record<string, unknown> = {
        user: smtpUser,
      };
      if (smtpPass) smtp.pass = smtpPass;

      const res = await api.saveEmailSettings({ smtp });
      if (res.success) {
        const smtpTestSent = Boolean((res.data as { emailTest?: { smtpTestSent?: boolean } } | undefined)?.emailTest?.smtpTestSent);
        const testError = (res.data as { emailTest?: { error?: string } } | undefined)?.emailTest?.error;

        setEmailChecklist((prev) => ({ ...prev, smtpSaved: true, smtpTestSent }));
        if (testError) {
          showToast(testError, 'error');
        } else {
          showToast(res.message || 'SMTP settings saved and test email sent', 'success');
        }
        setSmtpPass('');
        setSmtpConfigured(true);
        refetch();
      } else {
        showToast(res.error || 'Failed to save SMTP', 'error');
      }
    } catch {
      showToast('Failed to save SMTP settings', 'error');
    } finally {
      setSavingSmtp(false);
    }
  };

  const saveImapSettings = async () => {
    setSavingImap(true);
    try {
      const imap: Record<string, unknown> = {
        user: imapUser,
      };
      if (imapPass) imap.pass = imapPass;

      const res = await api.saveEmailSettings({ imap });
      if (res.success) {
        const imapTestSent = Boolean((res.data as { emailTest?: { imapTestSent?: boolean } } | undefined)?.emailTest?.imapTestSent);
        const testError = (res.data as { emailTest?: { error?: string } } | undefined)?.emailTest?.error;

        setEmailChecklist((prev) => ({ ...prev, imapSaved: true, imapTestSent }));
        if (testError) {
          showToast(testError, 'error');
        } else {
          showToast(res.message || 'IMAP settings saved and test email sent', 'success');
        }
        setImapPass('');
        setImapConfigured(true);
        refetch();
        if (imapTestSent) {
          const startedAt = new Date().toISOString();
          setEmailChecklist((prev) => ({ ...prev, lastUpdatedAt: startedAt }));
          await startImapVerificationPolling(true, startedAt);
        }
      } else {
        showToast(res.error || 'Failed to save IMAP', 'error');
      }
    } catch {
      showToast('Failed to save IMAP settings', 'error');
    } finally {
      setSavingImap(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10" />
        <CardSkeleton className="h-80" />
      </div>
    );
  }

  function formatLastSent(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');
    const dStr = d.toLocaleDateString('en-CA');
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (dStr === todayStr) return `Today at ${time}`;
    if (dStr === yesterdayStr) return `Yesterday at ${time}`;
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${time}`;
  }

  const enabledCount = [waterNotif, mealNotif, weighInNotif, workoutNotif, sleepNotif].filter(Boolean).length;
  const hasSmtp = smtpConfigured || (user?.hasSmtp ?? false);
  const hasImap = imapConfigured || (user?.hasImap ?? false);

  return (
    <div className="animate-fade-in flex flex-col max-lg:mobile-dash cards-stack-desktop">
      <DashboardPageShell
        title="Preferences"
        subtitle="Units, reminders, and email configuration"
        icon={Bell}
        mobileVariant="card"
      />

      {/* Summary */}
      <div className="mobile-fade-up mobile-dash-px lg:px-0" style={{ animationDelay: '80ms' }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={Scale}
          label="Units"
          value={units === 'metric' ? 'Metric' : 'Imperial'}
          subtitle={units === 'metric' ? 'kg, cm' : 'lbs, in'}
          iconColor="text-accent-violet"
        />
        <StatCard
          icon={Bell}
          label="Reminders"
          value={`${enabledCount}/5 enabled`}
          subtitle="Water, meals, weigh-in, workout, sleep"
          iconColor={enabledCount > 0 ? 'text-accent-emerald' : 'text-text-muted'}
        />
      </div>
      </div>

      <div className="mobile-fade-up mobile-dash-px lg:px-0" style={{ animationDelay: '160ms' }}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
        {/* Left: units */}
        <div className="flex flex-col gap-3 lg:min-h-0">
          <div className="glass-card rounded-2xl p-6 shrink-0">
            <p className="text-sm font-semibold text-text-primary">Units</p>
            <p className="mt-2 text-xs text-text-muted">
              Choose how weight and height are displayed across the app.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(['metric', 'imperial'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnits(u)}
                  className={cn(
                    'rounded-2xl border px-4 py-3 text-left transition-all',
                    units === u
                      ? 'border-accent-violet/30 bg-accent-violet/10 text-accent-violet'
                      : 'border-white/[0.06] bg-white/[0.03] text-text-muted hover:bg-white/[0.05] hover:text-text-primary'
                  )}
                >
                  <p className="text-sm font-semibold capitalize">{u}</p>
                  <p className="mt-0.5 text-[11px] opacity-80">{u === 'metric' ? 'kg, cm' : 'lbs, in'}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-accent-violet shrink-0" />
              <p className="text-sm font-semibold text-text-primary">Recipients</p>
            </div>
            <p className="mt-1.5 text-xs text-text-muted">
              Reminder and test emails are sent to this list. Your account email is included by default.
            </p>

            {/* Add input */}
            <div className="mt-3 flex gap-2">
              <input
                type="email"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRecipientEmail()}
                placeholder="email@example.com"
                className="min-w-0 flex-1 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-violet/50 transition-colors"
              />
              <button
                type="button"
                onClick={addRecipientEmail}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-violet/10 text-accent-violet hover:bg-accent-violet/20 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Recipient list */}
            {recipientEmails.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {recipientEmails.map((email) => (
                  <span key={email} className="flex items-center gap-1 rounded-full bg-white/[0.05] border border-white/[0.06] px-2.5 py-1 text-[11px] text-text-secondary">
                    {email}
                    <button
                      type="button"
                      onClick={() => setRecipientEmails(recipientEmails.filter((e) => e !== email))}
                      className="text-text-muted hover:text-text-primary transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-auto pt-4 flex justify-end gap-2">
              <button
                onClick={sendTestEmail}
                disabled={sendingTestEmail || savingRecipients}
                className="flex min-w-[145px] items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-5 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-white/[0.06] disabled:opacity-50"
              >
                {sendingTestEmail ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  'Send Test Email'
                )}
              </button>
              <button
                onClick={saveRecipientEmails}
                disabled={savingRecipients || sendingTestEmail}
                className="glass-button-primary flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {savingRecipients ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Right: notifications */}
        <div className="glass-card flex h-full flex-col rounded-2xl p-6 lg:min-h-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Reminder notifications</p>
              <p className="mt-1 text-xs text-text-muted">Control what you get nudged about.</p>
            </div>
            <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-text-muted">
              {enabledCount}/5 on
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {[
              { key: 'water', label: 'Water reminders', value: waterNotif, set: setWaterNotif, icon: Droplets, color: 'text-accent-cyan' },
              { key: 'meals', label: 'Meal logging reminders', value: mealNotif, set: setMealNotif, icon: Utensils, color: 'text-accent-emerald' },
              { key: 'weighIn', label: 'Daily weigh-in', value: weighInNotif, set: setWeighInNotif, icon: Scale, color: 'text-accent-amber' },
              { key: 'workout', label: 'Workout reminders', value: workoutNotif, set: setWorkoutNotif, icon: Dumbbell, color: 'text-accent-rose' },
              { key: 'sleep', label: 'Sleep reminders', value: sleepNotif, set: setSleepNotif, icon: Moon, color: 'text-accent-violet' },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.02] px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]', item.color)}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span className="truncate text-sm font-medium text-text-secondary">{item.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => item.set(!item.value)}
                  className={cn(
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
                    item.value ? 'bg-accent-violet' : 'bg-white/[0.1]'
                  )}
                  aria-pressed={item.value}
                  aria-label={`${item.label}: ${item.value ? 'on' : 'off'}`}
                >
                  <span
                    className={cn(
                      'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200',
                      item.value && 'translate-x-5'
                    )}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end pt-4">
            <button
              onClick={savePreferences}
              disabled={saving}
              className="glass-button-primary flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Reminder schedule + checklist */}
      <div className="mobile-fade-up mobile-dash-px lg:px-0" style={{ animationDelay: '220ms' }}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
        <div className="glass-card rounded-2xl p-6">
          <p className="text-sm font-semibold text-text-primary">Reminder schedule</p>
          <p className="mt-1 text-xs text-text-muted">
            Water reminders go out every 30 minutes. Meal and sleep times use your timezone and can be edited.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-text-muted">Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Kolkata"
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-violet/50 transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">Breakfast time</label>
              <input
                type="time"
                value={breakfastTime}
                onChange={(e) => setBreakfastTime(e.target.value)}
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50 transition-colors"
              />
              <p className="mt-1 text-[11px] text-text-muted">Last sent: {formatLastSent(lastSentAt.breakfast) || 'None'}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">Lunch time</label>
              <input
                type="time"
                value={lunchTime}
                onChange={(e) => setLunchTime(e.target.value)}
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50 transition-colors"
              />
              <p className="mt-1 text-[11px] text-text-muted">Last sent: {formatLastSent(lastSentAt.lunch) || 'None'}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">Dinner time</label>
              <input
                type="time"
                value={dinnerTime}
                onChange={(e) => setDinnerTime(e.target.value)}
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50 transition-colors"
              />
              <p className="mt-1 text-[11px] text-text-muted">Last sent: {formatLastSent(lastSentAt.dinner) || 'None'}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">Sleep reminder time</label>
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50 transition-colors"
              />
              <p className="mt-1 text-[11px] text-text-muted">Last sent: {formatLastSent(lastSentAt.sleep) || 'None'}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/[0.02] px-4 py-3">
            <span className="text-sm font-medium text-text-secondary">Water reminders every 30 min</span>
            <button
              type="button"
              onClick={() => setWaterHourlyEnabled(!waterHourlyEnabled)}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
                waterHourlyEnabled ? 'bg-accent-violet' : 'bg-white/[0.1]'
              )}
              aria-pressed={waterHourlyEnabled}
              aria-label={`Water reminders every 30 min: ${waterHourlyEnabled ? 'on' : 'off'}`}
            >
              <span
                className={cn(
                  'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200',
                  waterHourlyEnabled && 'translate-x-5'
                )}
              />
            </button>
          </div>
          <p className="mt-2 px-1 text-[11px] text-text-muted">Last sent: {formatLastSent(lastSentAt.water) || 'None'}</p>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <p className="text-sm font-semibold text-text-primary">Configuration checklist</p>
          <p className="mt-1 text-xs text-text-muted">
            Save SMTP/IMAP and recipients. Reply to the IMAP test email with “1000 ml water” to verify inbound processing.
          </p>
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
            <p className="mt-3 text-xs text-accent-emerald">
              Verified at: {new Date(emailChecklist.imapReplyVerifiedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
      </div>

      {/* SMTP + IMAP */}
      <div className="mobile-fade-up mobile-dash-px lg:px-0" style={{ animationDelay: '240ms' }}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
        {/* SMTP */}
        <div className={cn('glass-card rounded-2xl p-5 flex flex-col transition-all duration-300', hasSmtp && 'border border-accent-emerald/30 shadow-[0_0_0_1px_rgba(52,211,153,0.08)]')}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-300', hasSmtp ? 'bg-accent-emerald/15 text-accent-emerald' : 'bg-white/[0.04] text-accent-emerald')}>
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">SMTP</p>
                <p className="mt-0.5 text-xs text-text-muted">Sends reminders to your recipient list</p>
              </div>
            </div>
            {hasSmtp && (
              <span className="shrink-0 rounded-full bg-accent-emerald/10 px-2.5 py-1 text-[11px] font-medium text-accent-emerald">
                Configured
              </span>
            )}
          </div>

          <div className="mt-4 space-y-2.5">
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">Email</label>
              <input
                type="email"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="you@gmail.com"
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-violet/50 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">Password</label>
              <div className="relative">
                <input
                  type={showSmtpPass ? 'text' : 'password'}
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder={hasSmtp ? '•••••••• (leave blank to keep)' : 'App password'}
                  className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-violet/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPass(!showSmtpPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={saveSmtpSettings}
              disabled={savingSmtp}
              className="glass-button-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {savingSmtp ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
              Save SMTP
            </button>
          </div>
        </div>

        {/* IMAP */}
        <div className={cn('glass-card rounded-2xl p-5 flex flex-col transition-all duration-300', hasImap && 'border border-accent-emerald/30 shadow-[0_0_0_1px_rgba(52,211,153,0.08)]')}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-300', hasImap ? 'bg-accent-emerald/15 text-accent-emerald' : 'bg-white/[0.04] text-accent-cyan')}>
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">IMAP</p>
                <p className="mt-0.5 text-xs text-text-muted">Reads your replies and auto-logs them</p>
              </div>
            </div>
            {hasImap && (
              <span className="shrink-0 rounded-full bg-accent-emerald/10 px-2.5 py-1 text-[11px] font-medium text-accent-emerald">
                Configured
              </span>
            )}
          </div>

          <div className="mt-4 space-y-2.5">
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">Email</label>
              <input
                type="email"
                value={imapUser}
                onChange={(e) => setImapUser(e.target.value)}
                placeholder="you@gmail.com"
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-violet/50 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">Password</label>
              <div className="relative">
                <input
                  type={showImapPass ? 'text' : 'password'}
                  value={imapPass}
                  onChange={(e) => setImapPass(e.target.value)}
                  placeholder={hasImap ? '•••••••• (leave blank to keep)' : 'App password'}
                  className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-violet/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowImapPass(!showImapPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showImapPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={saveImapSettings}
              disabled={savingImap}
              className="glass-button-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {savingImap ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
              Save IMAP
            </button>
          </div>
        </div>

      </div>{/* end SMTP+IMAP grid */}
      </div>{/* end outer fade-up */}
    </div>
  );
}
