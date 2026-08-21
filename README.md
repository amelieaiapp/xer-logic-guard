# XER Logic-Guard Rev 1.17

# XER Logic-Guard

**Protect master schedule logic ties** for both **Ordinary P6 (Professional/Standalone)** and **EPS/EPPM**.

Offline-first HTML/PWA for Microsoft Store.

## Key design facts

- Offline **XER** structure is identical for Ordinary P6 and EPS P6.
- Field names handled: `proj_short_name` and `export_proj_short_name`.
- EPS may omit closed external projects from the PROJECT table — those links are treated as outside the safe set and stripped.
- Encoding: UTF-8 preferred; Ordinary P6 often uses Windows-1252 (handled with fallback decode).
- **XER only** for full logic fidelity (XML optional path exists in design docs but is not required for this Store app).

## Core logic (what the engine actually does)

**Detection (zero-trust by default).** Load your master WITH every received file, then Check Files. Each relationship (TASKPRED row) touching your master is classed as:
- **Extra** — a tie from a received file that reaches INTO your master (a rogue link to a master *internal* activity, or a link to an agreed interface point from a project you have not put on the safe list). Importing it would add/alter logic in your master.
- **Suspected Copy** — the same Activity ID appears in more than one project (a bad copy). Flagged, **never auto-stripped** — you fix it by renaming the activity in P6.
- **Orphan** — the tie points at a project that is not loaded.
- **Approved** — your master's own internal logic, or an interface from a project you've explicitly safe-listed.

Interface points are recognised by activity-code prefix (CM, IF, HO, MS, HOLD, GATE, KD …) plus the words INTERFACE / HANDOVER / MILESTONE / KEYDATE. This list is extendable in the Advanced panel for masters that use other interface codes.

**Cleaning (surgical, per-file).** Download Cleaned Package rebuilds a cleaned COPY of every loaded file, removing **only** the exact TASKPRED rows that were flagged **Extra** or **Orphan**. The match key is `task_id | pred_task_id | normalised-pred-type`, so a legitimate second relationship between the same activity pair (e.g. an SS alongside an FS) is preserved. **Suspected Copy is not stripped** (rename in P6). Rogue rows usually live in the CONTRACTOR file, so all loaded files are cleaned, not just the master. **Original files are never modified.**

**The package.** One ZIP under a single Audit ID: `CLEANED_*.xer` + `1_PROBLEMS-before.xlsx` + `2_CLEANED-after.xlsx` (a re-scan proving the rogue ties are gone) + `IMPORT_CHECKLIST.txt`.

**Out of scope by design.** Logic-Guard removes rogue *links*. It cannot see or clear P6 **External Dates** (early-start/late-finish constraints baked onto activities by a prior import) — the help and the import checklist tell you to clear those in P6 after import. It does not compute CPM; P6 does that after import.

## Support

amelie.ai.support@gmail.com

Part of the AMELIE·AI suite.
