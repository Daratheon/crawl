(function (root, factory) {
  // UMD: AMD (RequireJS) or browser global (window.Sound)
  if (typeof define === "function" && define.amd) {
    define([], function () { return factory(root); });
  } else {
    root.Sound = factory(root);
  }
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  let ctx = null;
  const buffers = new Map();

  function ensureCtx() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      ctx = new AC();                      
      root.__audioCtx = ctx;
    }
    return ctx;
  }

  // decodeAudioData compatibility (promise/callback forms)
  function decodeArrayBuffer(arrayBuf) {
    const c = ensureCtx();
    return new Promise((resolve, reject) => {
      // Newer browsers: single-arg promise form
      if (c.decodeAudioData.length === 1) {
        c.decodeAudioData(arrayBuf).then(resolve, reject);
      } else {
        // Older Safari/Chrome: callback form
        c.decodeAudioData(arrayBuf, resolve, reject);
      }
    });
  }

  async function load(name, url) {
    ensureCtx();
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
    const arr = await res.arrayBuffer();
    const audioBuf = await decodeArrayBuffer(arr);
    buffers.set(name, audioBuf);
    try { console.log("[Sound] loaded:", name, url); } catch {}
    return audioBuf;
  }

  function play(name, { volume = 1.0 } = {}) {
    ensureCtx();
    if (ctx && ctx.state === "suspended") {
      // Attempt to resume if user has already interacted
      try { ctx.resume(); } catch {}
    }
    const buf = buffers.get(name);
    if (!buf) { try { console.warn("[Sound] Not loaded:", name); } catch {}; return null; }

    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.buffer = buf;
    src.connect(gain).connect(ctx.destination);
    src.start();
    try { console.log("[Sound] play:", name, "vol:", volume); } catch {}
    return src;
  }

  function resume() {
    ensureCtx();
    if (ctx.state === "suspended") return ctx.resume();
    return Promise.resolve();
  }

  function state() {
    return ctx ? ctx.state : "none";
  }

  // Unlock on first user gesture (Chrome/Safari autoplay policy)
  (function setupAudioUnlock() {
    if (!root || !root.document) return;
    const unlock = () => {
      resume().catch(() => {});
      root.document.removeEventListener("pointerdown", unlock);
      root.document.removeEventListener("keydown", unlock);
      try { console.log("[Sound] audio unlocked"); } catch {}
    };
    root.document.addEventListener("pointerdown", unlock, { once: true });
    root.document.addEventListener("keydown", unlock, { once: true });
  })();

  return {
    load,
    play,
    resume,
    state,
    // exposed for debugging:
    _buffers: buffers
  };
});

