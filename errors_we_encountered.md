# 1. Vercel missing public directory

https://vercel.com/docs/errors/error-list#missing-public-directory

Fixed. Verified locally: npx tsc builds clean, npm start serves 200 on port 3000, and with VERCEL=1 set the process exits without opening a port (as it must on serverless).

What changed:

api/index.ts — new. Vercel auto-detects api/ as serverless functions; this re-exports your Express app as the handler.
vercel.json — rewrites sends every path to the function, and outputDirectory: "public" answers the error directly.
public/.gitkeep — empty static dir so the build has somewhere to point.
src/app.ts:12-17 — app.listen() now only runs when VERCEL is unset. Serverless invokes the app per request; binding a port there breaks the deploy.
tsconfig.json — rootDir: "." + api in include so both dirs compile. Output is now dist/src/app.js, so npm start was updated to match.
.gitignore — added dist/ and .vercel/.
Commit and push, and the build should get past that error.

One thing to decide before you go further, though: Vercel is a poor host for this particular project. Serverless functions are short-lived, so a TCP Redis connection (node-redis, step 6 of your list) gets re-opened on every cold start and free Redis tiers will hit connection limits. The cache still works, but you'll fight it.

Two ways out:

Stay on Vercel → use Upstash Redis, which is HTTP-based and built for serverless. Vercel has a first-party integration, and @upstash/redis swaps in for redis with minimal changes.
Switch to Render or Railway → free tier, runs npm start as a normal always-on server, and plain node-redis works exactly as your task list describes. Nothing above would be wasted; you'd just drop api/ and vercel.json.
I'd go with Render since the assignment is really about the caching layer. Want me to set either one up?

## The root cause

Vercel had no idea what your project was. It looks at a repo and tries to detect a framework (Next.js, Vite, etc.). It found none — just a package.json with a build script. So it fell back to its default assumption: "this must be a static website."

That assumption plays out in two steps:

Run npm run build → your script is tsc, which compiled TypeScript into dist/. This part succeeded.
Look for a folder of static files (HTML/CSS/JS) to serve to browsers. Vercel's default name for that folder is public/. It didn't exist → error.
The deeper problem is that the error message points at a missing folder, but the real mismatch is architectural: you don't have static files. You have a server — a program that runs continuously, listens on a port, and answers requests. Vercel doesn't run those. It runs serverless functions: code that sits dormant, wakes up when a request arrives, responds, and shuts down.

So the fix has two halves: tell Vercel "deploy this as a function, not a website", and make your app work in that model.

Step 1 — api/index.ts (the entry point)

import app from "../src/app";
export default app;
Vercel has a convention: any file in a folder named api/ becomes a serverless function. That's automatic, no configuration.

Vercel's Node runtime knows how to handle an Express app specifically — if you export default one, it wraps it and feeds each incoming request into it. So this three-line file is a shim: it does no work itself, it just presents your existing app at the location Vercel looks for.

Your real code stays in src/, untouched and portable. If you move hosts later, you delete this file and nothing else changes.

Step 2 — vercel.json (the routing rules)

{
"outputDirectory": "public",
"rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
rewrites is the important line. Without it, Vercel would only send requests for the literal path /api to your function — so /api/weather/london would 404. The rule reads: "take any path at all (/(.\*) is a regex matching everything) and hand it to the function."

That matters because Express has its own router. Your app already knows what to do with /, and will soon know /api/weather/:city. You want Vercel to stop trying to route and let Express do it.

outputDirectory answers the original error explicitly, rather than relying on the public default.

Step 3 — public/.gitkeep (satisfying the build)
Vercel still runs npm run build and still wants a static folder afterward. Your API has no static files, so I made an empty public/.

The .gitkeep file exists because Git cannot track empty directories — it only tracks files. Without a file inside, the folder would never reach GitHub and the error would return. .gitkeep isn't a special name or a Git feature; it's just a zero-byte placeholder by convention.

Step 4 — guarding app.listen()

if (!process.env.VERCEL) {
app.listen(PORT, () => { ... });
}
This is the conceptual heart of it. app.listen(3000) means "claim port 3000 and stay running forever." That is exactly right on your laptop and exactly wrong on serverless, where there is no port to claim and the process is expected to finish. Leaving it in causes hangs or timeouts.

Vercel automatically sets an environment variable named VERCEL on every deployment. So the check means: "if I'm not on Vercel, I'm on a real machine — open the port. If I am on Vercel, just export the app and let the platform call it."

One file, both environments. I verified both paths: locally it printed Server listening… and returned 200; with VERCEL=1 the process exited with code 0 instead of hanging, which is the proof no port was opened.

Step 5 — tsconfig.json and the start script
These are consequences of Step 1, not independent decisions.

Your tsconfig.json said "include": ["src"] — compile that folder only. The new api/ folder sat outside it, so TypeScript ignored it and wouldn't type-check it.

Adding api created a second problem. rootDir was "src", meaning "treat src/ as the base of my source tree." You can't have a base folder that some of your files live outside of, so tsc errored. Setting "rootDir": "." makes the project root the base, covering both folders.

That changed the output layout, because tsc mirrors your source structure into dist/:

before after
rootDir src/ .
src/app.ts → dist/app.js dist/src/app.js
Which is why start became node dist/src/app.js. Pointing at the old path would now fail with "module not found."

Step 6 — .gitignore
Added dist/ and .vercel/. dist/ is generated by tsc — committing build output means every rebuild shows up as noise in your diffs, and it goes stale against the source. .vercel/ is a local folder holding your project's link IDs, created if you use the Vercel CLI.

The rule of thumb: if a command regenerates it, don't commit it. Same reasoning as node_modules/.

The order it all happens in
You push to GitHub → Vercel starts a build
Vercel reads vercel.json
Runs npm install, then npm run build → tsc compiles to dist/
Finds public/ → satisfied, no error
Spots api/index.ts → compiles it into a serverless function
A request for /api/weather/london arrives → the rewrite sends it to that function
The function imports your app; VERCEL is set, so no port is opened
Express matches the route, responds, function goes dormant
Step 8 is where the Redis caveat I raised comes from — the function going dormant is also what makes a persistent Redis connection awkward.

# 2. commonjs vs modules

commonjs: const express = require("express"); module.exports = app;
ES modules: import express from "express"; export default app;

require() is a function call that runs at runtime. It blocks, reads the file, executes it, returns the exports.

import is not a function call. It's a declaration the engine reads before executing any of your code. Node parses the file, builds a graph of every import, loads them all, and only then runs anything.

# 3. Why do we import files like this: './app.js' and not like this: './app.ts'

Import path is not rewritten during compilation — it's copied through verbatim into the output, where it has to point at a file that actually exists at runtime.

TypeScript compiled weather.ts into weather.js, but it left your import string untouched. So the string must describe the compiled world, not the world you're editing in.

## Why doesn't tsc just fix the extension in transpilation step?

This is a deliberate, long-standing design decision, and it surprises everyone. The TypeScript team's position is that they emit JavaScript, they don't rewrite module specifiers — your import string is data they pass through. Rewriting paths would mean TypeScript has to model every possible output layout and bundler, which is a job it explicitly declines.

# 4. tsconfig.json had "module": "commonjs" instead of "nodenext"
