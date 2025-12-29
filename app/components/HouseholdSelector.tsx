'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface HouseholdSelectorProps {
  onSuccess?: () => void;
  autoShow?: boolean;
}

export default function HouseholdSelector({ onSuccess, autoShow = false }: HouseholdSelectorProps) {
  const [showModal, setShowModal] = useState(true); // Changed to true by default!
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (autoShow) {
      const saved = localStorage.getItem('household_code');
      if (saved) {
        // If autoShow and code exists, don't show modal
        setShowModal(false);
      }
    }
  }, [autoShow]);

  const handleSubmit = async () => {
    const code = inputCode.trim().toUpperCase();
    
    if (code.length < 4) {
      setError('Please enter a valid code');
      return;
    }

    // Check if code exists in database
    const { data, error: dbError } = await supabase
      .from('households')
      .select('code')
      .eq('code', code)
      .single();

    if (dbError || !data) {
      setError('Invalid code. Please check and try again.');
      return;
    }

    // Code is valid!
    localStorage.setItem('household_code', code);
    setShowModal(false);
    if (onSuccess) {
      onSuccess();
    } else {
      window.location.reload();
    }
  };

  if (!showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">
          Welcome to the SmartSaveAI beta!
        </h2>
        <p className="text-gray-600 mb-4">
          Enter your four character code to get started:
        </p>
        <input
          type="text"
          value={inputCode}
          onChange={(e) => {
            setInputCode(e.target.value.toUpperCase());
            setError('');
          }}
          onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="ASDF"
          maxLength={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-2 uppercase text-center text-2xl font-mono tracking-widest"
          autoFocus
        />
        {error && (
          <p className="text-red-600 text-sm mb-4">{error}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={inputCode.length < 4}
          className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          Continue
        </button>
      </div>
    </div>
  );
}