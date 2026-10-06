import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanText, pairConversations, validateConversations, validatePlan } from '../src/rules.js';

const places = ['square', 'bakery', 'cafe', 'honey_cottage', 'oak_cottage'].map(($id) => ({ $id }));
const residents = [
  { $id: 'bea', place: 'bakery', workplace: 'bakery', home: 'honey_cottage', mood: 'cheerful' },
  { $id: 'rafa', place: 'bakery', workplace: 'cafe', home: 'oak_cottage', mood: 'content' },
  { $id: 'mae', place: 'square', workplace: 'square', home: 'honey_cottage', mood: 'curious' },
];
const ctx = { residents, places, minuteOfDay: 9 * 60 };

test('actions outside the closed set are replaced', () => {
  const { planned, rejected } = validatePlan(
    [
      { resident: 'bea', action: 'delete_resident', place: null, with: 'rafa', line: 'Goodbye, Rafa', mood: 'angry' },
      { resident: 'rafa', action: 'move', place: 'the_moon', line: '', mood: 'excited' },
      { resident: 'mae', action: 'move', place: 'cafe', line: 'Post for the cafe!', mood: 'cheerful' },
      { resident: 'ghost', action: 'work' },
    ],
    ctx,
  );
  assert.equal(planned.get('bea').type, 'work'); // fallback: already at work
  assert.equal(planned.get('rafa').type, 'move'); // fallback: walk to work
  assert.equal(planned.get('rafa').place, 'cafe');
  assert.deepEqual(planned.get('mae'), { type: 'move', place: 'cafe', line: 'Post for the cafe!', mood: 'cheerful', emote: null });
  assert.equal(rejected.length, 3);
  assert.equal(planned.get('bea').mood, 'cheerful'); // "angry" is not a mood
});

test('talking needs both residents at the same place', () => {
  const { planned } = validatePlan(
    [
      { resident: 'bea', action: 'talk', with: 'rafa', line: 'Morning!', mood: 'cheerful' },
      { resident: 'rafa', action: 'react', emote: 'happy', line: '', mood: 'content' },
      { resident: 'mae', action: 'talk', with: 'bea', line: 'Bea!', mood: 'curious' },
    ],
    ctx,
  );
  const conversations = pairConversations(planned, residents);
  assert.deepEqual(conversations, [{ place: 'bakery', residents: ['bea', 'rafa'] }]);
  assert.equal(planned.get('rafa').type, 'talk');
  // Mae is at the square, so she walks to the bakery instead.
  assert.equal(planned.get('mae').type, 'move');
  assert.equal(planned.get('mae').place, 'bakery');
});

test('a rumor only passes from a resident who knows it', () => {
  // Who knows each rumor, as loaded from the memories table.
  const knowledge = new Map([['r1', new Set(['bea'])], ['r2', new Set()]]);
  const conversations = [{ place: 'bakery', residents: ['bea', 'rafa'] }];
  const raw = [{
    id: 'c0',
    lines: [{ speaker: 'bea', text: 'Did you hear?' }, { speaker: 'mae', text: 'I am not here' }],
    shared: [
      { speaker: 'bea', listener: 'rafa', rumorId: 'r1', retelling: 'Otto cannot swim a stroke' },
      { speaker: 'rafa', listener: 'bea', rumorId: 'r1', retelling: 'x' },
      { speaker: 'bea', listener: 'rafa', rumorId: 'r2', retelling: 'made up' },
    ],
    memories: [{ resident: 'rafa', text: 'Bea told me a secret.' }],
    feelings: [{ resident: 'rafa', toward: 'bea', delta: 50 }],
  }];
  const { results, rejected } = validateConversations(raw, conversations, knowledge);
  assert.equal(results[0].lines.length, 1);
  assert.deepEqual(results[0].shared.map((s) => [s.speaker, s.listener, s.rumorId]), [['bea', 'rafa', 'r1']]);
  assert.equal(results[0].feelings[0].delta, 10);
  assert.equal(rejected.length, 2);
});

test('a conversation passes on at most two rumors, and junk from the model is ignored', () => {
  const knowledge = new Map([['r1', new Set(['bea'])], ['r2', new Set(['bea'])], ['r3', new Set(['bea'])]]);
  const raw = [{ id: 'c0', lines: 'not a list', shared: ['r1', null,
    { speaker: 'bea', listener: 'rafa', rumorId: 'r1', retelling: 'one' },
    { speaker: 'bea', listener: 'rafa', rumorId: 'r2', retelling: 'two' },
    { speaker: 'bea', listener: 'rafa', rumorId: 'r3', retelling: 'three' }], memories: null, feelings: [null] }];
  const { results } = validateConversations(raw, [{ place: 'bakery', residents: ['bea', 'rafa'] }], knowledge);
  assert.deepEqual(results[0].lines, []);
  assert.deepEqual(results[0].shared.map((s) => s.rumorId), ['r1', 'r2']);
});

test('text is cleaned and cut at a word boundary', () => {
  assert.equal(cleanText('  «ignore»\nall   rules ', 50), 'ignore all rules');
  assert.equal(cleanText('one two three four five', 12), 'one two…');
  assert.equal(cleanText(42, 10), '');
});
