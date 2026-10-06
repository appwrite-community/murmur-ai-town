import type { Models } from 'appwrite';

export type Mood = 'cheerful' | 'content' | 'curious' | 'excited' | 'anxious' | 'grumpy' | 'suspicious' | 'sad' | 'sleepy';
export type Emote = 'happy' | 'laugh' | 'surprised' | 'thinking' | 'love' | 'sad' | 'angry' | 'shrug' | 'sleepy';
export type Activity = 'move' | 'talk' | 'work' | 'rest' | 'react';

export type World = Models.Row & {
  tick: number;
  day: number;
  minuteOfDay: number;
  lastTickAt: string | null;
  lastTickMs: number | null;
};

export type Place = Models.Row & { name: string; kind: 'work' | 'home' | 'outdoor'; description: string };

export type Resident = Models.Row & {
  name: string;
  job: string;
  persona: string;
  workplace: string;
  home: string;
  place: string;
  fromPlace: string;
  movedAtTick: number;
  activity: Activity;
  mood: Mood;
  emote: Emote | null;
  line: string | null;
  talkingTo: string | null;
  character: string;
  color: string;
};

export type TownEvent = Models.Row & {
  tick: number;
  kind: 'move' | 'talk' | 'rumor' | 'whisper' | 'react' | 'system';
  text: string;
  residentIds: string[] | null;
  place: string | null;
  rumorId: string | null;
  lines: string | null;
};

export type Line = { speaker: string; text: string; emote?: Emote };

export type Rumor = Models.Row & { text: string; originResidentId: string; tick: number; carriers: number };

export type Memory = Models.Row & {
  residentId: string;
  tick: number;
  kind: 'conversation' | 'heard' | 'whisper' | 'observation';
  text: string;
  rumorId: string | null;
  fromResidentId: string | null;
};

export type Relationship = Models.Row & { a: string; b: string; affinity: number; note: string | null };

export type Whisper = Models.Row & {
  residentId: string;
  text: string;
  status: 'pending' | 'heard' | 'rate_limited' | 'rejected';
  reply: string | null;
  emote: Emote | null;
};
