# Site profiles

The external gallery browser is site-agnostic. Everything that identifies a
concrete site lives in a *profile* module implementing `SiteProfile` from
[types.ts](types.ts).

| Path | Committed | Purpose |
| --- | --- | --- |
| `types.ts` | yes | The contract every profile implements |
| `example/` | yes | Sample profile for a fictional site; used by tests, CI and as a fallback |
| `private/` | **no** (git-ignored) | The real profile for the site you browse |

## Writing a private profile

1. Create `src/shared/sites/private/index.ts`.
2. Export `siteProfile: SiteProfile`. Start by copying `example/index.ts`.
3. Keep the module pure: no Node or Electron imports. The same code runs in the
   main process (allow-list, rate limit) and in the renderer (URL building and
   parsing with `DOMParser`).
4. Normalise tags: artists must get `namespace: 'artist'`, languages
   `'language'`, everything else `'other'`.
5. Put any real HTML you want to test against under `tests/fixtures/private/`
   (also git-ignored) and keep those tests out of the committed suite.

Both processes fall back to `example/` when `private/` is absent, so a fresh
checkout always builds and the UI shows that the sample profile is active.

## Pointing a development build at a local server

Fetching is https-only and restricted to the profile's `allowedHosts`. For
local fixtures (and the e2e suite) two environment variables relax this in
unpackaged builds only:

- `EXTERNAL_GALLERY_ALLOW_INSECURE=1` admits plain http and loopback literals
- `EXTERNAL_GALLERY_EXTRA_HOSTS=127.0.0.1:4100,localhost:4100` adds hosts to
  the allow list (ignored unless the first variable is set)

## Keeping the site out of the repository

- `.gitignore` excludes `src/shared/sites/private/`, `tests/fixtures/private/`
  and `.private-terms`.
- `npm run hooks:install` installs local git hooks that reject a commit when any
  staged line, file name or commit message contains a term listed in
  `.private-terms` (one per line, matched case-insensitively). See
  `.private-terms.example`.
- Use neutral names in committed code. Category labels, tag vocabulary and URL
  shapes belong in the profile, not in the engine.
- The private profile has no history in this repository. Back it up manually.
