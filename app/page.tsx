'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense, useRef } from 'react';
import HouseholdSelector from './components/HouseholdSelector';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChartBarIcon, ClockIcon, NewspaperIcon } from '@heroicons/react/24/solid';

function HomeContent() {
  const router = useRouter();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [householdCode, setHouseholdCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(true);
  const searchParams = useSearchParams();

  // Consolidate initialization and URL code checking into one effect
  useEffect(() => {
    const urlCode = searchParams.get('code');

    if (urlCode) {
      localStorage.setItem('household_code', urlCode);
      // Redirect to welcome if code provided in URL
      router.push('/welcome');
    } else {
      const code = localStorage.getItem('household_code');
      setHouseholdCode(code);
      setIsLoadingCode(false);
    }
  }, [searchParams, router]);

  const handleCodeSuccess = () => {
    router.push('/welcome');
  };

  const handleCopy = async () => {
    if (householdCode) {
      await navigator.clipboard.writeText(householdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLockedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowCodeModal(true);
  };

  const isLocked = !householdCode;

  return (
    <div className="min-h-screen app-bg flex items-center justify-center p-6">
      <div className="text-center text-bb-cream max-w-xs md:max-w-5xl w-full">
        <h1 className="text-3xl md:text-5xl font-bold mb-4 md:mb-8">ᯓ SmartSaveAI</h1>
        <p className="text-base md:text-xl mb-12 md:mb-20 px-2">Stop overpaying for groceries and essentials. Shop smart and save.</p>

        {/* Mobile: Focused Beta Layout */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {isLocked ? (
            <>
              {/* Primary Action: SHOP */}
              <button onClick={handleLockedClick} className="w-full bg-bb-gold text-bb-navy px-6 py-6 rounded-2xl text-xl font-extrabold hover:brightness-110 transition flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  <span>Shopping List</span>
                </div>
                <svg className="w-6 h-6 opacity-75 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </button>

              {/* Secondary Grid */}
              <div className="grid grid-cols-2 gap-4">
                <button onClick={handleLockedClick} className="bg-bb-raised border border-bb-line text-bb-cream p-4 rounded-xl font-bold hover:border-bb-gold/50 transition [&>svg]:text-bb-gold flex flex-col items-center gap-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span>Scan</span>
                </button>
                <button onClick={handleLockedClick} className="bg-bb-raised border border-bb-line text-bb-cream p-4 rounded-xl font-bold hover:border-bb-gold/50 transition [&>svg]:text-bb-gold flex flex-col items-center gap-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                  <span>Deals</span>
                </button>
              </div>

              {/* Tertiary Actions */}
              <div className="bg-bb-panel border border-bb-line rounded-xl p-2 flex justify-around">
                <button onClick={handleLockedClick} className="p-2 text-bb-muted hover:text-bb-cream flex flex-col items-center text-xs gap-1">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>Recent</span>
                </button>
                <button onClick={handleLockedClick} className="p-2 text-bb-muted hover:text-bb-cream flex flex-col items-center text-xs gap-1">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  <span>Insights</span>
                </button>
                <button onClick={handleLockedClick} className="p-2 text-bb-muted hover:text-bb-cream flex flex-col items-center text-xs gap-1">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                  <span>More</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Primary Action: SHOP */}
              <Link href="/list" className="w-full bg-bb-gold text-bb-navy px-6 py-6 rounded-2xl text-xl font-extrabold hover:brightness-110 transition flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  <span>Shopping List</span>
                </div>
                <svg className="w-6 h-6 opacity-75 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </Link>

              {/* Secondary Grid */}
              <div className="grid grid-cols-2 gap-4">
                <Link href="/receipts?scan=true&returnTo=/" className="bg-bb-raised border border-bb-line text-bb-cream p-5 rounded-2xl font-bold hover:border-bb-gold/50 transition [&>svg]:text-bb-gold flex flex-col items-center gap-2 text-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span className="leading-none">Scan<br /><span className="text-xs text-bb-muted font-normal">Receipt</span></span>
                </Link>
                <Link href="/deals" className="bg-bb-raised border border-bb-line text-bb-cream p-5 rounded-2xl font-bold hover:border-bb-gold/50 transition [&>svg]:text-bb-gold flex flex-col items-center gap-2 text-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                  <span className="leading-none">Save<br /><span className="text-xs text-bb-muted font-normal">Deals</span></span>
                </Link>
              </div>

              {/* Tertiary Actions - Text Links */}
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Link href="/trips" className="bg-bb-panel border border-bb-line rounded-xl p-3 flex flex-col items-center justify-center text-bb-cream hover:bg-white/5 transition">
                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-xs font-medium">Recent</span>
                </Link>
                <Link href="/insights" className="bg-bb-panel border border-bb-line rounded-xl p-3 flex flex-col items-center justify-center text-bb-cream hover:bg-white/5 transition">
                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  <span className="text-xs font-medium">Insights</span>
                </Link>
                <button
                  onClick={() => setShowMoreMenu(true)}
                  className="bg-bb-panel border border-bb-line rounded-xl p-3 flex flex-col items-center justify-center text-bb-cream hover:bg-white/5 transition"
                >
                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                  <span className="text-xs font-medium">More</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Desktop: Simplified Grid */}
        <div className="hidden md:grid grid-cols-3 gap-8 items-start text-left mt-8">

          {/* Core Loop */}
          <div className="col-span-1 bg-bb-panel rounded-2xl p-6 border border-bb-line">
            <h3 className="text-bb-muted font-bold uppercase tracking-wider text-sm mb-4">Shop</h3>
            {isLocked ? (
              <button onClick={handleLockedClick} className="w-full bg-bb-gold text-bb-navy p-6 rounded-2xl text-xl font-bold hover:brightness-110 transition flex items-center gap-4">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <span>Shopping List</span>
              </button>
            ) : (
              <Link href="/list" className="w-full bg-bb-gold text-bb-navy p-6 rounded-2xl text-xl font-bold hover:brightness-110 transition flex items-center gap-4">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <span>Shopping List</span>
              </Link>
            )}
            <p className="text-bb-muted text-sm mt-4 px-1">
              Build your list, check off items as you go, and track your total in real-time.
            </p>
          </div>

          <div className="col-span-1 bg-bb-panel rounded-2xl p-6 border border-bb-line">
            <h3 className="text-bb-muted font-bold uppercase tracking-wider text-sm mb-4">Save</h3>
            {isLocked ? (
              <button onClick={handleLockedClick} className="w-full bg-bb-raised border border-bb-line text-bb-cream p-6 rounded-2xl text-xl font-bold hover:border-bb-gold/50 transition [&>svg]:text-bb-gold flex items-center gap-4">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                <span>Local Deals</span>
              </button>
            ) : (
              <Link href="/deals" className="w-full bg-bb-raised border border-bb-line text-bb-cream p-6 rounded-2xl text-xl font-bold hover:border-bb-gold/50 transition [&>svg]:text-bb-gold flex items-center gap-4">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                <span>Local Deals</span>
              </Link>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {isLocked ? (
                <>
                  <button onClick={handleLockedClick} className="border border-bb-line bg-transparent hover:bg-white/5 text-bb-cream py-2 rounded-lg text-sm font-semibold transition">Recent</button>
                  <button onClick={handleLockedClick} className="border border-bb-line bg-transparent hover:bg-white/5 text-bb-cream py-2 rounded-lg text-sm font-semibold transition">Insights</button>
                </>
              ) : (
                <>
                  <Link href="/trips" className="border border-bb-line bg-transparent hover:bg-white/5 text-bb-cream py-2.5 rounded-xl text-sm font-semibold transition text-center flex items-center justify-center gap-2">
                    <ClockIcon className="w-4 h-4" />
                    Recent
                  </Link>
                  <Link href="/insights" className="border border-bb-line bg-transparent hover:bg-white/5 text-bb-cream py-2.5 rounded-xl text-sm font-semibold transition text-center flex items-center justify-center gap-2">
                    <ChartBarIcon className="w-4 h-4" />
                    Insights
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="col-span-1 bg-bb-panel rounded-2xl p-6 border border-bb-line">
            <h3 className="text-bb-muted font-bold uppercase tracking-wider text-sm mb-4">Scan</h3>
            {isLocked ? (
              <button onClick={handleLockedClick} className="w-full bg-bb-raised border border-bb-line text-bb-cream p-6 rounded-2xl text-xl font-bold hover:border-bb-gold/50 transition [&>svg]:text-bb-gold flex items-center gap-4">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span>Upload Receipt</span>
              </button>
            ) : (
              <Link href="/receipts?scan=true&returnTo=/" className="w-full bg-bb-raised border border-bb-line text-bb-cream p-6 rounded-2xl text-xl font-bold hover:border-bb-gold/50 transition [&>svg]:text-bb-gold flex items-center gap-4">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span>Upload Receipt</span>
              </Link>
            )}
            <div className="mt-4 flex gap-2">
              {isLocked ? (
                <button onClick={handleLockedClick} className="flex-1 border border-bb-line bg-transparent hover:bg-white/5 text-bb-cream py-2 rounded-lg text-sm font-semibold transition">
                  Add Flyer
                </button>
              ) : (
                <Link href="/flyers" className="flex-1 border border-bb-line bg-transparent hover:bg-white/5 text-bb-cream py-2.5 rounded-xl text-sm font-semibold transition text-center flex items-center justify-center gap-2">
                  <NewspaperIcon className="w-4 h-4" />
                  Add Flyer
                </Link>
              )}
            </div>
          </div>

        </div>

        {/* Beta Code Section at Bottom */}
        {!isLoadingCode && (
          <div className="mt-6 md:mt-12 text-center">
            {isLocked ? (
              <div className="bg-bb-panel border border-bb-line rounded-lg px-4 pt-1 pb-3 text-left">
                <div className="text-xs uppercase tracking-wider text-bb-muted mb-0.5">
                  Beta Code
                </div>

                <button
                  onClick={() => setShowCodeModal(true)}
                  className="w-full text-center bg-bb-gold text-bb-navy px-8 py-4 rounded-lg text-lg font-semibold hover:brightness-110 transition-all"
                >
                  Enter Beta Code
                </button>
              </div>
            ) : (
              <div className="bg-bb-panel border border-bb-line rounded-lg p-4 inline-block text-left">
                <div className="text-xs uppercase tracking-wider text-bb-muted mb-2">
                  Beta Code
                </div>

                <button
                  onClick={() => setShowCodeModal(true)}
                  className="relative bg-bb-raised border border-bb-line text-bb-cream hover:bg-white/5 px-10 py-2 rounded-lg transition-colors group"
                  title="Click to change beta code"
                >
                  <span className="font-mono font-bold text-lg tracking-widest">
                    {householdCode}
                  </span>
                  <svg
                    className="w-4 h-4 opacity-0 group-hover:opacity-75 transition-opacity absolute right-2 top-1/2 -translate-y-1/2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.0 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* More Menu Modal - Mobile Only - Only show if unlocked */}
      {showMoreMenu && !isLocked && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50 md:hidden">
          <div className="bg-bb-panel border border-bb-line rounded-lg p-6 w-full max-w-xs">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-bb-cream">More Options</h2>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="text-bb-muted hover:text-bb-cream text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Link href="/items" onClick={() => setShowMoreMenu(false)} className="w-full border border-bb-line bg-transparent text-bb-cream px-10 py-3 rounded-lg text-base font-semibold hover:bg-white/5 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-bb-gold">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                </span>
                <span className="flex-1 ml-6">Manage Items</span>
              </Link>

              <Link href="/stores" onClick={() => setShowMoreMenu(false)} className="w-full border border-bb-line bg-transparent text-bb-cream px-10 py-3 rounded-lg text-base font-semibold hover:bg-white/5 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-bb-gold">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                </span>
                <span className="flex-1 ml-6">Manage Stores</span>
              </Link>

              {/* 
               Admin Pages hidden for Beta:
                - /compare
                - /history
                - /items
                - /prices
               */}

              <Link href="/flyers" onClick={() => setShowMoreMenu(false)} className="w-full border border-bb-line bg-transparent text-bb-cream px-10 py-3 rounded-lg text-base font-semibold hover:bg-white/5 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-bb-gold">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                </span>
                <span className="flex-1 ml-6">Add Flyer</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Beta Code Modal */}
      {showCodeModal && (
        <HouseholdSelector
          onSuccess={handleCodeSuccess}
          autoShow={false}
          initialCode={householdCode || ''}
        />
      )}

    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen app-bg" />}>
      <HomeContent />
    </Suspense>
  );
}
