'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  currentPage: string;
}

export default function Header({ currentPage }: HeaderProps) {
  const pages = [
    {name: 'Home', path: '/', icon: '🏠' },
    { name: 'Shopping List', path: '/list', icon: '📝' },
    { name: 'Compare Items', path: '/compare', icon: '⚖️' },
    { name: 'Recent Trips', path: '/trips', icon: '🛒' },
    { name: 'Price History', path: '/history', icon: '📊' },
    { name: 'Manage Items', path: '/items', icon: '📋' },
    { name: 'Enter Prices', path: '/prices', icon: '💰' },
    { name: 'Add Receipt', path: '/receipts', icon: '🧾' },
    { name: 'Manage Stores', path: '/stores', icon: '🛍️' },
  ];

  const mobileColorByPage: Record<string, string> = {
    'Home': 'bg-yellow-500 hover:bg-yellow-600',
    'Shopping List': 'bg-yellow-500 hover:bg-yellow-600',
    'Compare Items': 'bg-emerald-500 hover:bg-emerald-600',
    'Recent Trips': 'bg-rose-500 hover:bg-rose-600',
    'Price History': 'bg-amber-700 hover:bg-amber-800',
    'Manage Items': 'bg-purple-500 hover:bg-purple-600',
    'Enter Prices': 'bg-blue-600 hover:bg-blue-700',
    'Add Receipt': 'bg-orange-500 hover:bg-orange-600',
    'Manage Stores': 'bg-pink-500 hover:bg-pink-600',
  };

  const mobileCurrentClass =
    mobileColorByPage[currentPage] || 'bg-gray-600 hover:bg-gray-700';

  const MORE_PAGES = ['Price History', 'Manage Items', 'Enter Prices', 'Add Receipt', 'Manage Stores'];
  const primaryPages = pages.filter((p) => p.name !== 'Home' && !MORE_PAGES.includes(p.name));
  const morePages = pages.filter((p) => MORE_PAGES.includes(p.name));
  const isInMore = MORE_PAGES.includes(currentPage);

  const [moreOpen, setMoreOpen] = useState(false);
  const [showHome, setShowHome] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    setShowHome(window.history.length <= 1);
  }, []);

  useEffect(() => {
    if (!moreOpen) return;

    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };

    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [moreOpen]);

  return (
    <nav className="w-full">
      <div className="flex md:hidden items-center gap-3">
        {showHome ? (
          <Link
            href="/"
            className="bg-gray-400 text-white w-14 h-14 rounded-2xl font-bold hover:bg-gray-500 transition flex items-center justify-center flex-shrink-0"
          >
            <span className="text-xl">🏠</span>
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
        <div className="w-full flex justify-end items-center gap-4">
          <Link href="/" className="text-gray-600 hover:text-blue-600 font-semibold">
            Home
          </Link>

          {primaryPages.map((page) => (
            <Link
              key={page.name}
              href={page.path}
              className={`font-semibold ${
                currentPage === page.name ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              {page.name}
            </Link>
          ))}

          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={`font-semibold flex items-center gap-1 ${
                isInMore ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'
              }`}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
            >
              More
              <svg
                className={`w-4 h-4 transition ${moreOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {moreOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden z-50"
              >
                {morePages.map((p) => (
                  <Link
                    key={p.name}
                    href={p.path}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className={`block px-4 py-2.5 text-sm font-semibold ${
                      currentPage === p.name
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}