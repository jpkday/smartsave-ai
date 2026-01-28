'use client';

import { useState, useRef } from 'react';
import { CameraIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import heic2any from 'heic2any';
import LoadingSpinner from './LoadingSpinner';

interface ReceiptPhotoCaptureProps {
    onImageCaptured: (imageData: string, addToTrips: boolean) => void;
    onClose: () => void;
}

export default function ReceiptPhotoCapture({ onImageCaptured, onClose }: ReceiptPhotoCaptureProps) {
    const [preview, setPreview] = useState<string | null>(null);
    const [addToTrips, setAddToTrips] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        let file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        try {
            // Handle HEIC/HEIF conversion
            if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
                try {
                    const convertedBlob = await heic2any({
                        blob: file,
                        toType: 'image/jpeg',
                        quality: 0.8
                    });

                    // heic2any can return an array if multiple images are in the HEIC file
                    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                    file = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
                } catch (err) {
                    console.error("HEIC conversion failed:", err);
                    // Continue with original file if conversion fails (though it will likely break in preview)
                }
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setPreview(result);
                setIsProcessing(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error("Processing failed:", err);
            setIsProcessing(false);
        }
    };

    const handleAnalyze = () => {
        if (preview) {
            onImageCaptured(preview, addToTrips);
            onClose();
        }
    };

    const handleRetake = () => {
        setPreview(null);
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (galleryInputRef.current) galleryInputRef.current.value = '';
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div
                className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl transform animate-in zoom-in-95 duration-200 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition"
                >
                    <XMarkIcon className="w-6 h-6" />
                </button>

                <h2 className="text-2xl font-bold mb-2 text-gray-900 pr-8">
                    <span className="md:hidden">Scan Receipt</span>
                    <span className="hidden md:block">Upload Receipt</span>
                </h2>
                <p className="text-gray-600 text-sm mb-6">
                    Upload a clear photo of your receipt to automatically extract items and prices.
                </p>

                {isProcessing ? (
                    <div className="py-20 flex flex-col items-center justify-center space-y-4">
                        <LoadingSpinner size="lg" message="Reading your receipt..." />
                    </div>
                ) : !preview ? (
                    <div className="space-y-6">
                        {/* Hidden Inputs */}
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="receipt-camera-input"
                        />
                        <input
                            ref={galleryInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="receipt-gallery-input"
                        />

                        {/* Trip Data Checkbox - Positioned ABOVE buttons, right-aligned, no container */}
                        <div className="flex justify-end pt-1">
                            <label className="flex items-center gap-2 select-none group">

                                <input
                                    id="add-to-trips"
                                    type="checkbox"
                                    checked={addToTrips}
                                    onChange={(e) => setAddToTrips(e.target.checked)}
                                    className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-blue-900/60 group-hover:text-blue-600 transition-colors">
                                    Add to Recent Trips
                                </span>
                            </label>
                        </div>

                        {/* Main Camera Option */}
                        <button
                            onClick={() => galleryInputRef.current?.click()}
                            className="w-full flex flex-col items-center gap-4 p-8 bg-blue-50 border-2 border-blue-100 rounded-2xl hover:bg-blue-100 transition group"
                        >
                            <div className="bg-blue-600 text-white rounded-full p-4 shadow-lg group-hover:scale-110 transition-transform">
                                <PhotoIcon className="w-10 h-10" />
                            </div>
                            <div className="text-center">
                                <p className="text-xl font-bold text-blue-900">Upload Image</p>
                                <p className="text-sm text-blue-600 font-medium opacity-80">Choose from gallery</p>
                            </div>
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500 font-medium">OR</span>
                            </div>
                        </div>

                        {/* Gallery Upload Option */}
                        <button
                            onClick={() => cameraInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed border-gray-200 rounded-2xl hover:border-blue-300 hover:bg-gray-50 transition text-gray-700 font-bold"
                        >
                            <CameraIcon className="w-6 h-6 text-blue-500" />
                            Scan Receipt
                        </button>

                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-xs text-amber-800 space-y-2">
                            <p className="font-bold flex items-center gap-1.5 uppercase tracking-wider">
                                Tips for Best Results:
                            </p>
                            <ul className="list-disc list-inside space-y-1 opacity-90 pl-1">
                                <li>Place receipt on a dark, flat surface</li>
                                <li>Ensure lighting is bright and even</li>
                                <li>Include the entire receipt from top to bottom</li>
                                <li>Keep the camera steady and wait for focus</li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Image Preview */}
                        <div className="rounded-2xl overflow-hidden border-2 border-gray-100 shadow-md max-h-[50vh] flex items-center justify-center bg-gray-50">
                            <img src={preview} alt="Receipt preview" className="max-w-full h-auto object-contain" />
                        </div>

                        {/* Trip Data Checkbox - Also right-aligned and no container here */}
                        <div className="flex justify-end">
                            <label className="flex items-center gap-2 select-none group">
                                <span className="text-xs font-bold text-blue-900/60 group-hover:text-blue-600 transition-colors">
                                    Add to Recent Trips
                                </span>
                                <input
                                    id="add-to-trips-preview"
                                    type="checkbox"
                                    checked={addToTrips}
                                    onChange={(e) => setAddToTrips(e.target.checked)}
                                    className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                            </label>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handleRetake}
                                className="py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold text-lg hover:bg-gray-200 transition"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={handleAnalyze}
                                className="py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition"
                            >
                                Analyze
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
