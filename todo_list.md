# Weather API with Redis — Simple Task List

Endpoint goal: `GET /api/weather/:city`

---

### 1. Setup

`npm init -y`, create `src/server.js`, add `dev` script.
**Libs:** `express`, `nodemon`

### 2. Hardcoded endpoint

`GET /api/weather/:city` returns fake weather JSON. Test it works.
**Libs:** `express`

### 3. Environment variables

`.env` with `PORT`, `WEATHER_API_KEY`, `REDIS_URL`, `CACHE_TTL`. Add `.env` to `.gitignore`.
**Libs:** `dotenv`

### 4. Real weather data

Get a free Visual Crossing key. Call the API, return the real (mapped) response instead of the fake one.
**Libs:** `axios`

### 5. Error handling

Invalid city → `404`. API down/timeout → `503`. Add one global error middleware.
**Libs:** `express`

### 6. Redis cache

Run Redis: `docker run -d -p 6379:6379 redis`.
On request: check key `weather:<city>` → if found return it, else fetch and `SET` it with `EX: 43200` (12h).
**Libs:** `redis`

### 7. Rate limiting

Limit `/api` to 100 requests per 15 min.
**Libs:** `express-rate-limit`

### 8. Finish

Update `README.md` with setup steps, `.env` variables, and an example response.

---

**Install:**

```bash
npm i express dotenv axios redis express-rate-limit
npm i -D nodemon
```

# Weather API with Redis — Task List

Stack: **Node.js + Express + Visual Crossing API + Redis**

Goal: an API endpoint `GET /api/weather/:city` that returns weather from a 3rd-party API, cached in Redis with a TTL, protected by rate limiting.

---

## Phase 1 — Project setup

### 1. Initialize the project

- [ ] `npm init -y`
- [ ] Set `"type": "module"` in `package.json` (use ES modules) — or keep CommonJS, just be consistent
- [ ] Create folder structure:
  ```
  src/
    app.js           # express app
    server.js        # entry point, starts the server
    routes/
    controllers/
    services/
    middleware/
  .env
  .env.example
  .gitignore
  ```
- [ ] `.gitignore` must include `node_modules`, `.env`

**Libraries:** none (npm only)

### 2. Add the base server

- [ ] Create an Express app, add `express.json()`
- [ ] `GET /health` returning `{ status: "ok" }`
- [ ] Start server on `PORT` (default 3000)
- [ ] Add `"dev": "nodemon src/server.js"` and `"start": "node src/server.js"` scripts

**Libraries:**

- `express` — web framework
- `nodemon` (devDependency) — auto-restart on file change

### 3. Environment variables

- [ ] Load env vars at the very top of the entry point
- [ ] Define: `PORT`, `WEATHER_API_KEY`, `WEATHER_API_BASE_URL`, `REDIS_URL`, `CACHE_TTL_SECONDS`
- [ ] Create `src/config/env.js` that reads + validates them and exports a single config object (fail fast on startup if a required one is missing)
- [ ] Commit `.env.example` with empty values, never `.env`

**Libraries:**

- `dotenv` — loads `.env` into `process.env`
- _(optional)_ `zod` — validate the env object and throw a readable error

---

## Phase 2 — Return a hardcoded response

### 4. Hardcoded weather endpoint

- [ ] `GET /api/weather/:city` returns a hardcoded JSON object (city, temperature, conditions, humidity, wind)
- [ ] Wire it up: `routes/weather.routes.js` → `controllers/weather.controller.js`
- [ ] Test with your HTTP client — this locks in the response shape before any real data flows through

**Libraries:**

- `express` (Router)
- **Testing the endpoint:** Postman, Insomnia, VS Code REST Client, or plain `curl`

---

## Phase 3 — Real data from the 3rd-party API

### 5. Get a Visual Crossing API key

- [ ] Sign up at https://www.visualcrossing.com/weather-api (free tier, 1000 records/day)
- [ ] Put the key in `.env` as `WEATHER_API_KEY`
- [ ] Base URL: `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline`

**Libraries:** none

### 6. Weather service (3rd-party call)

