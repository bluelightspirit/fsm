// UI wiring: sidebar (FSM list), toolbar buttons, keyboard shortcuts beyond editor.
// Called from window.onload in fsm.js after Workspace.init() and History.reset().

function wireUI() {
  var sidebarList = document.getElementById("fsm-list");
  var newBtn = document.getElementById("btn-new-fsm");
  var undoBtn = document.getElementById("btn-undo");
  var redoBtn = document.getElementById("btn-redo");
  var clearBtn = document.getElementById("btn-clear");
  var pngBtn = document.getElementById("btn-png");
  var svgBtn = document.getElementById("btn-svg");
  var latexBtn = document.getElementById("btn-latex");
  var titleEl = document.getElementById("current-fsm-name");
  var themeBtn = document.getElementById("btn-theme");

  function switchToFsm(id) {
    if (id === Workspace.getActiveId()) return;
    flushHistory();
    saveBackup();
    Workspace.switchTo(id);
    restoreBackup();
    History.reset(snapshotJSON());
    draw();
    updateTitle();
  }

  function promptRename(fsm) {
    var newName = prompt("Rename FSM:", fsm.name);
    if (newName == null) return;
    newName = newName.trim();
    if (!newName) return;
    Workspace.rename(fsm.id, newName);
    updateTitle();
  }

  function deleteFsm(fsm) {
    // Avoid window.confirm here: browsers suppress repeated native dialogs after
    // several deletions, which made the delete buttons appear to stop working.
    var dialog = document.getElementById("delete-fsm-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "delete-fsm-dialog";
      dialog.innerHTML =
        '<p class="delete-fsm-message"></p>' +
        '<div class="delete-fsm-actions"><button type="button" data-action="cancel">Cancel</button>' +
        '<button type="button" data-action="delete">Delete FSM</button></div>';
      document.body.appendChild(dialog);
      dialog.querySelector('[data-action="cancel"]').onclick = function () {
        dialog.close("cancel");
      };
      dialog.querySelector('[data-action="delete"]').onclick = function () {
        dialog.close("delete");
      };
    }
    dialog.querySelector(".delete-fsm-message").textContent =
      'Delete “' + fsm.name + '”? This cannot be undone.';
    dialog.onclose = function () {
      if (dialog.returnValue !== "delete") return;
      // The sidebar may have changed while the confirmation was open.
      if (!Workspace.list().some(function (item) { return item.id === fsm.id; })) return;
    var wasActive = fsm.id === Workspace.getActiveId();
    Workspace.remove(fsm.id);
    if (wasActive) {
      restoreBackup();
      History.reset(snapshotJSON());
      draw();
    }
    updateTitle();
    };
    dialog.showModal();
  }

  function renderSidebar() {
    var fsms = Workspace.list();
    var activeId = Workspace.getActiveId();

    // rebuild list
    while (sidebarList.firstChild)
      sidebarList.removeChild(sidebarList.firstChild);

    fsms.forEach(function (fsm) {
      var li = document.createElement("li");
      li.className = fsm.id === activeId ? "active" : "";

      var name = document.createElement("span");
      name.className = "name";
      name.textContent = fsm.name;
      name.title = fsm.name;
      name.onclick = function () {
        switchToFsm(fsm.id);
      };
      name.ondblclick = function (e) {
        e.stopPropagation();
        promptRename(fsm);
      };

      var renameBtn = document.createElement("button");
      renameBtn.className = "icon";
      renameBtn.title = "Rename";
      renameBtn.textContent = "✎"; // pencil
      renameBtn.onclick = function (e) {
        e.stopPropagation();
        promptRename(fsm);
      };

      var delBtn = document.createElement("button");
      delBtn.className = "icon";
      delBtn.title = "Delete";
      delBtn.textContent = "×"; // ×
      delBtn.onclick = function (e) {
        e.stopPropagation();
        deleteFsm(fsm);
      };

      li.appendChild(name);
      li.appendChild(renameBtn);
      li.appendChild(delBtn);
      sidebarList.appendChild(li);
    });
  }

  function updateTitle() {
    var active = Workspace.getActive();
    if (titleEl && active) titleEl.textContent = active.name;
  }

  function updateToolbar() {
    undoBtn.disabled = !History.canUndo();
    redoBtn.disabled = !History.canRedo();
  }

  newBtn.onclick = function () {
    flushHistory();
    saveBackup();
    var id = Workspace.create();
    Workspace.switchTo(id);
    restoreBackup();
    History.reset(snapshotJSON());
    draw();
    updateTitle();
  };

  undoBtn.onclick = function () {
    performUndo();
  };
  redoBtn.onclick = function () {
    performRedo();
  };
  clearBtn.onclick = function () {
    clearAll();
  };

  function bindExport(btn, fn) {
    if (!btn) return;
    btn.onclick = function (e) {
      e.preventDefault();
      fn();
    };
  }
  bindExport(pngBtn, saveAsPNG);
  bindExport(svgBtn, saveAsSVG);
  bindExport(latexBtn, saveAsLaTeX);
  if (typeof wireStyleUI === "function") wireStyleUI();
  if (typeof wireNamesUI === "function") wireNamesUI();
  if (typeof wireExportOptionsUI === "function") wireExportOptionsUI();
  if (typeof wireImportUI === "function") wireImportUI();
  if (typeof wirePagesUI === "function") wirePagesUI();
  if (typeof wireAutomataUI === "function") wireAutomataUI();
  if (typeof addCreditLine === "function") addCreditLine();
  bindExport(document.getElementById("btn-typst"), saveAsTypst);

  function updateThemeButton() {
    if (!themeBtn) return;
    var mode = Theme.get();
    var label =
      mode === "system" ? "Auto" : mode === "light" ? "Light" : "Dark";
    var icon = mode === "system" ? "◐" : mode === "light" ? "☀" : "☾";
    themeBtn.textContent = icon + " " + label;
    themeBtn.setAttribute(
      "aria-label",
      "Theme: " + label + " (click to change)",
    );
    themeBtn.title = "Theme: " + label + " (click to cycle)";
  }

  if (themeBtn && typeof Theme !== "undefined") {
    themeBtn.onclick = function () {
      Theme.cycle();
    };
    Theme.onChange(function () {
      updateThemeButton();
      draw(); // re-render canvas with new theme colors
    });
    updateThemeButton();
  }

  Workspace.onChange(function () {
    renderSidebar();
    updateTitle();
  });
  History.onChange(updateToolbar);

  renderSidebar();
  updateTitle();
  updateToolbar();
}
