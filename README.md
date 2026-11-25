# Podcast Route

Find podcasts by any subject, show or presenter, choose episodes by listening time, and keep a private listening queue. Use [Podcast Route](https://coolcode.ca/podcastroute/).

<!-- coolcode:guide -->
Search a subject or open an indexed RSS feed, then explore a show and filter its latest 100 indexed episodes by keywords, language at show level, and duration. Unknown durations are explicitly included or excluded. Follow shows, import/export subscriptions as OPML, and keep a queue with notes and listening positions automatically saved in this browser on your device; publisher audio and available chapter/transcript links remain on their original hosts.
<!-- /coolcode:guide -->

## Use it

1. Search a topic such as “Canadian history” or a specific podcast title. The language field filters loaded directory matches (for example `en`, `en-CA` or `fr`).
2. Open a show. Try a maximum duration of 30 minutes. Missing durations are kept only when the checkbox is selected. This filters the loaded episodes, not every episode ever published.
3. Queue episodes or listen directly. Audio needs HTTPS and is supplied by the publisher; availability, seeking and browser playback vary. The player restores the saved position after its metadata loads when the publisher supports seeking; the Resume control retries that position. Chapters and transcripts appear only when Podcast Index supplies publisher links.
4. Follow shows. Following is a directory reference, not a background subscription or automatic download. Opening a show requests current indexed episodes.
5. Follows, queue, notes and playback positions save automatically on this device. Look for **Saved on this device** above the search controls; refresh or reopen this same browser to restore them. Cookies and accounts are not needed. Turn off **Save this workspace automatically on this device** for a temporary tab; this removes the remembered copy and keeps that choice for future visits. Export a JSON backup before clearing browser data or changing devices. A shared 2 MB serialized-workspace budget keeps every exported backup importable; edits exceeding it are rolled back with a visible message. Importing a workspace replaces its queue, subscriptions, notes and positions. OPML adds resolved subscriptions and retains existing ones; import at most 50 feed URLs per file.

## Sources and coverage

[Podcast Index](https://podcastindex.org/) provides directory and episode metadata through a protected CoolCode gateway. No catalogue is bundled or presented as comprehensive. Directory matches and up to 100 recent indexed episodes are fetched on demand. Search matching and feed coverage depend on Podcast Index; older episodes may be available from the publisher. The visible checked time records gateway retrieval, not a publisher update. No scheduled collection, background syncing, audio download or automatic refresh is used.

Audio and images come from publisher hosts. Descriptions are rendered as plain text; executable publisher HTML is never injected. Saved queue items are a user-selected snapshot; open a show to request current metadata.

## API keys and configuration

**Do not put API keys in this repository, `web/`, GitHub Pages variables or public build artifacts.** The browser calls the public `api_base` in `web/config.json`, initially `https://coolcode-visitor-api.jeffdyer.workers.dev`. Its protected runtime needs Cloudflare Worker **secret** bindings `PODCASTINDEX_API_KEY` and `PODCASTINDEX_API_SECRET`. Add those to the shared Worker’s Settings → Variables and Secrets, then deploy the shared gateway prepared in the main CoolCode repository. Adding repository secrets alone does not activate this static app. A missing-key response is shown as an actionable service error; it is not replaced with invented results.

Contract, all read-only GET requests:

| Route under `/api/podcastroute/` | Input | Upstream data |
| --- | --- | --- |
| `search` | `q` | Podcast Index `search/byterm`, `feeds` |
| `episodes` | numeric `id` | `episodes/byfeedid`, `items`, max 100 and full descriptions |
| `feed` | public `url` | `podcasts/byfeedurl`, `feed` |

Success is `{ "fetched_at": "ISO timestamp", "data": { ...upstream JSON... } }`. Non-2xx failures use `{ "error": { "code": "...", "message": "..." } }`. The gateway must validate inputs, protect provider credentials, bound requests, cache provider responses appropriately and permit the CoolCode origin. The frontend never stores a credential.

## Privacy

Search queries, chosen feed IDs and imported RSS URLs are sent to the gateway and Podcast Index when requested. Loading cover art or playing audio contacts publisher hosts. Notes, playback positions, queue edits and workspace files stay in the browser; exporting uses a local download. Local persistence is enabled by default under `coolcode:podcastroute:workspace:v1`; the optional temporary-tab preference uses `coolcode:podcastroute:save-mode:v1`. Search terms and raw uploaded files are not saved. Other people using this browser profile can read a remembered workspace. Clear it using the app’s control. Private browsing, blocked/full browser storage, or clearing site data may prevent or remove persistence; the visible storage indicator reports failures instead of claiming a save. **Export workspace** keeps a portable backup. Nothing is synchronized to a server or another device.

Other tabs receive device updates when they have no unsaved edits. If another tab changes the saved copy while this tab has pending work, automatic saving pauses and displays recovery controls: export this tab, load the saved copy, or explicitly replace the saved copy. A malformed saved record is preserved until an explicit replacement or clear. The app also checks the saved baseline before a write, protecting against stale saves before a storage event arrives.

The shared CoolCode counter records aggregate tool opens independently of workspace contents.

## Expand or customize

Edit `web/config.json` to add arbitrary starter topics, for example append `"marine archaeology"` to `topics`. Visitors can search that subject immediately without a configuration change. `api_base` is the public gateway address, never a secret. `episode_limit` describes the backend’s 100-item limit and must stay synchronized with it; changing a frontend label cannot increase provider coverage. All filters/counts derive from returned records, not the starter topics.

Run the checks below and push to `main`. GitHub’s **Browser tool · Check and publish** workflow builds and publishes after checks pass. There is no collection refresh to run: a new search/show request fetches current directory metadata. After changing routes, sources, coverage or catalogue metadata, follow the [CoolCode lifecycle](https://github.com/jsdyer/jsdyer.github.io/blob/main/docs/tool-lifecycle.md), sync this guide and `tool.json`, and verify hub, Worker and watchdog registrations. Existing watchdog logic needs no app-specific schedule; its generated target must include this tool.

## Development and publication

```sh
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -v
python3 scripts/build.py
python3 -m http.server 8000 --directory dist
```

No application dependencies or network access are needed to build. `dist/` is generated and untracked. For browser tests, install `tests/browser-requirements.txt`, then run `CHROMIUM_PATH=/path/to/google-chrome python3 tests/browser_smoke.py`; CI uses Ubuntu 24.04’s installed Google Chrome. Fixtures exercise the real gateway response shape without consuming provider quota.

Set repository **Settings → Pages → Source → GitHub Actions**. A successful main run publishes the project path; no CNAME is needed. Deploying the frontend and configuring the protected gateway are separate steps. Live API readiness must be checked after the Worker and secret bindings are deployed.
