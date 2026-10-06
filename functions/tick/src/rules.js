// The closed set of actions a resident can take, and the checks that every
// action from the model must pass before the tick writes anything.

export const ACTIONS = ['move', 'talk', 'work', 'rest', 'react'];
export const EMOTES = ['happy', 'laugh', 'surprised', 'thinking', 'love', 'sad', 'angry', 'shrug', 'sleepy'];
export const MOODS = ['cheerful', 'content', 'curious', 'excited', 'anxious', 'grumpy', 'suspicious', 'sad', 'sleepy'];

export const MAX_LINE = 90;
export const MAX_CONVERSATIONS = 3;

/** Removes control characters and quote marks the prompt uses, collapses spaces, and cuts the length. */
export function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  const text = value
    // eslint-disable-next-line no-control-regex -- removing control characters is the point
    .replace(/[\u0000-\u001f\u007f«»]/g, ' ')
    .replace(/\s*[\u2013\u2014]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  // Cut at a word boundary, so a long line never ends mid-word.
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max / 2)).trimEnd()}…`;
}

export function isNight(minuteOfDay) {
  return minuteOfDay >= 22 * 60 || minuteOfDay < 6 * 60;
}

/** The action a resident takes when the model gives no valid one. */
function fallback(resident, minuteOfDay) {
  if (isNight(minuteOfDay)) return goOrStay(resident, resident.home, 'rest');
  return goOrStay(resident, resident.workplace, 'work');
}

function goOrStay(resident, place, activity) {
  return resident.place === place ? { type: activity } : { type: 'move', place };
}

/**
 * Turns the model's raw plan into one valid action per resident.
 * Anything outside the action set, the map, or the town's rules is replaced,
 * and the reason is kept for the tick log.
 */
export function validatePlan(rawActions, { residents, places, minuteOfDay }) {
  const byId = new Map(residents.map((r) => [r.$id, r]));
  const placeIds = new Set(places.map((p) => p.$id));
  const planned = new Map();
  const rejected = [];

  for (const raw of Array.isArray(rawActions) ? rawActions : []) {
    const resident = byId.get(raw?.resident);
    if (!resident || planned.has(resident.$id)) {
      rejected.push({ resident: raw?.resident, reason: 'unknown or duplicate resident' });
      continue;
    }
    let action;
    switch (raw.action) {
      case 'move':
        action = placeIds.has(raw.place) && raw.place !== resident.place
          ? { type: 'move', place: raw.place }
          : null;
        break;
      case 'talk':
        action = byId.has(raw.with) && raw.with !== resident.$id ? { type: 'talk', with: raw.with } : null;
        break;
      case 'work':
        action = goOrStay(resident, resident.workplace, 'work');
        break;
      case 'rest':
        action = goOrStay(resident, resident.home, 'rest');
        break;
      case 'react':
        action = { type: 'react', emote: EMOTES.includes(raw.emote) ? raw.emote : 'shrug' };
        break;
      default:
        action = null;
    }
    if (!action) {
      rejected.push({ resident: resident.$id, reason: `invalid ${String(raw.action).slice(0, 20)}` });
      action = fallback(resident, minuteOfDay);
    }
    action.line = cleanText(raw.line, MAX_LINE);
    action.mood = MOODS.includes(raw.mood) ? raw.mood : resident.mood;
    action.emote = action.emote ?? (EMOTES.includes(raw.emote) ? raw.emote : null);
    planned.set(resident.$id, action);
  }

  for (const resident of residents) {
    if (!planned.has(resident.$id)) {
      planned.set(resident.$id, { ...fallback(resident, minuteOfDay), line: '', mood: resident.mood, emote: null });
    }
  }

  return { planned, rejected };
}

/**
 * Pairs residents who talk. Both must stand at the same place and neither may
 * be walking away this tick. A resident who wants to talk to someone elsewhere
 * walks to that person's place instead.
 */
export function pairConversations(planned, residents) {
  const byId = new Map(residents.map((r) => [r.$id, r]));
  const busy = new Set();
  const conversations = [];

  for (const [id, action] of planned) {
    if (action.type !== 'talk' || busy.has(id)) continue;
    const self = byId.get(id);
    const other = byId.get(action.with);
    const otherAction = planned.get(other.$id);
    const sameplace = other.place === self.place && otherAction.type !== 'move';

    if (sameplace && !busy.has(other.$id) && conversations.length < MAX_CONVERSATIONS) {
      conversations.push({ place: self.place, residents: [id, other.$id] });
      busy.add(id).add(other.$id);
      planned.set(other.$id, { ...otherAction, type: 'talk', with: id });
      continue;
    }
    const destination = otherAction.type === 'move' ? otherAction.place : other.place;
    planned.set(id, destination !== self.place
      ? { ...action, type: 'move', place: destination, with: undefined }
      : { ...action, type: 'react', emote: action.emote ?? 'shrug', with: undefined });
  }

  return conversations;
}

/**
 * Checks the model's conversations. A rumor only passes on when the speaker
 * knows it and the listener is the other person in the conversation.
 */
export function validateConversations(raw, conversations, rumorsByResident) {
  const results = [];
  const rejected = [];
  const knows = (id, rumorId) => (rumorsByResident.get(id) ?? []).some((r) => r.rumorId === rumorId);
  const heardThisTick = new Set();

  conversations.forEach((conversation, index) => {
    const out = (Array.isArray(raw) ? raw : []).find((c) => c?.id === `c${index}`) ?? {};
    const members = new Set(conversation.residents);
    const lines = (out.lines ?? [])
      .filter((line) => members.has(line.speaker))
      .map((line) => ({ speaker: line.speaker, text: cleanText(line.text, MAX_LINE) }))
      .filter((line) => line.text)
      .slice(0, 4);

    const shared = [];
    for (const share of out.shared ?? []) {
      const ok = members.has(share.speaker) && members.has(share.listener) && share.speaker !== share.listener
        && knows(share.speaker, share.rumorId) && !knows(share.listener, share.rumorId)
        && !heardThisTick.has(`${share.listener}:${share.rumorId}`);
      if (!ok) {
        rejected.push({ conversation: index, reason: `rumor ${String(share.rumorId).slice(0, 36)} cannot pass from ${share.speaker} to ${share.listener}` });
        continue;
      }
      heardThisTick.add(`${share.listener}:${share.rumorId}`);
      shared.push({ ...share, retelling: cleanText(share.retelling, 160) });
    }

    const memories = (out.memories ?? [])
      .filter((m) => members.has(m.resident))
      .map((m) => ({ resident: m.resident, text: cleanText(m.text, 200) }))
      .filter((m) => m.text)
      .slice(0, 2);

    const feelings = (out.feelings ?? [])
      .filter((f) => members.has(f.resident) && members.has(f.toward) && f.resident !== f.toward)
      .map((f) => ({ ...f, delta: Math.max(-10, Math.min(10, Math.round(Number(f.delta) || 0))) }));

    results.push({ ...conversation, lines, shared, memories, feelings });
  });

  return { results, rejected };
}
