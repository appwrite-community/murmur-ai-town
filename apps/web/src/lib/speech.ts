// Speech bubbles above residents. Conversations play line by line.
import { create } from 'zustand';
import type { Emote, Line } from './types';

type Bubble = { text: string; emote: Emote | null; until: number; id: number };

export const useSpeech = create<{ bubbles: Record<string, Bubble> }>(() => ({ bubbles: {} }));

let counter = 0;
const timers = new Set<ReturnType<typeof setTimeout>>();

export function say(residentId: string, text: string, ms = 5000, emote: Emote | null = null) {
  const id = ++counter;
  useSpeech.setState((s) => ({ bubbles: { ...s.bubbles, [residentId]: { text, emote, until: Date.now() + ms, id } } }));
  const timer = setTimeout(() => {
    timers.delete(timer);
    useSpeech.setState((s) => {
      if (s.bubbles[residentId]?.id !== id) return s;
      const { [residentId]: _gone, ...rest } = s.bubbles;
      return { bubbles: rest };
    });
  }, ms);
  timers.add(timer);
}

/** Plays a conversation: one line every few seconds, each above its speaker. */
export function playConversation(lines: Line[], delayMs = 0) {
  lines.forEach((line, i) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      say(line.speaker, line.text, 4600, line.emote ?? null);
    }, delayMs + i * 4200);
    timers.add(timer);
  });
}