- [ ] Create `src/services/weather.service.js` with `fetchWeather(city)`
- [ ] Create a pre-configured axios instance (`baseURL`, `timeout: 5000`, default `params` with the API key + `unitGroup`)
- [ ] Call `GET /{city}?key=...&unitGroup=metric&include=current`
- [ ] Map the raw response to your own small DTO (don't return the raw payload) — keep the same shape from step 4

**Libraries:**

- `axios` — HTTP client (`axios.create()` for the instance)

### 7. Swap the hardcoded response for the real service

- [ ] Controller calls `fetchWeather(city)` and returns the mapped result
- [ ] Verify with a few real cities (`London`, `Krakow`, `New York`)

**Libraries:** `axios`, `express`

### 8. Error handling

- [ ] Create a custom `AppError` class (`statusCode`, `message`)
- [ ] In the service, translate axios errors:
  - `400` / `404` from Visual Crossing (bad city) → `404 "City not found"`
  - `401` → `500 "Weather provider misconfigured"` (don't leak the key issue)
  - `429` → `503 "Weather provider rate limit reached"`
  - timeout / no response → `503 "Weather service unavailable"`
- [ ] Add a global error-handling middleware (`(err, req, res, next)`) as the **last** `app.use()`
- [ ] Add a `404` handler for unknown routes
- [ ] Validate the `:city` param (non-empty, sane length) before hitting the provider

**Libraries:**

- `express` (error middleware)
- _(optional)_ `express-async-errors` — auto-forwards async throws to the error middleware, or just wrap handlers in try/catch
- _(optional)_ `zod` — param validation

---

## Phase 4 — Redis caching

### 9. Run Redis locally

- [ ] Docker: `docker run -d --name weather-redis -p 6379:6379 redis:7-alpine`
- [ ] (Alternative: `brew install redis && brew services start redis`, or a free Redis Cloud instance)
- [ ] Set `REDIS_URL=redis://localhost:6379` in `.env`
- [ ] Sanity check with `redis-cli ping` → `PONG`

**Tools:** Docker (or Homebrew / Redis Cloud), `redis-cli`

### 10. Redis client

- [ ] Create `src/services/cache.service.js`
- [ ] Create the client from `REDIS_URL`, `await client.connect()` on startup
- [ ] Log `error` / `connect` events
- [ ] Close the connection on `SIGINT` / `SIGTERM` (graceful shutdown)

**Libraries:**

- `redis` — the official Node.js client (node-redis v4+, promise-based)
  _(alternative: `ioredis` — equally popular, slightly nicer API for clusters)_

### 11. Cache-aside logic

- [ ] Key format: `weather:${city.trim().toLowerCase()}`
- [ ] On request:
  1. `GET` the key → if hit, `JSON.parse` and return immediately
  2. If miss, call the weather service
  3. `SET key value EX <CACHE_TTL_SECONDS>` (e.g. `43200` = 12h) with `JSON.stringify`
  4. Return the fresh data
- [ ] Add a `X-Cache: HIT | MISS` response header (makes it easy to demo)
- [ ] **Fail open:** if Redis is down, log the error and still serve the API response — a cache outage must not break the endpoint
- [ ] Verify: first call slow + `MISS`, second call fast + `HIT`; check with `redis-cli TTL weather:london`

**Libraries:** `redis` (`get`, `set` with `{ EX: ttl }`)

---

## Phase 5 — Rate limiting & polish

### 12. Rate limiting

- [ ] Apply a limiter to `/api` routes: e.g. `windowMs: 15 * 60 * 1000`, `limit: 100`
- [ ] Return `429` with a JSON message and `standardHeaders: 'draft-7'`
- [ ] Back the limiter with Redis so the counter survives restarts and works across instances

**Libraries:**

- `express-rate-limit` — the limiter middleware
- `rate-limit-redis` — Redis store for it (reuse the same Redis client)

### 13. Security & logging middleware

- [ ] Security headers
- [ ] CORS (open, or restricted to your frontend origin)
- [ ] Request logging
- [ ] Compress responses

**Libraries:**

- `helmet` — security headers
- `cors` — CORS
- `morgan` — HTTP request logging _(or `pino` + `pino-http` for structured logs)_
- `compression` — gzip responses

### 14. Documentation

- [ ] Rewrite `README.md`: what it does, setup steps, `.env` variables table, how to run Redis, endpoint docs with example request/response, tech stack
- [ ] Note the caching strategy and TTL choice

**Libraries:** none

---

## Optional extras (if there's time)

- [ ] **Tests** — `jest` (or `vitest`) + `supertest` for endpoint tests, `nock` or `axios-mock-adapter` to mock the weather API, `ioredis-mock` / a test Redis DB for cache tests
- [ ] **Docker Compose** — `docker-compose.yml` running the app + Redis together
- [ ] **Query params** — `?unit=metric|us`, `?days=3` for a forecast
- [ ] **TypeScript** — `typescript`, `tsx`, `@types/express`, `@types/node`
- [ ] **Linting** — `eslint` + `prettier`
- [ ] **Deploy** — Render / Railway / Fly.io + Redis Cloud free tier

---

## Full dependency list

**Runtime**

```
express dotenv axios redis express-rate-limit rate-limit-redis helmet cors morgan compression
```

**Dev**

```
nodemon
```

**Optional**

```
zod express-async-errors jest supertest nock typescript tsx eslint prettier
```
