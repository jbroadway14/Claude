# 🐝 Hive Log

A free, offline beehive record book that runs in your phone's browser and installs
to the home screen like an app. Built for **National** and **Langstroth** hives
and UK beekeeping (NBU notifiable diseases, VMD medicines record).

- **No subscription, no account, no server.** Hosted free on GitHub Pages.
- **Works with no signal** at the apiary once it has been opened once.
- **Glove-friendly**: big tap buttons and +/− steppers instead of typing.
- **Your data stays on your device** (IndexedDB), with JSON backup and CSV export.
- **Optional GitHub sync**: records upload to a *private* GitHub repo when you have signal.

## Features

| Area | What it does |
|---|---|
| Hives dashboard | Every hive grouped by apiary, with its queen colour, the last inspection summary and warning flags |
| Inspections | Quick form for queen and brood, colony, health and actions taken; an unsaved draft survives a phone lock or reload |
| Warnings | Inspection overdue, charged or capped queen cells, no eggs seen, high varroa, low stores, needs space, notifiable disease, treatment due out |
| Treatments | A medicines record that meets the UK VMD requirement, with a suggested finish date per product and a CSV export |
| Feeding & harvest | Syrup, fondant and pollen logs, plus honey weights per hive |
| Due list | Upcoming inspections and treatment removals; **Add to calendar** downloads a `.ics` file for your phone's calendar |
| Charts | Frames of bees and brood over time, plus a varroa history table |
| GitHub sync | Records are saved to a private repo of yours. Changes made offline are queued and upload automatically when signal returns. Every sync is a commit, so you get a full history |
| Backup file | Download a JSON backup, then import it on another device. Imports merge, and the newest edit wins |

## Recommended fields

### Apiary
| Field | Why |
|---|---|
| Name | e.g. Home, Allotment |
| Location | Postcode, grid reference or what3words. There's an "Open in Maps" link, and BeeBase / bee inspectors ask for it |
| Notes | Access, landowner contact, forage |

### Hive
| Field | Options / notes |
|---|---|
| Name / number | e.g. H1 (suggested automatically) |
| Apiary | Hives can be moved between apiaries |
| Hive type | National, National 14×12, Langstroth 10-frame, Langstroth 8-frame, National nuc, Langstroth nuc |
| Brood arrangement | Single, brood & a half, double brood |
| Floor | Open mesh / solid (matters for varroa tray counts) |
| Status | Active, dead out, united, sold, archived. History is kept, so set the status rather than deleting |
| Colony established + origin | Bought nuc, package, caught swarm, split, artificial swarm |
| **Queen** year | Sets the international marking colour automatically (white 1/6, yellow 2/7, red 3/8, green 4/9, blue 5/0) |
| Queen marked / clipped | Yes / No |
| Queen source | Own rearing, bought, swarm, supersedure, emergency |
| Strain / breeder | Free text |

### Inspection
| Section | Fields |
|---|---|
| Queen & brood | Queen seen · eggs · open larvae · capped brood (the four together = **BIAS**, brood in all stages) · brood pattern · drone brood · **queen cells** (none / cups / charged / capped / emerged) · number of queen cells · cell position (swarm / supersedure / emergency) |
| Colony | Frames covered with bees · frames with brood · temper 1–5 · behaviour on the comb (steady / runny / followers) · honey stores · pollen · space · supers on (carried over from last time) · hefted weight |
| Health | Varroa check method (tray drop / sugar roll / alcohol wash / drone uncapping) · mites counted · days the tray was in → automatic **% infestation** or **mites/day** · signs seen (DWV, chalkbrood, sacbrood, nosema, wax moth, robbing, drone layer, suspected AFB / EFB / small hive beetle, Asian hornet) |
| Actions taken | Super added/removed, brood box added, foundation, queen cells removed, artificial swarm, split, united, re-queened, queen marked/clipped, fed, treated, clearer board, mouse guard, entrance reduced |
| Conditions & notes | Temperature · weather · notes · **next inspection due** (pre-filled: 7 days Apr–Jul, 14 days Mar and Aug–Oct) |

