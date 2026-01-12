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
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 flex items-center justify-center p-6">
      <div className="text-center text-white max-w-xs md:max-w-2xl w-full">
        <h1 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6">ᯓ SmartSaveAI</h1>
        <p className="text-base md:text-xl mb-6 md:mb-10 px-2">Stop overpaying for groceries. Shop smart and save.</p>
        
{/* Mobile: Primary 5 buttons */}
<div className="grid grid-cols-1 gap-3 md:hidden">
  {isLocked ? (
    <>
      <button onClick={handleLockedClick} className="w-full bg-yellow-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-yellow-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-xl">📝</span>
        <span className="flex-1 ml-6">Shopping List</span>
      </button>
      
      <Link href="/deals" className="bg-red-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-red-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">🔥</span>
        <span className="flex-1 ml-6">Local Deals</span>
      </Link>

      <button onClick={handleLockedClick} className="w-full bg-violet-700 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-violet-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-xl">💡</span>
        <span className="flex-1 ml-6">Insights</span>
      </button>

      <button onClick={handleLockedClick} className="w-full bg-lime-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-lime-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-xl">🛒</span>
        <span className="flex-1 ml-6">Recent Trips</span>
      </button>
      
      <button 
        onClick={handleLockedClick}
        className="w-full bg-blue-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-gray-800 transition cursor-pointer text-center relative flex items-center"
      >
        <span className="absolute left-4 text-xl">⋯</span>
        <span className="flex-1 ml-6">More</span>
      </button>
    </>
  ) : (
    <>
      <Link href="/list" className="w-full bg-yellow-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-yellow-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-xl">📝</span>
        <span className="flex-1 ml-6">Shopping List</span>
      </Link>
      
      <Link href="/deals" className="w-full bg-red-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-red-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">🔥</span>
        <span className="flex-1 ml-6">Local Deals</span>
      </Link>

      <Link href="/insights" className="w-full bg-violet-700 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-violet-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-xl">💡</span>
        <span className="flex-1 ml-6">Insights</span>
      </Link>
      
      <Link href="/trips" className="w-full bg-lime-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-lime-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-xl">🛒</span>
        <span className="flex-1 ml-6">Recent Trips</span>
      </Link>
  
      <button 
        onClick={() => setShowMoreMenu(true)}
        className="w-full bg-blue-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-gray-800 transition cursor-pointer text-center relative flex items-center"
      >
        <span className="absolute left-4 text-xl">⋯</span>
        <span className="flex-1 ml-6">More</span>
      </button>
    </>
  )}
</div>

        {/* Desktop: All buttons in 2 columns */}
<div className="hidden md:grid grid-cols-2 gap-4">
  {isLocked ? (
    <>
      <button onClick={handleLockedClick} className="bg-yellow-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-yellow-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">📝</span>
        <span className="flex-1 ml-6">Shopping List</span>
      </button>

      <button onClick={handleLockedClick} className="bg-purple-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">📋</span>
        <span className="flex-1 ml-6">Manage Items</span>
      </button>

      <button onClick={handleLockedClick} className="bg-lime-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-lime-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">🛒</span>
        <span className="flex-1 ml-6">Recent Trips</span>
      </button>

      <button onClick={handleLockedClick} className="bg-violet-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-violet-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">💡</span>
        <span className="flex-1 ml-6">Insights</span>
      </button>
      
      <button onClick={handleLockedClick} className="bg-emerald-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-emerald-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">⚖️</span>
        <span className="flex-1 ml-6">Compare Items</span>
      </button>

      <button onClick={handleLockedClick} className="bg-red-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-red-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">🔥</span>
        <span className="flex-1 ml-6">Local Deals</span>
      </button>
      
      <button onClick={handleLockedClick} className="bg-amber-700 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-amber-800 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">📊</span>
        <span className="flex-1 ml-6">Price History</span>
      </button>
      
      <button onClick={handleLockedClick} className="bg-orange-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-orange-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">🧾</span>
        <span className="flex-1 ml-6">Enter Receipt</span>
      </button>
      
      <button onClick={handleLockedClick} className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">💰</span>
        <span className="flex-1 ml-6">Enter Prices</span>
      </button>
      
      <button onClick={handleLockedClick} className="bg-pink-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-pink-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">🛍️</span>
        <span className="flex-1 ml-6">Manage Stores</span>
      </button>
    </>
  ) : (
    <>
      <Link href="/list" className="bg-yellow-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-yellow-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">📝</span>
        <span className="flex-1 ml-6">Shopping List</span>
      </Link>

      <Link href="/items" className="bg-purple-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">📋</span>
        <span className="flex-1 ml-6">Manage Items</span>
      </Link>

      <Link href="/deals" className="bg-red-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-red-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">🔥</span>
        <span className="flex-1 ml-6">Local Deals</span>
      </Link>
      
      <Link href="/compare" className="bg-emerald-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-emerald-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">⚖️</span>
        <span className="flex-1 ml-6">Compare Items</span>
      </Link>

      <Link href="/prices" className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">💰</span>
        <span className="flex-1 ml-6">Enter Prices</span>
      </Link>

      <Link href="/trips" className="bg-lime-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-lime-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">🛒</span>
        <span className="flex-1 ml-6">Recent Trips</span>
      </Link>

      <Link href="/insights" className="bg-violet-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-violet-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">💡</span>
        <span className="flex-1 ml-6">Insights</span>
      </Link>

      <Link href="/receipts" className="bg-orange-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-orange-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">🧾</span>
        <span className="flex-1 ml-6">Enter Receipt</span>
      </Link>

      <Link href="/history" className="bg-amber-700 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-amber-800 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">📊</span>
        <span className="flex-1 ml-6">Price History</span>
      </Link>
      
      <Link href="/stores" className="bg-pink-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-pink-600 transition cursor-pointer text-center relative flex items-center">
        <span className="absolute left-4 text-2xl">🛍️</span>
        <span className="flex-1 ml-6">Manage Stores</span>
      </Link>
    </>
  )}
</div>

        {/* Beta Code Section at Bottom */}
        {!isLoadingCode && (
          <div className="mt-8 md:mt-12 text-center">
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
              
              <Link href="/receipts" onClick={() => setShowMoreMenu(false)} className="w-full bg-orange-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-orange-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">🧾</span>
                <span className="flex-1 ml-6">Enter Receipt</span>
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
