import { useState, useEffect, useRef } from 'react';
import { auth, isFirebaseConfigured } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import Sidebar from './Sidebar';
import Timeline from './Timeline';
import CircularChart from './CircularChart';
import LabelModal from './LabelModal';
import SchedulesPage from './SchedulesPage';
import SettingsPage from './SettingsPage';
import AuthButtons from './AuthButtons';
import AIAssistant from './AIAssistant';
import ScheduleListPanel from './ScheduleListPanel';
import type { DisplayMessage } from './AIAssistant';
import Footer from './Footer';
import type { NavRoute, TimeBlock } from '../types/schedule';
import {
  saveSchedule,
  updateSchedule,
  getDefaultSchedule,
  getSchedule,
  getUserSchedules,
} from '../services/scheduleService';
import type { Schedule } from '../types/schedule';
import { validateTimeBlock, sortTimeBlocks } from '../utils/timeUtils';

const availableColors = [
  '#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa',
  '#fb923c', '#65a30d', '#f472b6', '#38bdf8', '#c084fc',
];

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<NavRoute>('dashboard');
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const [viewMode, setViewMode] = useState<'linear' | 'circular'>('circular');
  const [showScheduleList, setShowScheduleList] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  // Modal state
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [pendingBlock, setPendingBlock] = useState<{ startTime: string; endTime: string } | null>(null);
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null);

  // Current schedule
  const [currentScheduleId, setCurrentScheduleId] = useState<string | null>(null);
  const [currentScheduleName, setCurrentScheduleName] = useState<string>('My Schedule');
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const authButtonRef = useRef<HTMLDivElement>(null);

  // AI Assistant chat state (lifted up to persist across navigation)
  const [aiMessages, setAiMessages] = useState<DisplayMessage[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI scheduling assistant. I can help you plan your day, suggest schedule improvements, or create a new schedule from scratch.\n\nHow can I help?',
      timestamp: new Date(),
    },
  ]);

  // Dark mode
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Apply dark mode class on mount and toggle
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleDarkMode = () => setIsDark(prev => !prev);

  // Ref to track if we're currently saving
  const savingRef = useRef(false);

  // Load user's default schedule on auth change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsLoading(true);

      if (currentUser) {
        try {
          const [defaultSchedule, schedules] = await Promise.all([
            getDefaultSchedule(currentUser.uid),
            getUserSchedules(currentUser.uid),
          ]);

          setAllSchedules(schedules);

          if (defaultSchedule) {
            setTimeBlocks(defaultSchedule.timeBlocks);
            setCurrentScheduleId(defaultSchedule.id);
            setCurrentScheduleName(defaultSchedule.name);
          }
        } catch (error) {
          console.error('Error loading schedules:', error);
        }
      } else {
        setTimeBlocks([]);
        setCurrentScheduleId(null);
        setCurrentScheduleName('My Schedule');
        setAllSchedules([]);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Manual save function
  const handleSaveSchedule = async () => {
    // If guest mode, show sign-in prompt
    if (!user) {
      setShowSignInPrompt(true);
      return;
    }

    if (savingRef.current) return;

    let scheduleName = currentScheduleName;

    // Only prompt for name when saving for the first time (no existing schedule)
    if (!currentScheduleId) {
      const input = prompt('Enter a title for this schedule:', 'My Schedule');
      if (!input) return;
      scheduleName = input.trim() || 'My Schedule';
      setCurrentScheduleName(scheduleName);
    }

    savingRef.current = true;
    setSaveStatus('saving');

    try {
      const scheduleData = {
        name: scheduleName,
        timeBlocks: timeBlocks,
        isDefault: true,
      };

      if (currentScheduleId) {
        await updateSchedule(currentScheduleId, user.uid, scheduleData);
      } else {
        const newId = await saveSchedule(user.uid, scheduleData);
        setCurrentScheduleId(newId);
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      console.error('Error saving schedule:', error);
      setSaveStatus('error');
      if (error instanceof Error && error.message.includes('Maximum 10 schedules')) {
        alert(error.message);
      }
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      savingRef.current = false;
    }
  };

  // Handle block creation from timeline
  const handleBlockCreated = (startTime: string, endTime: string) => {
    // Validate no overlaps
    const validation = validateTimeBlock({ startTime, endTime }, timeBlocks);

    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    setPendingBlock({ startTime, endTime });
    setShowLabelModal(true);
  };

  // Save the labeled block (create or edit)
  const handleSaveBlock = (label: string, color: string) => {
    if (editingBlock) {
      // Edit existing block
      setTimeBlocks(prev =>
        prev.map(b =>
          b.id === editingBlock.id
            ? { ...b, label, color }
            : b
        )
      );
      setEditingBlock(null);
    } else if (pendingBlock) {
      // Create new block
      const newBlock: TimeBlock = {
        id: crypto.randomUUID(),
        startTime: pendingBlock.startTime,
        endTime: pendingBlock.endTime,
        label,
        color,
        order: timeBlocks.length,
      };
      setTimeBlocks(prev => sortTimeBlocks([...prev, newBlock]));
      setPendingBlock(null);
    }
    setShowLabelModal(false);
  };

  // Handle block deletion
  const handleDeleteBlock = () => {
    if (editingBlock) {
      setTimeBlocks(prev => prev.filter(b => b.id !== editingBlock.id));
      setEditingBlock(null);
      setShowLabelModal(false);
    }
  };

  // Handle block click (for editing)
  const handleBlockClick = (block: TimeBlock) => {
    setEditingBlock(block);
    setShowLabelModal(true);
  };

  // Handle schedule switching
  const handleScheduleSelect = async (scheduleId: string) => {
    if (!user) return;

    try {
      const schedule = await getSchedule(scheduleId, user.uid);
      if (schedule) {
        setTimeBlocks(schedule.timeBlocks);
        setCurrentScheduleId(schedule.id);
        setCurrentScheduleName(schedule.name);
        setShowScheduleDropdown(false);
        if (currentRoute !== 'dashboard') {
          setCurrentRoute('dashboard'); // Navigate back to dashboard if not already there
        }
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      alert('Failed to load schedule');
    }
  };

  // Clear all time blocks
  const handleClearAllBlocks = () => {
    if (!confirm('Are you sure you want to clear all time blocks from this schedule? This cannot be undone.')) {
      return;
    }
    setTimeBlocks([]);
  };

  // Create new schedule
  const handleCreateNewSchedule = async () => {
    if (!user) {
      setShowSignInPrompt(true);
      return;
    }

    const scheduleName = prompt('Enter a name for the new schedule:', 'New Schedule');
    if (!scheduleName) return;

    try {
      const newId = await saveSchedule(user.uid, {
        name: scheduleName.trim(),
        timeBlocks: [],
        isDefault: false,
      });

      // Refresh schedules list
      const schedules = await getUserSchedules(user.uid);
      setAllSchedules(schedules);

      // Switch to new schedule
      setCurrentScheduleId(newId);
      setCurrentScheduleName(scheduleName.trim());
      setTimeBlocks([]);
      setShowScheduleDropdown(false);
    } catch (error) {
      console.error('Error creating schedule:', error);
      if (error instanceof Error && error.message.includes('Maximum 10 schedules')) {
        alert(error.message);
      } else {
        alert('Failed to create schedule');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Landing page for non-authenticated users
  if (!user && !isGuestMode) {
    return (
      <div className="min-h-screen overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-950">
        {/* Nav bar rendered by AuthButtons */}
        <AuthButtons />

        <div className="flex items-center justify-center p-4 sm:p-8 pt-24 sm:pt-28 pb-16 min-h-screen">
          <div className="max-w-2xl w-full">

            {/* Hero */}
            <div className="text-center mb-10 sm:mb-14">
              <h1
                className="text-6xl sm:text-7xl lg:text-8xl font-black text-gray-900 dark:text-white mb-4 tracking-tight leading-none"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                DayChart
              </h1>
              <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Visual time management — plan your day on a 24-hour clock dial
              </p>
              {/* Mobile performance note */}
              <div className="lg:hidden mt-5 px-4">
                <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-full px-4 py-2 text-sm text-blue-700 dark:text-blue-300">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Best experienced on desktop
                </div>
              </div>
            </div>

            {/* Primary CTA */}
            <div className="text-center mb-10 sm:mb-14">
              <button
                onClick={() => setIsGuestMode(true)}
                className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/30 hover:bg-blue-700 hover:shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all border-none"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Try It Free
              </button>
              <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">
                No account needed
                {isFirebaseConfigured && (
                  <>
                    {' ·  '}
                    <span
                      onClick={() => {
                        const btn = document.querySelector<HTMLButtonElement>('nav button');
                        if (btn) btn.click();
                      }}
                      className="text-blue-500 cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                    >
                      Sign in
                    </span>
                    {' '}to save & sync across devices
                  </>
                )}
              </p>
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-10">
              <div className="group bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5">Circular + Linear Views</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">24-hour clock dial or linear timeline — see your whole day at a glance</p>
              </div>

              <div className="group bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-800 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5">Drag to Create</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Click and drag on the dial or timeline to create color-coded time blocks instantly</p>
              </div>

              <div className="group bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 hover:border-green-200 dark:hover:border-green-800 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5">Multiple Schedules</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Save separate schedules for work days, weekends, travel, and more</p>
              </div>

              <div className="group bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 hover:border-violet-200 dark:hover:border-violet-800 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5">AI Assistant</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Describe your ideal day in plain text and let AI build the schedule for you</p>
              </div>
            </div>

            {!isFirebaseConfigured && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 text-center">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Firebase not configured. Add your config to enable authentication and sync.
                </p>
              </div>
            )}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Sidebar - Desktop Only */}
      <div className="hidden lg:block">
        <Sidebar
          currentRoute={currentRoute}
          onNavigate={(route) => {
            setCurrentRoute(route);
          }}
          userEmail={user?.email}
          isGuestMode={isGuestMode}
          isDark={isDark}
          onToggleDark={toggleDarkMode}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header - Hidden on mobile and on AI Assistant (which has its own header) */}
        <header className={`bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-8 py-2 sm:py-3 lg:py-4 ${currentRoute === 'ai-assistant' ? 'hidden' : 'hidden lg:block'}`}>
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Page title — only shown for non-dashboard routes, or dashboard without dropdown */}
                {(currentRoute !== 'dashboard' || !user) && (
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {currentRoute === 'dashboard' && 'Schedule Editor'}
                    {currentRoute === 'schedules' && 'My Schedules'}
                    {currentRoute === 'settings' && 'Settings'}
                    {currentRoute === 'ai-assistant' && 'AI Assistant'}
                  </h2>
                )}

                {/* Schedule Dropdown - only on Schedule Editor page */}
                {currentRoute === 'dashboard' && user && (
                  <div className="relative">
                    <button
                      onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all shadow-sm"
                    >
                      <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate max-w-[160px]">{currentScheduleName}</span>
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showScheduleDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowScheduleDropdown(false)} />
                        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-20 max-h-96 overflow-y-auto">
                          {/* Current Schedules */}
                          <div className="px-2 py-1">
                            {allSchedules.map(schedule => (
                              <button
                                key={schedule.id}
                                onClick={() => handleScheduleSelect(schedule.id)}
                                className={`w-full px-3 py-2.5 text-left text-sm rounded-lg transition-colors flex items-center justify-between group ${
                                  schedule.id === currentScheduleId
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {schedule.id === currentScheduleId && (
                                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                  <span className="truncate font-medium">{schedule.name}</span>
                                </div>
                                <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{schedule.timeBlocks.length} blocks</span>
                              </button>
                            ))}
                          </div>

                          {/* Divider */}
                          <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

                          {/* Actions */}
                          <div className="px-2 py-1">
                            <button
                              onClick={handleCreateNewSchedule}
                              className="w-full px-3 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              New Schedule
                            </button>
                            <button
                              onClick={() => {
                                setShowScheduleDropdown(false);
                                handleClearAllBlocks();
                              }}
                              className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Clear All Blocks
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {user && saveStatus && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  {saveStatus === 'saved' && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      <span className="text-green-600 font-medium">Saved</span>
                    </>
                  )}
                  {saveStatus === 'saving' && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                      <span className="text-blue-600 font-medium">Saving...</span>
                    </>
                  )}
                  {saveStatus === 'error' && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      <span className="text-red-600 font-medium">Error saving</span>
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Controls */}
            {currentRoute === 'dashboard' && (
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {/* Schedule List Toggle */}
                <button
                  onClick={() => setShowScheduleList(true)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs sm:text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700 touch-manipulation flex items-center gap-1.5"
                  title="View schedule as list"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span className="hidden sm:inline">List</span>
                </button>

                {/* Save Button */}
                <button
                  onClick={handleSaveSchedule}
                  disabled={savingRef.current}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  {savingRef.current ? 'Saving...' : 'Save'}
                </button>

                {/* View Toggle */}
                <div className="inline-flex items-center gap-0.5 sm:gap-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100/80 dark:bg-gray-800/80 p-0.5 sm:p-1 shadow-inner">
                  <button
                    onClick={() => setViewMode('linear')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap touch-manipulation ${
                      viewMode === 'linear'
                        ? 'bg-blue-600 text-white shadow-sm border-blue-600'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border-transparent hover:border-gray-200 dark:hover:border-gray-600 hover:bg-white/70 dark:hover:bg-gray-700/70'
                    }`}
                  >
                    Linear
                  </button>
                  <button
                    onClick={() => setViewMode('circular')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap touch-manipulation ${
                      viewMode === 'circular'
                        ? 'bg-blue-600 text-white shadow-sm border-blue-600'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border-transparent hover:border-gray-200 dark:hover:border-gray-600 hover:bg-white/70 dark:hover:bg-gray-700/70'
                    }`}
                  >
                    Circular
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content Area - Mobile shows only circular, desktop can toggle */}
        {currentRoute === 'dashboard' && (
          <>
            {/* Desktop: Show based on viewMode */}
            <div className="hidden lg:block flex-1 overflow-auto">
              {viewMode === 'linear' && (
                <Timeline
                  timeBlocks={timeBlocks}
                  onBlockCreated={handleBlockCreated}
                  onBlockClick={handleBlockClick}
                />
              )}
              {viewMode === 'circular' && (
                <CircularChart
                  timeBlocks={timeBlocks}
                  onBlockCreated={handleBlockCreated}
                  onBlockClick={handleBlockClick}
                />
              )}
            </div>

            {/* Mobile: Always show circular — pt-12 clears the mobile top toolbar, pb-16 clears bottom nav */}
            <div className="lg:hidden flex-1 pt-12 pb-16">
              <CircularChart
                timeBlocks={timeBlocks}
                onBlockCreated={handleBlockCreated}
                onBlockClick={handleBlockClick}
              />
            </div>
          </>
        )}

        {currentRoute === 'schedules' && (
          <div className="flex-1 flex flex-col pb-16 lg:pb-0 min-h-0">
            {user ? (
              <SchedulesPage
                user={user}
                currentScheduleId={currentScheduleId}
                onScheduleSelect={handleScheduleSelect}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-950">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Sign In to View Schedules
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Create an account or{' '}
                    <span
                      onClick={() => {
                        const button = authButtonRef.current?.querySelector('button');
                        if (button) button.click();
                      }}
                      className="text-blue-600 underline cursor-pointer hover:text-blue-700 transition-colors"
                    >
                      sign in
                    </span>{' '}
                    to save and manage multiple schedules
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {currentRoute === 'ai-assistant' && (
          <div className="flex-1 flex flex-col pb-16 lg:pb-0 overflow-hidden min-h-0">
            <AIAssistant
              timeBlocks={timeBlocks}
              messages={aiMessages}
              setMessages={setAiMessages}
              onApplySchedule={(newBlocks) => {
                setTimeBlocks(newBlocks);
              }}
            />
          </div>
        )}

        {currentRoute === 'settings' && (
          <div className="flex-1 flex flex-col pb-16 lg:pb-0 min-h-0">
            {user ? (
              <SettingsPage
                user={user}
                timeBlocks={[]}
                currentScheduleName=""
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-950">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Sign In to Access Settings
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    <span
                      onClick={() => {
                        const button = authButtonRef.current?.querySelector('button');
                        if (button) button.click();
                      }}
                      className="text-blue-600 underline cursor-pointer hover:text-blue-700 transition-colors"
                    >
                      Sign in
                    </span>{' '}
                    to manage your profile, export schedules, and more
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Top Toolbar — dashboard controls */}
      {currentRoute === 'dashboard' && (
        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 h-12 flex items-center px-3 gap-2">
          <span className="flex-1 font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
            {currentScheduleName}
          </span>
          <button
            onClick={() => setShowScheduleList(true)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border-none"
            title="Schedule list"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          {user ? (
            <button
              onClick={handleSaveSchedule}
              disabled={savingRef.current}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 border-none flex items-center gap-1.5"
            >
              {saveStatus === 'saving' ? (
                <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : saveStatus === 'saved' ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
              {savingRef.current ? 'Saving…' : 'Save'}
            </button>
          ) : (
            <button
              onClick={() => setShowSignInPrompt(true)}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors border-none"
            >
              Sign In
            </button>
          )}
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-stretch h-16">
          {/* Editor */}
          <button
            onClick={() => setCurrentRoute('dashboard')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors border-none bg-transparent px-1 ${
              currentRoute === 'dashboard' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={currentRoute === 'dashboard' ? 2.5 : 2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Editor
          </button>

          {/* Schedules */}
          <button
            onClick={() => setCurrentRoute('schedules')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors border-none bg-transparent px-1 ${
              currentRoute === 'schedules' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={currentRoute === 'schedules' ? 2.5 : 2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Schedules
          </button>

          {/* AI Assistant */}
          <button
            onClick={() => setCurrentRoute('ai-assistant')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors border-none bg-transparent px-1 relative ${
              currentRoute === 'ai-assistant' ? 'text-violet-600 dark:text-violet-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={currentRoute === 'ai-assistant' ? 2.5 : 2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              {currentRoute !== 'ai-assistant' && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-violet-500 rounded-full" />
              )}
            </div>
            AI
          </button>

          {/* Settings */}
          <button
            onClick={() => setCurrentRoute('settings')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors border-none bg-transparent px-1 ${
              currentRoute === 'settings' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={currentRoute === 'settings' ? 2.5 : 2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={currentRoute === 'settings' ? 2.5 : 2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>
      </nav>


      {/* Schedule List Panel */}
      {showScheduleList && (
        <ScheduleListPanel
          timeBlocks={timeBlocks}
          onBlockClick={(block) => {
            setShowScheduleList(false);
            handleBlockClick(block);
          }}
          onClose={() => setShowScheduleList(false)}
        />
      )}

      {/* Label Modal */}
      {(pendingBlock || editingBlock) && (
        <LabelModal
          isOpen={showLabelModal}
          startTime={editingBlock?.startTime || pendingBlock?.startTime || '00:00'}
          endTime={editingBlock?.endTime || pendingBlock?.endTime || '00:00'}
          onClose={() => {
            setShowLabelModal(false);
            setPendingBlock(null);
            setEditingBlock(null);
          }}
          onSave={handleSaveBlock}
          onDelete={editingBlock ? handleDeleteBlock : undefined}
          availableColors={availableColors}
          mode={editingBlock ? 'edit' : 'create'}
          initialLabel={editingBlock?.label}
          initialColor={editingBlock?.color}
        />
      )}

      {/* Auth Buttons for Guest Mode - Hidden but functional */}
      {!user && isGuestMode && (
        <div ref={authButtonRef} className="hidden">
          <AuthButtons />
        </div>
      )}

      {/* Sign-In Prompt Modal */}
      {showSignInPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-8 relative border border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setShowSignInPrompt(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Sign In to Save
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create a free account to save your schedules and access them from anywhere
              </p>

              <div className="space-y-3">
                <AuthButtons />
                <button
                  onClick={() => setShowSignInPrompt(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Continue without saving
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
