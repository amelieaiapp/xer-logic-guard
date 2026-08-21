# XER Logic-Guard — Detailed Help

**Support:** amelie.ai.support@gmail.com

---

## The problem you just hit (HORIZON example)

| What you see | What it actually is |
|--------------|---------------------|
| File on disk: `HORIZON_RevA.xer` | Windows file name only |
| You typed: `MASTER_RevA` or `MASTER_HORIZON_RevA` | Invented name — not in the file |
| App says Found: **HORIZON** | The real **proj_short_name** inside the XER |

**You must use `HORIZON`.**  
Click the blue name button after the first Scan, then Scan again.

If Master Ties stays **0**, the short name did not match. Nothing is wrong with the XER — the name is wrong.

---

## Easiest workflow (do this every time)

1. Put the master **.xer** in the **left** box (optional: contracts on the right).
2. Click **Scan Relationships** once.
3. Under the master name field, **blue buttons** appear — one per project name found inside the file(s).
4. **Click the blue button** for your master (e.g. HORIZON).
5. Optionally fill the safe list with that name + allowed contracts.
6. Click **Scan** again.
7. Open **Problems Only**.
8. Use **Export Excel** / **Download Cleaned XER** as needed.
9. **Reset results** clears the tables but keeps your files so you can change the name and scan again without reloading.

---

**Who this is for:** Client-side planners who own the **master schedules** and need to remove unwanted logic ties left by contractor project copies.

**Important:** The application interface is **English**. This document explains how your **schedule files** (including Arabic Gulf and Eastern European programmes) are read and cleaned.

---

## 1. What problem does this app solve?

In Primavera P6, when someone **copies a project**, there is an option similar to:

> “Retain relationships with projects outside the copied group”

If a contractor **leaves that option on** (or does not clear external links), the copy keeps relationships that still point at **your master** (or at other projects).

Result on your side:

- Your **master schedule** suddenly has **extra, duplicate, or broken logic ties**
- Activities appear linked to projects that are only contractor working copies
- The programme is harder to trust for site, claims, and reporting

**You** are the only person who should control relationships **on the master**.  
XER Logic-Guard helps you **find** those rogue ties and **download a cleaned XER** with them removed.

---

## 2. Ordinary P6 vs EPS P6 — read this carefully

### 2.1 Ordinary P6 (also called P6 Professional / Standalone)

- You usually work in a **local** or **direct** database.
- You export with **File → Export → Primavera PM – (XER)**.
- Project short names often appear in the XER as `proj_short_name`.
- Files are sometimes saved with **Windows-1252** (Western European) encoding.

### 2.2 EPS P6 (EPPM / Enterprise)

- You work through an **Enterprise Project Structure (EPS)** in a shared environment.
- Export is still **XER** (or XML) from the tools your organisation provides.
- Project short names may appear as `export_proj_short_name` **or** `proj_short_name`.
- **Important EPS behaviour:** when a project is closed or not included in the export, its details may be **missing** from the PROJECT table in the XER.  
  Relationships that still point at that missing project are treated as **outside your safe list** and can be stripped — that is intentional and correct for cleanup.

### 2.3 Critical rule (both products)

**Offline XER structure is the same for Ordinary P6 and EPS.**  

If you process the XER correctly, the same app works for both.  
You do **not** need a different tool for EPS vs Ordinary P6.

---

## 3. Step-by-step for complete beginners

### Step A — Export from P6 (do this in Primavera, not in this app)

1. Open the **master** project (or the set of projects you need) in P6.
2. Use **Export** and choose **XER** (Primavera PM – XER).
3. If you also need contractor files, export each relevant **contract project** as its own XER (or one multi-project XER if your process uses that).
4. Save the files where you can find them (Desktop or a project folder).
5. **Do not** only export PDF or a picture of the Gantt — the app needs the **.xer** file.

### Step B — Open XER Logic-Guard

1. Launch the app from the Microsoft Store (or open `index.html` if you are testing the package).
2. You should see two drop zones: **Master Schedule(s)** and **Contract / Project Schedules**.

### Step C — Load files

1. Drop or select your **master** XER into the left zone.
2. Drop or select contractor / project XERs into the right zone (if you have them separate).
3. If everything is in **one** multi-project XER, load it as the master file; you can leave the contract zone empty.

### Step D — Type the master short name(s)

1. In **Master short name(s)**, type the exact short name as it appears in P6  
   (example: `MASTER_HORIZON` or `M-2026-MAIN`).
2. If you have more than one master, separate names with commas.
3. **Silly mistake to avoid:** typing the long project title instead of the **short name**.  
   Use the same short name you see in the Project ID / short name field in P6.

### Step E — Enter the safe / approved list

1. In **Approved / Safe Project List**, enter **every** project that is **allowed** to keep relationships with the master.
2. Include:
   - The **master** short name itself  
   - Each **valid** contract project (typically 2 to 8 names)
