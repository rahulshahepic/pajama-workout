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
  let sessionMultiplier = 1;      // per-workout override (defaults from settings)

  // ── User settings (persisted to localStorage) ──────────────
  const SETTINGS_KEY = "pajama-settings";
  let settings = { multiplier: 1, tts: false };

  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (s && typeof s === "object") {
        settings.multiplier = typeof s.multiplier === "number" ? s.multiplier : 1;
        settings.tts = !!s.tts;
      }
    } catch (_) {}
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
  }

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
      historyHeatmap:$("history-heatmap"),
      historyList:   $("history-list"),
      streakBanner:  $("streak-banner"),
      wakeIndicator: $("wake-indicator"),
      btnSettings:       $("btn-settings"),
      settingsBackdrop:  $("settings-backdrop"),
      settingsPanel:     $("settings-panel"),
      settingsAccount:   $("settings-account"),
      multiplierSlider:  $("multiplier-slider"),
      multiplierLabel:   $("multiplier-label"),
      ttsToggle:         $("tts-toggle"),
      syncStatusLine:    $("sync-status-line"),
      sessionMultiplier: $("session-multiplier"),
      sessionMultLabel:  $("session-mult-label"),
      btnMultDown:       $("btn-mult-down"),
      btnMultUp:         $("btn-mult-up"),
      phaseListContainer:$("phase-list-container"),
      phaseList:         $("phase-list"),
      swapBackdrop:      $("swap-backdrop"),
      swapPanel:         $("swap-panel"),
      swapCurrent:       $("swap-current"),
      swapOptions:       $("swap-options"),
    };

    // Derive ring circumference from the actual SVG attribute
    const r = parseFloat(els.timerRing.getAttribute("r"));
    RING_CIRCUMFERENCE = 2 * Math.PI * r;
  }

  // ── Helpers ──────────────────────────────────────────────────
  function fmt(s) {
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function summarise(phasesArr, mult) {
    let workCount = 0, stretchCount = 0, yogaCount = 0, total = 0;
    var m = mult || 1;
    for (const p of phasesArr) {
      if (p.type === "work") workCount++;
      if (p.type === "stretch") stretchCount++;
      if (p.type === "yoga") yogaCount++;
      total += Math.round(p.duration * m);
    }
    const mins = Math.round(total / 60);
    const parts = [`${mins} min`];
    if (workCount)    parts.push(`${workCount} exercises`);
    if (yogaCount)    parts.push(`${yogaCount} poses`);
    if (stretchCount) parts.push(`${stretchCount} stretches`);
    return parts.join(" \u00B7 ");
  }

  function workoutDuration(w, mult) {
    var m = mult || 1;
    return w.phases.reduce((sum, p) => sum + Math.round(p.duration * m), 0);
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

  // ── TTS (text-to-speech) ────────────────────────────────────
  function speak(text) {
    if (!settings.tts || !window.speechSynthesis) return;
    var u = new SpeechSynthesisUtterance(text);
    u.rate = 1.1;
    u.volume = 0.8;
    speechSynthesis.speak(u);
  }

  function cancelSpeech() {
    if (window.speechSynthesis) speechSynthesis.cancel();
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
    if (p.type === "yoga") return "Yoga";
    return "Workout";
  }

  function counterFor(idx) {
    const p = phases[idx];
    if (p.type === "yoga") {
      const yogaPhases = phases.filter(x => x.type === "yoga");
      const num = yogaPhases.indexOf(p) + 1;
      return `Pose ${num} of ${yogaPhases.length}`;
    }
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
    els.sessionMultiplier.classList.remove("visible");
    els.phaseListContainer.classList.remove("visible");
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
      multiplier:      sessionMultiplier,
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
        speak("Workout complete");
        showDone();
        return;
      }
      const prev = phases[phaseIndex];
      phaseIndex = next;
      const nx   = phases[phaseIndex];
      timeLeft   = nx.duration;

      if (nx.type !== prev.type) cue("transition");
      else cue("start");

      speak(nx.name);
      applyTheme(nx.type);
      render();
      return;
    }
    timeLeft--;
    elapsed++;
    if (timeLeft === 3) {
      cue("tick");
      // Announce what's next at 3 seconds remaining
      var nextPhase = phases[phaseIndex + 1];
      if (nextPhase) speak("Next: " + nextPhase.name);
    } else if (timeLeft < 3 && timeLeft > 0) {
      cue("tick");
    }
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
    els.sessionMultiplier.classList.remove("visible");
    els.phaseListContainer.classList.remove("visible");

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
    speak("Get ready");
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
    speak(phases[phaseIndex].name);
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
    cancelSpeech();
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
    cancelSpeech();
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
    var m = settings.multiplier;

    // Sort by duration (shortest first)
    const sorted = Object.keys(WORKOUTS).sort(
      (a, b) => workoutDuration(WORKOUTS[a], m) - workoutDuration(WORKOUTS[b], m)
    );

    for (const key of sorted) {
      const w    = WORKOUTS[key];
      const card = document.createElement("div");
      card.className = "workout-card";
      var cat = (typeof CATEGORIES !== "undefined" && w.category && CATEGORIES[w.category]) ? CATEGORIES[w.category] : null;
      if (cat) {
        card.style.borderLeftWidth = "3px";
        card.style.borderLeftColor = cat.color;
      }
      var meta = summarise(w.phases, m);
      var catLabel = cat ? `<span class="workout-card-cat" style="color:${cat.color}">${cat.label}</span>` : "";
      var desc = w.description ? `<div class="workout-card-desc">${w.description}</div>` : "";
      card.innerHTML =
        `<div class="workout-card-title">${w.title}${catLabel}</div>` +
        `<div class="workout-card-meta">${meta}</div>` +
        desc;
      card.addEventListener("click", () => selectWorkout(key));
      container.appendChild(card);
    }
  }

  // ── Phase list & swap (Ready screen) ──────────────────────
  var swapPhaseIndex = -1;   // which phase is being swapped

  function renderPhaseList() {
    els.phaseList.innerHTML = "";
    var subs = typeof SUBSTITUTIONS !== "undefined" ? SUBSTITUTIONS : {};
    for (var i = 0; i < phases.length; i++) {
      var p = phases[i];
      var div = document.createElement("div");
      div.className = "phase-list-item";
      if (p.type === "rest") {
        div.classList.add("is-rest");
        div.innerHTML = '<span>rest</span><span class="phase-dur">' + p.duration + 's</span>';
      } else {
        var canSwap = !!subs[p.name];
        if (canSwap) div.classList.add("swappable");
        div.innerHTML = '<span>' + p.name + '</span><span class="phase-dur">' + p.duration + 's</span>';
        if (canSwap) {
          (function (idx) {
            div.addEventListener("click", function () { openSwap(idx); });
          })(i);
        }
      }
      els.phaseList.appendChild(div);
    }
  }

  function openSwap(idx) {
    var subs = typeof SUBSTITUTIONS !== "undefined" ? SUBSTITUTIONS : {};
    var p = phases[idx];
    var options = subs[p.name];
    if (!options || !options.length) return;
    swapPhaseIndex = idx;
    els.swapCurrent.textContent = "Currently: " + p.name;
    els.swapOptions.innerHTML = "";
    for (var j = 0; j < options.length; j++) {
      var opt = options[j];
      var div = document.createElement("div");
      div.className = "swap-option";
      div.innerHTML = '<div class="swap-option-name">' + opt.name + '</div>' +
        '<div class="swap-option-hint">' + opt.hint + '</div>';
      (function (sub) {
        div.addEventListener("click", function () { doSwap(sub); });
      })(opt);
      els.swapOptions.appendChild(div);
    }
    els.swapBackdrop.classList.add("open");
    els.swapPanel.classList.add("open");
  }

  function closeSwap() {
    els.swapBackdrop.classList.remove("open");
    els.swapPanel.classList.remove("open");
    swapPhaseIndex = -1;
  }

  function doSwap(sub) {
    if (swapPhaseIndex < 0 || swapPhaseIndex >= phases.length) return;
    phases[swapPhaseIndex].name = sub.name;
    phases[swapPhaseIndex].hint = sub.hint;
    closeSwap();
    renderPhaseList();
    // If we swapped the first exercise, update the Ready screen name display
    if (swapPhaseIndex === 0) {
      els.exerciseName.textContent = WORKOUTS[currentWorkoutId].title;
    }
  }

  /** Rebuild phases from the original workout using sessionMultiplier. */
  function applySessionMultiplier() {
    if (!currentWorkoutId) return;
    var w = WORKOUTS[currentWorkoutId];
    var m = sessionMultiplier;
    phases = w.phases.map(function (p) {
      return { name: p.name, type: p.type, duration: Math.round(p.duration * m), hint: p.hint };
    });
    totalTime = phases.reduce(function (sum, p) { return sum + p.duration; }, 0);
    timeLeft = phases[0].duration;

    // Update ready screen display
    els.timerDisplay.textContent = fmt(phases[0].duration);
    els.counterLabel.textContent = summarise(w.phases, m);
    els.sessionMultLabel.innerHTML = fmtMultiplier(m);
  }

  function selectWorkout(id, push) {
    currentWorkoutId = id;
    sessionMultiplier = settings.multiplier;
    const w = WORKOUTS[id];
    var m = sessionMultiplier;
    phases = w.phases.map(function (p) {
      return { name: p.name, type: p.type, duration: Math.round(p.duration * m), hint: p.hint };
    });
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
    els.counterLabel.textContent = summarise(w.phases, m);
    els.exerciseName.textContent = w.title;
    els.exerciseHint.textContent = w.subtitle;
    els.upnextContainer.style.display = "none";
    els.sessionMultiplier.classList.add("visible");
    els.sessionMultLabel.innerHTML = fmtMultiplier(m);
    els.phaseListContainer.classList.add("visible");
    renderPhaseList();
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

  function renderHeatmap() {
    var entries = WorkoutHistory.getAll();
    // Count workouts per day
    var counts = {};
    for (var i = 0; i < entries.length; i++) {
      var d = new Date(entries[i].completedAt);
      var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      counts[key] = (counts[key] || 0) + 1;
    }

    // Build 13 weeks (91 days) grid ending today
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    // Find the Monday 12 weeks ago (13 weeks total)
    var startDay = new Date(today);
    var todayDow = (today.getDay() + 6) % 7; // Mon=0
    startDay.setDate(today.getDate() - todayDow - 12 * 7);

    var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    // Month labels row
    var monthHtml = "";
    var cursor = new Date(startDay);
    var lastMonth = -1;
    for (var w = 0; w < 13; w++) {
      var m = cursor.getMonth();
      if (m !== lastMonth) {
        monthHtml += '<span class="heatmap-month">' + MONTHS[m] + '</span>';
        lastMonth = m;
      } else {
        monthHtml += '<span class="heatmap-month"></span>';
      }
      cursor.setDate(cursor.getDate() + 7);
    }

    // Build grid: 7 rows x 13 cols (Mon-Sun x 13 weeks)
    var cells = [];
    for (var row = 0; row < 7; row++) {
      for (var col = 0; col < 13; col++) {
        var cellDate = new Date(startDay);
        cellDate.setDate(startDay.getDate() + col * 7 + row);
        var key2 = cellDate.getFullYear() + "-" + String(cellDate.getMonth() + 1).padStart(2, "0") + "-" + String(cellDate.getDate()).padStart(2, "0");
        var count = counts[key2] || 0;
        var isFuture = cellDate > today;
        var level = isFuture ? "future" : count === 0 ? "" : count === 1 ? "level-1" : count === 2 ? "level-2" : count === 3 ? "level-3" : "level-4";
        cells.push('<div class="heatmap-cell ' + level + '"></div>');
      }
    }

    els.historyHeatmap.innerHTML =
      '<div class="heatmap-months">' + monthHtml + '</div>' +
      '<div class="heatmap-grid">' + cells.join("") + '</div>' +
      '<div class="heatmap-legend">' +
        '<span>Less</span>' +
        '<div class="heatmap-legend-cell heatmap-cell"></div>' +
        '<div class="heatmap-legend-cell heatmap-cell level-1"></div>' +
        '<div class="heatmap-legend-cell heatmap-cell level-2"></div>' +
        '<div class="heatmap-legend-cell heatmap-cell level-3"></div>' +
        '<div class="heatmap-legend-cell heatmap-cell level-4"></div>' +
        '<span>More</span>' +
      '</div>';
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

    // Heatmap
    renderHeatmap();

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
        var multTag = (item.multiplier && item.multiplier !== 1)
          ? " @ " + item.multiplier + "\u00D7"
          : "";
        html += `<div class="history-entry">`;
        html += `<span class="history-entry-name">${item.title}</span>`;
        html += `<span class="history-entry-meta">${mins} min${multTag} &middot; ${formatTime(time)}</span>`;
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

  // ── Sync / Account ─────────────────────────────────────────
  var lastSyncedAt = null;

  function syncAvailable() {
    return typeof SyncManager !== "undefined";
  }

  function updateSyncStatusLine() {
    if (!syncAvailable()) {
      els.syncStatusLine.classList.remove("visible");
      return;
    }
    if (SyncManager.isSignedIn()) {
      var email = SyncManager.getEmail();
      var text = "";
      if (lastSyncedAt) {
        text = "Synced " + timeAgo(lastSyncedAt);
        if (email) text += " \u00B7 " + email;
      } else {
        text = email ? "Signed in \u00B7 " + email : "Signed in";
      }
      els.syncStatusLine.textContent = text;
      els.syncStatusLine.classList.add("visible");
    } else {
      els.syncStatusLine.textContent = "Tap \u2699 to enable sync";
      els.syncStatusLine.classList.add("visible");
    }
  }

  function timeAgo(date) {
    var diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + " min ago";
    if (diff < 86400) return Math.floor(diff / 3600) + " hr ago";
    return "yesterday";
  }

  function renderSettingsAccount() {
    if (!syncAvailable()) {
      els.settingsAccount.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,0.3)">Sync not available</div>';
      return;
    }
    if (SyncManager.isSignedIn()) {
      var email = SyncManager.getEmail() || "Connected";
      els.settingsAccount.innerHTML =
        '<div class="settings-account-signed-in">' +
          '<span class="settings-account-email">' + email + '</span>' +
          '<div class="settings-account-actions">' +
            '<button class="btn-settings-action" id="btn-sync-now">SYNC</button>' +
            '<button class="btn-settings-action btn-settings-signout" id="btn-signout">SIGN OUT</button>' +
          '</div>' +
        '</div>';
      $("btn-sync-now").addEventListener("click", async function () {
        this.textContent = "SYNCING\u2026";
        await syncAndUpdateUI();
        this.textContent = "SYNC";
      });
      $("btn-signout").addEventListener("click", function () {
        SyncManager.signOut();
        lastSyncedAt = null;
        renderSettingsAccount();
        updateSyncStatusLine();
      });
    } else {
      els.settingsAccount.innerHTML =
        '<button class="btn-settings-action" id="btn-signin">SIGN IN WITH GOOGLE</button>';
      $("btn-signin").addEventListener("click", async function () {
        this.textContent = "SIGNING IN\u2026";
        try {
          await SyncManager.signIn();
          if (SyncManager.isSignedIn()) {
            renderSettingsAccount();
            updateSyncStatusLine();
            syncAndUpdateUI();
          } else {
            this.textContent = "SIGN IN WITH GOOGLE";
          }
        } catch (_) {
          this.textContent = "SIGN IN WITH GOOGLE";
        }
      });
    }
  }

  async function syncAndUpdateUI() {
    if (!syncAvailable() || !SyncManager.isSignedIn()) return;
    var result = await SyncManager.sync();
    if (result.ok) {
      lastSyncedAt = new Date();
      updateSyncStatusLine();
      updateStreakBanner();
      if (els.historyScreen.classList.contains("active")) renderHistory();
    }
  }

  // ── Settings panel ──────────────────────────────────────────
  function openSettings() {
    renderSettingsAccount();
    els.multiplierSlider.value = settings.multiplier;
    els.multiplierLabel.innerHTML = fmtMultiplier(settings.multiplier);
    els.ttsToggle.checked = settings.tts;
    els.settingsBackdrop.classList.add("open");
    els.settingsPanel.classList.add("open");
  }

  function closeSettings() {
    els.settingsBackdrop.classList.remove("open");
    els.settingsPanel.classList.remove("open");
  }

  function fmtMultiplier(v) {
    if (v === 1) return "1\u00D7";
    // Show one decimal for non-integers, no trailing zero for .5 etc.
    var s = Number(v) % 1 === 0 ? String(v) : v.toFixed(2).replace(/0$/, "");
    return s + "\u00D7";
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
    loadSettings();

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

    // ── Swap sheet ───────────────────────────────────────────
    els.swapBackdrop.addEventListener("click", closeSwap);

    // ── Per-session multiplier (+/−) ──────────────────────────
    els.btnMultDown.addEventListener("click", function () {
      if (state !== "idle" || !currentWorkoutId) return;
      sessionMultiplier = Math.max(0.5, +(sessionMultiplier - 0.25).toFixed(2));
      applySessionMultiplier();
    });
    els.btnMultUp.addEventListener("click", function () {
      if (state !== "idle" || !currentWorkoutId) return;
      sessionMultiplier = Math.min(3, +(sessionMultiplier + 0.25).toFixed(2));
      applySessionMultiplier();
    });

    // ── Settings panel ────────────────────────────────────────
    els.btnSettings.addEventListener("click", openSettings);
    els.settingsBackdrop.addEventListener("click", closeSettings);

    els.multiplierSlider.addEventListener("input", function () {
      var v = parseFloat(this.value);
      settings.multiplier = v;
      els.multiplierLabel.innerHTML = fmtMultiplier(v);
    });
    els.multiplierSlider.addEventListener("change", function () {
      saveSettings();
      buildPicker();   // update displayed times
    });

    els.ttsToggle.addEventListener("change", function () {
      settings.tts = this.checked;
      saveSettings();
    });

    // ── Sync setup (must never break the app) ────────────────
    try {
      await SyncManager.handleRedirect();
      updateSyncStatusLine();
      if (SyncManager.isSignedIn()) {
        syncAndUpdateUI();
      }
    } catch (_) {
      updateSyncStatusLine();
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
