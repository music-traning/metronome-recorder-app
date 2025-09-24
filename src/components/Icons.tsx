import React from 'react';

const iconProps = {
  className: "w-6 h-6",
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 2
};

export const PlayIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
  </svg>
);

export const PauseIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h1a1 1 0 100-2H9V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 001 1h1a1 1 0 100-2h-1V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

export const MicIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" {...iconProps} >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
);

export const StopIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
    </svg>
);

export const DownloadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" {...iconProps} >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);