3. One name per line, or comma-separated.
4. **Silly mistake to avoid:** listing only the master and forgetting the real contracts — then valid interface links may be stripped.
5. **Silly mistake to avoid:** listing a contractor **copy** name (e.g. `CONTRACT_A_COPY`) that should not keep links to the master.

### Step F — Scan

1. Click **Scan Relationships**.
2. Wait until the summary appears (counts of Extra, Suspected Copy, Orphan, etc.).
3. Open **Problems Only** to see what looks wrong.
4. After scan, the app may show **Found projects in file(s):** — use that list to check you typed short names correctly.

### Step G — Clean and download

1. Click **Clean Unwanted Ties** if you want the on-screen lists updated (Removed / Kept).
2. Click **Download Cleaned XER**.
3. You get a file named like `CLEANED_YourMaster.xer`.
4. **Keep the original XER** as backup. Never overwrite your only copy.
5. Import the cleaned XER back into P6 using your normal import procedure (and your organisation’s rules for updating the master).

### Step H — Excel audit (recommended)

1. Click **Export Excel Report**.
2. Store the Excel with your records (before/after evidence for audits or disputes).

---

## 4. What each flag means (plain language)

| Flag | Meaning | What you should do |
|------|---------|-------------------|
| **Extra** | Link involves a project **not** on your safe list | Usually remove (Download Cleaned XER does this) |
| **Suspected Copy** | Same activity ID appears in more than one project and still ties to the master | Typical sign of a bad copy — review and usually remove |
| **Orphan** | Link points at a project that is **not in the loaded files** | Often safe to strip; common with EPS partial exports |
| **Approved** | Link stays within master + safe list | Keep |

---

## 5. Gulf and Eastern European programmes (Arabic / Russian, etc.)

### 5.1 What the app does for you

- Detects **byte-order marks (BOM)** when present.
- Tries **UTF-8**, **Windows-1252**, **Windows-1251** (Cyrillic / Eastern Europe), **Windows-1256** (Arabic / Gulf), and related encodings.
- Chooses the encoding that best preserves readable text and valid XER markers.
- So a schedule written in **Arabic** on a Gulf installation, or in **Russian** on an Eastern European one, should appear as **readable names**, not rows of `?????`.

### 5.2 What is preserved when you clean

Cleaning only removes **unwanted relationship rows** (TASKPRED).  
It does **not** rebuild or delete:

- Calendars  
- Working weeks (including **Sunday–Thursday** weeks)  
- **Ramadan** or other non-work periods defined in the file  
- Regional holiday calendars  

Those stay in the scrubbed copy so the programme can still calculate correctly for a **UAE**, **Saudi**, or similar job, provided they were correct in the original XER.

### 5.3 Note about the interface

- The **application screens and buttons are in English**.
- Regional language support is about **reading and writing your XER data**, not translating the UI.

### 5.4 If names still look wrong

1. Confirm the file is a real **.xer** from P6, not a renamed PDF or Excel.
2. Re-export from P6 and try again.
3. Email **amelie.ai.support@gmail.com** with the country/language of the P6 installation (no need to send confidential full programmes unless asked).

---

## 6. Common silly mistakes checklist

- [ ] Exported **PDF** or screenshot instead of **XER**
- [ ] Typed **long project name** instead of **short name**
- [ ] Safe list **missing** the real contract projects (valid links stripped)
- [ ] Safe list **includes** bad copy project names (bad links kept)
- [ ] Overwrote the **only** original XER with the cleaned file
- [ ] Imported cleaned file into the **wrong** EPS node or database
- [ ] Expected the app to fix **logic inside** one project (it focuses on **cross-project / master** ties)
- [ ] Used a different short name spelling than in P6 (spaces, dashes, case usually match as stored in the XER)

---

## 7. Ordinary P6 — short recipe

1. Export master (and contracts if needed) as **XER**.  
2. Load into Logic-Guard.  
3. Enter master short name + approved contract short names.  
4. Scan → review Problems Only.  
5. Download Cleaned XER → keep original → import cleaned file per your process.

## 8. EPS P6 — short recipe

1. Export from EPPM/EPS tools as **XER** (same idea).  
2. Load into Logic-Guard.  
3. Enter short names **exactly** as in EPS.  
4. Remember: missing external projects in the file are treated as **not allowed** — orphans/extra links to them can be stripped.  
5. Scan → Download Cleaned XER → import according to your EPS governance (often via a controlled import account).

---

## 9. Support

**Email:** amelie.ai.support@gmail.com  

Please include:

- Ordinary P6 or EPS/EPPM  
- Country / language of the schedule (e.g. UAE Arabic, Poland, Russia) if encoding is relevant  
- Whether the issue is scan, clean download, or import back into P6  

---

*XER Logic-Guard · Part of the AMELIE·AI suite · Offline-first · Data stays on your device*
