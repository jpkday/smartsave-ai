'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import HouseholdSelector from './components/HouseholdSelector';

export default function Home() {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [householdCode, setHouseholdCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const code = localStorage.getItem('household_code');
    setHouseholdCode(code);
  }, []);

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
        <h1 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6">SmartSaveAI</h1>
        <p className="text-base md:text-xl mb-6 md:mb-10 px-2">Stop overpaying for groceries. Shop smart and save.</p>
        
        {/* Mobile: Primary 4 buttons only */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {isLocked ? (
            <>
              <button onClick={handleLockedClick} className="w-full bg-yellow-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-yellow-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">📝</span>
                <span className="flex-1 ml-6">Shopping List</span>
              </button>
              
              <button onClick={handleLockedClick} className="w-full bg-green-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-green-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">⚖️</span>
                <span className="flex-1 ml-6">Compare</span>
              </button>
              
              <button onClick={handleLockedClick} className="w-full bg-amber-700 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-amber-800 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">📊</span>
                <span className="flex-1 ml-6">History</span>
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
              
              <Link href="/compare" className="w-full bg-green-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-green-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">⚖️</span>
                <span className="flex-1 ml-6">Compare</span>
              </Link>
              
              <Link href="/history" className="w-full bg-amber-700 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-amber-800 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">📊</span>
                <span className="flex-1 ml-6">History</span>
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
              
              <button onClick={handleLockedClick} className="bg-amber-700 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-amber-800 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-2xl">📊</span>
                <span className="flex-1 ml-6">History</span>
              </button>
              
              <button onClick={handleLockedClick} className="bg-green-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-green-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-2xl">⚖️</span>
                <span className="flex-1 ml-6">Compare</span>
              </button>
              
              <button onClick={handleLockedClick} className="bg-orange-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-orange-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-2xl">🧾</span>
                <span className="flex-1 ml-6">Receipts</span>
              </button>
              
              <button onClick={handleLockedClick} className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-2xl">💰</span>
                <span className="flex-1 ml-6">Prices</span>
              </button>
              
              <button onClick={handleLockedClick} className="bg-pink-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-pink-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-2xl">🛍️</span>
                <span className="flex-1 ml-6">Stores</span>
              </button>
              
              <button onClick={handleLockedClick} className="bg-purple-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-2xl">📋</span>
                <span className="flex-1 ml-6">Items</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/list" className="bg-yellow-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-yellow-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-2xl">📝</span>
                <span className="flex-1 ml-6">Shopping List</span>
              </Link>
              
              <Link href="/history" className="bg-amber-700 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-amber-800 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-2xl">📊</span>
                <span className="flex-1 ml-6">History</span>
              </Link>
              
              <Link href="/compare" className="bg-green-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-green-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-2xl">⚖️</span>
                <span className="flex-1 ml-6">Compare</span>
              </Link>
              
              <Link href="/receipts" className="bg-orange-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-orange-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-2xl">🧾</span>
                <span className="flex-1 ml-6">Receipts</span>
              </Link>
              
              <Link href="/prices" className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-2xl">💰</span>
                <span className="flex-1 ml-6">Prices</span>
              </Link>
              
              <Link href="/stores" className="bg-pink-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-pink-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-2xl">🛍️</span>
                <span className="flex-1 ml-6">Stores</span>
              </Link>
              
              <Link href="/items" className="bg-purple-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-2xl">📋</span>
                <span className="flex-1 ml-6">Items</span>
              </Link>
            </>
          )}
        </div>

        {/* Beta Code Section at Bottom */}
        <div className="mt-8 md:mt-12">
          {isLocked ? (
            <button
              onClick={() => setShowCodeModal(true)}
              className="bg-white/20 backdrop-blur-sm text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white/30 transition-all"
            >
              Enter Beta Code
            </button>
          ) : (
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 inline-block">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 bg-white/30 hover:bg-white/40 px-4 py-2 rounded-lg transition-colors"
                  >
                    <span className="font-mono font-bold text-lg tracking-widest">{householdCode}</span>
                    <span className="text-sm">{copied ? '✓' : '📋'}</span>
                  </button>
                </div>
                <button
                  onClick={() => setShowCodeModal(true)}
                  className="text-xs underline opacity-75 hover:opacity-100 transition-opacity"
                >
                  Switch code
                </button>
              </div>
            </div>
          )}
        </div>
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
              <Link href="/items" onClick={() => setShowMoreMenu(false)} className="w-full bg-purple-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-purple-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">📋</span>
                <span className="flex-1 ml-6">Items</span>
              </Link>
              
              <Link href="/prices" onClick={() => setShowMoreMenu(false)} className="w-full bg-blue-600 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-blue-700 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">💰</span>
                <span className="flex-1 ml-6">Prices</span>
              </Link>
              
              <Link href="/receipts" onClick={() => setShowMoreMenu(false)} className="w-full bg-orange-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-orange-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">🧾</span>
                <span className="flex-1 ml-6">Receipts</span>
              </Link>
              
              <Link href="/stores" onClick={() => setShowMoreMenu(false)} className="w-full bg-pink-500 text-white px-10 py-3 rounded-lg text-base font-semibold hover:bg-pink-600 transition cursor-pointer text-center relative flex items-center">
                <span className="absolute left-4 text-xl">🛍️</span>
                <span className="flex-1 ml-6">Stores</span>
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
        />
      )}
    </div>
  );
}