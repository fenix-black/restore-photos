'use client';

import React, { useState, useEffect } from 'react';

interface CameraMascotProps {
  isActive: boolean;
  progress: number;
}

const CameraMascot: React.FC<CameraMascotProps> = ({ isActive, progress }) => {
  const [position, setPosition] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [eyeBlink, setEyeBlink] = useState(false);
  const [armWave, setArmWave] = useState(false);

  // Wandering animation
  useEffect(() => {
    if (!isActive) return;

    const wanderInterval = setInterval(() => {
      setPosition(Math.random() * 60 - 30); // Random position between -30 and 30
    }, 3000);

    return () => clearInterval(wanderInterval);
  }, [isActive]);

  // Random jumping
  useEffect(() => {
    if (!isActive) return;

    const jumpInterval = setInterval(() => {
      setIsJumping(true);
      setTimeout(() => setIsJumping(false), 500);
    }, 8000);

    return () => clearInterval(jumpInterval);
  }, [isActive]);

  // Eye blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setEyeBlink(true);
      setTimeout(() => setEyeBlink(false), 150);
    }, 2500);

    return () => clearInterval(blinkInterval);
  }, []);

  // Arm waving
  useEffect(() => {
    if (!isActive) return;

    const waveInterval = setInterval(() => {
      setArmWave(true);
      setTimeout(() => setArmWave(false), 1000);
    }, 6000);

    return () => clearInterval(waveInterval);
  }, [isActive]);

  // Get excitement level based on progress
  const getExcitement = () => {
    if (progress > 90) return 'very-excited';
    if (progress > 60) return 'excited';
    if (progress > 30) return 'happy';
    return 'normal';
  };

  const excitement = getExcitement();

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className={`absolute bottom-0 transition-all duration-1000 ease-in-out ${
          isJumping ? '-translate-y-8' : 'translate-y-0'
        }`}
        style={{ 
          left: '50%',
          transform: `translateX(calc(-50% + ${position}px)) ${isJumping ? 'translateY(-2rem)' : ''}`,
        }}
      >
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          className={`${excitement === 'very-excited' ? 'animate-bounce' : ''}`}
        >
          {/* Camera Body */}
          <rect
            x="15"
            y="25"
            width="50"
            height="35"
            rx="5"
            fill="#4a5568"
            stroke="#2d3748"
            strokeWidth="2"
          />
          
          {/* Camera Lens */}
          <circle
            cx="40"
            cy="42"
            r="12"
            fill="#2d3748"
            stroke="#1a202c"
            strokeWidth="2"
          />
          <circle
            cx="40"
            cy="42"
            r="8"
            fill="#4299e1"
            opacity="0.8"
          />
          <circle
            cx="42"
            cy="40"
            r="3"
            fill="#ffffff"
            opacity="0.6"
          />
          
          {/* Viewfinder */}
          <rect
            x="30"
            y="20"
            width="20"
            height="8"
            rx="2"
            fill="#4a5568"
            stroke="#2d3748"
            strokeWidth="1.5"
          />
          
          {/* Flash */}
          <rect
            x="55"
            y="28"
            width="8"
            height="6"
            rx="1"
            fill="#fbbf24"
            className={progress > 75 ? 'animate-pulse' : ''}
          />
          
          {/* Cute Eyes */}
          <g className="eyes">
            {/* Left Eye */}
            <ellipse
              cx="30"
              cy="35"
              rx="4"
              ry={eyeBlink ? 1 : 5}
              fill="#1a202c"
              className="transition-all duration-150"
            />
            <circle
              cx="31"
              cy="34"
              r="1.5"
              fill="#ffffff"
              opacity={eyeBlink ? 0 : 1}
            />
            
            {/* Right Eye */}
            <ellipse
              cx="50"
              cy="35"
              rx="4"
              ry={eyeBlink ? 1 : 5}
              fill="#1a202c"
              className="transition-all duration-150"
            />
            <circle
              cx="51"
              cy="34"
              r="1.5"
              fill="#ffffff"
              opacity={eyeBlink ? 0 : 1}
            />
          </g>
          
          {/* Cute Mouth */}
          <path
            d={excitement === 'very-excited' 
              ? "M 35 48 Q 40 52 45 48" // Big smile
              : excitement === 'excited'
              ? "M 36 48 Q 40 50 44 48" // Medium smile
              : "M 37 48 Q 40 49 43 48" // Small smile
            }
            fill="none"
            stroke="#1a202c"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          
          {/* Little Arms */}
          <g className={armWave ? 'animate-wave' : ''}>
            {/* Left Arm */}
            <rect
              x="10"
              y="38"
              width="8"
              height="3"
              rx="1.5"
              fill="#4a5568"
              transform={armWave ? "rotate(-20 14 39.5)" : ""}
            />
            {/* Right Arm */}
            <rect
              x="62"
              y="38"
              width="8"
              height="3"
              rx="1.5"
              fill="#4a5568"
              transform={armWave ? "rotate(20 66 39.5)" : ""}
            />
          </g>
          
          {/* Little Legs */}
          <rect x="25" y="58" width="6" height="8" rx="3" fill="#4a5568" />
          <rect x="49" y="58" width="6" height="8" rx="3" fill="#4a5568" />
          
          {/* Film Strip Trail (appears when moving) */}
          {position !== 0 && (
            <g opacity="0.3">
              <rect x={position < 0 ? 70 : -10} y="62" width="15" height="10" fill="#1a202c" />
              <rect x={position < 0 ? 72 : -8} y="64" width="2" height="2" fill="#ffffff" />
              <rect x={position < 0 ? 75 : -5} y="64" width="2" height="2" fill="#ffffff" />
              <rect x={position < 0 ? 78 : -2} y="64" width="2" height="2" fill="#ffffff" />
              <rect x={position < 0 ? 72 : -8} y="68" width="2" height="2" fill="#ffffff" />
              <rect x={position < 0 ? 75 : -5} y="68" width="2" height="2" fill="#ffffff" />
              <rect x={position < 0 ? 78 : -2} y="68" width="2" height="2" fill="#ffffff" />
            </g>
          )}
          
          {/* Excitement particles */}
          {excitement === 'very-excited' && (
            <g className="animate-pulse">
              <circle cx="20" cy="20" r="2" fill="#fbbf24" opacity="0.6" />
              <circle cx="60" cy="18" r="2" fill="#f59e0b" opacity="0.6" />
              <circle cx="25" cy="15" r="1.5" fill="#fbbf24" opacity="0.5" />
              <circle cx="55" cy="22" r="1.5" fill="#f59e0b" opacity="0.5" />
            </g>
          )}
        </svg>
        
        {/* Speech Bubble (occasional) */}
        {armWave && (
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white rounded-lg px-2 py-1 text-xs text-gray-800 animate-fade-in">
            {progress > 75 ? '🎬' : '📸'}
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-20deg); }
          75% { transform: rotate(20deg); }
        }
        
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-wave {
          animation: wave 1s ease-in-out;
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default CameraMascot;
