/* ═══════════════════════════════════════════════════════════════
   Pajama Workout — App
   ═══════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  // ── Constants ────────────────────────────────────────────────
  const RING_CIRCUMFERENCE = 2 * Math.PI * 110; // must match SVG r=110

  // ── State ────────────────────────────────────────────────────
  let phases       = [];
  let totalTime    = 0;
  let elapsed      = 0;
  let phaseIndex   = 0;
  let timeLeft     = 0;
  let state        = "idle";      // idle | running | paused | done
  let interval     = null;
  let audioCtx     = null;
  let wakeLock     = null;
  let currentWorkoutId = null;

  // ── DOM refs (cached on init) ────────────────────────────────
  const $ = (id) => document.getElementById(id);

  let els = {};

  function cacheDOM() {
    els = {
      glow:          $("glow"),
      progressFill:  $("progress-fill"),
      sectionLabel:  $("section-label"),
      counterLabel:  $("counter-label"),
      timerContainer:$("timer-container"),
      timerDisplay:  $("timer-display"),
      timerRing:     $("timer-ring"),
      doneCheck:     $("done-check"),
      exerciseName:  $("exercise-name"),
      exerciseHint:  $("exercise-hint"),
      controls:      $("controls"),
      btnStart:      $("btn-start"),
      btnPause:      $("btn-pause"),
      btnResume:     $("btn-resume"),
      btnReset:      $("btn-reset"),
      btnSkip:       $("btn-skip"),
      upnextContainer: $("upnext-container"),
      upnextList:    $("upnext-list"),
      pickerScreen:  $("picker-screen"),
      timerScreen:   $("timer-screen"),
      wakeIndicator: $("wake-indicator"),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────
  function fmt(s) {
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function summarise(phasesArr) {
    let workCount = 0, stretchCount = 0, total = 0;
    for (const p of phasesArr) {
      if (p.type === "work") workCount++;
      if (p.type === "stretch") stretchCount++;
      total += p.duration;
    }
    const mins = Math.round(total / 60);
    const parts = [`${mins} min`];
    if (workCount)   parts.push(`${workCount} exercises`);
    if (stretchCount) parts.push(`${stretchCount} stretches`);
    return parts.join(" \u00B7 ");
  }

  // ── Audio (tiny beeps) ──────────────────────────────────────
  function beep(freq, durMs, count) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < count; i++) {
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.value = 0.15;
        const t = audioCtx.currentTime + i * 0.2;
        osc.start(t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + durMs / 1000);
        osc.stop(t + durMs / 1000);
      }
    } catch (_) { /* silent fail */ }
  }

  // ── Wake Lock (keeps screen on during workout) ──────────────
  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen");
        els.wakeIndicator.classList.add("on");
        wakeLock.addEventListener("release", () => {
          els.wakeIndicator.classList.remove("on");
        });
      }
    } catch (_) { /* not supported or denied */ }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
    els.wakeIndicator.classList.remove("on");
  }

  // Re-acquire wake lock when the page becomes visible again
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state === "running") {
      requestWakeLock();
    }
  });

  // ── Theming ─────────────────────────────────────────────────
  function applyTheme(phaseType) {
    const t = THEME[phaseType];
    if (!t) return;
    document.body.style.background = t.bg;
    els.glow.style.background      = t.glow;
    els.timerRing.setAttribute("stroke", t.accent);
    els.timerDisplay.style.color   = t.accent;
    els.exerciseName.style.color   = t.accent;
    els.progressFill.style.background = t.progress;
  }

  // ── Render helpers ──────────────────────────────────────────
  function sectionFor(idx) {
    const p = phases[idx];
    if (p.type === "stretch") return "Stretches";
    return "Workout";
  }

  function counterFor(idx) {
    const p = phases[idx];
    if (p.type === "work" || p.type === "rest") {
      const workPhases = phases.filter(x => x.type === "work");
      const exNum = Math.floor(idx / 2) + 1;
      return `Exercise ${exNum} of ${workPhases.length}`;
    }
    const stretches = phases.filter(x => x.type === "stretch");
    const stretchNum = stretches.indexOf(p) + 1;
    return `Stretch ${stretchNum} of ${stretches.length}`;
  }

  function renderUpNext() {
    if (state !== "running" && state !== "paused") {
      els.upnextContainer.style.display = "none";
      return;
    }
    els.upnextContainer.style.display = "block";
    els.upnextList.innerHTML = "";
    const upcoming = phases.slice(phaseIndex + 1, phaseIndex + 4);
    for (const u of upcoming) {
      const div = document.createElement("div");
      div.className = "upnext-item " + (u.type === "rest" ? "upnext-rest" : "upnext-work");
      div.innerHTML =
        `<span>${u.type === "rest" ? "— rest —" : u.name}</span>` +
        `<span style="opacity:0.6">${u.duration}s</span>`;
      els.upnextList.appendChild(div);
    }
  }

  function render() {
    const p = phases[phaseIndex];
    const progress = (p.duration - timeLeft) / p.duration;
    const offset   = RING_CIRCUMFERENCE * (1 - progress);

    els.timerRing.setAttribute("stroke-dashoffset", offset);
    els.timerDisplay.textContent = fmt(timeLeft);
    els.progressFill.style.width = (elapsed / totalTime * 100) + "%";
    els.sectionLabel.textContent = sectionFor(phaseIndex);
    els.counterLabel.textContent = counterFor(phaseIndex);
    els.exerciseName.textContent = p.name;
    els.exerciseHint.textContent = p.hint;
    renderUpNext();
  }

  function showButtons(st) {
    els.btnStart.style.display  = (st === "idle" || st === "done") ? "inline-block" : "none";
    els.btnStart.textContent    = st === "done" ? "AGAIN" : "START";
    els.btnPause.style.display  = st === "running" ? "inline-block" : "none";
    els.btnResume.style.display = st === "paused" ? "inline-block" : "none";
    els.btnReset.style.display  = (st === "paused" || st === "running") ? "inline-block" : "none";
    els.btnSkip.style.display   = (st === "running" || st === "paused") ? "inline-block" : "none";
  }

  // ── Done screen ─────────────────────────────────────────────
  function showDone() {
    document.body.style.background    = DONE_THEME.bg;
    els.glow.style.background         = DONE_THEME.glow;
    els.timerContainer.style.display  = "none";
    els.doneCheck.style.display       = "block";
    els.sectionLabel.textContent      = "Complete";
    els.counterLabel.textContent      = "";
    els.exerciseName.textContent      = "All done.";
    els.exerciseName.style.color      = DONE_THEME.accent;
    els.exerciseHint.textContent      = "You showed up. That's what matters.";
    els.progressFill.style.width      = "100%";
    els.progressFill.style.background = DONE_THEME.accent;
    els.upnextContainer.style.display = "none";
    showButtons("done");
    releaseWakeLock();
  }

  // ── Timer core ──────────────────────────────────────────────
  function tick() {
    if (timeLeft <= 1) {
      elapsed++;
      const next = phaseIndex + 1;
      if (next >= phases.length) {
        clearInterval(interval);
        state = "done";
        beep(880, 200, 3);
        showDone();
        return;
      }
      const prev = phases[phaseIndex];
      phaseIndex = next;
      const nx   = phases[phaseIndex];
      timeLeft   = nx.duration;

      if (nx.type !== prev.type) beep(770, 150, 2);
      else beep(660, 100, 1);

      applyTheme(nx.type);
      render();
      return;
    }
    timeLeft--;
    elapsed++;
    if (timeLeft <= 3) beep(550, 80, 1);
    render();
  }

  // ── Public actions ──────────────────────────────────────────
  function start() {
    if (state === "idle" || state === "done") {
      phaseIndex = 0;
      timeLeft   = phases[0].duration;
      elapsed    = 0;
      els.timerContainer.style.display = "block";
      els.doneCheck.style.display      = "none";
    }
    state = "running";
    applyTheme(phases[phaseIndex].type);
    render();
    showButtons("running");
    beep(660, 100, 1);
    clearInterval(interval);
    interval = setInterval(tick, 1000);
    requestWakeLock();
  }

  function pause() {
    state = "paused";
    clearInterval(interval);
    showButtons("paused");
    releaseWakeLock();
  }

  function resume() {
    state = "running";
    showButtons("running");
    clearInterval(interval);
    interval = setInterval(tick, 1000);
    requestWakeLock();
  }

  function reset() {
    clearInterval(interval);
    state = "idle";
    releaseWakeLock();
    // go back to picker
    showPicker();
  }

  function skip() {
    if (state !== "running" && state !== "paused") return;
    // consume remaining time of current phase
    elapsed += timeLeft;
    const next = phaseIndex + 1;
    if (next >= phases.length) {
      clearInterval(interval);
      state = "done";
      beep(880, 200, 3);
      showDone();
      return;
    }
    phaseIndex = next;
    timeLeft = phases[phaseIndex].duration;
    beep(770, 150, 2);
    applyTheme(phases[phaseIndex].type);
    render();
    // if we were paused, stay paused
  }

  // ── Picker / routing ────────────────────────────────────────
  function showPicker() {
    state = "idle";
    clearInterval(interval);
    els.pickerScreen.classList.add("active");
    els.timerScreen.classList.remove("active");

    // reset body to default look
    document.body.style.background = "#1a2332";
    els.glow.style.background      = "rgba(78,205,196,0.25)";
    els.progressFill.style.width   = "0%";
    els.progressFill.style.background = "#4ECDC4";

    buildPicker();
  }

  function buildPicker() {
    const container = $("workout-list");
    container.innerHTML = "";
    for (const key of Object.keys(WORKOUTS)) {
      const w    = WORKOUTS[key];
      const card = document.createElement("div");
      card.className = "workout-card";
      card.innerHTML =
        `<div class="workout-card-title">${w.title}</div>` +
        `<div class="workout-card-meta">${summarise(w.phases)}</div>`;
      card.addEventListener("click", () => selectWorkout(key));
      container.appendChild(card);
    }
  }

  function selectWorkout(id) {
    currentWorkoutId = id;
    const w = WORKOUTS[id];
    phases    = w.phases;
    totalTime = phases.reduce((sum, p) => sum + p.duration, 0);

    els.pickerScreen.classList.remove("active");
    els.timerScreen.classList.add("active");

    // set up initial state
    phaseIndex = 0;
    timeLeft   = phases[0].duration;
    elapsed    = 0;
    state      = "idle";

    // display ready state
    applyTheme(phases[0].type);
    els.timerContainer.style.display = "block";
    els.doneCheck.style.display      = "none";
    els.timerRing.setAttribute("stroke-dashoffset", RING_CIRCUMFERENCE);
    els.timerDisplay.textContent = fmt(phases[0].duration);
    els.sectionLabel.textContent = "Ready";
    els.counterLabel.textContent = summarise(phases);
    els.exerciseName.textContent = w.title;
    els.exerciseHint.textContent = w.subtitle;
    els.upnextContainer.style.display = "none";
    showButtons("idle");
  }

  // ── Keyboard shortcuts ──────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (state === "running") pause();
      else if (state === "paused") resume();
      else if (state === "idle" && currentWorkoutId) start();
    }
    if (e.code === "KeyR" && (state === "paused" || state === "running")) {
      reset();
    }
    if (e.code === "KeyS" && (state === "running" || state === "paused")) {
      skip();
    }
  });

  // ── Init ────────────────────────────────────────────────────
  function init() {
    cacheDOM();

    // Wire buttons
    els.btnStart.addEventListener("click", start);
    els.btnPause.addEventListener("click", pause);
    els.btnResume.addEventListener("click", resume);
    els.btnReset.addEventListener("click", reset);
    els.btnSkip.addEventListener("click", skip);

    // If only one workout, skip picker and go straight to it
    const workoutKeys = Object.keys(WORKOUTS);
    if (workoutKeys.length === 1) {
      selectWorkout(workoutKeys[0]);
    } else {
      showPicker();
    }
  }

  // ── Register service worker ─────────────────────────────────
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
