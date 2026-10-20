# Lab CS

The website for the Lab computer science team: tests and contests, a problem set with an online judge, a playground for dozens of languages, ACSL drills, slides, and a projector board. Admins run everything from the browser.

- **Tests** with interactive, auto-graded questions. Every student gets their own numbers, so copying answers doesn't work. Written answers can be graded by Claude against a rubric.
- **Live start**: everyone waits in the lobby and starts together. Pause, add time or end the test for everyone from the Monitor tab.
- **Integrity**: leaving the tab, switching apps, pasting, full screen exits and more are recorded and flagged for admins. Nothing is blocked in a normal browser; the Lab CS app and Safe Exam Browser lock the computer down for tests that need it.
- **Problems** judged in Python, Java, C++ and many more languages, with hidden tests.
- **Board** for the projector: a big timer for any test, a standalone timer, the join code with a QR code, slides and messages, controlled from a laptop or phone.

## Deploy on Vercel

1. Import this repository at [vercel.com/new](https://vercel.com/new). The defaults are right.
2. In the project, open **Storage** and add a **Neon** Postgres database. It sets `DATABASE_URL` for you.
3. Add `ANTHROPIC_API_KEY` under **Settings → Environment Variables** to turn on Claude grading, rubric drafts, problem drafts and integrity reviews. Optional, but recommended.
4. Redeploy. The database tables are created during the build.
5. Open the site. The first visit goes to `/setup`, where you create the owner account. Leave **Load starter content** on to get the problem set, the intro test, a practice round and slides.

Add members from **Manage → Members** (paste a list of names; usernames and passwords are generated and printable), or turn on sign-up and share the join code. The **Board** page can show the join code with a QR code.

### Environment variables

| Variable | What it does |
|---|---|
| `DATABASE_URL` | Postgres connection string. Set by the Neon integration. |
| `ANTHROPIC_API_KEY` | Turns on Claude features. Pick the model and effort in **Settings**. |
| `SETUP_TOKEN` | Optional. Requires this token on `/setup`, so nobody else can claim the site first. |
| `JUDGE0_URL`, `JUDGE0_KEY` | Optional. Your own Judge0 server. The public Judge0 CE API is used by default, with Wandbox as a backup. |
| `PISTON_URL` | Optional. A self-hosted Piston server instead of Judge0. |
| `BLOB_READ_WRITE_TOKEN` | Optional. Set by connecting Vercel Blob; allows PDF slides over 4 MB. |
| `DESKTOP_APP_SECRET` | Optional. A shared secret so only the real app can open lockdown tests. Set the same value as the `DESKTOP_APP_SECRET` repository secret before building the app. |
| `DESKTOP_RELEASE_REPO` | Optional. Where installers are downloaded from, as `owner/repo`. Defaults to this repository. |
| `DESKTOP_DOWNLOAD_BASE` | Optional. Serve installers from another host instead of GitHub releases. |
| `SITE_NAME`, `SITE_TIMEZONE` | Defaults before you change them in **Settings**. |

For a contest with many people submitting code at once, run your own Judge0 or Piston server and set its URL. The public servers are shared and can be slow.

## Running a test

1. Build the test under **Manage → Tests**. Questions can be multiple choice, short answer, numbers, ordering, matching, written answers (graded by Claude or by you), code problems, or any of the interactive puzzles.
2. On the **Edit** tab, choose **Everyone together** to start it live, set the time limit, and pick where it runs: a browser tab, the Lab CS app, or Safe Exam Browser.
3. On test day, put the **Board** on the projector and choose the test. Members open the test and wait in the lobby.
4. Press **Start** on the **Monitor** tab. Watch progress, time left and integrity flags live. Pause, add time, give one student extra time, or end it.
5. The **Results** tab shows scores, how far everyone got, and a strip of right and wrong answers per person. Select people and add them to a group, export a CSV, run **Check for copying**, and grade written answers.

The intro test (**Intro Logic Test**) is 30 minutes and 30 questions of logic puzzles that get harder as they go: quick multiple-choice riddles, two made-up languages (Tock, and Glyph with its one-page manual), a fake terminal with a door to break into, circuits, a robot, a code lock and more. It runs in a normal browser with full screen and the integrity checks on. Each student starts it whenever they like, at school or at home, and gets 30 minutes from their own start. Nobody is expected to finish; where people end up and how many they get right separates experience levels without saying so.

## The Lab CS app

Tests set to run in the app open in the Lab CS desktop app for Mac and Windows. Students press **Open in Lab CS app** on the test page; the app signs them in with a one-time link, fills the screen and locks down until they submit. It blocks screenshots and screen recording, keeps other windows out, and reports app switches, new displays, clipboard use from other apps, and chat, AI or remote-control apps that are running. Leaving early needs the exit code shown on the Monitor tab.

Students install it from the **Desktop app** page. The one-line install commands there avoid the security prompts unsigned apps normally get.

Installers are built by the **Desktop app** workflow in GitHub Actions. To release a new version, raise `version` in `desktop/package.json` and push to the default branch; the workflow builds Mac, Windows and Linux versions and publishes them as a release. Raise **Oldest version allowed** in **Settings** to make everyone update.

## Safe Exam Browser

Tests can also require [Safe Exam Browser](https://safeexambrowser.org). The site generates the configuration and opens it with a one-time link, so nothing has to be set up by hand. When SEB proves it is running that configuration, its requests are held to the configuration's key for the rest of the test. The quit password is the test's exit code.

## Privacy

The optional camera check runs entirely in the student's browser. No video or images leave the computer; only flags such as "no face in view" are saved. Students are told before it starts. Integrity flags are signals for a coach to look at, never automatic penalties.

## Development

```bash
npm install
npm run dev
```

With no `DATABASE_URL`, development uses an embedded Postgres (PGlite) in `.data/`. To use a local Postgres instead, put `DATABASE_URL` in `.env.local`.

```bash
npm run typecheck   # route types and TypeScript
npm test            # unit tests
npm run build       # production build
```

`scripts/qa/` has end-to-end scripts that drive a running site in Chromium. `npm run test:desktop` runs the real desktop app against the local site and checks the whole handoff and lockdown (wrap it in `xvfb-run -a` on Linux). Set `LABCS_APP_BIN` to test a packaged build instead.

Change the database schema in `src/lib/db/schema.ts`, then run `npm run db:generate`.
