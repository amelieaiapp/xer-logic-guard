/**
 * XER Logic-Guard – XER Parser
 * Ordinary P6 (Professional) + EPS/EPPM.
 * Multi-encoding: UTF-8, Windows-1252, Windows-1251 (Cyrillic), Windows-1256 (Arabic).
 */
window.XerParser = (function () {

  function parseXerText(text) {
    const lines = text.split(/\r?\n/);
    const tables = {};
    let currentTable = null;
    let currentFields = [];

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line) continue;

      if (line.startsWith("%T")) {
        currentTable = line.substring(2).trim();
        tables[currentTable] = { fields: [], rows: [] };
        currentFields = [];
      } else if (line.startsWith("%F") && currentTable) {
        currentFields = line.substring(2).split("\t").map(f => f.trim());
        tables[currentTable].fields = currentFields;
      } else if (line.startsWith("%R") && currentTable) {
        const values = line.substring(2).split("\t");
        const row = {};
        currentFields.forEach((field, i) => {
          row[field] = values[i] !== undefined ? values[i] : "";
        });
        tables[currentTable].rows.push(row);
      } else if (line.startsWith("%E")) {
        currentTable = null;
        currentFields = [];
      }
    }
    return tables;
  }

  function getProjectShortName(row) {
    return (
      row.export_proj_short_name ||
      row.proj_short_name ||
      row.PROJ_SHORT_NAME ||
      row.EXPORT_PROJ_SHORT_NAME ||
      row.proj_id ||
      ""
    ).trim();
  }

  function getField(row, names) {
    for (const n of names) {
      if (row[n] !== undefined && row[n] !== "") return row[n];
    }
    return "";
  }

  function buildFromTables(tables) {
    const projects = {};
    const activities = {};
    const relationships = [];
    const projectIdToName = {};

    if (tables.PROJECT) {
      for (const r of tables.PROJECT.rows) {
        const id = getField(r, ["proj_id", "PROJ_ID"]);
        const shortName = getProjectShortName(r);
        projects[id] = {
          proj_id: id,
          proj_short_name: shortName,
          proj_name: getField(r, ["proj_name", "PROJ_NAME"]) || shortName,
          is_master: false
        };
        projectIdToName[id] = shortName;
      }
    }

    if (tables.TASK) {
      for (const r of tables.TASK.rows) {
        const taskId = getField(r, ["task_id", "TASK_ID"]);
        const projId = getField(r, ["proj_id", "PROJ_ID"]);
        activities[taskId] = {
          task_id: taskId,
          task_code: getField(r, ["task_code", "TASK_CODE"]) || taskId,
          task_name: getField(r, ["task_name", "TASK_NAME"]) || "",
          proj_id: projId,
          project_name: projectIdToName[projId] || projId,
          status_code: getField(r, ["status_code", "STATUS_CODE"]) || ""
        };
        if (projects[projId]) {
          if (!projects[projId].activity_ids) projects[projId].activity_ids = new Set();
          projects[projId].activity_ids.add(taskId);
        }
      }
    }

    if (tables.TASKPRED) {
      for (const r of tables.TASKPRED.rows) {
        const predId = getField(r, ["pred_task_id", "PRED_TASK_ID"]);
        const succId = getField(r, ["task_id", "TASK_ID"]);
        const predAct = activities[predId];
        const succAct = activities[succId];
        relationships.push({
          pred_task_id: predId,
          task_id: succId,
          pred_type: (getField(r, ["pred_type", "PRED_TYPE"]) || "PR_FS").replace("PR_", ""),
          lag_hr_cnt: parseFloat(getField(r, ["lag_hr_cnt", "LAG_HR_CNT"]) || 0) || 0,
          pred_project_id: getField(r, ["pred_proj_id", "PRED_PROJ_ID"]) || (predAct ? predAct.proj_id : ""),
          succ_project_id: getField(r, ["proj_id", "PROJ_ID"]) || (succAct ? succAct.proj_id : ""),
          pred_activity: predAct || null,
          succ_activity: succAct || null,
          relationship_id: getField(r, ["task_pred_id", "TASK_PRED_ID"]) || "",
          flag: "Unknown",
          flag_reason: ""
        });
      }
    }

    return { projects, activities, relationships, projectIdToName, tables };
  }

  async function parseFile(file) {
    let text;
    let encodingInfo = { encoding: "utf-8", confidence: "unknown" };
    if (window.XerEncoding && window.XerEncoding.readFileAsText) {
      const result = await window.XerEncoding.readFileAsText(file);
      text = result.text;
      encodingInfo = { encoding: result.encoding, confidence: result.confidence };
    } else {
      try {
        text = await file.text();
      } catch (e) {
        const buf = await file.arrayBuffer();
        text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      }
    }
    const tables = parseXerText(text);
    const built = buildFromTables(tables);
    built._originalText = text;
    built._fileName = file.name;
    built._encoding = encodingInfo;
    return built;
  }



  // Surgical clean: remove only the specific TASKPRED rows the audit flagged (by
  // task_id|pred_task_id), from whichever file actually contains them. Keeps every other
  // relationship — including the file's own internal logic and approved interfaces.
  function stripFlaggedTies(originalText, stripKeySet) {
    const lines = originalText.split(/\r?\n/);
    const out = [];
    let currentTable = "";
    let predFields = [];
    let stripped = 0, kept = 0;
    for (const raw of lines) {
      const trimmed = raw.trimEnd();
      if (trimmed.startsWith("%T")) { currentTable = trimmed.substring(2).trim(); out.push(raw); continue; }
      if (currentTable === "TASKPRED" && trimmed.startsWith("%F")) {
        predFields = trimmed.substring(2).split("\t").map(f => f.trim()); out.push(raw); continue;
      }
      if (currentTable === "TASKPRED" && trimmed.startsWith("%R")) {
        const values = trimmed.substring(2).split("\t");
        const iT = predFields.indexOf("task_id");
        const iP = predFields.indexOf("pred_task_id");
        const iType = predFields.indexOf("pred_type");
        const typeNorm = iType >= 0 ? String(values[iType] || "").replace(/^PR_/, "") : "";
        const key = (iT >= 0 ? (values[iT] || "") : "") + "|" + (iP >= 0 ? (values[iP] || "") : "") + "|" + typeNorm;
        if (stripKeySet.has(key)) { stripped++; continue; }
        kept++; out.push(raw); continue;
      }
      out.push(raw);
    }
    return { text: out.join("\n"), stripped, kept };
  }

  return {
    parseFile,
    parseXerText,
    buildFromTables,
    stripFlaggedTies,
    getProjectShortName
  };
})();
