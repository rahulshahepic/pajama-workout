/* ═══════════════════════════════════════════════════════════════
   Pajama Workout — History (localStorage)
   ═══════════════════════════════════════════════════════════════ */

const WorkoutHistory = (function () {
  "use strict";

  const STORAGE_KEY = "pajama-workout-history";

  // ── Read / write ────────────────────────────────────────────
  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (_) {
      return [];
    }
  }

  function save(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (_) { /* storage full or unavailable */ }
  }

  // ── Public API ──────────────────────────────────────────────

  /** Record a completed workout */
  function record(entry) {
    const entries = load();
    entries.push({
      workoutId:       entry.workoutId,
      title:           entry.title,
      completedAt:     new Date().toISOString(),
      durationSecs:    entry.durationSecs,
      phasesCompleted: entry.phasesCompleted,
      phasesTotal:     entry.phasesTotal,
    });
    save(entries);
  }

  /** Return all entries, most recent first */
  function getAll() {
    return load().sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  /** Total number of completed workouts */
  function totalCount() {
    return load().length;
  }

  /**
   * Current streak: consecutive days (up to today) with at least one workout.
   * A "day" is based on local time.
   */
  function streak() {
    const entries = load();
    if (entries.length === 0) return 0;

    // Build a Set of unique day strings (YYYY-MM-DD in local time)
    const days = new Set();
    for (const e of entries) {
      const d = new Date(e.completedAt);
      days.add(dateKey(d));
    }

    // Walk backwards from today
    let count = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (days.has(dateKey(cursor))) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return count;
  }

  /** This week's total (Mon–Sun) */
  function thisWeekCount() {
    const entries = load();
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    return entries.filter(e => new Date(e.completedAt) >= monday).length;
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── Helpers ─────────────────────────────────────────────────
  function dateKey(d) {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  // ── Expose ──────────────────────────────────────────────────
  return { record, getAll, totalCount, streak, thisWeekCount, clear };
})();
