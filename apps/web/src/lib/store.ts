import { create } from 'zustand';
import type { Place, Resident, Rumor, TownEvent, Whisper, World } from './types';

export const TICK_SECONDS = 60;
export const TICK_MINUTES = 30;

type TownState = {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  visitorId: string | null;
  world: World | null;
  /** performance.now() when the current tick arrived. Drives the clock between ticks. */
  tickArrivedAt: number;
  places: Record<string, Place>;
  residents: Record<string, Resident>;
  events: TownEvent[];
  rumors: Record<string, Rumor>;
  whispers: Record<string, Whisper>;
  selectedId: string | null;
  hoveredId: string | null;
  whisperOpen: boolean;
  /** A rumor whose path is highlighted in the feed. */
  focusedRumor: string | null;
};

export const useTown = create<TownState>(() => ({
  status: 'loading',
  error: null,
  visitorId: null,
  world: null,
  tickArrivedAt: 0,
  places: {},
  residents: {},
  events: [],
  rumors: {},
  whispers: {},
  selectedId: null,
  hoveredId: null,
  whisperOpen: false,
  focusedRumor: null,
}));

const byId = <T extends { $id: string }>(list: T[]) => Object.fromEntries(list.map((row) => [row.$id, row]));

export const townActions = {
  loaded(data: { world: World; places: Place[]; residents: Resident[]; events: TownEvent[]; rumors: Rumor[] }, visitorId: string) {
    // On first load, place the clock where it is in the current tick.
    const age = data.world.lastTickAt ? (Date.now() - new Date(data.world.lastTickAt).getTime()) / 1000 : TICK_SECONDS;
    const current = useTown.getState();
    // If Realtime already delivered this tick, keep the moment it arrived.
    const arrived = current.world && current.world.tick >= data.world.tick ? current.tickArrivedAt : null;
    useTown.setState({
      status: 'ready',
      visitorId,
      world: current.world && current.world.tick > data.world.tick ? current.world : data.world,
      tickArrivedAt: arrived ?? performance.now() - Math.min(Math.max(age, 0), TICK_SECONDS) * 1000,
      places: byId(data.places),
      residents: { ...byId(data.residents), ...current.residents },
      events: data.events,
      rumors: byId(data.rumors),
    });
  },
  failed(error: string) {
    useTown.setState({ status: 'error', error });
  },
  world(world: World) {
    useTown.setState((s) => (s.world && world.tick === s.world.tick ? { world } : { world, tickArrivedAt: performance.now() }));
  },
  resident(resident: Resident) {
    useTown.setState((s) => ({ residents: { ...s.residents, [resident.$id]: resident } }));
  },
  event(event: TownEvent) {
    useTown.setState((s) => (s.events.some((e) => e.$id === event.$id) ? s : { events: [event, ...s.events].slice(0, 80) }));
  },
  rumor(rumor: Rumor) {
    useTown.setState((s) => ({ rumors: { ...s.rumors, [rumor.$id]: rumor } }));
  },
  whisper(whisper: Whisper) {
    useTown.setState((s) => ({ whispers: { ...s.whispers, [whisper.$id]: whisper } }));
  },
  select(id: string | null) {
    useTown.setState({ selectedId: id, whisperOpen: false });
  },
  hover(id: string | null) {
    useTown.setState({ hoveredId: id });
  },
  openWhisper(open: boolean) {
    useTown.setState({ whisperOpen: open });
  },
  focusRumor(id: string | null) {
    useTown.setState({ focusedRumor: id });
  },
};

/** Minute of day shown on screen, moving smoothly between ticks. */
export function displayMinute(world: World | null, tickArrivedAt: number, now = performance.now()) {
  if (!world) return 7 * 60;
  const progress = Math.min(Math.max((now - tickArrivedAt) / (TICK_SECONDS * 1000), 0), 1);
  return (world.minuteOfDay + progress * TICK_MINUTES) % 1440;
}
