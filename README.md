NY Rangers First Goal Pool

Full-stack app to run a pool where participants pick the first goal scorer for every New York Rangers game.

Features
- Participants CRUD (add participants)
- Import Rangers season schedule from NHL API
- Snake draft order per game, with winner keeps first pick rule
- Prevent same-player picks in consecutive games
- Make picks per game, auto-compute results from NHL game feed
- Standings with points:
  - 3 points for correct first goal scorer
  - 1 point per goal for picked player otherwise (multi-goal games accumulate)

Getting Started

Prereqs
- Node 18+

Install
```bash
cd /workspace/app
npm install --prefix server
npm install --prefix frontend
```

Run (both server and client)
```bash
cd /workspace/app
npm run dev
```
- Server: http://localhost:3001
- Client: http://localhost:5173

Usage
1. Add participants on the Participants tab
2. Import season schedule on the Schedule tab (e.g., `20242025`)
3. On Picks tab, see upcoming game, draft order, and make picks
4. After a game, trigger compute for that game (temporary: call POST `/api/games/:gameId/compute` via curl or add a small admin button)
5. View standings on the Standings tab

Notes
- Database is a local SQLite file at `server/src/data.sqlite`
- The roster endpoint tries to read roster from the NHL live feed; if unavailable before puck drop, type a player id manually or pick after lineup is posted

Scripts
- `npm run dev` — run server and client concurrently
- `npm --prefix server run dev` — backend only
- `npm --prefix frontend run dev` — frontend only

Deployment (Render)
1. Commit this repo to GitHub
2. On Render, create Web Service from `server/` (Node 18). Start command: `node src/index.js`
3. On Render, create Static Site from `frontend/` with build command `npm install && npm run build` and publish directory `dist`
4. Set the Static Site env var `VITE_API_BASE` to the API’s external URL (Render provides `RENDER_EXTERNAL_URL`)
   - If using `render.yaml`, just connect the repo and “Blueprint” deploy; it wires `VITE_API_BASE` automatically
5. After deploy, visit the frontend URL

