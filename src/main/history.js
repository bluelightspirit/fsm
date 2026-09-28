// History: snapshot-based undo/redo stack for the active FSM.
// Snapshots are JSON strings produced by snapshotJSON()/loadSnapshotJSON() in save.js.

var History = (function () {
  var stack = [];
  var index = -1;
  var LIMIT = 100;
  var listeners = [];

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i]();
      } catch (e) {}
    }
  }

  return {
    push: function (snapshot) {
      // dedupe consecutive identical states
      if (index >= 0 && stack[index] === snapshot) return;
      // drop redo tail
      if (index < stack.length - 1) {
        stack.length = index + 1;
      }
      stack.push(snapshot);
      if (stack.length > LIMIT) {
        stack.shift();
      }
      index = stack.length - 1;
      notify();
    },
    reset: function (snapshot) {
      stack = snapshot != null ? [snapshot] : [];
      index = stack.length - 1;
      notify();
    },
    undo: function () {
      if (index <= 0) return null;
      index--;
      notify();
      return stack[index];
    },
    redo: function () {
      if (index >= stack.length - 1) return null;
      index++;
      notify();
      return stack[index];
    },
    canUndo: function () {
      return index > 0;
    },
    canRedo: function () {
      return index < stack.length - 1;
    },
    onChange: function (fn) {
      listeners.push(fn);
    },
  };
})();
