'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  currentPage: string;
}

export default function Header({ currentPage }: HeaderProps) {
  const pages = [
    { name: 'Home', path: '/', icon: 'ᯓ ' },
    { name: 'Shopping List', path: '/list', icon: '📝' },
    { name: 'Insights', path: '/insights', icon: '💡' },
    { name: 'Local Deals', path: '/deals', icon: '🔥' },
    { name: 'Recent Trips', path: '/trips', icon: '🛒' },
    { name: 'Compare Items', path: '/compare', icon: '⚖️' },
    { name: 'Price History', path: '/history', icon: '📊' },
    { name: 'Manage Items', path: '/items', icon: '📋' },
    { name: 'Enter Prices', path: '/prices', icon: '💰' },
    { name: 'Add Receipt', path: '/receipts?mode=receipt', icon: '🧾' },
    { name: 'Add Flyer', path: '/receipts?mode=flyer', icon: '✄' },
    { name: 'Manage Stores', path: '/stores', icon: '🛍️' },
  ];

  const mobileColorByPage: Record<string, string> = {
    'Home': 'bg-yellow-500 hover:bg-yellow-600',
    'Shopping List': 'bg-yellow-500 hover:bg-yellow-600',
    'Insights': 'bg-violet-700 hover:bg-violet-600',
    'Local Deals': 'bg-red-500 hover:bg-red-600',
    'Recent Trips': 'bg-lime-500 hover:bg-lime-600',
    'Compare Items': 'bg-emerald-500 hover:bg-emerald-600',
    'Price History': 'bg-amber-700 hover:bg-amber-800',
    'Manage Items': 'bg-purple-500 hover:bg-purple-600',
    'Enter Prices': 'bg-blue-600 hover:bg-blue-700',
    'Add Receipt': 'bg-orange-500 hover:bg-orange-600',
    'Add Flyer': 'bg-indigo-600 hover:bg-indigo-700',
    'Manage Stores': 'bg-pink-500 hover:bg-pink-600',
  };

  const mobileCurrentClass =
    mobileColorByPage[currentPage] || 'bg-gray-600 hover:bg-gray-700';

  const [showHome, setShowHome] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setShowHome(window.history.length <= 1);
  }, []);

  return (
    <nav className="w-full">
      <div className="flex md:hidden items-center gap-3">
        {showHome ? (
          <Link
            href="/"
            className="bg-gray-400 text-white w-14 h-14 rounded-2xl font-bold hover:bg-gray-500 transition flex items-center justify-center flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </Link>
        ) : (
          <button
            onClick={() => router.back()}
            className="bg-gray-400 text-white w-14 h-14 rounded-2xl font-bold hover:bg-gray-500 transition flex items-center justify-center flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <div className="flex-1 relative">
          <div
            className={`w-full px-4 py-3.5 rounded-2xl font-bold text-white ${mobileCurrentClass} transition text-center flex items-center justify-center gap-2`}
          >
            <span>
              {pages.find((p) => p.name === currentPage)?.icon} {currentPage}
            </span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <select
            value={currentPage}
            onChange={(e) => {
              const page = pages.find((p) => p.name === e.target.value);
              if (page) window.location.href = page.path;
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          >
            {pages.map((page) => (
              <option key={page.name} value={page.name} disabled={page.name === currentPage}>
                {page.icon} {page.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="hidden md:block w-full">
        <div className="w-full flex justify-end items-center">

          {/* SHOP GROUP (Direct Links) */}
          <div className="flex items-center gap-1">

            <Link
              href="/list"
              className={`font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${currentPage === 'Shopping List' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-700'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Shopping List
            </Link>
            <Link
              href="/deals"
              className={`font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${currentPage === 'Local Deals' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-700'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
              Deals
            </Link>
          </div>

          <div className="h-6 w-px bg-gray-200 mx-4"></div>

          <div className="flex items-center gap-0">
            {/* ANALYZE GROUP (Dropdown) */}
            <div className="group relative">
              <button className={`font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors cursor-pointer ${['Insights', 'Price History', 'Compare Items', 'Recent Trips'].includes(currentPage) ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-700'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analyze
                <svg className="w-4 h-4 transition group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 transform origin-top-right z-50">
                <div className="py-2">
                  <Link href="/compare" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-700">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                    Compare Items
                  </Link>
                  <Link href="/history" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-700">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                    Price History
                  </Link>
                  <Link href="/insights" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-700">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548 5.478A1 1 0 0114 21h-4a1 1 0 01-.995-1.104l-.548-5.478z" /></svg>
                    Insights
                  </Link>
                  <Link href="/trips" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-700">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Recent Trips
                  </Link>
                </div>
              </div>
            </div>

            {/* ADD GROUP (Dropdown) */}
            <div className="group relative">
              <button className={`font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors cursor-pointer ${['Add Receipt', 'Add Flyer'].includes(currentPage) ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-700'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Contribute
                <svg className="w-4 h-4 transition group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 transform origin-top-right z-50">
                <div className="py-2">
                  <Link href="/receipts?mode=receipt" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-700">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Add Receipt
                  </Link>
                  <Link href="/receipts?mode=flyer" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-700">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    Add Flyer
                  </Link>
                  <div className="border-t border-gray-100 my-1"></div>
                  <Link href="/prices" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-700">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Enter Prices
                  </Link>
                </div>
              </div>
            </div>

            {/* MANAGE GROUP (Dropdown) */}
            <div className="group relative">
              <button className={`font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors cursor-pointer ${['Manage Items', 'Manage Stores'].includes(currentPage) ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-700'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage
                <svg className="w-4 h-4 transition group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 transform origin-top-right z-50">
                <div className="py-2">
                  <Link href="/items" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-700">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Manage Items
                  </Link>
                  <Link href="/stores" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-700">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    Manage Stores
                  </Link>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </nav>
  );
}
