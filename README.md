# 🚂 Freight

**How long can _you_ build your train?!**

Freight is a kitschy little mobile web game. A freight train lumbers past your rail yard,
and it's your job to load it. Crates of coffee, wheat, onions, wood and more wait above and
below the track. Drag them onto the empty cars before the cars leave the yard.

The dispatcher keeps adding rules ("Onions can't ride next to Wood"), some cars roll in
already loaded, and the train only gets faster. Miss a car or break a rule and you lose a
heart. Three strikes and the train is gone.

At the end you get your stats: train length, crates moved, time survived, top speed.
Every route is logged in the **Route Ledger**, grouped by week, and after every five games
you get a **Weekly Dispatch** comparing this week's combined train to last week's.

## Play

Open `public/index.html` in a browser, or serve the folder:

```sh
npx serve public
```

Best on a phone in portrait. Works with mouse on desktop too.

## Deploy to Netlify

The site is static with no build step. `netlify.toml` publishes the `public/` folder.

- **Git**: connect this repo in Netlify. The build settings are picked up from `netlify.toml`.
- **CLI**: `npx netlify-cli deploy --prod --dir=public`
- **Drag and drop**: drop the `public/` folder onto https://app.netlify.com/drop

The build command in `netlify.toml` stamps Netlify's `$URL` into the absolute
`og:image`, `og:url`, `twitter:image` and canonical tags, so link previews work on
whatever domain the site ends up on.

## Layout

```
public/
  index.html            all screens (title, game, game over, weekly dispatch, ledger) + meta/OG tags
  style.css             kitschy rail-yard styling
  game.js               game loop, drag & drop, rules, ledger storage
  fonts/                Alfa Slab One + Nunito, vendored so there's no third-party request
  manifest.webmanifest  add-to-home-screen support
  og.png                1200×630 social preview
  favicon.ico, icon-*.png, apple-touch-icon.png, icon.svg
tools/
  gen-assets.mjs        regenerates og.png, favicon.ico and the icon PNGs with Playwright
netlify.toml
```

To regenerate the social image and icons after a design change:

```sh
npm i -D playwright   # or use a global install
node tools/gen-assets.mjs
```

Stats live in `localStorage` on the device under the key `freight.ledger.v1`.