Ticking **Treated** or **Fed** takes you straight to that form after saving, so the
medicines record stays complete. Selecting a notifiable disease shows NBU reporting guidance.

### Treatment (VMD medicines record)
Product (Apiguard, ApiLife Var, Apivar, MAQS, Formic Pro, Api-Bioxal trickle or
sublimation, Oxuvar, VarroMed, Apistan, other) · batch number · expiry · quantity/dose ·
supplier · start date · finish/removal date (suggested from the product) · honey
withdrawal / supers off · finished? · notes.
UK law requires these records to be kept for 5 years.

### Feed
Date · feed type (1:1 syrup, 2:1 syrup, invert syrup, fondant, pollen substitute) · amount · litres/kg · notes.

### Harvest
Date · supers/frames taken · honey weight (kg) · honey type (spring/OSR, summer, heather, ivy) · notes.

## Getting it on your phone

1. **Make GitHub Pages available.** The repo is currently **private**, and GitHub Pages
   on private repos needs a paid GitHub plan. Either make the repo public (only the app
   code is in it; your hive data never leaves your phone) or use GitHub Pro.
2. Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. The workflow `.github/workflows/pages.yml` publishes the `app/` folder to
   `https://jbroadway14.github.io/Claude/` on every push to the repo's main branch.
   You can also re-run it from the **Actions** tab ("Run workflow").
4. Open that link on your phone:
   - **iPhone (Safari):** Share → *Add to Home Screen*
   - **Android (Chrome):** ⋮ → *Install app*
5. Open it once with signal. After that it works offline.

> **Back up!** Without GitHub sync, data lives only in the phone's browser storage.
> Either turn on sync (below) or use *More → Download backup* every few weeks.

## GitHub sync (your own database)

Your records are stored as one JSON file (`hive-log.json`) in a **private** repo of
yours. The app repo is public, so the data must never go there. The app refuses to
sync to a public repo.

**One-time setup:**
1. Create a new **private** repo on GitHub, e.g. `hive-log-data`. Tick "Add a README"
   or leave it empty; either works.
2. Create a token at **GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**:
   - *Repository access*: **Only select repositories** → `hive-log-data`
   - *Permissions → Repository permissions → Contents*: **Read and write**
   - *Expiration*: up to a year (set a reminder to renew it)
3. In the app go to **More → GitHub sync**, then enter your username, `hive-log-data` and
   the token, and tap **Save & sync**.
4. Do the same on any other device (computer, second phone) to keep them in step.

**How it behaves:**
- **Status pill in the header:** *Synced*, *Waiting to sync*, *Offline · queued* or *Sync error*.
- **When it syncs:** a few seconds after each save, when signal comes back, when you
  reopen the app, and with **Sync now**.
- **Each sync:** downloads the file, merges it record by record (newest edit wins,
  deletions carry across), then uploads the result as a commit, e.g. *"Hive Log sync from
  Phone (42 records)"*. If two devices sync at the same moment, it re-downloads and merges again.
- **Where the token lives:** only in that browser's storage. It is never included in
  backups or in the synced file. It can only touch the one repo you chose, and you can
  revoke it on GitHub at any time.
- **Phones suspend web apps in the background**, so a queued change uploads the next
  time the app is open with signal, not while it's closed.

## Running locally

No build step. Serve the `app/` folder with any static server:

```sh
cd app && python3 -m http.server 8000
# open http://localhost:8000
```

## Project layout

```
app/
  index.html            page shell + bottom tab bar
  styles.css            mobile-first styles, light/dark
  app.js                all app logic: data model, forms, views, import/export
  sw.js                 service worker (offline cache)
  manifest.webmanifest  install metadata
  icons/                app icons
.github/workflows/pages.yml   deploys app/ to GitHub Pages
```

Field lists live as data at the top of `app.js` (`HIVE_SECTIONS`, `INSPECTION`,
`TREATMENT`, `FEED`, `HARVEST`). To add a field, add one line there. The form,
summary and CSV export pick it up automatically.

Varroa thresholds and treatment durations are rough guides. Always follow the
product label and [National Bee Unit](https://www.nationalbeeunit.com/) advice.
