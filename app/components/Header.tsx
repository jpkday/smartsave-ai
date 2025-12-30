'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface HeaderProps {
  currentPage: string;
}

export default function Header({ currentPage }: HeaderProps) {
  const pages = [
    { name: 'Shopping List', path: '/list', icon: '📝' },
    { name: 'Compare', path: '/compare', icon: '⚖️' },
    { name: 'Price History', path: '/history', icon: '📊' },
    { name: 'Items', path: '/items', icon: '📋' },
    { name: 'Price Grid', path: '/prices', icon: '💰' },
    { name: 'Add Receipt', path: '/receipts', icon: '🧾' },
    { name: 'Manage Stores', path: '/stores', icon: '🛍️' },
  ];

  // Desktop-only: collapse these into "More"
  const MORE_PAGES = ['Price Grid', 'Add Receipt', 'Manage Stores'];
  const primaryPages = pages.filter((p) => !MORE_PAGES.includes(p.name));
  const morePages = pages.filter((p) => MORE_PAGES.includes(p.name));
  const isInMore = MORE_PAGES.includes(currentPage);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

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
      {/* ===================== */}
      {/* Mobile: unchanged */}
      {/* ===================== */}
      <div className="flex md:hidden items-center gap-3">
        <Link
          href="/"
          className="bg-gray-600 text-white w-14 h-14 rounded-lg font-bold hover:bg-gray-700 transition flex items-center justify-center flex-shrink-0"
        >
          <span className="text-xl">🏠</span>
        </Link>

        <div className="flex-1 relative">
          <div className="w-full px-4 py-3.5 rounded-lg font-bold text-white bg-gray-600 text-center flex items-center justify-center gap-2">
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

      {/* ===================== */}
      {/* Desktop: 2 rows */}
      {/* Row 1 (top): right-aligned links */}
      {/* Row 2: (intentionally blank — page title is rendered by the page itself) */}
      {/* ===================== */}
      <div className="hidden md:block w-full">
        {/* Row 1: NAV LINKS (right-aligned) */}
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

          {/* More dropdown (desktop only, no icons) */}
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
                className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50"
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

        {/* Row 2 removed to avoid duplicate page title */}
      </div>
    </nav>
  );
}
