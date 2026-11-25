# SIM+EHR (Student Edition)

*The OME EHR training sandbox. "EPIG" is a pun on the system it prepares students for, with a flying pig as its mascot; it is a teaching parody and is not affiliated with or endorsed by Epic Systems Corporation.*

A practice electronic health record for medical learners. It reproduces the workflows of a
commercial inpatient EHR (the layout and concepts will feel familiar to anyone heading into
Epic) using entirely fictional patients.

**Not for clinical use. Never enter real patient information.** This is an independent teaching
tool and is not affiliated with or endorsed by Epic Systems Corporation.

## Run it

Open `index.html` in Chrome or Edge. There is nothing to install or build.

Everything is stored in the browser's local storage on that computer, so each device (and each
browser profile) has its own sandbox. "Reset sandbox data" on the Patient Lists screen restores
the starting census and regenerates the timeline relative to the current time; learning progress
is kept.

## What learners can do

| Area | Details |
| --- | --- |
| Patient lists | Six inpatients (heart failure, sepsis/pneumonia, post-op hip on warfarin, DKA, GI bleed with DNR/DNI, COPD) |
| Chart | Sidebar with identity, code status, allergies, vitals; Summary; Chart Review |
| Results | Lab grid with flags and critical values, trend graphs, imaging/cardiology/micro reports |
| Flowsheets | Vital-sign grid, trends, record new vitals |
| Orders | Search, order sets, editable details, sign or pend; lab and imaging orders result on their own after about 15–25 seconds |
| Decision support | Allergy, cross-sensitivity, duplicate, drug interaction, lab-based (potassium, creatinine) and problem-based advisories with remove/override |
| Notes | Templates, dot phrases (`.vitals`, `.labs`, `.meds` …), `***` placeholders with F2, sign, cosign |
| MAR | Scheduled, continuous and PRN doses; scan patient and medication before documenting |
| Inbox | Result notifications, cosign requests, staff messages |
| Activity Log | Every chart opened and action taken |
| Cases | Seven PBL cases, each a new patient with a decision tree, a clock, three endings and a debrief that shows the whole tree (`js/cases.js`; plan in `docs/cases-and-world-plan.md`) |
| Missions | Six patient cases scored bronze, silver or gold, one with a live deterioration event |
| Proficiency check | Timed chart-lookup test, 8 of 10 to pass, two attempts, printable certificate |

### Roles

- **Medical Student** — writes notes and pends orders; both need a physician cosign.
- **Physician** — signs and discontinues orders, cosigns student work, sees every learner's progress.
- **Nurse** — documents medication administration, vitals and nursing notes.

Log out and back in to switch roles.

## Learning objectives and assessment

The **Learning** tab holds the curriculum:

- Six objectives, each mapped to one of the AAMC *Core Entrustable Professional Activities for
  Entering Residency*: EPA 3 (interpret tests), EPA 4 (enter orders), EPA 5 (document an
  encounter), EPA 8 (handover), EPA 10 (recognize urgent care needs), EPA 13 (safety and
  improvement).
- Practice tasks that are checked off automatically when the learner does them in a chart.
- A knowledge check with immediate feedback (the first answer counts).
- Work samples: the notes and orders the learner entered, for faculty review.
- **Download report** (JSON) and **Print report** (with a line for faculty rating per EPA) so a
  learner can submit their work.

The EPA numbers and titles are the AAMC's. The objective statements, tasks and questions were
written for this sandbox and have not been reviewed by the AAMC; faculty should check them
against the school's program objectives before using them for grading. All of it lives in
[`js/learning.js`](js/learning.js) and can be edited without touching the rest of the app.

## Files

| File | Purpose |
| --- | --- |
| `js/learning.js` | Objectives, tasks, quiz questions, progress tracking |
| `js/seed.js` | The fictional patients |
| `js/catalog.js` | Orderables, order sets, lab reference ranges, note templates |
| `js/clinical.js` | Decision-support rules, MAR schedule, simulated resulting, dot phrases |
| `js/views.js`, `js/app.js`, `css/app.css` | Screens, interactions, styling |
| `js/core.js` | Storage, roles, formatting helpers |

## Limits of this demo

- Progress and charting are saved per browser, not on a server. There are no real accounts: the
  name typed at login identifies the learner, and faculty collect work through the exported report.
- Clinical content and decision-support rules are simplified for teaching.
- Inpatient workflows only (no scheduling, ambulatory visits, prescriptions to pharmacy, or billing).

## Supplied artwork

One piece of artwork was supplied by the project owner rather than drawn in code: the sprite sheet for Truffle, the corner assistant (`assets/assistant/`). The EPIG logo (`assets/logo/`) is cut from the same sheet. An earlier airbrushed logo picture is kept in `assets/logo/` but is not used. The files as received are kept beside the processed versions as `*-source.png`. Confirm where they came from and that they may be used before the sandbox is distributed.

The ambulance in the banner and the arrival cutscene is from [Rescue Vehicles](https://opengameart.org/content/rescue-vehicles) by bart on OpenGameArt, released under CC0 (public domain, no attribution required; credited here anyway). It is stored as pixel data in `js/world.js`, converted from the PNG with `tools/png-sprite.js`, so it can be toned with the time of day.

The animated pictures in the consequence windows (`assets/cut/`) are composed from two packs by [Mucho Pixels](https://muchopixels.itch.io/), the [Hospital Tileset Pack](https://muchopixels.itch.io/hospital-tileset-pack) (bought) and the [Character Animation Asset Pack](https://muchopixels.itch.io/character-animation-asset-pack), under the GameDev Market Pro licence: the art may be used and edited in this project but the asset files may not be redistributed. The packs are kept out of the published files; only the finished scenes are published. Rebuild them with `node tools/build-scenes.js` from the unpacked packs in `docs/art-source/mucho-hospital` and `docs/art-source/mucho-characters`.

The plan for bringing EPIG in line with real Epic onboarding is in [docs/training-parity-plan.md](docs/training-parity-plan.md).
