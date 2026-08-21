# XER Logic-Guard — Publishing to the Microsoft Store

**Package layout (this deliverable):**
```
XER-Logic-Guard-App-Rev1.17.zip
├── App/                     ← the PWA (deploy this)
│   ├── index.html
│   ├── css/ js/ assets/
│   ├── manifest.json  sw.js
│   ├── README.md  HELP_DETAILED.md  PRIVACY.md
│   └── GET-OFFLINE-LIBS.txt
└── TestPack/                ← sample XERs for reviewers (not shipped in the Store build)
```

## 1. Make it fully offline (one-time)
Follow `GET-OFFLINE-LIBS.txt` — drop `xlsx.bundle.js` and `jszip.min.js` into `App/js/`.
The app and service worker already load them local-first.

## 2. Host + package
1. Host the **App/** folder on any HTTPS URL (GitHub Pages is fine).
2. Go to **PWABuilder.com**, paste the URL, let it validate manifest + service worker.
3. Reserve the app name in **Partner Center** BEFORE uploading.
4. Download the **Windows MSIX**, submit in Partner Center.
5. Bump the service-worker version on every re-package.

## 3. Store listing copy (paste-ready)

**Name:** XER Logic-Guard — Protect Your P6 Master Schedule Logic

**Short description (≤100 chars):**
Verify contractor P6/XER files won't corrupt your master before you import them. 100% offline.

**Long description:**
When you import a contractor's monthly XER, P6's default import can quietly ADD their external relationships — including links into YOUR master — the moment you import. One rogue or copied link can re-wire your critical path and float, and there's no built-in P6 way to even list those cross-project ties. XER Logic-Guard is the missing check. Load your master together with the received files and it gives one straight answer — SAFE TO IMPORT or DO NOT IMPORT AS-IS — flagging every tie that reaches into your master, every duplicate Activity ID that could overwrite your activities, and every orphan link. One click then cleans a COPY of each file (all four relationship types handled), packaged with before/after Excel reports and an import checklist under one Audit ID. 100% offline — nothing leaves your PC. Originals never modified. Reads Ordinary P6 (Professional) and EPS/EPPM XER, Arabic/Cyrillic names and Gulf calendars.

**8 feature bullets:**
- One clear answer: SAFE TO IMPORT, or DO NOT IMPORT AS-IS.
- Flags rogue ties into your master, duplicate Activity IDs, and orphan links.
- Surgical clean — removes only the flagged rows, by relationship type; originals untouched.
- Audited ZIP: cleaned XERs + before/after Excel + import checklist, one Audit ID.
- Re-scan proof that the rogue ties are gone in the cleaned files.
- 100% offline — no account, no cloud, nothing uploaded.
- Ordinary P6 (Professional) and EPS/EPPM; Arabic/Cyrillic and Gulf calendars.
- Configurable interface codes for masters that don't use "CM".

**Category:** Productivity / Business  **Search terms:** primavera p6, xer, schedule logic, external relationships, inter-project, master schedule, EPS, EPPM, contractor programme, logic check.

## 4. Still to supply before submission (assets, not code)
- [ ] 3–5 Store screenshots (drag files → red verdict → cleaned package → Excel).
- [ ] Privacy policy URL — host `PRIVACY.md` and link it (no data is collected).
- [ ] Age rating + support contact: **amelie.ai.support@gmail.com** (this app's identity).

Support: amelie.ai.support@gmail.com
