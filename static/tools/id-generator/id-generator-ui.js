
  (function () {
    const api = globalThis.RitsuLibEntryId;
    const library = document.getElementById("entryIdLibrary");
    const baseLibFields = document.getElementById("entryIdBaseLibFields");
    const ritsuLibFields = document.getElementById("entryIdRitsuLibFields");
    const namespaceInput = document.getElementById("entryIdNamespace");
    const modId = document.getElementById("entryIdModId");
    const modelType = document.getElementById("entryIdModelType");
    const namesInput = document.getElementById("entryIdNames");
    const importBtn = document.getElementById("entryIdImport");
    const importInput = document.getElementById("entryIdImportInput");
    const error = document.getElementById("entryIdError");
    const final = document.getElementById("entryIdFinal");
    const copy = document.getElementById("entryIdCopy");

    if (!api || !library || !baseLibFields || !ritsuLibFields || !namespaceInput || !modId || !modelType || !namesInput || !importBtn || !importInput || !error || !final || !copy) {
      return;
    }

    const storageKey = "sts2modding:id-generator:state";

    const modelTypes = [
      "afflicition",
      "card",
      "cardpile",
      "cardtag",
      "character",
      "enchantment",
      "encounter",
      "event",
      "keyword",
      "modelcapability",
      "modifier",
      "monster",
      "orb",
      "poolfilter",
      "potion",
      "power",
      "relic",
      "reward",
      "targettype",
      "topbarbutton",
    ];

    // Suffix templates derived from sts2 localization (zhs)
    // Categories not listed fall back to default ["title", "description"]
    const suffixTemplates = {
      CARDPILE: ["title"],
      ENCOUNTER: ["title", "loss"],
      EVENT: ["title", "pages.INITIAL.description"],
      MONSTER: ["name"],
      POWER: ["title", "description", "smartDescription"],
      RELIC: ["title", "description", "flavor"],
    };

    // BaseLib has no category notion — assume general entries with title+description
    const baseLibSuffixes = ["title", "description"];

    modelType.replaceChildren(...modelTypes.map((type) => {
      const option = document.createElement("option");
      option.value = type.toUpperCase();
      option.textContent = type.toUpperCase();
      return option;
    }));

    restoreState();

    [library, namespaceInput, modId, modelType, namesInput].forEach((control) => {
      control.addEventListener("input", update);
      control.addEventListener("change", update);
    });

    copy.addEventListener("click", async () => {
      const value = final.textContent || "";
      if (!value) return;

      try {
        await navigator.clipboard.writeText(value);
        copy.textContent = "已复制";
      } catch (ex) {
        copy.textContent = "复制失败";
      }

      setTimeout(() => {
        copy.textContent = "复制";
      }, 1200);
    });

    importBtn.addEventListener("click", () => importInput.click());

    importInput.addEventListener("change", () => {
      const files = Array.from(importInput.files || []);
      if (files.length === 0) return;

      const stems = [];
      for (const f of files) {
        const path = (f.webkitRelativePath || f.name || "").replace(/\\/g, "/");
        const base = path.split("/").pop() || "";
        // Only .cs files; ignore .uid, .import, .meta, etc.
        if (!/\.cs$/i.test(base)) continue;
        const stem = base.slice(0, -3);
        if (stem.length > 0) stems.push(stem);
      }

      const existing = new Set(
        namesInput.value.split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length > 0)
      );

      const added = [];
      for (const stem of stems) {
        if (existing.has(stem)) continue;
        existing.add(stem);
        added.push(stem);
      }

      if (added.length === 0) {
        importBtn.textContent = "无新条目";
      } else {
        const prefix = namesInput.value.length > 0 && !namesInput.value.endsWith("\n") ? "\n" : "";
        namesInput.value = namesInput.value + prefix + added.join("\n");
        importBtn.textContent = `已导入 ${added.length} 项`;
        update();
      }

      importInput.value = "";
      setTimeout(() => { importBtn.textContent = "导入文件夹"; }, 1500);
    });

    render();

    function update() {
      saveState();
      render();
    }

    function saveState() {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          library: library.value,
          namespace: namespaceInput.value,
          modId: modId.value,
          modelType: modelType.value,
          names: namesInput.value,
        }));
      } catch (ex) {}
    }

    function restoreState() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;

        const state = JSON.parse(raw);
        setControlValue(library, state.library);
        setControlValue(namespaceInput, state.namespace);
        setControlValue(modId, state.modId);
        setControlValue(modelType, state.modelType);
        if (typeof state.names === "string") namesInput.value = state.names;
      } catch (ex) {}
    }

    function setControlValue(control, value) {
      if (typeof value !== "string") return;
      if (control.tagName === "SELECT") {
        const hasOption = Array.prototype.some.call(control.options, (option) => option.value === value);
        if (!hasOption) return;
      }
      control.value = value;
    }

    function render() {
      const isBaseLib = library.value === "baselib";
      baseLibFields.classList.toggle("is-hidden", !isBaseLib);
      ritsuLibFields.classList.toggle("is-hidden", isBaseLib);

      error.textContent = "";

      const names = namesInput.value
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (names.length === 0) {
        final.textContent = "";
        return;
      }

      const suffixes = isBaseLib
        ? baseLibSuffixes
        : (suffixTemplates[modelType.value] || baseLibSuffixes);

      try {
        const out = {};
        for (const name of names) {
          const id = isBaseLib
            ? api.buildBaseLibEntryId(namespaceInput.value, name)
            : api.buildRitsuLibEntryId(modId.value, modelType.value, name);

          for (const suffix of suffixes) {
            out[`${id}.${suffix}`] = "";
          }
        }
        final.innerHTML = highlightJson(JSON.stringify(out, null, 2));
      } catch (ex) {
        error.textContent = ex.message;
        final.textContent = "";
      }
    }

    function escapeHtml(s) {
      return s.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      })[c]);
    }

    function highlightJson(text) {
      // Token-by-token, regex-based JSON highlighter (input is JSON.stringify output, so safe).
      const tokenRe = /"(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],]/g;
      let result = "";
      let lastIndex = 0;
      let m;
      while ((m = tokenRe.exec(text)) !== null) {
        result += escapeHtml(text.slice(lastIndex, m.index));
        const tok = m[0];
        if (tok.endsWith(":") || /:\s*$/.test(tok)) {
          // Trailing colon means this is a key
          const colonIdx = tok.lastIndexOf(":");
          const key = tok.slice(0, colonIdx).trimEnd();
          const after = tok.slice(colonIdx);
          result += '<span class="json-key">' + escapeHtml(key) + "</span>" + escapeHtml(after);
        } else if (tok.startsWith('"')) {
          result += '<span class="json-string">' + escapeHtml(tok) + "</span>";
        } else if (tok === "true" || tok === "false") {
          result += '<span class="json-bool">' + tok + "</span>";
        } else if (tok === "null") {
          result += '<span class="json-null">' + tok + "</span>";
        } else if (/^-?\d/.test(tok)) {
          result += '<span class="json-number">' + tok + "</span>";
        } else {
          result += '<span class="json-punct">' + escapeHtml(tok) + "</span>";
        }
        lastIndex = tokenRe.lastIndex;
      }
      result += escapeHtml(text.slice(lastIndex));
      return result;
    }
  })();

