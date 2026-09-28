// Workspace: manages multiple FSMs persisted in localStorage.
// Storage layout:
//   fsm_workspace = { version, activeId, fsms: [{id, name, createdAt, updatedAt}] }
//   fsm_data_<id> = { nodes: [...], links: [...] }
// Migrates legacy `fsm` key (single-FSM) into the new format on first load.

var Workspace = (function () {
  var WORKSPACE_KEY = "fsm_workspace";
  var DATA_PREFIX = "fsm_data_";
  var LEGACY_KEY = "fsm";
  var VERSION = 2;

  var meta = null;
  var listeners = [];

  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      try {
        return crypto.randomUUID();
      } catch (e) {}
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }

  function dataKey(id) {
    return DATA_PREFIX + id;
  }

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {}
  }

  function safeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  function loadMeta() {
    var raw = safeGet(WORKSPACE_KEY);
    if (!raw) return null;
    try {
      var obj = JSON.parse(raw);
      if (obj && obj.fsms) return obj;
    } catch (e) {}
    return null;
  }

  function saveMeta() {
    safeSet(WORKSPACE_KEY, JSON.stringify(meta));
  }

  function readData(id) {
    var raw = safeGet(dataKey(id));
    if (!raw) return { nodes: [], links: [] };
    try {
      var obj = JSON.parse(raw);
      if (obj && obj.nodes && obj.links) return obj;
    } catch (e) {}
    return { nodes: [], links: [] };
  }

  function writeData(id, data) {
    safeSet(dataKey(id), JSON.stringify(data));
  }

  function migrate() {
    var legacyRaw = safeGet(LEGACY_KEY);
    var id = uuid();
    var now = Date.now();
    meta = {
      version: VERSION,
      activeId: id,
      fsms: [{ id: id, name: "FSM 1", createdAt: now, updatedAt: now }],
    };
    if (legacyRaw) {
      try {
        var parsed = JSON.parse(legacyRaw);
        if (parsed && parsed.nodes && parsed.links) {
          writeData(id, parsed);
        }
      } catch (e) {}
    } else {
      writeData(id, { nodes: [], links: [] });
    }
    saveMeta();
    safeRemove(LEGACY_KEY);
  }

  function ensureNonEmpty() {
    if (!meta.fsms.length) {
      var id = uuid();
      var now = Date.now();
      meta.fsms.push({ id: id, name: "FSM 1", createdAt: now, updatedAt: now });
      meta.activeId = id;
      writeData(id, { nodes: [], links: [] });
    }
    // validate activeId
    var found = false;
    for (var i = 0; i < meta.fsms.length; i++) {
      if (meta.fsms[i].id === meta.activeId) {
        found = true;
        break;
      }
    }
    if (!found) meta.activeId = meta.fsms[0].id;
  }

  function findFsm(id) {
    for (var i = 0; i < meta.fsms.length; i++) {
      if (meta.fsms[i].id === id) return meta.fsms[i];
    }
    return null;
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i]();
      } catch (e) {}
    }
  }

  return {
    init: function () {
      meta = loadMeta();
      if (!meta) {
        migrate();
      }
      ensureNonEmpty();
      saveMeta();
    },
    list: function () {
      return meta.fsms.map(function (f) {
        return { id: f.id, name: f.name };
      });
    },
    getActiveId: function () {
      return meta.activeId;
    },
    getActive: function () {
      return findFsm(meta.activeId);
    },
    loadActive: function () {
      return readData(meta.activeId);
    },
    saveActive: function (data) {
      writeData(meta.activeId, data);
      var active = findFsm(meta.activeId);
      if (active) {
        active.updatedAt = Date.now();
        saveMeta();
      }
    },
    create: function (name) {
      var id = uuid();
      var now = Date.now();
      var fsm = {
        id: id,
        name: name || "FSM " + (meta.fsms.length + 1),
        createdAt: now,
        updatedAt: now,
      };
      meta.fsms.push(fsm);
      writeData(id, { nodes: [], links: [] });
      saveMeta();
      notify();
      return id;
    },
    rename: function (id, name) {
      var fsm = findFsm(id);
      if (!fsm) return;
      fsm.name = name;
      fsm.updatedAt = Date.now();
      saveMeta();
      notify();
    },
    remove: function (id) {
      for (var i = 0; i < meta.fsms.length; i++) {
        if (meta.fsms[i].id === id) {
          meta.fsms.splice(i, 1);
          break;
        }
      }
      safeRemove(dataKey(id));
      if (meta.activeId === id) {
        meta.activeId = meta.fsms.length ? meta.fsms[0].id : null;
      }
      ensureNonEmpty();
      saveMeta();
      notify();
    },
    switchTo: function (id) {
      if (!findFsm(id)) return;
      meta.activeId = id;
      saveMeta();
      notify();
    },
    onChange: function (fn) {
      listeners.push(fn);
    },
  };
})();
