'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface HouseholdSelectorProps {
  onSuccess?: () => void;
  autoShow?: boolean;
  initialCode?: string;
}

export default function HouseholdSelector({
  onSuccess,
  autoShow = false,
  initialCode = '',
}: HouseholdSelectorProps) {
  const [showModal, setShowModal] = useState(true);
  const [inputCode, setInputCode] = useState(initialCode);
  const [error, setError] = useState('');

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoShow) {
      const savedCode = localStorage.getItem('household_code');
      const savedId = localStorage.getItem('household_id');
      if (savedCode && savedId) {
        setShowModal(false);
      }
    }
  }, [autoShow]);

  // Update input when initialCode changes
  useEffect(() => {
    setInputCode(initialCode);
  }, [initialCode]);

  useEffect(() => {
    if (!showModal) return;
  
    const code =
      initialCode ||
      localStorage.getItem('household_code') ||
      '';
  
    if (code) {
      setInputCode(code.toUpperCase());
    }
  
    // iOS-safe focus + keyboard open
    setTimeout(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      inputRef.current?.setSelectionRange(0, 999);
    }, 50);
  }, [showModal, initialCode]);
  

  const handleSubmit = async () => {
    const code = inputCode.trim().toUpperCase();

    if (code.length < 4) {
      setError('Please enter a valid code');
      return;
    }

    const { data, error: dbError } = await supabase
      .from('households')
      .select('id, code')
      .eq('code', code)
      .single();

    if (dbError || !data) {
      setError('Invalid code. Please check and try again.');
      return;
    }

    localStorage.setItem('household_code', code);
    localStorage.setItem('household_id', data.id);
    setShowModal(false);

    if (onSuccess) onSuccess();
    else window.location.reload();
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">
          {initialCode ? 'Change Beta Code' : 'Welcome to the SmartSaveAI beta!'}
        </h2>
        <p className="text-gray-600 mb-4">
          {initialCode ? 'Enter a new four character code:' : 'Enter your four character code to get started:'}
        </p>

        <input
          ref={inputRef}
          type="text"
          value={inputCode}
          onChange={(e) => {
            setInputCode(e.target.value.toUpperCase());
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="A1B2"
          maxLength={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-2 uppercase text-center text-2xl font-mono tracking-widest"
        />


        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

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
