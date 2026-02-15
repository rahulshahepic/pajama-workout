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
  let sessionRestMultiplier = 1;  // per-workout rest override

  // ── User settings (persisted to localStorage) ──────────────
  const SETTINGS_KEY = "pajama-settings";
  let settings = { multiplier: 1, restMultiplier: 1, tts: false, announceHints: false, weeklyGoal: 3, ambient: false };

  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (s && typeof s === "object") {
        settings.multiplier = typeof s.multiplier === "number" ? s.multiplier : 1;
        settings.restMultiplier = typeof s.restMultiplier === "number" ? s.restMultiplier : 1;
        settings.tts = !!s.tts;
        settings.announceHints = !!s.announceHints;
        settings.weeklyGoal = typeof s.weeklyGoal === "number" ? s.weeklyGoal : 3;
        settings.ambient = !!s.ambient;
      }
    } catch (_) {}
  }

  function saveSettings() {
    settings._syncedAt = Date.now();
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
      pickerStatus:  $("picker-status"),
      fabCreate:     $("fab-create"),
      wakeIndicator: $("wake-indicator"),
      btnSettings:       $("btn-settings"),
      settingsBackdrop:  $("settings-backdrop"),
      settingsPanel:     $("settings-panel"),
      settingsAccount:   $("settings-account"),
      multiplierSlider:  $("multiplier-slider"),
      multiplierLabel:   $("multiplier-label"),
      restMultSlider:    $("rest-multiplier-slider"),
      restMultLabel:     $("rest-multiplier-label"),
      ttsToggle:         $("tts-toggle"),
      hintsToggle:       $("hints-toggle"),
      ambientToggle:     $("ambient-toggle"),
      goalLabel:         $("goal-label"),
      btnGoalDown:       $("btn-goal-down"),
      btnGoalUp:         $("btn-goal-up"),
      sessionMultiplier: $("session-multiplier"),
      sessionMultLabel:  $("session-mult-label"),
      btnMultDown:       $("btn-mult-down"),
      btnMultUp:         $("btn-mult-up"),
      builderScreen:     $("builder-screen"),
      btnBuilderBack:    $("btn-builder-back"),
      builderName:       $("builder-name"),
      builderPhases:     $("builder-phases"),
      btnAddWork:        $("btn-add-work"),
      btnAddRest:        $("btn-add-rest"),
      btnAddStretch:     $("btn-add-stretch"),
      btnAddYoga:        $("btn-add-yoga"),
      btnSaveWorkout:    $("btn-save-workout"),
      btnShare:          $("btn-share"),
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

  function summarise(phasesArr, mult, restMult) {
    let workCount = 0, stretchCount = 0, yogaCount = 0, total = 0;
    var m = mult || 1;
    var rm = restMult || m;
    for (var i = 0; i < phasesArr.length; i++) {
      var p = phasesArr[i];
      if (p.type === "work") workCount++;
      if (p.type === "stretch") stretchCount++;
      if (p.type === "yoga") yogaCount++;
      var dur = Math.round(p.duration * (p.type === "rest" ? rm : m));
      // If announceHints is on, rest phases may be extended so the
      // next phase's hint has time to be read aloud.
      if (settings.announceHints && p.type === "rest" && i + 1 < phasesArr.length) {
        var nextHint = phasesArr[i + 1].hint;
        if (nextHint) dur = Math.max(dur, hintSpeechSecs(nextHint));
      }
      total += dur;
    }
    const mins = Math.round(total / 60);
    const parts = [`${mins} min`];
    if (workCount)    parts.push(`${workCount} exercises`);
    if (yogaCount)    parts.push(`${yogaCount} poses`);
    if (stretchCount) parts.push(`${stretchCount} stretches`);
    return parts.join(" \u00B7 ");
  }

  /**
   * Build the final phase array with durations adjusted for multipliers
   * and (when announceHints is on) for minimum rest to fit the next hint.
   */
  function buildPhases(raw, m, rm) {
    var result = [];
    for (var i = 0; i < raw.length; i++) {
      var p = raw[i];
      var mult = p.type === "rest" ? rm : m;
      var dur = Math.round(p.duration * mult);
      if (settings.announceHints && p.type === "rest" && i + 1 < raw.length) {
        var nextHint = raw[i + 1].hint;
        if (nextHint) dur = Math.max(dur, hintSpeechSecs(nextHint));
      }
      result.push({ name: p.name, type: p.type, duration: dur, hint: p.hint });
    }
    return result;
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

  /** Speak hint text (only when announceHints is on). */
  function speakHint(text) {
    if (!settings.announceHints || !window.speechSynthesis) return;
    var u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.volume = 0.8;
    speechSynthesis.speak(u);
  }

  /** Estimate how many seconds TTS needs for a given text (~2.5 words/sec at rate 1.0, +1s buffer). */
  function hintSpeechSecs(text) {
    if (!text) return 0;
    var words = text.trim().split(/\s+/).length;
    return Math.ceil(words / 2.5) + 1;
  }

  function cancelSpeech() {
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  // ── Ambient drone (oscillator-based) ────────────────────────
  var ambientNodes = null;

  function startAmbient() {
    if (!settings.ambient || ambientNodes) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var gain = audioCtx.createGain();
      gain.gain.value = 0.03;
      gain.connect(audioCtx.destination);

      // Layer two detuned oscillators for a warm pad
      var osc1 = audioCtx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = 110;  // A2
      osc1.connect(gain);
      osc1.start();

      var osc2 = audioCtx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 165;  // E3 (a fifth above)
      osc2.detune.value = -5;
      osc2.connect(gain);
      osc2.start();

      ambientNodes = { gain: gain, osc1: osc1, osc2: osc2 };
    } catch (_) {}
  }

  function stopAmbient() {
    if (!ambientNodes) return;
    try {
      ambientNodes.gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      var nodes = ambientNodes;
      setTimeout(function () {
        nodes.osc1.stop();
        nodes.osc2.stop();
      }, 600);
    } catch (_) {}
    ambientNodes = null;
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
    els.btnShare.style.display = "none";
    showButtons("done");
    releaseWakeLock();
    stopAmbient();

    // Record to history
    const w = allWorkouts()[currentWorkoutId];
    WorkoutHistory.record({
      workoutId:       currentWorkoutId,
      title:           w.title,
      durationSecs:    totalTime,
      phasesCompleted: phases.length,
      phasesTotal:     phases.length,
      multiplier:      sessionMultiplier,
    });

    // Check if we should offer to hide frequently-skipped exercises
    checkHidePrompt();

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
      // If entering a rest phase with announceHints, read the upcoming hint
      if (settings.announceHints && nx.type === "rest" && phaseIndex + 1 < phases.length) {
        speakHint(phases[phaseIndex + 1].hint);
      }
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
    els.btnShare.style.display = "none";

    const cdSecs = typeof COUNTDOWN_SECS === "number" ? COUNTDOWN_SECS : 0;
    if (cdSecs > 0) {
      startCountdown(cdSecs);
    } else {
      beginWorkout();
    }
  }

  function startCountdown(secs) {
    // When announceHints is on, ensure the countdown is long enough for the first hint
    if (settings.announceHints && phases.length > 0 && phases[0].hint) {
      secs = Math.max(secs, hintSpeechSecs(phases[0].hint));
    }
    countdownLeft = secs;
    state = "countdown";
    speak("Get ready");
    if (settings.announceHints && phases.length > 0 && phases[0].hint) {
      speakHint(phases[0].hint);
    }
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
    startAmbient();
  }

  function pause() {
    state = "paused";
    clearInterval(interval);
    showButtons("paused");
    releaseWakeLock();
    stopAmbient();
  }

  function resume() {
    state = "running";
    showButtons("running");
    clearInterval(interval);
    interval = setInterval(tick, 1000);
    requestWakeLock();
    startAmbient();
  }

  function reset() {
    clearInterval(interval);
    cancelSpeech();
    stopAmbient();
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
    // Record the skip for memory
    recordSkip(phases[phaseIndex].name);
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
    els.builderScreen.classList.remove("active");
    els.fabCreate.style.display = "flex";

    applyTheme("idle");
    els.progressFill.style.width = "0%";

    if (push) history.pushState({ screen: "picker" }, "");

    buildPicker();
    updatePickerStatus();
  }

  function buildPicker() {
    const container = $("workout-list");
    container.innerHTML = "";
    var m = settings.multiplier;
    var all = allWorkouts();

    // Sort by duration (shortest first)
    const sorted = Object.keys(all).sort(
      (a, b) => workoutDuration(all[a], m) - workoutDuration(all[b], m)
    );

    for (const key of sorted) {
      const w    = all[key];
      const card = document.createElement("div");
      card.className = "workout-card";
      var isCustom = !!w.custom;
      var cat = (typeof CATEGORIES !== "undefined" && w.category && CATEGORIES[w.category]) ? CATEGORIES[w.category] : null;
      if (cat) {
        card.style.borderLeftWidth = "3px";
        card.style.borderLeftColor = cat.color;
      }
      var meta = summarise(w.phases, m, settings.restMultiplier);
      var actionsHtml = "";
      if (isCustom) {
        actionsHtml =
          '<div class="workout-card-actions">' +
            '<button class="workout-card-btn workout-card-edit" data-id="' + key + '" aria-label="Edit">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
            '</button>' +
            '<button class="workout-card-btn workout-card-delete" data-id="' + key + '" aria-label="Delete">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>' +
            '</button>' +
          '</div>';
      }
      card.innerHTML =
        '<div class="workout-card-row">' +
          '<div class="workout-card-info">' +
            '<div class="workout-card-title">' + escHtml(w.title) + '</div>' +
            '<div class="workout-card-meta">' + meta + '</div>' +
          '</div>' +
          actionsHtml +
        '</div>';
      // Clicking the card body starts the workout
      card.querySelector(".workout-card-info").addEventListener("click", function () { selectWorkout(key); });
      // If custom, wire edit/delete buttons
      if (isCustom) {
        card.querySelector(".workout-card-edit").addEventListener("click", function (e) {
          e.stopPropagation();
          showBuilder(true, this.dataset.id);
        });
        card.querySelector(".workout-card-delete").addEventListener("click", function (e) {
          e.stopPropagation();
          deleteCustomWorkout(this.dataset.id);
        });
      }
      // For built-in workouts (no action buttons), the card-info covers entire card
      card.style.cursor = "pointer";
      container.appendChild(card);
    }
  }

  function deleteCustomWorkout(id) {
    if (!customWorkouts[id]) return;
    delete customWorkouts[id];
    saveCustomWorkouts();
    buildPicker();
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

  // ── Skip memory (localStorage) ─────────────────────────────
  var SKIP_KEY = "pajama-skip-counts";
  var HIDDEN_KEY = "pajama-hidden-exercises";
  var skipCounts = {};   // { "exerciseName": count }
  var hiddenExercises = {};   // { "workoutId:exerciseName": true }
  var SKIP_THRESHOLD = 3;

  function loadSkipData() {
    try {
      var sc = JSON.parse(localStorage.getItem(SKIP_KEY));
      if (sc && typeof sc === "object") skipCounts = sc;
    } catch (_) {}
    try {
      var he = JSON.parse(localStorage.getItem(HIDDEN_KEY));
      if (he && typeof he === "object") hiddenExercises = he;
    } catch (_) {}
  }

  function saveSkipCounts() {
    try { localStorage.setItem(SKIP_KEY, JSON.stringify(skipCounts)); } catch (_) {}
  }

  function saveHiddenExercises() {
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenExercises)); } catch (_) {}
  }

  function recordSkip(exerciseName) {
    if (!exerciseName || exerciseName === "Rest") return;
    skipCounts[exerciseName] = (skipCounts[exerciseName] || 0) + 1;
    saveSkipCounts();

    if (skipCounts[exerciseName] === SKIP_THRESHOLD && currentWorkoutId) {
      var key = currentWorkoutId + ":" + exerciseName;
      if (!hiddenExercises[key]) {
        // Show a subtle prompt after the workout (don't interrupt)
        pendingHidePrompt = { key: key, name: exerciseName };
      }
    }
  }

  var pendingHidePrompt = null;

  function checkHidePrompt() {
    if (!pendingHidePrompt) return;
    var p = pendingHidePrompt;
    pendingHidePrompt = null;
    // Render a small dismissible banner at the bottom of done screen
    var banner = document.createElement("div");
    banner.className = "hide-prompt";
    banner.innerHTML =
      '<span>You skip <strong>' + p.name + '</strong> often. Hide it?</span>' +
      '<button class="hide-prompt-yes">HIDE</button>' +
      '<button class="hide-prompt-no">KEEP</button>';
    banner.querySelector(".hide-prompt-yes").addEventListener("click", function () {
      hiddenExercises[p.key] = true;
      saveHiddenExercises();
      banner.remove();
    });
    banner.querySelector(".hide-prompt-no").addEventListener("click", function () {
      // Reset count so we don't keep asking
      skipCounts[p.name] = 0;
      saveSkipCounts();
      banner.remove();
    });
    els.timerScreen.appendChild(banner);
  }

  /** Filter out hidden exercises for a given workout. */
  function filterHidden(workoutId, phasesArr) {
    return phasesArr.filter(function (p) {
      if (p.type === "rest") return true;
      var key = workoutId + ":" + p.name;
      return !hiddenExercises[key];
    }).filter(function (p, i, arr) {
      // Remove consecutive rests (orphaned by hiding the exercise before them)
      if (p.type === "rest" && i > 0 && arr[i - 1].type === "rest") return false;
      // Remove trailing rest
      if (p.type === "rest" && i === arr.length - 1) return false;
      // Remove leading rest
      if (p.type === "rest" && i === 0) return false;
      return true;
    });
  }

  // ── Custom workouts (localStorage) ──────────────────────────
  var CUSTOM_KEY = "pajama-custom-workouts";
  var customWorkouts = {};

  function loadCustomWorkouts() {
    try {
      var raw = JSON.parse(localStorage.getItem(CUSTOM_KEY));
      if (raw && typeof raw === "object") customWorkouts = raw;
    } catch (_) {}
  }

  function saveCustomWorkouts() {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customWorkouts)); } catch (_) {}
  }

  /** Merge built-in + custom workouts for the picker. */
  function allWorkouts() {
    var merged = {};
    for (var k in WORKOUTS) merged[k] = WORKOUTS[k];
    for (var c in customWorkouts) merged[c] = customWorkouts[c];
    return merged;
  }

  // ── Builder screen ──────────────────────────────────────────
  var builderPhaseList = [];
  var editingWorkoutId = null;  // null = new, string = editing existing custom

  function showBuilder(push, editId) {
    editingWorkoutId = editId || null;
    els.pickerScreen.classList.remove("active");
    els.timerScreen.classList.remove("active");
    els.historyScreen.classList.remove("active");
    els.builderScreen.classList.add("active");
    els.fabCreate.style.display = "none";
    if (push !== false) history.pushState({ screen: "builder" }, "");

    if (editId && customWorkouts[editId]) {
      var w = customWorkouts[editId];
      els.builderName.value = w.title;
      builderPhaseList = w.phases.map(function (p) {
        return { name: p.name, type: p.type, duration: p.duration, hint: p.hint || "" };
      });
    } else {
      els.builderName.value = "";
      builderPhaseList = [];
    }
    renderBuilderPhases();
  }

  function hideBuilder() {
    history.back();
  }

  function addBuilderPhase(type) {
    var defaults = { work: { name: "Exercise", duration: 40 }, rest: { name: "Rest", duration: 20 }, stretch: { name: "Stretch", duration: 30 }, yoga: { name: "Pose", duration: 30 } };
    var d = defaults[type] || defaults.work;
    builderPhaseList.push({ name: d.name, type: type, duration: d.duration, hint: "" });
    renderBuilderPhases();
  }

  function removeBuilderPhase(idx) {
    builderPhaseList.splice(idx, 1);
    renderBuilderPhases();
  }

  function renderBuilderPhases() {
    els.builderPhases.innerHTML = "";
    for (var i = 0; i < builderPhaseList.length; i++) {
      var p = builderPhaseList[i];
      var row = document.createElement("div");
      row.className = "builder-phase";
      row.innerHTML =
        '<span class="builder-phase-type type-' + p.type + '">' + p.type + '</span>' +
        '<input type="text" class="builder-phase-name" value="' + escHtml(p.name) + '" data-idx="' + i + '">' +
        '<input type="number" class="builder-phase-dur" value="' + p.duration + '" min="5" max="300" data-idx="' + i + '">s' +
        '<button class="builder-phase-remove" data-idx="' + i + '">&times;</button>';
      els.builderPhases.appendChild(row);
    }
    // Wire inline events
    els.builderPhases.querySelectorAll(".builder-phase-name").forEach(function (el) {
      el.addEventListener("change", function () {
        builderPhaseList[+this.dataset.idx].name = this.value;
      });
    });
    els.builderPhases.querySelectorAll(".builder-phase-dur").forEach(function (el) {
      el.addEventListener("change", function () {
        builderPhaseList[+this.dataset.idx].duration = Math.max(5, Math.min(300, +this.value || 30));
      });
    });
    els.builderPhases.querySelectorAll(".builder-phase-remove").forEach(function (el) {
      el.addEventListener("click", function () {
        removeBuilderPhase(+this.dataset.idx);
      });
    });
  }

  function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function saveCustomWorkout() {
    var title = els.builderName.value.trim();
    if (!title) { els.builderName.focus(); return; }
    if (builderPhaseList.length === 0) return;

    // Sync any unsaved inline edits
    els.builderPhases.querySelectorAll(".builder-phase-name").forEach(function (el) {
      builderPhaseList[+el.dataset.idx].name = el.value;
    });
    els.builderPhases.querySelectorAll(".builder-phase-dur").forEach(function (el) {
      builderPhaseList[+el.dataset.idx].duration = Math.max(5, Math.min(300, +el.value || 30));
    });

    var id = editingWorkoutId || "custom-" + Date.now();
    customWorkouts[id] = {
      id: id,
      title: title,
      category: "custom",
      subtitle: "Custom workout",
      description: "",
      custom: true,
      phases: builderPhaseList.map(function (p) {
        return { name: p.name, type: p.type, duration: p.duration, hint: p.hint || "" };
      }),
    };
    saveCustomWorkouts();
    hideBuilder();
  }

  /** Rebuild phases from the original workout using sessionMultiplier. */
  function applySessionMultiplier() {
    if (!currentWorkoutId) return;
    var w = allWorkouts()[currentWorkoutId];
    var m = sessionMultiplier;
    var rm = sessionRestMultiplier;
    phases = buildPhases(filterHidden(currentWorkoutId, w.phases), m, rm);
    totalTime = phases.reduce(function (sum, p) { return sum + p.duration; }, 0);
    timeLeft = phases[0].duration;

    // Update ready screen display
    els.timerDisplay.textContent = fmt(phases[0].duration);
    els.counterLabel.textContent = summarise(w.phases, m, sessionRestMultiplier);
    els.sessionMultLabel.innerHTML = fmtMultiplier(m);
  }

  function selectWorkout(id, push) {
    currentWorkoutId = id;
    sessionMultiplier = settings.multiplier;
    sessionRestMultiplier = settings.restMultiplier;
    const w = allWorkouts()[id];
    var m = sessionMultiplier;
    var rm = sessionRestMultiplier;
    var filtered = filterHidden(id, w.phases);
    phases = buildPhases(filtered, m, rm);
    totalTime = phases.reduce((sum, p) => sum + p.duration, 0);

    els.pickerScreen.classList.remove("active");
    els.historyScreen.classList.remove("active");
    els.builderScreen.classList.remove("active");
    els.timerScreen.classList.add("active");
    els.fabCreate.style.display = "none";

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
    els.counterLabel.textContent = summarise(w.phases, m, sessionRestMultiplier);
    els.exerciseName.textContent = w.title;
    els.exerciseHint.textContent = w.subtitle;
    els.upnextContainer.style.display = "none";
    els.sessionMultiplier.classList.add("visible");
    els.sessionMultLabel.innerHTML = fmtMultiplier(m);
    els.phaseListContainer.classList.add("visible");
    els.btnShare.style.display = w.custom ? "inline-block" : "none";
    renderPhaseList();
    showButtons("idle");
  }

  // ── History screen ─────────────────────────────────────────
  function showHistory(push) {
    els.pickerScreen.classList.remove("active");
    els.timerScreen.classList.remove("active");
    els.builderScreen.classList.remove("active");
    els.historyScreen.classList.add("active");
    els.fabCreate.style.display = "none";
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

  /** Single status line: combines goal + streak info into one subtle line. */
  function updatePickerStatus() {
    var parts = [];
    var goal = settings.weeklyGoal;
    if (goal && goal > 0) {
      var count = WorkoutHistory.thisWeekCount();
      if (count >= goal) {
        parts.push("Goal hit! " + count + "/" + goal + " this week");
      } else {
        parts.push(count + "/" + goal + " this week");
      }
    }
    var s = WorkoutHistory.streak();
    if (s >= 2) parts.push(s + " day streak");
    els.pickerStatus.textContent = parts.join(" \u00B7 ");
  }

  // ── Sync / Account ─────────────────────────────────────────
  var lastSyncedAt = null;

  function syncAvailable() {
    return typeof SyncManager !== "undefined";
  }

  function updateSyncStatusLine() {
    // Sync status is now only shown in settings, not on the home page.
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
      // Reload custom workouts in case remote had new ones
      loadCustomWorkouts();
      // Reload settings in case remote had different values
      if (result.settingsChanged) loadSettings();
      updatePickerStatus();
      if (els.pickerScreen.classList.contains("active")) buildPicker();
      if (els.historyScreen.classList.contains("active")) renderHistory();
    }
  }

  // ── Settings panel ──────────────────────────────────────────
  function openSettings() {
    renderSettingsAccount();
    els.multiplierSlider.value = settings.multiplier;
    els.multiplierLabel.innerHTML = fmtMultiplier(settings.multiplier);
    els.restMultSlider.value = settings.restMultiplier;
    els.restMultLabel.innerHTML = fmtMultiplier(settings.restMultiplier);
    els.ttsToggle.checked = settings.tts;
    els.hintsToggle.checked = settings.announceHints;
    els.ambientToggle.checked = settings.ambient;
    els.goalLabel.textContent = settings.weeklyGoal + "\u00D7/wk";
    els.settingsBackdrop.classList.add("open");
    els.settingsPanel.classList.add("open");
    els.settingsPanel.style.transform = "";
  }

  function closeSettings() {
    els.settingsBackdrop.classList.remove("open");
    els.settingsPanel.classList.remove("open");
    els.settingsPanel.style.transform = "";
  }

  // ── Swipe-down-to-close for bottom sheets ──────────────────
  function setupSwipeToDismiss(panel, backdrop, onClose) {
    var startY = 0, currentY = 0, dragging = false;
    // Use the handle bar as the drag target — it doesn't scroll,
    // so the browser won't hijack the touch for scroll.
    var handle = panel.querySelector(".settings-handle");
    var dragTarget = handle || panel;

    dragTarget.addEventListener("touchstart", function (e) {
      startY = e.touches[0].clientY;
      currentY = startY;
      dragging = true;
      panel.style.transition = "none";
    }, { passive: true });

    // MUST be passive:false so we can preventDefault() to stop the
    // browser from scrolling the panel while we're dragging it.
    panel.addEventListener("touchmove", function (e) {
      if (!dragging) return;
      e.preventDefault();
      currentY = e.touches[0].clientY;
      var dy = currentY - startY;
      if (dy < 0) dy = 0;
      panel.style.transform = "translateY(" + dy + "px)";
      var opacity = Math.max(0, 1 - dy / 300);
      backdrop.style.opacity = opacity;
    }, { passive: false });

    panel.addEventListener("touchend", function () {
      if (!dragging) return;
      dragging = false;
      var dy = currentY - startY;
      panel.style.transition = "";
      backdrop.style.opacity = "";
      if (dy > 80) {
        onClose();
      } else {
        panel.style.transform = "";
      }
    });
  }

  function fmtMultiplier(v) {
    if (v === 1) return "1\u00D7";
    // Show one decimal for non-integers, no trailing zero for .5 etc.
    var s = Number(v) % 1 === 0 ? String(v) : v.toFixed(2).replace(/0$/, "");
    return s + "\u00D7";
  }

  // ── Share workout (URL hash) ────────────────────────────────
  function encodeWorkout(w) {
    var compact = {
      t: w.title,
      p: w.phases.map(function (ph) {
        return [ph.name, ph.type, ph.duration, ph.hint || ""];
      }),
    };
    return btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
  }

  function decodeWorkout(hash) {
    try {
      var json = decodeURIComponent(escape(atob(hash)));
      var compact = JSON.parse(json);
      if (!compact.t || !compact.p || !compact.p.length) return null;
      return {
        title: compact.t,
        phases: compact.p.map(function (a) {
          return { name: a[0], type: a[1], duration: a[2], hint: a[3] || "" };
        }),
      };
    } catch (_) { return null; }
  }

  function shareCurrentWorkout() {
    if (!currentWorkoutId) return;
    var w = allWorkouts()[currentWorkoutId];
    if (!w) return;
    var hash = encodeWorkout(w);
    var url = location.origin + location.pathname + "#w=" + hash;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        showShareToast("Link copied!");
      }).catch(function () {
        showShareToast(url);
      });
    } else {
      prompt("Share this URL:", url);
    }
  }

  function showShareToast(msg) {
    var toast = document.createElement("div");
    toast.className = "share-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.classList.add("visible"); }, 10);
    setTimeout(function () {
      toast.classList.remove("visible");
      setTimeout(function () { toast.remove(); }, 300);
    }, 2000);
  }

  function checkImportHash() {
    var hash = location.hash;
    if (!hash || !hash.startsWith("#w=")) return false;
    var data = decodeWorkout(hash.slice(3));
    if (!data) return false;

    // Import as a custom workout
    var id = "import-" + Date.now();
    customWorkouts[id] = {
      id: id,
      title: data.title,
      category: "custom",
      subtitle: "Imported workout",
      description: "",
      custom: true,
      phases: data.phases,
    };
    saveCustomWorkouts();
    // Clear the hash
    history.replaceState(null, "", location.pathname);
    return id;
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
    } else if (s.screen === "workout" && allWorkouts()[s.id]) {
      selectWorkout(s.id, false);
    } else if (s.screen === "history") {
      showHistory(false);
    } else if (s.screen === "builder") {
      showBuilder(false);
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

    loadCustomWorkouts();
    loadSkipData();

    // Check for shared workout import
    var importedId = checkImportHash();

    // If only one workout, skip picker and go straight to it
    var workoutKeys = Object.keys(allWorkouts());
    if (importedId) {
      selectWorkout(importedId);
    } else if (workoutKeys.length === 1) {
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

    // ── Builder ───────────────────────────────────────────────
    els.fabCreate.addEventListener("click", function () { showBuilder(true); });
    els.btnBuilderBack.addEventListener("click", hideBuilder);
    els.btnAddWork.addEventListener("click", function () { addBuilderPhase("work"); });
    els.btnAddRest.addEventListener("click", function () { addBuilderPhase("rest"); });
    els.btnAddStretch.addEventListener("click", function () { addBuilderPhase("stretch"); });
    els.btnAddYoga.addEventListener("click", function () { addBuilderPhase("yoga"); });
    els.btnSaveWorkout.addEventListener("click", saveCustomWorkout);
    els.btnShare.addEventListener("click", shareCurrentWorkout);

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
    $("btn-settings-done").addEventListener("click", closeSettings);
    setupSwipeToDismiss(els.settingsPanel, els.settingsBackdrop, closeSettings);
    setupSwipeToDismiss(els.swapPanel, els.swapBackdrop, closeSwap);

    els.multiplierSlider.addEventListener("input", function () {
      var v = parseFloat(this.value);
      settings.multiplier = v;
      els.multiplierLabel.innerHTML = fmtMultiplier(v);
    });
    els.multiplierSlider.addEventListener("change", function () {
      saveSettings();
      buildPicker();   // update displayed times
    });

    els.restMultSlider.addEventListener("input", function () {
      var v = parseFloat(this.value);
      settings.restMultiplier = v;
      els.restMultLabel.innerHTML = fmtMultiplier(v);
    });
    els.restMultSlider.addEventListener("change", function () {
      saveSettings();
    });

    els.ttsToggle.addEventListener("change", function () {
      settings.tts = this.checked;
      saveSettings();
    });

    els.hintsToggle.addEventListener("change", function () {
      settings.announceHints = this.checked;
      saveSettings();
    });

    els.ambientToggle.addEventListener("change", function () {
      settings.ambient = this.checked;
      saveSettings();
    });

    els.btnGoalDown.addEventListener("click", function () {
      settings.weeklyGoal = Math.max(1, settings.weeklyGoal - 1);
      els.goalLabel.textContent = settings.weeklyGoal + "\u00D7/wk";
      saveSettings();
    });
    els.btnGoalUp.addEventListener("click", function () {
      settings.weeklyGoal = Math.min(14, settings.weeklyGoal + 1);
      els.goalLabel.textContent = settings.weeklyGoal + "\u00D7/wk";
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
