'use client';

import { useState, useRef } from 'react';
import { CameraIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface PricePhotoCaptureProps {
    onImageCaptured: (imageData: string) => void;
    onClose: () => void;
}

export default function PricePhotoCapture({ onImageCaptured, onClose }: PricePhotoCaptureProps) {
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setPreview(result);
        };
        reader.readAsDataURL(file);
    };

    const handleCapture = () => {
        if (preview) {
            onImageCaptured(preview);
            setPreview(null);
        }
    };

    const handleRetake = () => {
        setPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                <h2 className="text-2xl font-bold mb-4 text-gray-900">Scan Price Tag</h2>

                {!preview ? (
                    <div className="space-y-4">
                        <p className="text-gray-600 text-sm">
                            Take a photo of a store price tag to automatically add the price to your database.
                        </p>

                        {/* Camera/Upload Button */}
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleFileSelect}
                                className="hidden"
                                id="price-photo-input"
                            />
                            <label
                                htmlFor="price-photo-input"
                                className="cursor-pointer flex flex-col items-center gap-3"
                            >
                                <div className="bg-blue-100 rounded-full p-4">
                                    <CameraIcon className="w-12 h-12 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-gray-900">Take Photo</p>
                                    <p className="text-sm text-gray-500">or select from gallery</p>
                                </div>
                            </label>
                        </div>

                        <div className="text-xs text-gray-500 space-y-1">
                            <p className="font-semibold">Tips for best results:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                <li>Ensure good lighting</li>
                                <li>Keep tag text clear and readable</li>
                                <li>Capture the entire price tag</li>
                            </ul>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Image Preview */}
                        <div className="rounded-xl overflow-hidden border-2 border-gray-200">
                            <img src={preview} alt="Price tag preview" className="w-full" />
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={handleRetake}
                                className="bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
                            >
                                Retake
                            </button>
                            <button
                                onClick={handleCapture}
                                className="bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
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
