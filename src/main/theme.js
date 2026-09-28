// Theme manager: 'system' | 'light' | 'dark'.
// Default is 'system' — follows OS color scheme via prefers-color-scheme.
// User choice persists in localStorage['fsm_theme'].

var Theme = (function () {
  var KEY = "fsm_theme";
  var current = "system";
  var listeners = [];
  var mq = null;

  function getStored() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark" || v === "system") return v;
    } catch (e) {}
    return "system";
  }

  function setStored(v) {
    try {
      localStorage.setItem(KEY, v);
    } catch (e) {}
  }

  function apply() {
    var root = document.documentElement;
    if (current === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", current);
    }
    notify();
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i]();
      } catch (e) {}
    }
  }

  function effective() {
    if (current !== "system") return current;
    if (mq && mq.matches) return "dark";
    return "light";
  }

  function onSystemChange() {
    // Only matters if user is on 'system' mode.
    if (current === "system") notify();
  }

  return {
    init: function () {
      current = getStored();
      if (window.matchMedia) {
        mq = window.matchMedia("(prefers-color-scheme: dark)");
        if (mq.addEventListener) mq.addEventListener("change", onSystemChange);
        else if (mq.addListener) mq.addListener(onSystemChange);
      }
      apply();
    },
    get: function () {
      return current;
    },
    effective: effective,
    cycle: function () {
      // system -> light -> dark -> system
      current =
        current === "system"
          ? "light"
          : current === "light"
            ? "dark"
            : "system";
      setStored(current);
      apply();
    },
    set: function (v) {
      if (v !== "system" && v !== "light" && v !== "dark") return;
      current = v;
      setStored(v);
      apply();
    },
    onChange: function (fn) {
      listeners.push(fn);
    },
  };
})();
