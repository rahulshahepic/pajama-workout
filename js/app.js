/* ═══════════════════════════════════════════════════════════════
   Pajama Workout — App
   ═══════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  // ── Constants (computed on init from DOM) ───────────────────
  let RING_CIRCUMFERENCE = 0;

  // ── State ────────────────────────────────────────────────────
  let phases       = [];
  let totalTime    = 0;
  let elapsed      = 0;
  let phaseIndex   = 0;
  let timeLeft     = 0;
  let state        = "idle";      // idle | countdown | running | paused | done
  let countdownLeft = 0;
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
      historyScreen: $("history-screen"),
      btnHistory:    $("btn-history"),
      btnHistoryBack:$("btn-history-back"),
      btnClearHistory:$("btn-clear-history"),
      btnHome:       $("btn-home"),
      historyStats:  $("history-stats"),
      historyList:   $("history-list"),
      streakBanner:  $("streak-banner"),
      wakeIndicator: $("wake-indicator"),
      btnSync:       $("btn-sync"),
      syncStatus:    $("sync-status"),
    };

    // Derive ring circumference from the actual SVG attribute
    const r = parseFloat(els.timerRing.getAttribute("r"));
    RING_CIRCUMFERENCE = 2 * Math.PI * r;
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

  function workoutDuration(w) {
    return w.phases.reduce((sum, p) => sum + p.duration, 0);
  }

  /** Spread a SOUNDS entry into beep(freq, dur, count) */
  function cue(name) {
    beep(...SOUNDS[name]);
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
  function applyTheme(key) {
    const t = THEME[key];
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
    els.btnReset.style.display  = (st === "paused" || st === "running" || st === "countdown") ? "inline-block" : "none";
    els.btnSkip.style.display   = (st === "running" || st === "paused" || st === "countdown") ? "inline-block" : "none";
    els.btnHome.style.display   = (st === "idle" || st === "done") ? "inline-block" : "none";
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

    // Record to history
    const w = WORKOUTS[currentWorkoutId];
    WorkoutHistory.record({
      workoutId:       currentWorkoutId,
      title:           w.title,
      durationSecs:    totalTime,
      phasesCompleted: phases.length,
      phasesTotal:     phases.length,
    });

    // Sync to cloud (fire-and-forget)
    if (SyncManager.isSignedIn()) SyncManager.sync().catch(() => {});
  }

  // ── Timer core ──────────────────────────────────────────────
  function tick() {
    if (timeLeft <= 1) {
      elapsed++;
      const next = phaseIndex + 1;
      if (next >= phases.length) {
        clearInterval(interval);
        state = "done";
        cue("done");
        showDone();
        return;
      }
      const prev = phases[phaseIndex];
      phaseIndex = next;
      const nx   = phases[phaseIndex];
      timeLeft   = nx.duration;

      if (nx.type !== prev.type) cue("transition");
      else cue("start");

      applyTheme(nx.type);
      render();
      return;
    }
    timeLeft--;
    elapsed++;
    if (timeLeft <= 3) cue("tick");
    render();
  }

  // ── Public actions ──────────────────────────────────────────
  function start() {
    if (state !== "idle" && state !== "done") return;
    phaseIndex = 0;
    timeLeft   = phases[0].duration;
    elapsed    = 0;
    els.timerContainer.style.display = "block";
    els.doneCheck.style.display      = "none";

    const cdSecs = typeof COUNTDOWN_SECS === "number" ? COUNTDOWN_SECS : 0;
    if (cdSecs > 0) {
      startCountdown(cdSecs);
    } else {
      beginWorkout();
    }
  }

  function startCountdown(secs) {
    countdownLeft = secs;
    state = "countdown";
    renderCountdown();
    showButtons("countdown");
    requestWakeLock();
    clearInterval(interval);
    interval = setInterval(countdownTick, 1000);
  }

  function countdownTick() {
    countdownLeft--;
    if (countdownLeft <= 3 && countdownLeft > 0) cue("tick");
    if (countdownLeft <= 0) {
      clearInterval(interval);
      cue("transition");
      beginWorkout();
      return;
    }
    renderCountdown();
  }

  function renderCountdown() {
    const cdTotal = typeof COUNTDOWN_SECS === "number" ? COUNTDOWN_SECS : 10;
    const progress = 1 - (countdownLeft / cdTotal);
    const offset = RING_CIRCUMFERENCE * (1 - progress);
    els.timerRing.setAttribute("stroke-dashoffset", offset);
    els.timerDisplay.textContent = countdownLeft;
    els.sectionLabel.textContent = "Get Ready";
    els.counterLabel.textContent = "";
    els.exerciseName.textContent = phases[0].name;
    els.exerciseHint.textContent = "starts in " + countdownLeft + "s — tap SKIP to start now";
    els.upnextContainer.style.display = "none";
    els.progressFill.style.width = "0%";
    applyTheme("countdown");
  }

  function skipCountdown() {
    clearInterval(interval);
    cue("transition");
    beginWorkout();
  }

  function beginWorkout() {
    state = "running";
    applyTheme(phases[phaseIndex].type);
    render();
    showButtons("running");
    cue("start");
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
    countdownLeft = 0;
    releaseWakeLock();
    // navigate back — popstate will show picker
    history.back();
  }

  function goHome() {
    // from the "Ready" or "Done" screen, go back to picker
    if (state === "idle" || state === "done") {
      history.back();
    }
  }

  function skip() {
    if (state === "countdown") { skipCountdown(); return; }
    if (state !== "running" && state !== "paused") return;
    // consume remaining time of current phase
    elapsed += timeLeft;
    const next = phaseIndex + 1;
    if (next >= phases.length) {
      clearInterval(interval);
      state = "done";
      cue("done");
      showDone();
      return;
    }
    phaseIndex = next;
    timeLeft = phases[phaseIndex].duration;
    cue("transition");
    applyTheme(phases[phaseIndex].type);
    render();
    // if we were paused, stay paused
  }

  // ── Picker / routing ────────────────────────────────────────

  // Push = true means we add a history entry; false means popstate called us.
  function showPicker(push) {
    state = "idle";
    clearInterval(interval);
    currentWorkoutId = null;
    els.pickerScreen.classList.add("active");
    els.timerScreen.classList.remove("active");
    els.historyScreen.classList.remove("active");

    applyTheme("idle");
    els.progressFill.style.width = "0%";

    if (push) history.pushState({ screen: "picker" }, "");

    buildPicker();
    updateStreakBanner();
  }

  function buildPicker() {
    const container = $("workout-list");
    container.innerHTML = "";

    // Sort by duration (shortest first)
    const sorted = Object.keys(WORKOUTS).sort(
      (a, b) => workoutDuration(WORKOUTS[a]) - workoutDuration(WORKOUTS[b])
    );

    for (const key of sorted) {
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

  function selectWorkout(id, push) {
    currentWorkoutId = id;
    const w = WORKOUTS[id];
    phases    = w.phases;
    totalTime = phases.reduce((sum, p) => sum + p.duration, 0);

    els.pickerScreen.classList.remove("active");
    els.historyScreen.classList.remove("active");
    els.timerScreen.classList.add("active");

    // set up initial state
    phaseIndex = 0;
    timeLeft   = phases[0].duration;
    elapsed    = 0;
    state      = "idle";

    if (push !== false) history.pushState({ screen: "workout", id: id }, "");

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

  // ── History screen ─────────────────────────────────────────
  function showHistory(push) {
    els.pickerScreen.classList.remove("active");
    els.timerScreen.classList.remove("active");
    els.historyScreen.classList.add("active");
    if (push !== false) history.pushState({ screen: "history" }, "");
    renderHistory();
  }

  function hideHistory() {
    history.back();
  }

  function renderHistory() {
    // Stats
    const total = WorkoutHistory.totalCount();
    const streakDays = WorkoutHistory.streak();
    const weekCount = WorkoutHistory.thisWeekCount();

    els.historyStats.innerHTML =
      statCard(total, "Total") +
      statCard(streakDays, "Streak") +
      statCard(weekCount, "This Week");

    // List
    const entries = WorkoutHistory.getAll();
    els.btnClearHistory.style.display = entries.length ? "inline-block" : "none";

    if (entries.length === 0) {
      els.historyList.innerHTML =
        '<div class="history-empty">No workouts yet.<br>Go do one!</div>';
      return;
    }

    // Group by date
    const groups = {};
    for (const e of entries) {
      const d = new Date(e.completedAt);
      const key = formatDate(d);
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }

    let html = "";
    for (const [date, items] of Object.entries(groups)) {
      html += `<div class="history-date-group">`;
      html += `<div class="history-date-label">${date}</div>`;
      for (const item of items) {
        const time = new Date(item.completedAt);
        const mins = Math.round(item.durationSecs / 60);
        html += `<div class="history-entry">`;
        html += `<span class="history-entry-name">${item.title}</span>`;
        html += `<span class="history-entry-meta">${mins} min &middot; ${formatTime(time)}</span>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
    els.historyList.innerHTML = html;
  }

  function statCard(value, label) {
    return `<div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  }

  function formatDate(d) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (sameDay(d, today)) return "Today";
    if (sameDay(d, yesterday)) return "Yesterday";

    return d.toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric",
    });
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function formatTime(d) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric", minute: "2-digit",
    });
  }

  function updateStreakBanner() {
    const s = WorkoutHistory.streak();
    const total = WorkoutHistory.totalCount();
    if (s >= 2) {
      els.streakBanner.textContent = s + " day streak \u00B7 " + total + " workouts";
      els.streakBanner.classList.add("visible");
    } else if (total > 0) {
      els.streakBanner.textContent = total + " workout" + (total === 1 ? "" : "s") + " completed";
      els.streakBanner.classList.add("visible");
    } else {
      els.streakBanner.classList.remove("visible");
    }
  }

  // ── Sync UI ────────────────────────────────────────────────
  function syncAvailable() {
    return typeof SyncManager !== "undefined";
  }

  function updateSyncUI() {
    if (!syncAvailable()) {
      els.btnSync.style.display = "none";
      return;
    }
    els.btnSync.textContent = "SYNC";
    if (SyncManager.isSignedIn()) {
      var email = SyncManager.getEmail();
      els.syncStatus.textContent = email ? "Synced \u00B7 " + email : "Synced";
      els.syncStatus.style.display = "block";
    } else {
      els.syncStatus.style.display = "none";
    }
  }

  async function syncAndUpdateUI() {
    if (!syncAvailable()) return;
    els.syncStatus.textContent = "Syncing\u2026";
    els.syncStatus.style.display = "block";
    var result = await SyncManager.sync();
    if (result.ok) {
      var email = SyncManager.getEmail();
      els.syncStatus.textContent = email ? "Synced \u00B7 " + email : "Synced";
      updateStreakBanner();
      if (els.historyScreen.classList.contains("active")) renderHistory();
    } else {
      els.syncStatus.textContent = "Sync failed \u00B7 " + (result.reason || "unknown");
      els.syncStatus.style.display = "block";
    }
  }

  async function handleSyncButton() {
    if (!syncAvailable()) return;
    if (SyncManager.isSignedIn()) {
      await syncAndUpdateUI();
    } else {
      try {
        els.syncStatus.textContent = "Signing in\u2026";
        els.syncStatus.style.display = "block";
        await SyncManager.signIn();
        if (SyncManager.isSignedIn()) {
          updateSyncUI();
          await syncAndUpdateUI();
        } else {
          els.syncStatus.textContent = "Sign-in cancelled";
          els.syncStatus.style.display = "block";
        }
      } catch (e) {
        els.syncStatus.textContent = "Sign-in failed";
        els.syncStatus.style.display = "block";
      }
    }
  }

  function handleSyncStatusTap() {
    if (!syncAvailable() || !SyncManager.isSignedIn()) return;
    if (confirm("Sign out of sync?")) {
      SyncManager.signOut();
      updateSyncUI();
    }
  }

  // ── Keyboard shortcuts ──────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (state === "countdown") skipCountdown();
      else if (state === "running") pause();
      else if (state === "paused") resume();
      else if (state === "idle" && currentWorkoutId) start();
    }
    if (e.code === "KeyR" && (state === "paused" || state === "running" || state === "countdown")) {
      reset();
    }
    if (e.code === "KeyS" && (state === "running" || state === "paused" || state === "countdown")) {
      skip();
    }
  });

  // ── Browser history (Back button) ──────────────────────────
  window.addEventListener("popstate", (e) => {
    // If a workout is active (countdown/running/paused), stop it first
    if (state === "countdown" || state === "running" || state === "paused") {
      clearInterval(interval);
      state = "idle";
      countdownLeft = 0;
      releaseWakeLock();
    }

    const s = e.state;
    if (!s || s.screen === "picker") {
      showPicker(false);
    } else if (s.screen === "workout" && WORKOUTS[s.id]) {
      selectWorkout(s.id, false);
    } else if (s.screen === "history") {
      showHistory(false);
    } else {
      showPicker(false);
    }
  });

  // ── Init ────────────────────────────────────────────────────
  async function init() {
    cacheDOM();

    // ── Show UI first (must never fail) ──────────────────────
    // Seed the initial history entry so there's something to go "back" to
    history.replaceState({ screen: "picker" }, "");

    // If only one workout, skip picker and go straight to it
    var workoutKeys = Object.keys(WORKOUTS);
    if (workoutKeys.length === 1) {
      selectWorkout(workoutKeys[0]);
    } else {
      showPicker(false);
    }

    // ── Wire buttons ─────────────────────────────────────────
    els.btnStart.addEventListener("click", start);
    els.btnPause.addEventListener("click", pause);
    els.btnResume.addEventListener("click", resume);
    els.btnReset.addEventListener("click", reset);
    els.btnSkip.addEventListener("click", skip);
    els.btnHome.addEventListener("click", goHome);
    els.btnHistory.addEventListener("click", showHistory);
    els.btnHistoryBack.addEventListener("click", hideHistory);
    els.btnClearHistory.addEventListener("click", function () {
      WorkoutHistory.clear();
      renderHistory();
    });
    els.btnSync.addEventListener("click", handleSyncButton);
    els.syncStatus.addEventListener("click", handleSyncStatusTap);

    // ── Sync setup (must never break the app) ────────────────
    try {
      var redirect = await SyncManager.handleRedirect();
      updateSyncUI();
      if (redirect && redirect.wasRedirect && !redirect.ok) {
        var msg = redirect.error || "unknown";
        if (redirect.detail) msg += " \u00B7 " + redirect.detail.slice(0, 200);
        els.syncStatus.textContent = "Sign-in failed \u00B7 " + msg;
        els.syncStatus.style.display = "block";
      } else if ((redirect && redirect.ok) || SyncManager.isSignedIn()) {
        syncAndUpdateUI();
      }
    } catch (_) {
      updateSyncUI();
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
