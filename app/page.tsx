'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import HouseholdSelector from './components/HouseholdSelector';
import { useSearchParams } from 'next/navigation';

function HomeContent() {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [householdCode, setHouseholdCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = localStorage.getItem('household_code');
    setHouseholdCode(code);
    setIsLoadingCode(false);
  }, []);

  useEffect(() => {
    const urlCode = searchParams.get('code');

    if (urlCode) {
      localStorage.setItem('household_code', urlCode);
      setHouseholdCode(urlCode);
      setIsLoadingCode(false);
      window.history.replaceState({}, '', '/');
    } else {
      const code = localStorage.getItem('household_code');
      setHouseholdCode(code);
      setIsLoadingCode(false);
    }
  }, [searchParams]);

  const handleCodeSuccess = () => {
    const code = localStorage.getItem('household_code');
    setHouseholdCode(code);
    setShowCodeModal(false);
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
    <div className="min-h-screen bg-blue-500 bg-gradient-to-br from-blue-500 to-green-400 flex items-center justify-center p-6">
      <div className="text-center text-white max-w-xs md:max-w-5xl w-full">
        <h1 className="text-3xl md:text-5xl font-bold mb-4 md:mb-8">ᯓ SmartSaveAI</h1>
        <p className="text-base md:text-xl mb-12 md:mb-20 px-2">Stop overpaying for groceries. Shop smart and save.</p>

        {/* Mobile: Primary 5 buttons */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {isLocked ? (
            <>
              <button onClick={handleLockedClick} className="w-full bg-yellow-500/90 backdrop-blur-sm border border-yellow-400/50 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-yellow-500 transition cursor-pointer text-center relative flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                <svg className="w-8 h-8 absolute left-4 text-yellow-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <span className="flex-1 ml-6 text-yellow-50 drop-shadow-sm">Shopping List</span>
              </button>

              <Link href="/deals" className="bg-red-500/90 backdrop-blur-sm border border-red-400/50 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-red-500 transition cursor-pointer text-center relative flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                <svg className="w-8 h-8 absolute left-4 text-red-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
                <span className="flex-1 ml-6 text-red-50 drop-shadow-sm">Local Deals</span>
              </Link>

              <button onClick={handleLockedClick} className="w-full bg-violet-700/90 backdrop-blur-sm border border-violet-500/50 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-violet-700 transition cursor-pointer text-center relative flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                <svg className="w-8 h-8 absolute left-4 text-violet-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548 5.478A1 1 0 0114 21h-4a1 1 0 01-.995-1.104l-.548-5.478z" /></svg>
                <span className="flex-1 ml-6 text-violet-50 drop-shadow-sm">Insights</span>
              </button>

              <button onClick={handleLockedClick} className="w-full bg-lime-500/90 backdrop-blur-sm border border-lime-400/50 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-lime-500 transition cursor-pointer text-center relative flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                <svg className="w-8 h-8 absolute left-4 text-lime-50 is-drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="flex-1 ml-6 text-lime-50 drop-shadow-sm">Recent Trips</span>
              </button>

              <button
                onClick={handleLockedClick}
                className="w-full bg-white/20 backdrop-blur-md border border-white/30 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-white/30 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 relative"
              >
                <span className="absolute left-4 text-xl">⋯</span>
                <span className="flex-1 ml-6">More</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/list" className="w-full bg-yellow-500/90 backdrop-blur-sm border border-yellow-400/50 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-yellow-500 transition cursor-pointer text-center relative flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                <svg className="w-8 h-8 absolute left-4 text-yellow-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <span className="flex-1 ml-6 text-yellow-50 drop-shadow-sm">Shopping List</span>
              </Link>

              <Link href="/deals" className="w-full bg-red-500/90 backdrop-blur-sm border border-red-400/50 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-red-500 transition cursor-pointer text-center relative flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                <svg className="w-8 h-8 absolute left-4 text-red-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
                <span className="flex-1 ml-6 text-red-50 drop-shadow-sm">Local Deals</span>
              </Link>

              <Link href="/insights" className="w-full bg-violet-700/90 backdrop-blur-sm border border-violet-500/50 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-violet-700 transition cursor-pointer text-center relative flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                <svg className="w-8 h-8 absolute left-4 text-violet-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548 5.478A1 1 0 0114 21h-4a1 1 0 01-.995-1.104l-.548-5.478z" /></svg>
                <span className="flex-1 ml-6 text-violet-50 drop-shadow-sm">Insights</span>
              </Link>

              <Link href="/trips" className="w-full bg-lime-500/90 backdrop-blur-sm border border-lime-400/50 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-lime-500 transition cursor-pointer text-center relative flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                <svg className="w-8 h-8 absolute left-4 text-lime-50 is-drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="flex-1 ml-6 text-lime-50 drop-shadow-sm">Recent Trips</span>
              </Link>

              <button
                onClick={() => setShowMoreMenu(true)}
                className="w-full bg-white/20 backdrop-blur-md border border-white/30 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-white/30 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 relative"
              >
                <span className="absolute left-4 text-xl">⋯</span>
                <span className="flex-1 ml-6">More</span>
              </button>
            </>
          )}
        </div>

        {/* Desktop: All buttons in 3 columns */}
        {/* Desktop: 3 Logical Columns (Shop, Analyze, Add) */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6 items-start text-left">

          {/* Column 1: Shop */}
          <div className="flex flex-col gap-3">
            <h3 className="text-white/90 font-bold uppercase tracking-wider text-sm mb-1 px-1">Shop</h3>
            {isLocked ? (
              <>
                <button onClick={handleLockedClick} className="bg-yellow-500 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-yellow-600 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  <span className="flex-1">Shopping List</span>
                </button>
                <button onClick={handleLockedClick} className="bg-red-500 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-red-600 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                  </svg>
                  <span className="flex-1">Local Deals</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/list" className="bg-yellow-500 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-yellow-600 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  <span className="flex-1">Shopping List</span>
                </Link>
                <Link href="/deals" className="bg-red-500 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-red-600 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                  </svg>
                  <span className="flex-1">Local Deals</span>
                </Link>
              </>
            )}
          </div>

          {/* Column 2: Analyze */}
          <div className="flex flex-col gap-3">
            <h3 className="text-white/90 font-bold uppercase tracking-wider text-sm mb-1 px-1">Analyze</h3>
            {isLocked ? (
              <>
                <button onClick={handleLockedClick} className="bg-violet-700 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-violet-600 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548 5.478A1 1 0 0114 21h-4a1 1 0 01-.995-1.104l-.548-5.478z" /></svg>
                  <span className="flex-1">Insights</span>
                </button>
                <button onClick={handleLockedClick} className="bg-lime-500 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-lime-600 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="flex-1">Recent Trips</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/insights" className="bg-violet-700 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-violet-600 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548 5.478A1 1 0 0114 21h-4a1 1 0 01-.995-1.104l-.548-5.478z" /></svg>
                  <span className="flex-1">Insights</span>
                </Link>
                <Link href="/trips" className="bg-lime-500 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-lime-600 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="flex-1">Recent Trips</span>
                </Link>
              </>
            )}
          </div>

          {/* Column 3: Contribute */}
          <div className="flex flex-col gap-3">
            <h3 className="text-white/90 font-bold uppercase tracking-wider text-sm mb-1 px-1">Contribute</h3>
            {isLocked ? (
              <>
                <button onClick={handleLockedClick} className="bg-orange-500 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-orange-600 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <span className="flex-1">Add Receipt</span>
                </button>
                <button onClick={handleLockedClick} className="bg-indigo-600 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                  <span className="flex-1">Add Flyer</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/receipts?mode=receipt" className="bg-orange-500 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-orange-600 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <span className="flex-1">Add Receipt</span>
                </Link>
                <Link href="/receipts?mode=flyer" className="bg-indigo-600 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition cursor-pointer flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                  <span className="flex-1">Add Flyer</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Beta Code Section at Bottom */}
        {!isLoadingCode && (
          <div className="mt-12 md:mt-20 text-center">
            {isLocked ? (
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 pt-1 pb-3 text-left">
                <div className="text-xs uppercase tracking-wider text-gray-300 mb-0.5">
                  Beta Code
                </div>

                <button
                  onClick={() => setShowCodeModal(true)}
                  className="w-full text-center bg-white/20 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white/30 transition-all"
                >
                  Enter Beta Code
                </button>
              </div>
            ) : (
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 inline-block text-left">
                <div className="text-xs uppercase tracking-wider text-gray-200 mb-2">
                  Beta Code
                </div>

                <button
                  onClick={() => setShowCodeModal(true)}
                  className="relative bg-white/30 hover:bg-white/40 px-10 py-2 rounded-lg transition-colors group"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50 md:hidden">
          <div className="bg-white rounded-lg p-6 w-full max-w-xs">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">More Options</h2>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Link href="/compare" onClick={() => setShowMoreMenu(false)} className="w-full bg-emerald-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-emerald-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">⚖️</span>
                <span className="flex-1 ml-6">Compare Items</span>
              </Link>

              <Link href="/history" onClick={() => setShowMoreMenu(false)} className="w-full bg-amber-700 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-amber-800 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">📊</span>
                <span className="flex-1 ml-6">Price History</span>
              </Link>

              <Link href="/items" onClick={() => setShowMoreMenu(false)} className="w-full bg-purple-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-purple-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">📋</span>
                <span className="flex-1 ml-6">Manage Items</span>
              </Link>

              <Link href="/prices" onClick={() => setShowMoreMenu(false)} className="w-full bg-blue-600 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-blue-700 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">💰</span>
                <span className="flex-1 ml-6">Enter Prices</span>
              </Link>

              <Link href="/receipts?mode=receipt" onClick={() => setShowMoreMenu(false)} className="w-full bg-orange-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-orange-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">🧾</span>
                <span className="flex-1 ml-6">Add Receipt</span>
              </Link>

              <Link href="/receipts?mode=flyer" onClick={() => setShowMoreMenu(false)} className="w-full bg-indigo-600 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-indigo-700 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">✄</span>
                <span className="flex-1 ml-6">Add Flyer</span>
              </Link>

              <Link href="/stores" onClick={() => setShowMoreMenu(false)} className="w-full bg-pink-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-pink-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">🛍️</span>
                <span className="flex-1 ml-6">Manage Stores</span>
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
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400" />}>
      <HomeContent />
    </Suspense>
  );
}
