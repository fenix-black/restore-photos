'use client';

import React, { useState, useCallback } from 'react';
import { PhotoIcon } from './icons/PhotoIcon';
import { useLocalization } from '@/contexts/LocalizationContext';

interface DropzoneProps {
  onImageDrop: (file: File) => void;
}

const Dropzone: React.FC<DropzoneProps> = ({ onImageDrop }) => {
  const { t } = useLocalization();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if(files[0].type.startsWith('image/')) {
        onImageDrop(files[0]);
      } else {
        alert(t('alertImageType'));
      }
    }
  }, [onImageDrop, t]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
        if(files[0].type.startsWith('image/')) {
            onImageDrop(files[0]);
        } else {
            alert(t('alertImageType'));
        }
    }
  };


  return (
    <div
      className={`relative w-full max-w-2xl p-8 sm:p-12 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer
        ${isDragging ? 'border-brand-secondary bg-blue-900/30 scale-105' : 'border-gray-600 hover:border-gray-500 bg-brand-dark'}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => document.getElementById('fileInput')?.click()}
    >
      <input
        type="file"
        id="fileInput"
        className="hidden"
        accept="image/*"
        onChange={handleFileSelect}
      />
      <PhotoIcon className="w-16 h-16 text-gray-500 mb-4 transition-transform duration-300" />
      <h3 className="text-xl font-semibold text-white">{t('dropzoneTitle')}</h3>
      <p className="text-gray-400 mt-2">{t('dropzoneSubtitle')}</p>
      <p className="text-xs text-gray-500 mt-4">{t('dropzoneHint')}</p>
    </div>
  );
};

export default Dropzone;