'use client';

import { useState, useRef } from 'react';
import { CameraIcon, PhotoIcon, XMarkIcon, DocumentIcon } from '@heroicons/react/24/outline';
// import heic2any from 'heic2any'; // Moved to dynamic import
import LoadingSpinner from './LoadingSpinner';

interface ReceiptPhotoCaptureProps {
    onImageCaptured: (imageData: string, addToTrips: boolean) => void;
    onClose: () => void;
}

export default function ReceiptPhotoCapture({ onImageCaptured, onClose }: ReceiptPhotoCaptureProps) {
    const [preview, setPreview] = useState<string | null>(null);
    const [isPDF, setIsPDF] = useState(false);
    const [pdfFileName, setPdfFileName] = useState<string | null>(null);
    const [addToTrips, setAddToTrips] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        let file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        try {
            // Check if it's a PDF
            const fileIsPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            setIsPDF(fileIsPDF);

            if (fileIsPDF) {
                // For PDFs, read directly as base64 (no conversion needed)
                setPdfFileName(file.name);
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    setPreview(result);
                    setIsProcessing(false);
                };
                reader.readAsDataURL(file);
                return;
            }

            // Handle HEIC/HEIF conversion for images
            if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
                try {
                    const heic2any = (await import('heic2any')).default;
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
            // Do not close immediately - let the parent handle navigation or error state
            // onClose(); 
        }
    };

    const handleRetake = () => {
        setPreview(null);
        setIsPDF(false);
        setPdfFileName(null);
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (galleryInputRef.current) galleryInputRef.current.value = '';
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div
                className="bg-bb-panel text-bb-cream border border-bb-line rounded-2xl max-w-lg w-full p-6 shadow-sm transform animate-in zoom-in-95 duration-200 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-bb-muted hover:text-bb-cream transition"
                >
                    <XMarkIcon className="w-6 h-6" />
                </button>

                <h2 className="text-2xl font-bold mb-2 text-bb-cream pr-8">
                    <span className="md:hidden">Scan Receipt</span>
                    <span className="hidden md:block">Upload Receipt</span>
                </h2>
                <p className="text-bb-muted text-sm mb-6">
                    Upload a photo or PDF of your receipt to automatically extract items and prices.
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
                            accept="image/*,.pdf,application/pdf"
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
                                    className="w-4 h-4 rounded border-bb-line accent-[#c9a96e] focus:ring-bb-gold/50 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-bb-muted group-hover:text-bb-cream transition-colors">
                                    Add to Recent Trips
                                </span>
                            </label>
                        </div>

                        {/* Main Camera Option */}
                        <button
                            onClick={() => galleryInputRef.current?.click()}
                            className="w-full flex flex-col items-center gap-4 p-8 bg-bb-raised border border-bb-line rounded-2xl hover:bg-white/5 transition group"
                        >
                            <div className="bg-bb-gold text-bb-navy rounded-full p-4 group-hover:scale-110 transition-transform">
                                <PhotoIcon className="w-10 h-10" />
                            </div>
                            <div className="text-center">
                                <p className="text-xl font-bold text-bb-cream">Upload File</p>
                                <p className="text-sm text-bb-muted font-medium">Image or PDF</p>
                            </div>
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-bb-line"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-bb-panel text-bb-muted font-medium">OR</span>
                            </div>
                        </div>

                        {/* Gallery Upload Option */}
                        <button
                            onClick={() => cameraInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed border-bb-line rounded-2xl hover:border-bb-gold/50 hover:bg-white/5 transition text-bb-cream font-bold"
                        >
                            <CameraIcon className="w-6 h-6 text-bb-muted" />
                            Scan Receipt
                        </button>

                        <div className="bg-white/[0.03] rounded-xl p-4 border border-bb-line text-xs text-bb-muted space-y-2">
                            <p className="font-bold flex items-center gap-1.5 uppercase tracking-wider">
                                Tips for Best Results:
                            </p>
                            <ul className="list-disc list-inside space-y-1 opacity-90 pl-1">
                                <li>PDF receipts from email work great</li>
                                <li>For photos: place receipt on a dark, flat surface</li>
                                <li>Include the entire receipt from top to bottom</li>
                                <li>Keep the camera steady and wait for focus</li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Preview */}
                        <div className="rounded-2xl overflow-hidden border border-bb-line max-h-[50vh] flex items-center justify-center bg-bb-raised">
                            {isPDF ? (
                                <div className="flex flex-col items-center gap-4 p-8">
                                    <div className="bg-bb-raised rounded-full p-4">
                                        <DocumentIcon className="w-16 h-16 text-bb-muted" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-bb-cream">PDF Receipt</p>
                                        <p className="text-sm text-bb-muted truncate max-w-[200px]">{pdfFileName}</p>
                                    </div>
                                </div>
                            ) : (
                                <img src={preview!} alt="Receipt preview" className="max-w-full h-auto object-contain" />
                            )}
                        </div>

                        {/* Trip Data Checkbox - Also right-aligned and no container here */}
                        <div className="flex justify-end">
                            <label className="flex items-center gap-2 select-none group">
                                <span className="text-xs font-bold text-bb-muted group-hover:text-bb-cream transition-colors">
                                    Add to Recent Trips
                                </span>
                                <input
                                    id="add-to-trips-preview"
                                    type="checkbox"
                                    checked={addToTrips}
                                    onChange={(e) => setAddToTrips(e.target.checked)}
                                    className="w-4 h-4 rounded border-bb-line accent-[#c9a96e] focus:ring-bb-gold/50 cursor-pointer"
                                />
                            </label>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handleRetake}
                                className="py-4 border border-bb-line bg-transparent text-bb-cream rounded-2xl font-bold text-lg hover:bg-white/5 transition"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={handleAnalyze}
                                className="py-4 bg-bb-gold text-bb-navy rounded-2xl font-semibold text-lg hover:brightness-110 transition"
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
