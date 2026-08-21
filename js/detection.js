/* XER Logic-Guard detection — Rev 1.17.0
   Zero-trust: flags every tie from a received file that touches the master (Extra),
   duplicate Activity IDs across projects (Suspected Copy), and links to unloaded projects
   (Orphan). Handles FS/SS/FF/SF. Cleaning is surgical and type-aware (in xer-parser). */
/**
 * XER Logic-Guard – Detection Engine
 * Rules:
 *  - Internal master ↔ master = Approved
 *  - External ↔ master CM-* interface = Approved if project on safe list
 *  - External ↔ master INTERNAL (non-CM) activity = always Extra (rogue)
 *  - External project not on safe list = Extra
 *  - No safe list at all = all external ties Extra (must review)
 *  - Missing target project = Orphan
 *  - Same activity code in multiple projects = Suspected Copy
 *  - No more "Unknown" that hides from Problems tab
 */
window.LogicGuardDetection = (function () {

  function buildMasterActivitySet(projects, activities, masterNames) {
    const set = new Set();
    const nameSet = new Set((masterNames || []).map(n => String(n).trim().toLowerCase()).filter(Boolean));

    Object.values(projects).forEach(p => {
      const isMaster =
        nameSet.has(String(p.proj_short_name || "").toLowerCase()) ||
        nameSet.has(String(p.proj_id || "").toLowerCase());
      p.is_master = isMaster;
    });

    Object.values(activities).forEach(a => {
      const p = projects[a.proj_id];
      if (p && p.is_master) set.add(a.task_id);
    });
    return set;
  }

  let INTERFACE_PREFIXES = ["CM", "IF", "HO", "MS", "HOLD", "GATE", "KD"];
  const INTERFACE_WORDS = ["INTERFACE", "HANDOVER", "MILESTONE", "KEYDATE", "HOLDPOINT"];
  function setInterfaceCodes(list) {
    if (!Array.isArray(list)) return;
    const extra = list.map(s => String(s).trim().toUpperCase()).filter(Boolean);
    const base = ["CM", "IF", "HO", "MS", "HOLD", "GATE", "KD"];
    INTERFACE_PREFIXES = [...new Set(base.concat(extra))];
  }
  function isInterfaceActivity(act) {
    if (!act) return false;
    const code = String(act.task_code || act.task_id || "").toUpperCase();
    // starts with a known interface prefix immediately followed by a number (CM-01, IF02, MS-100)
    if (INTERFACE_PREFIXES.some(tok =>
      new RegExp("^" + tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[-_ ]?\\d").test(code))) return true;
    // or contains one of the long, unambiguous interface words anywhere
    return INTERFACE_WORDS.some(w => code.indexOf(w) >= 0);
  }

  function activityCodeToProjects(activities) {
    const map = {};
    Object.values(activities).forEach(a => {
      const code = a.task_code || a.task_id;
      if (!map[code]) map[code] = new Set();
      map[code].add(a.proj_id);
    });
    return map;
  }

  /** Re-attach activity objects after all XERs are merged */
  function relink(relationships, activities, projects) {
    relationships.forEach(rel => {
      rel.pred_activity = activities[rel.pred_task_id] || null;
      rel.succ_activity = activities[rel.task_id] || null;
      if (rel.pred_activity) {
        rel.pred_project_id = rel.pred_project_id || rel.pred_activity.proj_id;
      }
      if (rel.succ_activity) {
        rel.succ_project_id = rel.succ_project_id || rel.succ_activity.proj_id;
      }
      // Prefer human short names for display
      if (rel.pred_activity && projects[rel.pred_activity.proj_id]) {
        rel.pred_activity.project_name = projects[rel.pred_activity.proj_id].proj_short_name;
      }
      if (rel.succ_activity && projects[rel.succ_activity.proj_id]) {
        rel.succ_activity.project_name = projects[rel.succ_activity.proj_id].proj_short_name;
      }
    });
  }

  function detect(relationships, projects, activities, masterNames, approvedList) {
    relink(relationships, activities, projects);

    const masterActs = buildMasterActivitySet(projects, activities, masterNames);
    const codeToProjs = activityCodeToProjects(activities);
    const approved = new Set(
      (approvedList || [])
        .flatMap(s => String(s).split(/[,\n]/))
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
    );

    const flagged = [];

    relationships.forEach(rel => {
      const predIsMaster = masterActs.has(rel.pred_task_id);
      const succIsMaster = masterActs.has(rel.task_id);

      // Orphan – the relationship references a project that is NOT in the loaded files
      // (deleted or renamed EPS/project). This is checked for every relationship, whether or
      // not it touches the master, because contractor logic left pointing at a gone project is
      // a defect in its own right.
      const predProjId = rel.pred_project_id || (rel.pred_activity && rel.pred_activity.proj_id) || "";
      const succProjId = rel.succ_project_id || (rel.succ_activity && rel.succ_activity.proj_id) || "";
      const predProjMissing = predProjId && !projects[predProjId];
      const succProjMissing = succProjId && !projects[succProjId];
      if (predProjMissing || succProjMissing) {
        rel.flag = "Orphan";
        const goneId = predProjMissing ? predProjId : succProjId;
        rel.flag_reason =
          "Points at project '" + goneId + "' which is NOT loaded. " +
          "If that is your master or another contract you have, load it and re-scan. " +
          "If it no longer exists, this is orphan logic to a deleted/renamed EPS/project.";
        flagged.push(rel);
        return;
      }

      // Pure non-master internal – skip (not a master tie)
      if (!predIsMaster && !succIsMaster) return;

      // Both master = internal
      if (predIsMaster && succIsMaster) {
        rel.flag = "Approved";
        rel.flag_reason = "Internal master relationship";
        flagged.push(rel);
        return;
      }

      // One side master, one side external
      let externalProjId = "";
      let externalAct = null;
      let masterAct = null;

      if (predIsMaster && !succIsMaster) {
        masterAct = rel.pred_activity;
        externalProjId = rel.succ_project_id || (rel.succ_activity && rel.succ_activity.proj_id) || "";
        externalAct = rel.succ_activity;
      } else {
        masterAct = rel.succ_activity;
        externalProjId = rel.pred_project_id || (rel.pred_activity && rel.pred_activity.proj_id) || "";
        externalAct = rel.pred_activity;
      }

      // Orphan – target project missing from loaded set
      if (!externalProjId || !projects[externalProjId]) {
        // If the other side activity is missing but proj id points at master, treat as internal orphan activity
        const masterProjIds = new Set(
          Object.values(projects).filter(p => p.is_master).map(p => String(p.proj_id))
        );
        if (externalProjId && masterProjIds.has(String(externalProjId))) {
          rel.flag = "Approved";
          rel.flag_reason = "Same master project (activity may only exist in one of the loaded revisions)";
          flagged.push(rel);
          return;
        }
        rel.flag = "Orphan";
        rel.flag_reason = "Target project '" + (externalProjId || "?") + "' not found in loaded files";
        flagged.push(rel);
        return;
      }

      const extProj = projects[externalProjId];
      const extName = String(extProj.proj_short_name || "").toLowerCase();
      const extId = String(extProj.proj_id || "").toLowerCase();

      // SAME PROJECT as master → always internal (never Extra/rogue)
      if (extProj.is_master) {
        rel.flag = "Approved";
        rel.flag_reason = "Internal master relationship (same project)";
        flagged.push(rel);
        return;
      }

      const onSafeList = approved.size > 0 && (approved.has(extName) || approved.has(extId));

      // ROGUE: external project linked to master INTERNAL activity (not CM/interface)
      if (masterAct && !isInterfaceActivity(masterAct)) {
        rel.flag = "Extra";
        rel.flag_reason =
          "WILL CORRUPT MASTER: '" + extProj.proj_short_name +
          "' links into your master INTERNAL activity '" +
          (masterAct.task_code || masterAct.task_id) +
          "' (not an agreed interface/CM point). Importing this creates that logic in your master.";
        flagged.push(rel);
        return;
      }

      // No safe list → every external tie is Extra until user defines one
      if (approved.size === 0) {
        rel.flag = "Extra";
        rel.flag_reason =
          "TIE INTO YOUR MASTER: '" + extProj.proj_short_name +
          "' links to a master interface point. Importing adds a successor to your master here — verify it is the agreed interface before importing.";
        flagged.push(rel);
        return;
      }

      // Safe list present but this project not on it
      if (!onSafeList) {
        rel.flag = "Extra";
        rel.flag_reason =
          "TIE INTO YOUR MASTER: '" + extProj.proj_short_name +
          "' is not a formally-agreed interface. Importing adds this link to your master — verify before importing.";
        flagged.push(rel);
        return;
      }

      // (Duplicate Activity IDs are handled by the standalone Suspected Copy scan below,
      //  independent of whether the duplicated activity sits in a master tie.)

      // On safe list + interface point = Approved
      rel.flag = "Approved";
      rel.flag_reason = "Formally-agreed interface with '" + extProj.proj_short_name + "' (you signed this off in the safe list).";
      flagged.push(rel);
    });

    // ---- Standalone Suspected Copy scan ----
    // A duplicate Activity ID (same task_code in more than one project) is a copy artefact
    // wherever it sits — it does not need to be inside a master tie to be a problem. Each
    // duplicated code is reported once, listing the projects it appears in.
    const actsByCode = {};
    Object.values(activities).forEach(a => {
      const code = a.task_code || a.task_id;
      if (!code) return;
      (actsByCode[code] = actsByCode[code] || []).push(a);
    });
    Object.keys(actsByCode).forEach(code => {
      // one representative activity per project for this code
      const reps = [];
      actsByCode[code].forEach(a => {
        const pn = projects[a.proj_id] ? projects[a.proj_id].proj_short_name : String(a.proj_id || "?");
        if (!reps.some(r => r.project_name === pn)) {
          reps.push({
            task_code: a.task_code || a.task_id,
            task_id: a.task_id,
            task_name: a.task_name || "",
            proj_id: a.proj_id,
            project_name: pn
          });
        }
      });
      if (reps.length < 2) return; // present in only one project – fine
      const projNames = reps.map(r => r.project_name);
      const masterSet = new Set((masterNames || []).map(m => String(m).toLowerCase()));
      const hitsMaster = projNames.some(pn => masterSet.has(String(pn).toLowerCase()));
      const reason = hitsMaster
        ? "OVERWRITE RISK: Activity ID '" + code + "' exists in your MASTER and also in " +
          projNames.filter(pn => !masterSet.has(String(pn).toLowerCase())).join(", ") +
          ". Importing could overwrite your master activity. Rename the contractor's activity in P6 before importing."
        : "Activity ID '" + code + "' appears in " + reps.length + " projects (" +
          projNames.join(", ") + ") — retained from a project copy. Rename in P6 so IDs are unique.";
      flagged.push({
        flag: "Suspected Copy",
        flag_reason: reason,
        pred_activity: reps[0],
        succ_activity: reps[1],
        pred_project_id: reps[0].proj_id,
        succ_project_id: reps[1].proj_id,
        pred_task_id: reps[0].task_id,
        task_id: reps[1].task_id,
        pred_type: "DUP-ID",
        lag_hr_cnt: "",
        duplicate_of: projNames.join(", "),
        synthetic: true
      });
    });

    return { flagged };
  }

  return { detect, buildMasterActivitySet, isInterfaceActivity, relink, setInterfaceCodes };
})();
