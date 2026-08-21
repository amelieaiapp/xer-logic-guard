/* XER Logic-Guard APP_VERSION=1.17.0 */
window.LG_VERSION = '1.17.0';
/**
 * XER Logic-Guard – Main Application (simplified UX)
 * Ordinary P6 + EPS/EPPM
 */
(function () {
  const state = {
    masterFiles: [],
    projectFiles: [],
    projects: {},
    activities: {},
    relationships: [],
    flagged: [],
    removed: [],
    kept: [],
    currentTab: "all",
    originalTexts: {},
    lastFoundNames: [],
    auditId: null,
    lastWorkbook: null
  };

  // ---- "What do I do now?" coach — makes the flow foolproof ----
  function updateCoach() {
    const el = document.getElementById("coach");
    if (!el) return;
    const nMaster = state.masterFiles.length;
    const nSubs = state.projectFiles.length;
    const scanned = state.flagged.length > 0 || Object.keys(state.projects).length > 0;
    const problems = state.flagged.filter(r => ["Extra", "Suspected Copy", "Orphan"].includes(r.flag)).length;
    let msg, tone = "go";
    if (nMaster === 0) {
      msg = "STEP 1 — Drag your MASTER programme (.xer) onto the LEFT box, and the received files onto the RIGHT.";
    } else if (nMaster > 0 && nSubs === 0 && !scanned) {
      msg = "STEP 1 — Master loaded. Now drop the received/contractor file(s) onto the RIGHT box.";
    } else if (!scanned) {
      msg = "STEP 2 — Files loaded. Click the big CHECK FILES button.";
    } else if (problems === 0) {
      msg = "✔ ALL CLEAR — no rogue ties into your master. Safe to import — but in P6 still check the External Early Start / Late Finish columns (constraints this tool can't see).";
      tone = "done";
    } else {
      msg = "STEP 3 — Problems found. Click DOWNLOAD CLEANED PACKAGE — it cleans the files and gives you one zip (cleaned XERs + reports + checklist). Import the CLEANED copies into P6 (never the originals), then check the External Early Start / Late Finish columns.";
      tone = "warn";
    }
    el.textContent = "👉  " + msg;
    el.style.background = tone === "done" ? "#C6EFCE" : (tone === "warn" ? "#FFF3CD" : "#E8F0FE");
    el.style.color = tone === "done" ? "#006100" : (tone === "warn" ? "#664D03" : "#1F4E79");
    el.style.borderColor = tone === "done" ? "#7FBF8F" : (tone === "warn" ? "#E0C97A" : "#9BC0E8");
  }

  // Download is available as soon as a scan finds problems. The audit trail is preserved
  // because the package itself always contains the before/after Excel reports + checklist.
  function updateCleanGate() {
    const dl = document.getElementById("btn-download-clean");
    if (dl) {
      const problems = state.flagged.filter(r => ["Extra", "Suspected Copy", "Orphan"].includes(r.flag)).length;
      const strippable = state.flagged.filter(r => (r.flag === "Extra" || r.flag === "Orphan") && !r.synthetic).length;
      dl.disabled = strippable === 0;
      dl.style.display = problems > 0 ? "" : "none";
    }
    updateCoach();
  }

  function setupDropZone(zoneId, inputId, listId, isMaster) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);

    zone.addEventListener("click", (e) => {
      if (e.target.closest(".file-remove") || e.target.closest(".btn-clear-zone")) return;
      input.click();
    });
    zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", e => {
      e.preventDefault();
      zone.classList.remove("dragover");
      handleFiles(e.dataTransfer.files, isMaster, list);
    });
    input.addEventListener("change", () => handleFiles(input.files, isMaster, list));
  }

  function handleFiles(fileList, isMaster, listEl) {
    const arr = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith(".xer"));
    if (!arr.length) {
      alert("Please select .xer files only.");
      return;
    }
    if (isMaster) {
      state.masterFiles = state.masterFiles.concat(arr);
      renderFileList(listEl, state.masterFiles, true);
    } else {
      state.projectFiles = state.projectFiles.concat(arr);
      renderFileList(listEl, state.projectFiles, false);
    }
    updateCoach();
  }

  function renderFileList(el, files, isMaster) {
    if (!files.length) { el.innerHTML = ""; return; }
    el.innerHTML = files.map((f, i) =>
      `<li>
        <span>${f.name} (${(f.size/1024).toFixed(1)} KB)</span>
        <button type="button" class="file-remove" data-master="${isMaster}" data-index="${i}" title="Remove">×</button>
      </li>`
    ).join("");
    el.querySelectorAll(".file-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-index"), 10);
        const master = btn.getAttribute("data-master") === "true";
        if (master) {
          state.masterFiles.splice(idx, 1);
          renderFileList(el, state.masterFiles, true);
        } else {
          state.projectFiles.splice(idx, 1);
          renderFileList(el, state.projectFiles, false);
        }
      });
    });
  }

  function clearZone(isMaster) {
    if (isMaster) {
      state.masterFiles = [];
      document.getElementById("master-input").value = "";
      renderFileList(document.getElementById("master-list"), [], true);
    } else {
      state.projectFiles = [];
      document.getElementById("project-input").value = "";
      renderFileList(document.getElementById("project-list"), [], false);
    }
  }

  function getSafeList() {
    return document.getElementById("approved-list").value
      .split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  }

  function getMasterNames() {
    return document.getElementById("master-names").value
      .split(",").map(s => s.trim()).filter(Boolean);
  }

  function setMasterName(name) {
    document.getElementById("master-names").value = name;
    const box = document.getElementById("name-picker");
    if (box) box.querySelectorAll(".name-chip").forEach(c => {
      c.classList.toggle("selected", c.dataset.name === name);
    });
  }

  function renderNamePicker(foundNames) {
    const box = document.getElementById("name-picker");
    if (!box) return;
    state.lastFoundNames = foundNames || [];
    if (!foundNames.length) {
      box.innerHTML = "<p class='hint'>Load XER files and click Scan — project names found in the files will appear here as buttons you can click.</p>";
      return;
    }
    box.innerHTML =
      "<p class='hint'><strong>Click a name below to use it as the master short name</strong> (must match exactly what is inside the XER):</p>" +
      foundNames.map(n =>
        `<button type="button" class="name-chip" data-name="${escapeHtml(n)}">${escapeHtml(n)}</button>`
      ).join(" ");
    box.querySelectorAll(".name-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        setMasterName(btn.dataset.name);
        // also suggest adding to safe list if empty
        const safe = document.getElementById("approved-list");
        if (!safe.value.trim()) {
          safe.value = btn.dataset.name;
        }
      });
    });
  }

  function renderSafePicker(foundNames) {
    const box = document.getElementById("safe-picker");
    if (!box) return;
    if (!foundNames || !foundNames.length) { box.innerHTML = ""; return; }
    const current = getSafeList().map(s => s.toLowerCase());
    box.innerHTML =
      "<p class='hint'><strong>Click each contract you TRUST</strong> to add it to the safe list. " +
      "Anything you leave un-clicked is flagged as <em>Extra</em> for you to review. " +
      "The master is trusted automatically.</p>" +
      foundNames.map(n => {
        const on = current.includes(n.toLowerCase());
        return `<button type="button" class="name-chip${on ? " selected" : ""}" data-safe="${escapeHtml(n)}">${on ? "\u2713 " : ""}${escapeHtml(n)}</button>`;
      }).join(" ");
    box.querySelectorAll("[data-safe]").forEach(btn => {
      btn.addEventListener("click", () => toggleSafe(btn.dataset.safe));
    });
  }

  function toggleSafe(name) {
    const ta = document.getElementById("approved-list");
    const list = ta.value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    const idx = list.findIndex(s => s.toLowerCase() === name.toLowerCase());
    if (idx >= 0) list.splice(idx, 1); else list.push(name);
    ta.value = list.join("\n");
    renderSafePicker(state.lastFoundNames);
  }

  function ensureMasterInSafe() {
    const ta = document.getElementById("approved-list");
    const masters = getMasterNames();
    if (!ta || !masters.length) return;
    const list = ta.value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    masters.forEach(m => {
      if (!list.some(s => s.toLowerCase() === m.toLowerCase())) list.push(m);
    });
    ta.value = list.join("\n");
  }

  function resetResults() {
    state.projects = {};
    state.activities = {};
    state.relationships = [];
    state.flagged = [];
    state.removed = [];
    state.kept = [];
    state.originalTexts = {};
    document.getElementById("summary").innerHTML = "";
    document.getElementById("results").hidden = true;
    const _dl = document.getElementById("btn-download-clean");
    if (_dl) { _dl.disabled = true; _dl.style.display = "none"; }
    const tbody = document.querySelector("#results-table tbody");
    if (tbody) tbody.innerHTML = "";
    document.getElementById("found-projects-hint").textContent = "";
    // keep files and name fields — user can Scan again
    alert("Results cleared. Your files and names are still loaded.\nClick Scan Relationships to run again.");
  }

  async function runScan() {
    if (state.masterFiles.length === 0 && state.projectFiles.length === 0) {
      alert("Load at least one XER file first.\n\nPut the schedule you want to treat as MASTER in the LEFT box.");
      return;
    }

    const btn = document.getElementById("btn-scan");
    btn.disabled = true;
    btn.textContent = "Scanning…";

    try {
      state.projects = {};
      state.auditId = null;
      state.lastWorkbook = null;
      updateCleanGate();
      state.activities = {};
      state.relationships = [];
      state.flagged = [];
      state.removed = [];
      state.kept = [];
      state.originalTexts = {};

      const allFiles = [...state.masterFiles, ...state.projectFiles];
      for (const file of allFiles) {
        const data = await XerParser.parseFile(file);
        Object.assign(state.projects, data.projects);
        Object.assign(state.activities, data.activities);
        state.relationships.push(...data.relationships);
        if (data._originalText) state.originalTexts[file.name] = data._originalText;
      }

      const foundNames = Object.values(state.projects).map(p => p.proj_short_name).filter(Boolean);
      const uniqueFound = [...new Set(foundNames)];
      renderNamePicker(uniqueFound);
      ensureMasterInSafe();
      renderSafePicker(uniqueFound);

      let masterNames = getMasterNames();

      // Auto-select when only one project short name exists in the file(s)
      if (uniqueFound.length === 1) {
        if (masterNames.length === 0 || masterNames[0].toLowerCase() !== uniqueFound[0].toLowerCase()) {
          setMasterName(uniqueFound[0]);
          masterNames = [uniqueFound[0]];
          const safe = document.getElementById("approved-list");
          if (safe && !safe.value.trim()) safe.value = uniqueFound[0];
        }
      } else if (masterNames.length === 0 && uniqueFound.length > 1) {
        // leave empty — user must click a blue chip
      }

      if (masterNames.length === 0) {
        document.getElementById("results").hidden = false;
        document.getElementById("summary").innerHTML = `
          <div class="stat"><div class="num">${Object.keys(state.projects).length}</div><div class="label">Projects</div></div>
          <div class="stat"><div class="num">${Object.keys(state.activities).length}</div><div class="label">Activities</div></div>
          <div class="stat"><div class="num">0</div><div class="label">Findings</div></div>
        `;
        document.getElementById("found-projects-hint").textContent =
          "Found projects: " + uniqueFound.join(", ") +
          "\n⚠ Type or CLICK one of those names as the master short name, then Scan again.";
        alert(
          "Files loaded. Project name(s) found inside the XER:\n\n  " +
          uniqueFound.join("\n  ") +
          "\n\nYou must use ONE OF THESE EXACT names as Master short name.\n" +
          "Click a blue name button under the master field, then click Scan again.\n\n" +
          "Example: if the app shows PROJECT_A, type PROJECT_A — not MASTER_RevA or the file name."
        );
        btn.disabled = false;
        btn.textContent = "🔍  SCAN RELATIONSHIPS";
        return;
      }

      const approvedList = getSafeList();
      // Let the master's own interface codes extend the defaults (Advanced input)
      const ifEl = document.getElementById("interface-codes");
      if (ifEl && LogicGuardDetection.setInterfaceCodes) {
        LogicGuardDetection.setInterfaceCodes((ifEl.value || "").split(/[,\n]/));
      }
      const result = LogicGuardDetection.detect(
        state.relationships,
        state.projects,
        state.activities,
        masterNames,
        approvedList
      );
      state.flagged = result.flagged;

      const counts = {};
      state.flagged.forEach(r => { counts[r.flag] = (counts[r.flag] || 0) + 1; });

      const matchedMaster = masterNames.filter(n =>
        uniqueFound.some(f => f.toLowerCase() === n.toLowerCase())
      );

      document.getElementById("summary").innerHTML = `
        <div class="stat"><div class="num">${Object.keys(state.projects).length}</div><div class="label">Projects</div></div>
        <div class="stat"><div class="num">${Object.keys(state.activities).length}</div><div class="label">Activities</div></div>
        <div class="stat"><div class="num">${state.flagged.length}</div><div class="label">Findings</div></div>
        <div class="stat"><div class="num">${counts["Extra"] || 0}</div><div class="label">Extra</div></div>
        <div class="stat"><div class="num">${counts["Suspected Copy"] || 0}</div><div class="label">Suspected Copy</div></div>
        <div class="stat"><div class="num">${counts["Orphan"] || 0}</div><div class="label">Orphan</div></div>
      `;

      const hint = document.getElementById("found-projects-hint");
      if (matchedMaster.length === 0) {
        hint.innerHTML =
          "Found in file(s): <strong>" + uniqueFound.map(escapeHtml).join(", ") + "</strong><br>" +
          "⚠ You typed <strong>" + masterNames.map(escapeHtml).join(", ") + "</strong> — that does NOT match.<br>" +
          "Click a blue name button above, then Scan again.";
        alert(
          "NO MASTER MATCHED\n\n" +
          "You typed: " + masterNames.join(", ") + "\n" +
          "Inside the XER the project is called: " + uniqueFound.join(", ") + "\n\n" +
          "The short name is NOT the file name.\n" +
          "It is the Project ID / Short Name stored inside P6.\n\n" +
          "Click the blue button with the correct name, then Scan again."
        );
      } else {
        const loadedLc = Object.values(state.projects).map(p => String(p.proj_short_name || "").toLowerCase());
        const activeSafe = approvedList.filter(s => loadedLc.includes(s.toLowerCase()));
        const staleSafe = approvedList.filter(s => !loadedLc.includes(s.toLowerCase()));
        hint.textContent =
          "Found: " + uniqueFound.join(", ") +
          " | Using master: " + matchedMaster.join(", ") +
          " | Safe list (active): " + (activeSafe.length ? activeSafe.join(", ") : "master only — every external tie flagged") +
          (staleSafe.length ? "  |  remembered but NOT loaded (inactive this scan): " + staleSafe.join(", ") : "");
        const problems = state.flagged.filter(r => ["Extra","Suspected Copy","Orphan"].includes(r.flag)).length;
        if (approvedList.length === 0) {
          alert("Master matched: " + matchedMaster.join(", ") +
            "\n\nSafe list is empty — all external ties are flagged Extra.\nOpen Problems Only to review.\nAdd approved contracts and Scan again when ready.");
        } else if (problems > 0) {
          alert("Scan complete.\nMaster: " + matchedMaster.join(", ") +
            "\nProblems found: " + problems + "\nOpen Problems Only tab.");
        } else {
          alert("Scan complete.\nMaster: " + matchedMaster.join(", ") +
            "\nNo Extra / Suspected Copy / Orphan problems found.");
        }
      }

      document.getElementById("results").hidden = false;
      updateCleanGate(); // shows the Download button only when problems exist
      // One-line verdict banner — the headline in a single read
      (function () {
        const v = document.getElementById("verdict");
        if (!v) return;
        const c = {}; state.flagged.forEach(r => { c[r.flag] = (c[r.flag] || 0) + 1; });
        const ex = c["Extra"] || 0, sc = c["Suspected Copy"] || 0, or = c["Orphan"] || 0;
        const probs = ex + sc + or;
        v.style.display = "block";
        if (probs === 0) {
          v.style.background = "#C6EFCE"; v.style.color = "#006100";
          v.style.border = "1px solid #7FBF8F";
          v.textContent = "\u2714 SAFE TO IMPORT — nothing in these files creates, changes or duplicates logic in your master. No rogue ties, no duplicate IDs, no orphans.";
        } else {
          v.style.background = "#F8D7DA"; v.style.color = "#842029";
          v.style.border = "1px solid #D99";
          const bits = [];
          if (ex) bits.push(ex + " tie" + (ex > 1 ? "s" : "") + " reaching INTO your master (Extra)");
          if (sc) bits.push(sc + " duplicate Activity ID" + (sc > 1 ? "s" : "") + " that could overwrite master activities (Suspected Copy)");
          if (or) bits.push(or + " orphan link" + (or > 1 ? "s" : "") + " to missing projects");
          let msg = "\u26D4 DO NOT IMPORT AS-IS — these files WILL affect your master: " + bits.join("; ") +
            ".  Open Problems Only, then Clean Unwanted Ties \u2192 Download Cleaned XER, and import the CLEANED copies.";
          if (or > 0) msg += "  \u2139 Some ties point at projects that are NOT loaded — if any is your master or another contract, load it and Scan again before cleaning.";
          v.textContent = msg;
        }
      })();
      // Land the user on what matters: Problems Only if there are problems, else All Master Ties.
      const _probCount = state.flagged.filter(r => ["Extra","Suspected Copy","Orphan"].includes(r.flag)).length;
      renderTable(_probCount > 0 ? "problems" : "all");
      // Bring the answer into view — results sit lower down the page
      setTimeout(function () {
        const v = document.getElementById("verdict");
        const target = (v && v.style.display !== "none") ? v : document.getElementById("results");
        if (target && target.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (err) {
      console.error(err);
      alert("Error while scanning: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "🔍  SCAN RELATIONSHIPS";
    }
  }

  function runClean() {
    if (!state.flagged.length) {
      alert("Nothing to clean. Fix the master short name and Scan first.");
      return;
    }
    state.removed = [];
    state.kept = [];
    let dupIds = 0;
    state.flagged.forEach(r => {
      if ((r.flag === "Extra" || r.flag === "Orphan") && !r.synthetic) state.removed.push(r);
      else { if (r.flag === "Suspected Copy") dupIds++; state.kept.push(r); }
    });
    alert("In-memory clean:\n  Removable rogue/orphan ties: " + state.removed.length +
      "\n  Kept: " + state.kept.length +
      (dupIds ? "\n  Duplicate Activity IDs (Suspected Copy): " + dupIds + " — rename in P6, cannot be removed by stripping a link" : "") +
      "\n\nUse Download Cleaned XER for the real cleaned file(s).");
    renderTable(state.currentTab);
    updateCoach();
  }

  // Re-parse the cleaned file texts and re-run detection — the "after" proof.
  function rescanCleaned(cleanedOut) {
    try {
      const projects = {}, activities = {};
      let rels = [];
      cleanedOut.forEach(c => {
        const built = XerParser.buildFromTables(XerParser.parseXerText(c.text));
        Object.assign(projects, built.projects);
        Object.assign(activities, built.activities);
        rels = rels.concat(built.relationships);
      });
      // include the master so ties can still be classified
      state.masterFiles.forEach(f => {
        const t = state.originalTexts[f.name];
        if (!t) return;
        const b = XerParser.buildFromTables(XerParser.parseXerText(t));
        Object.assign(projects, b.projects);
        Object.assign(activities, b.activities);
        rels = rels.concat(b.relationships);
      });
      if (LogicGuardDetection.relink) LogicGuardDetection.relink(rels, activities, projects);
      const res = LogicGuardDetection.detect(rels, projects, activities, getMasterNames(), getSafeList());
      return res.flagged || [];
    } catch (e) {
      return [];
    }
  }

  function buildImportChecklist(cleanedOut, totalStripped) {
    const c = {}; state.flagged.forEach(r => { c[r.flag] = (c[r.flag] || 0) + 1; });
    return [
      "XER LOGIC-GUARD — IMPORT CHECKLIST",
      "Audit ID: " + (state.auditId || "(none)"),
      "Generated: " + new Date().toISOString(),
      "Support: amelie.ai.support@gmail.com",
      "",
      "This package pairs with the Excel report of the SAME Audit ID.",
      "",
      "WHAT WAS FOUND",
      "  Ties reaching into your master (Extra): " + (c["Extra"] || 0),
      "  Duplicate Activity IDs (Suspected Copy): " + (c["Suspected Copy"] || 0) + "  (rename in P6 — NOT removed here)",
      "  Orphan links to missing projects: " + (c["Orphan"] || 0),
      "  Rogue/orphan ties removed in this package: " + totalStripped,
      "",
      "CLEANED FILES IN THIS ZIP",
      cleanedOut.map(f => "  " + f.name + "  (" + f.stripped + " tie(s) removed)").join("\n"),
      "",
      "TWO EXCEL REPORTS IN THIS ZIP:",
      "  1_PROBLEMS-BEFORE ... the problems found in the received files.",
      "  2_CLEANED-AFTER  ... a re-scan of the cleaned files proving the rogue/orphan ties",
      "                      are gone (any remaining rows are duplicate IDs to rename in P6).",
      "",
      "BEFORE YOU IMPORT TO THE LIVE MASTER — do these in order:",
      "  1. Open the matching Excel report and review the 'Problems Only' sheet.",
      "  2. BACK UP your live master database/project first.",
      "  3. Import the CLEANED_ files (not the originals). By default P6's import action",
      "     'Update Existing' for 'Relationships to External Projects' ADDS external ties into",
      "     your master — which is exactly why they had to be cleaned first.",
      "  4. In the import wizard, review the 'Activity Relationships' Delete option carefully.",
      "  5. Reschedule (F9). If a contractor project referenced projects not in your database,",
      "     schedule with 'Ignore Relationships To and From Other Projects' so external dates are handled.",
      "  6. CHECK EXTERNAL DATES: add columns 'External Early Start' / 'External Late Finish';",
      "     clear any unagreed values (Logic-Guard cannot see these — they are constraints, not links).",
      "  7. Re-check your master's critical path and total float after rescheduling.",
      "",
      "Duplicate Activity IDs are NOT auto-removed. Rename the contractor's activity in P6",
      "so IDs are unique BEFORE importing, or it may collide with your master activity.",
      "",
      "Originals are never modified. Only the client imports to the live master — not contractors.",
      "*** No cleaned XER should reach the live master without this checklist and its matching Excel. ***"
    ].join("\n");
  }

  function downloadCleanedXer() {
    if (!state.flagged.length) { alert("Check your files first."); return; }
    if (!state.auditId) state.auditId = "LG-" + new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);

    const stripKeys = new Set();
    state.flagged.forEach(r => {
      if ((r.flag === "Extra" || r.flag === "Orphan") && !r.synthetic && r.task_id && r.pred_task_id) {
        stripKeys.add(r.task_id + "|" + r.pred_task_id + "|" + String(r.pred_type || "").replace(/^PR_/, ""));
      }
    });
    if (!stripKeys.size) {
      alert("Nothing to strip.\n\nThe only findings are duplicate Activity IDs (Suspected Copy) — " +
            "fix those by renaming the activities in P6. Deleting a link would not fix a duplicate ID.");
      return;
    }
    const allFiles = [...state.masterFiles, ...state.projectFiles];
    const cleanedOut = [];
    let totalStripped = 0;
    allFiles.forEach(f => {
      const original = state.originalTexts[f.name];
      if (!original) return;
      const res = XerParser.stripFlaggedTies(original, stripKeys);
      if (res.stripped > 0) {
        totalStripped += res.stripped;
        cleanedOut.push({ name: "CLEANED_" + f.name, text: res.text, stripped: res.stripped });
      }
    });
    // keep the on-screen Removed/Kept tabs in sync
    state.removed = state.flagged.filter(r => (r.flag === "Extra" || r.flag === "Orphan") && !r.synthetic);
    state.kept = state.flagged.filter(r => !((r.flag === "Extra" || r.flag === "Orphan") && !r.synthetic));
    if (!cleanedOut.length) {
      alert("No file physically contains the flagged rogue/orphan rows.\n\n" +
            "They usually live in the CONTRACTOR files — load those and try again. Your master itself is already clean.");
      return;
    }
    const summary = cleanedOut.map(c => c.name + "  —  " + c.stripped + " removed").join("\n");
    const checklist = buildImportChecklist(cleanedOut, totalStripped);
    const stamp = new Date().toISOString().slice(0, 10);
    const zipName = "XER_Logic-Guard_PACKAGE_" + (state.auditId || stamp) + ".zip";

    if (typeof JSZip === "undefined") {
      alert("The packaging library didn't load (are you offline on first run?). Reconnect once, or use Export report (Excel) for now.");
      return;
    }
    const zip = new JSZip();
    cleanedOut.forEach(c => zip.file(c.name, c.text));
    zip.file("IMPORT_CHECKLIST.txt", checklist);

    // Excel reports — base64 path (reliable with JSZip). Each in its own try so one can't kill the other.
    if (typeof XLSX !== "undefined") {
      try {
        const wbBefore = exportExcel({ flagged: state.flagged, removed: [], kept: [], cleanedFlag: false, returnWb: true });
        if (wbBefore) zip.file("1_PROBLEMS-before_" + stamp + ".xlsx", XLSX.write(wbBefore, { bookType: "xlsx", type: "base64" }), { base64: true });
      } catch (e) {}
      try {
        const afterFlagged = rescanCleaned(cleanedOut);
        const wbAfter = exportExcel({ flagged: afterFlagged, removed: state.removed, kept: state.kept, cleanedFlag: true, returnWb: true });
        if (wbAfter) zip.file("2_CLEANED-after_" + stamp + ".xlsx", XLSX.write(wbAfter, { bookType: "xlsx", type: "base64" }), { base64: true });
      } catch (e) {}
    }

    zip.generateAsync({ type: "blob" }).then(function (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = zipName;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      renderTable(state.currentTab);
      updateCoach();
      alert("✔ Done — your originals are untouched.\n\nDownloaded: " + zipName +
            "\nInside: the cleaned XER file(s), two Excel reports (problems + cleaned), and the import checklist.\n\n" +
            totalStripped + " tie(s) removed:\n" + summary);
    }).catch(function () {
      alert("Could not build the zip. Try again, or use Export report (Excel).");
    });
  }

  function renderTable(tab) {
    state.currentTab = tab;
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    let rows = [];
    if (tab === "all") rows = state.flagged;
    else if (tab === "problems") rows = state.flagged.filter(r => ["Extra","Suspected Copy","Orphan"].includes(r.flag));
    else if (tab === "removed") rows = state.removed;
    else if (tab === "kept") rows = state.kept;

    const tbody = document.querySelector("#results-table tbody");
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:#666;">
        No rows in this category.<br>
        If Master Ties is 0, the short name does not match the name inside the XER — click a blue name button and Scan again.
      </td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => {
      const predName = r.pred_activity ? (r.pred_activity.task_code + " – " + r.pred_activity.task_name) : r.pred_task_id;
      const succName = r.succ_activity ? (r.succ_activity.task_code + " – " + r.succ_activity.task_name) : r.task_id;
      return `<tr>
        <td><span class="flag flag-${r.flag}">${r.flag}</span></td>
        <td>${escapeHtml(r.flag_reason)}</td>
        <td>${escapeHtml(r.pred_activity ? r.pred_activity.project_name : r.pred_project_id)}</td>
        <td>${escapeHtml(predName)}</td>
        <td>${r.pred_type}</td>
        <td>${r.lag_hr_cnt}</td>
        <td>${escapeHtml(r.succ_activity ? r.succ_activity.project_name : r.succ_project_id)}</td>
        <td>${escapeHtml(succName)}</td>
      </tr>`;
    }).join("");
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function exportExcel(opts) {
    if (typeof XLSX === "undefined") {
      alert("Excel library not loaded.");
      return;
    }
    opts = (opts && typeof opts === "object" && !opts.type) ? opts : {};
    const flaggedData = opts.flagged || state.flagged;
    const removedData = opts.removed || state.removed;
    const keptData = opts.kept || state.kept;
    const forceCleaned = opts.cleanedFlag === true;
    const wb = XLSX.utils.book_new();
    const now = new Date();
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const dayName = days[now.getDay()];
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8);
    const tmp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);

    const counts = {};
    flaggedData.forEach(r => { counts[r.flag] = (counts[r.flag] || 0) + 1; });
    const foundNames = Object.values(state.projects).map(p => p.proj_short_name).filter(Boolean);
    const uniqueFound = [...new Set(foundNames)];
    const masterNames = getMasterNames();
    const matched = masterNames.filter(n => uniqueFound.some(f => f.toLowerCase() === n.toLowerCase()));

    const cleaned = forceCleaned || (removedData && removedData.length > 0);
    if (!state.auditId) state.auditId = "LG-" + now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const reportType = cleaned
      ? "CLEANED-RESULT REPORT (after removing unwanted ties)"
      : "LOGIC AUDIT — PROBLEMS REPORT (before cleaning)";
    const BRAND = "XER Logic-Guard  ·  AMELIE·AI  ·  amelie.ai.support@gmail.com";

    const guide = [
      [BRAND],
      ["XER LOGIC-GUARD — " + reportType],
      ["Protect master schedule logic · Ordinary P6 (Professional) and EPS/EPPM · Offline"],
      ["Audit ID", state.auditId + "   (this ID also stamps the cleaned package so the pair can be proven to match)"],
      [""],
      ["HOW TO READ THIS REPORT"],
      ["1. Cover sheet", "Title, support email, date/time, counts, what you typed vs what was in the file"],
      ["2. All Master Ties", "Every relationship that touches the master"],
      ["3. Problems Only", "Extra = not on safe list or rogue link to master internal activity; Suspected Copy = same Activity ID in 2+ projects; Orphan = target project missing"],
      ["4. Removed", "Ties marked for removal after Clean"],
      ["5. Kept Clean", "Ties kept (Approved / internal)"],
      [""],
      ["Report type", cleaned ? "CLEANED RESULT — " + removedData.length + " tie(s) removed; rogue ties gone from the cleaned files" : "PROBLEMS AUDIT — problems found, nothing removed yet"],
      ["Product", "XER Logic-Guard (AMELIE·AI)"],
      ["Support email", "amelie.ai.support@gmail.com"],
      ["Day", dayName],
      ["Date", dateStr],
      ["Week number (ISO)", weekNo],
      ["Time", timeStr],
      [""],
      ["Files loaded", [...state.masterFiles, ...state.projectFiles].map(f => f.name).join("; ") || "(none)"],
      ["Project short names FOUND INSIDE the XER file(s)", uniqueFound.join(", ") || "(none)"],
      ["Master short name YOU TYPED", masterNames.join(", ") || "(none)"],
      ["Master name MATCHED?", matched.length ? "YES – " + matched.join(", ") : "NO – this is why Master Ties can be 0"],
      ["Safe list YOU TYPED", getSafeList().join(", ") || "(none)"],
      [""],
      ["Projects loaded", Object.keys(state.projects).length],
      ["Activities loaded", Object.keys(state.activities).length],
      ["Master relationships found", state.flagged.length],
      ["Extra", counts["Extra"] || 0],
      ["Suspected Copy", counts["Suspected Copy"] || 0],
      ["Orphan", counts["Orphan"] || 0],
      ["Approved", counts["Approved"] || 0],
      ["Removed (after clean)", removedData.length],
      ["Kept (after clean)", keptData.length],
      [""],
      ["IMPORTANT", "The master short name must equal the Project Short Name inside P6/XER (e.g. PROJECT_A), NOT the Windows file name (PROJECT_A_RevA.xer) and NOT a name you invent (MASTER_RevA)."]
    ];
    const wsCover = XLSX.utils.aoa_to_sheet(guide);
    wsCover["!cols"] = [{ wch: 45 }, { wch: 80 }];
    (function styleCover() {
      const NAVY = "1F4E79", WHITE = "FFFFFF";
      const s = (ref, st) => { if (wsCover[ref]) wsCover[ref].s = st; };
      s("A1", { font: { bold: true, color: { rgb: WHITE }, sz: 12 }, fill: { fgColor: { rgb: NAVY } } });
      s("A2", { font: { bold: true, color: { rgb: NAVY }, sz: 12 } });
      s("A3", { font: { italic: true, color: { rgb: "555555" } } });
      wsCover["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }
      ];
      wsCover["!rows"] = [{ hpt: 20 }];
      const rng = XLSX.utils.decode_range(wsCover["!ref"]);
      for (let r = 4; r <= rng.e.r; r++) {
        const k = XLSX.utils.encode_cell({ r, c: 0 });
        if (wsCover[k]) wsCover[k].s = { font: { bold: true, color: { rgb: NAVY } } };
      }
    })();
    XLSX.utils.book_append_sheet(wb, wsCover, "Cover");

    function addSheet(rels, name) {
      const data = rels.map(r => ({
        Flag: r.flag,
        Reason: r.flag_reason,
        "Pred Project": r.pred_activity ? r.pred_activity.project_name : r.pred_project_id,
        "Pred Activity ID": r.pred_activity ? r.pred_activity.task_code : r.pred_task_id,
        "Pred Activity Name": r.pred_activity ? r.pred_activity.task_name : "",
        Type: r.pred_type,
        "Lag (hrs)": r.lag_hr_cnt,
        "Succ Project": r.succ_activity ? r.succ_activity.project_name : r.succ_project_id,
        "Succ Activity ID": r.succ_activity ? r.succ_activity.task_code : r.task_id,
        "Succ Activity Name": r.succ_activity ? r.succ_activity.task_name : ""
      }));
      const rows = data.length ? data : [{ Flag: "—", Reason: "No relationships in this category." }];
      const ws = XLSX.utils.aoa_to_sheet([
        [BRAND],
        ["XER Logic-Guard — " + name + "  ·  " + reportType + "  ·  " + dateStr],
        []
      ]);
      XLSX.utils.sheet_add_json(ws, rows, { origin: "A4" });
      ws["!cols"] = [
        { wch: 16 }, { wch: 60 }, { wch: 18 }, { wch: 16 }, { wch: 28 },
        { wch: 8 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 28 }
      ];
      styleAuditSheet(ws);
      XLSX.utils.book_append_sheet(wb, ws, name);
    }

    // ---- professional styling (needs xlsx-js-style) ----
    function styleAuditSheet(ws) {
      if (!ws["!ref"]) return;
      const NAVY = "1F4E79", LIGHT = "E8F0FE", WHITE = "FFFFFF";
      const flagFill = { "Extra": "F8D7DA", "Suspected Copy": "FFF3CD", "Orphan": "E2E3E5", "Approved": "D4EDDA" };
      const flagText = { "Extra": "842029", "Suspected Copy": "664D03", "Orphan": "41464B", "Approved": "0F5132" };
      const thin = { style: "thin", color: { rgb: "CCCCCC" } };
      const box = { top: thin, bottom: thin, left: thin, right: thin };
      const NCOL = 10;
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const set = (r, c, s) => { const k = XLSX.utils.encode_cell({ r, c }); if (ws[k]) ws[k].s = s; };
      // banner + report line (merged)
      set(0, 0, { font: { bold: true, color: { rgb: WHITE }, sz: 12 }, fill: { fgColor: { rgb: NAVY } }, alignment: { vertical: "center" } });
      set(1, 0, { font: { bold: true, color: { rgb: NAVY }, sz: 11 } });
      ws["!merges"] = (ws["!merges"] || []).concat([
        { s: { r: 0, c: 0 }, e: { r: 0, c: NCOL - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: NCOL - 1 } }
      ]);
      ws["!rows"] = [{ hpt: 20 }, { hpt: 16 }];
      // column header row (row index 3)
      for (let c = 0; c < NCOL; c++) set(3, c, { font: { bold: true, color: { rgb: NAVY } }, fill: { fgColor: { rgb: LIGHT } }, border: box, alignment: { vertical: "center", wrapText: false } });
      // data rows: borders + flag colour-coding
      for (let r = 4; r <= range.e.r; r++) {
        for (let c = 0; c < NCOL; c++) {
          const k = XLSX.utils.encode_cell({ r, c });
          if (!ws[k]) continue;
          ws[k].s = { border: box, alignment: { vertical: "top", wrapText: c === 1 } };
        }
        const fk = XLSX.utils.encode_cell({ r, c: 0 });
        if (ws[fk] && flagFill[ws[fk].v]) ws[fk].s = { font: { bold: true, color: { rgb: flagText[ws[fk].v] } }, fill: { fgColor: { rgb: flagFill[ws[fk].v] } }, border: box, alignment: { vertical: "top" } };
      }
      ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3, c: NCOL - 1 } }) };
    }

    addSheet(flaggedData, "All Master Ties");
    addSheet(flaggedData.filter(r => ["Extra","Suspected Copy","Orphan"].includes(r.flag)), cleaned ? "Problems (now removed)" : "Problems Only");
    addSheet(removedData, "Removed");
    addSheet(keptData, "Kept Clean");

    const fileTag = cleaned ? "CLEANED-RESULT" : "PROBLEMS-AUDIT";
    if (opts.returnWb) return wb;
    state.lastWorkbook = wb;
    updateCleanGate();
    XLSX.writeFile(wb, "XER_Logic-Guard_" + fileTag + "_" + dateStr + "_Wk" + weekNo + ".xlsx");
  }

  function openHelp() {
    document.getElementById("help-modal").classList.add("is-open");
  }
  function closeHelp() {
    document.getElementById("help-modal").classList.remove("is-open");
  }
  function doPrint() {
    const tab = state.currentTab;
    let rows = [];
    if (tab === "all") rows = state.flagged;
    else if (tab === "problems") rows = state.flagged.filter(r => ["Extra","Suspected Copy","Orphan"].includes(r.flag));
    else if (tab === "removed") rows = state.removed;
    else if (tab === "kept") rows = state.kept;
    const n = rows.length;
    const PRINT_CAP = 40;

    let mode = "all";
    if (n > PRINT_CAP) {
      const ok = confirm(
        "There are " + n + " rows in this view.\n\n" +
        "OK = Print first " + PRINT_CAP + " rows + note (fast)\n" +
        "Cancel = Summary counts only (fastest)\n\n" +
        "Full list is always in the Excel export."
      );
      mode = ok ? "capped" : "summary";
    }

    const res = document.getElementById("results");
    if (res) res.hidden = false;
    const note = document.getElementById("print-cap-note");
    const tbody = document.querySelector("#results-table tbody");
    let savedHtml = tbody ? tbody.innerHTML : "";

    document.body.classList.remove("print-summary-only", "print-capped");

    // Self-identifying print header: name the SECTION (tab) actually being printed
    const cleaned = state.removed && state.removed.length > 0;
    const tabNames = { all: "All Master Ties (includes Approved internal logic)", problems: "Problems Only", removed: "Removed ties", kept: "Kept (Clean)" };
    const sectionName = tabNames[tab] || tab;
    const pt = document.getElementById("print-title");
    const ps = document.getElementById("print-sub");
    if (pt) pt.textContent = "Section: " + sectionName +
      "   —   " + (cleaned ? "CLEANED-RESULT report" : "PROBLEMS-AUDIT report");
    if (ps) {
      const c = {}; state.flagged.forEach(r => { c[r.flag] = (c[r.flag] || 0) + 1; });
      const masterNames = getMasterNames();
      ps.textContent =
        "Master: " + (masterNames.join(", ") || "(none)") +
        "  ·  Printing " + n + " row(s) from “" + sectionName.replace(/ \(.*/, "") + "”" +
        "  ·  Totals: Extra " + (c["Extra"] || 0) + " · Suspected Copy " + (c["Suspected Copy"] || 0) +
        " · Orphan " + (c["Orphan"] || 0) + " · Approved " + (c["Approved"] || 0) +
        (cleaned ? " · Removed " + state.removed.length : "") +
        "  ·  " + new Date().toISOString().slice(0, 10);
    }

    if (mode === "summary") {
      document.body.classList.add("print-summary-only");
      if (note) note.textContent = "";
    } else if (mode === "capped" && tbody) {
      document.body.classList.add("print-capped");
      const trs = tbody.querySelectorAll("tr");
      for (let i = PRINT_CAP; i < trs.length; i++) trs[i].style.display = "none";
      if (note) {
        note.style.display = "block";
        note.textContent =
          "Print shows first " + PRINT_CAP + " of " + n +
          " rows. Full list is in Export Excel Report.";
      }
    }

    // allow layout to settle — avoid long Chromium pagination
    const _savedTitle = document.title;
    const _d = new Date().toISOString().slice(0, 10);
    document.title = (cleaned ? "XER_Logic-Guard_CLEANED-RESULT_" : "XER_Logic-Guard_PROBLEMS-AUDIT_") +
      _d + (mode === "summary" ? "_summary" : "");
    setTimeout(() => {
      window.print();
      document.title = _savedTitle;
      document.body.classList.remove("print-summary-only", "print-capped");
      if (tbody && savedHtml) tbody.innerHTML = savedHtml;
      if (note) {
        note.textContent = "";
        note.style.display = "none";
      }
    }, 50);
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupDropZone("master-zone", "master-input", "master-list", true);
    setupDropZone("project-zone", "project-input", "project-list", false);

    document.getElementById("btn-clear-master").addEventListener("click", (e) => { e.stopPropagation(); clearZone(true); });
    document.getElementById("btn-clear-projects").addEventListener("click", (e) => { e.stopPropagation(); clearZone(false); });
    document.getElementById("btn-scan").addEventListener("click", runScan);
    document.getElementById("btn-download-clean").addEventListener("click", downloadCleanedXer);
    document.getElementById("btn-excel").addEventListener("click", (e) => { e.preventDefault(); exportExcel(); });
    document.getElementById("btn-print").addEventListener("click", (e) => { e.preventDefault(); doPrint(); });
    document.getElementById("btn-reset").addEventListener("click", (e) => { e.preventDefault(); resetResults(); });
    document.getElementById("btn-help").addEventListener("click", openHelp);
    document.getElementById("help-close").addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); closeHelp(); });
    document.getElementById("help-modal").addEventListener("click", (e) => { if (e.target.id === "help-modal") closeHelp(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeHelp(); });

    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => renderTable(tab.dataset.tab));
    });

    // Safe-list reset: back to zero-trust (master only)
    const trustMasterBtn = document.getElementById("btn-trust-master");
    if (trustMasterBtn) trustMasterBtn.addEventListener("click", () => {
      const ta = document.getElementById("approved-list");
      if (!ta) return;
      ta.value = getMasterNames().join("\n");
      try { localStorage.setItem("lg_safe_list", ta.value); } catch (e) {}
      renderSafePicker(state.lastFoundNames);
      alert("Back to ZERO-TRUST: master only. Every tie into your master will be flagged. Click CHECK FILES.");
    });

    // Persist the safe list so repeat users don't re-type their trusted contractors
    (function persistSafeList() {
      const ta = document.getElementById("approved-list");
      if (!ta) return;
      try {
        const saved = localStorage.getItem("lg_safe_list");
        if (saved && !ta.value.trim()) ta.value = saved;
      } catch (e) {}
      ta.addEventListener("input", () => {
        try { localStorage.setItem("lg_safe_list", ta.value); } catch (e) {}
      });
    })();

    updateCoach(); // show the first step immediately
  });
})();
