# Murmur: a living AI town on Appwrite

Murmur is a tiny 3D town with ten AI residents. Each resident has a name, a job, a home, memories, and
feelings about the others. Every minute the town moves forward 30 minutes of town time: residents walk
to work, meet, talk, and pass rumors on. Visitors watch the same town live, click a resident, and
whisper something. Then they watch the rumor travel from resident to resident.

- **Appwrite Functions:** `tick` runs every minute on a cron schedule and moves the world forward.
  `whisper` runs when a visitor creates a whisper row.
- **TablesDB:** the world, the residents, memories, relationships, rumors, and the town crier feed. A
  tick writes all of its changes in one transaction.
- **Realtime:** every browser receives every change, so all visitors see the same town.
- **Appwrite Sites:** hosts the game.

The residents think with GPT-6 Luna through [OpenRouter](https://openrouter.ai).

## How it works

1. The `tick` function reads the town and asks the model for one action per resident. The action
   comes from a closed set: `move`, `talk`, `work`, `rest`, or `react`.
2. Code checks every action against the set and the map (`functions/tick/src/rules.js`). Anything
   invalid is replaced with the resident's normal routine. The model never writes to the database.
3. Residents who stand at the same place talk. A second model call writes the conversation and says
   which rumors a speaker passes on. A rumor passes only from a resident who knows it.
4. The tick stages every change and commits it in one TablesDB transaction. The first operation creates
   the row `tick-<n>` in `ticks`, so an overlapping run that computes the same tick fails with
   `transaction_conflict` and writes nothing. A run that fails before the commit writes nothing.
5. A visitor gets an anonymous session and can only create whisper rows. The `whisper` function
   identifies the visitor from the `x-appwrite-user-id` header, allows three whispers per visitor every
   ten minutes (one row with a fixed ID per slot), and stores the whisper as a memory and a rumor.
6. The game subscribes to the town tables with Realtime and walks each resident along the path network
   between ticks. It never starts a function execution on its own.

## Layout

- `apps/web`: the game (Vite, React, react-three-fiber, drei). `src/scene` is the 3D world, `src/hud`
  the game interface, `src/lib/appwrite.ts` all Appwrite calls.
- `functions/tick/src`: `main.js` (one tick), `town.js` (reads the town), `prompts.js` (prompts and
  schemas), `rules.js` (the action set and every check), `commit.js` (the transaction).
- `functions/tick/test`: unit tests for the rules (`pnpm test`).
- `functions/whisper/src/main.js`: rate limit, reply, and the whisper transaction.
- `scripts/schema.ts`: the database, the tables, and both functions in one place.
- `scripts/provision.ts`, `scripts/seed.ts`, `scripts/town.ts`, `scripts/town.json` (places and residents).

## Setup

You need Node.js 22 or later, pnpm, an Appwrite project, and an OpenRouter API key.

1. Install the dependencies:

   ```bash
   pnpm install
   ```

2. In the Appwrite Console, add a Web app with the hostname `localhost`. Then create an API key with
   these scopes: `databases.read`, `databases.write`, `tables.read`, `tables.write`, `columns.read`,
   `columns.write`, `indexes.read`, `indexes.write`, `rows.read`, `rows.write`, `functions.read`,
   `functions.write`, `executions.write`, `sites.read`, `sites.write`, `rules.read`, `rules.write`,
   `platforms.read`, and `platforms.write`. Only the scripts use it.
3. Copy `.env.example` to `.env` and fill in the endpoint, the project ID, the API key, and the
   OpenRouter API key.
4. Create everything, deploy the functions and the Site, and add the residents:

   ```bash
   pnpm run provision
   pnpm run seed
   ```

5. Start the town and open the Site URL that `pnpm run provision` printed:

   ```bash
   pnpm run town start
   ```

The town starts paused, and a paused town makes no model calls. Use these commands to control it:

```bash
pnpm run town start    # schedule the tick function every minute
pnpm run town stop     # disable both functions and remove the schedule
pnpm run town step     # run one tick now
pnpm run town status   # show the clock and the function state
```

`pnpm run seed` resets the town to the morning of day 1.

To work on the game locally, copy `apps/web/.env.example` to `apps/web/.env` and run `pnpm dev`. The
game runs at `http://localhost:4314`.

## Controls

Drag to pan, scroll to zoom, and press `Q` or `E` to rotate the view. `W`, `A`, `S`, `D` or the arrow
keys also pan. Click a resident to open their card, then select **Whisper**.

## Credits

- 3D models: [Kenney](https://kenney.nl) Fantasy Town Kit, Nature Kit, and Mini Characters, all
  released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The license files are in
  `apps/web/public/models`. The roof colors are recolored copies of the Fantasy Town Kit texture.
- Fonts: [Fredoka](https://fonts.google.com/specimen/Fredoka) and
  [Nunito](https://fonts.google.com/specimen/Nunito), both under the SIL Open Font License 1.1, through
  Fontsource.

## License

MIT, see `LICENSE`. The models and fonts keep their own licenses listed above.
