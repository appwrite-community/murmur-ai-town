// Chunky game icons, drawn as inline SVG.
import type { Emote } from '../lib/types';

const stroke = { stroke: '#3b2b2b', strokeWidth: 2.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export function EmoteIcon({ emote, size = 22 }: { emote: Emote; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24' };
  switch (emote) {
    case 'love':
      return <svg {...common}><path d="M12 20s-7-4.4-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.6 12 20 12 20z" fill="#ff6b8b" {...stroke} /></svg>;
    case 'happy':
      return <svg {...common}><circle cx="12" cy="12" r="8.5" fill="#ffd166" {...stroke} /><path d="M8.5 13.5c1.8 2.4 5.2 2.4 7 0" fill="none" {...stroke} /><circle cx="9.3" cy="10" r="1" fill="#3b2b2b" /><circle cx="14.7" cy="10" r="1" fill="#3b2b2b" /></svg>;
    case 'laugh':
      return <svg {...common}><circle cx="12" cy="12" r="8.5" fill="#ffd166" {...stroke} /><path d="M7.5 12.5h9c-.6 3-2.4 4.5-4.5 4.5s-3.9-1.5-4.5-4.5z" fill="#c8553d" {...stroke} /><path d="M8 9.5l2 1-2 1M16 9.5l-2 1 2 1" fill="none" {...stroke} /></svg>;
    case 'surprised':
      return <svg {...common}><path d="M12 3.5v10" {...stroke} strokeWidth={4.4} stroke="#e8505b" /><circle cx="12" cy="19.2" r="2" fill="#e8505b" /></svg>;
    case 'thinking':
      return <svg {...common}><path d="M8.5 8.5a3.6 3.6 0 1 1 5.4 3.1c-1.2.7-1.9 1.4-1.9 2.9" fill="none" {...stroke} strokeWidth={3.4} stroke="#4a7bd1" /><circle cx="12" cy="19.2" r="1.9" fill="#4a7bd1" /></svg>;
    case 'sad':
      return <svg {...common}><path d="M12 4c3 4.4 5 7.2 5 9.6a5 5 0 0 1-10 0C7 11.2 9 8.4 12 4z" fill="#7cc6f2" {...stroke} /></svg>;
    case 'angry':
      return <svg {...common}><path d="M5 9l4 1.5M19 9l-4 1.5M6 5l3 3M18 5l-3 3M9 15h6" fill="none" {...stroke} stroke="#d64545" strokeWidth={3} /></svg>;
    case 'shrug':
      return <svg {...common}><path d="M4 14l3-3 3 3M14 14l3-3 3 3" fill="none" {...stroke} /><path d="M9 19h6" {...stroke} /></svg>;
    case 'sleepy':
      return <svg {...common}><path d="M5 7h6l-6 7h6M14 4h5l-5 5h5" fill="none" {...stroke} stroke="#7b6cd9" /></svg>;
  }
}

export function SunIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <path key={a} d="M12 1.8v3" transform={`rotate(${a} 12 12)`} {...stroke} stroke="#f2a541" />
      ))}
      <circle cx="12" cy="12" r="5.2" fill="#ffd166" {...stroke} />
    </svg>
  );
}

export function MoonIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.4A7 7 0 0 1 15.5 3.5z" fill="#ffe8a3" {...stroke} />
      <circle cx="11" cy="14" r="1.1" fill="#e2c46f" />
    </svg>
  );
}

export function ScrollIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="#fff6e5" {...stroke} />
      <path d="M9 9h7M9 12.5h7M9 16h4" fill="none" {...stroke} strokeWidth={2} />
      <path d="M6 4a2 2 0 0 0-2 2v2h2" fill="#e9d3a5" {...stroke} />
    </svg>
  );
}

export function WhisperIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" fill="#fd366e" {...stroke} />
      <circle cx="8.7" cy="10" r="1.2" fill="#fff" /><circle cx="12" cy="10" r="1.2" fill="#fff" /><circle cx="15.3" cy="10" r="1.2" fill="#fff" />
    </svg>
  );
}

export function EyeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="#fff6e5" {...stroke} />
      <circle cx="12" cy="12" r="3.2" fill="#3b2b2b" />
    </svg>
  );
}

export function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M6 6l12 12M18 6L6 18" fill="none" {...stroke} strokeWidth={3.4} />
    </svg>
  );
}
