/* ═══════════════════════════════════════════════════════════════
   Pajama Workout — History (storage layer)

   Storage format (versioned envelope):
   {
     version: <number>,
     entries: [ { workoutId, title, completedAt, durationSecs,
                   phasesCompleted, phasesTotal } ]
   }

   The storage adapter (_load / _save / _clear) is the only code that
   touches localStorage directly.  Swap those three functions to migrate
   to a remote backend (e.g. Firebase, Supabase, your own API) without
   changing any business logic.
   ═══════════════════════════════════════════════════════════════ */

const WorkoutHistory = (function () {
  "use strict";

  const STORAGE_KEY   = "pajama-workout-history";
  const SCHEMA_VERSION = 1;

  // ── Storage adapter (swap for remote later) ────────────────
  function _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return null;
    }
  }

  function _save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) { /* storage full or unavailable */ }
  }

  function _clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) { /* ignore */ }
  }

  // ── Migration system ──────────────────────────────────────
  // Each key is the version we're migrating TO.
  // The function receives the data envelope and returns the upgraded version.
  const MIGRATIONS = {
    // Example for future use:
    // 2: (data) => {
    //   data.entries.forEach(e => { e.tags = e.tags || []; });
    //   data.version = 2;
    //   return data;
    // },
  };

  function migrate(data) {
    while (data.version < SCHEMA_VERSION) {
      const next = data.version + 1;
      const fn = MIGRATIONS[next];
      if (!fn) break;  // no migration path — stop
      data = fn(data);
    }
    data.version = SCHEMA_VERSION;
    return data;
  }

  /**
   * Load the envelope, handling:
   *  - null / missing → fresh envelope
   *  - raw array (pre-versioned legacy data) → wrap in envelope
   *  - versioned envelope → migrate if needed
   *  - corrupt data → fresh envelope
   */
  function loadEnvelope() {
    const raw = _load();

    // No stored data
    if (raw == null) {
      return { version: SCHEMA_VERSION, entries: [] };
    }

    // Legacy: bare array (pre-versioned format)
    if (Array.isArray(raw)) {
      const data = { version: 1, entries: raw.map(normaliseEntry) };
      _save(data);  // persist the upgrade
      return migrate(data);
    }

    // Versioned envelope
    if (raw && typeof raw === "object" && typeof raw.version === "number") {
      raw.entries = (raw.entries || []).map(normaliseEntry);
      if (raw.version < SCHEMA_VERSION) {
        const migrated = migrate(raw);
        _save(migrated);
        return migrated;
      }
      return raw;
    }

    // Corrupt — start fresh
    return { version: SCHEMA_VERSION, entries: [] };
  }

  /** Apply defaults so old entries missing new fields don't break readers */
  function normaliseEntry(e) {
    return {
      workoutId:       e.workoutId       || "unknown",
      title:           e.title           || "Workout",
      completedAt:     e.completedAt     || new Date(0).toISOString(),
      durationSecs:    e.durationSecs    || 0,
      phasesCompleted: e.phasesCompleted || 0,
      phasesTotal:     e.phasesTotal     || 0,
    };
  }

  // ── Public API ──────────────────────────────────────────────

  /** Record a completed workout */
  function record(entry) {
    const data = loadEnvelope();
    data.entries.push(normaliseEntry({
      workoutId:       entry.workoutId,
      title:           entry.title,
      completedAt:     new Date().toISOString(),
      durationSecs:    entry.durationSecs,
      phasesCompleted: entry.phasesCompleted,
      phasesTotal:     entry.phasesTotal,
    }));
    _save(data);
  }

  /** Return all entries, most recent first */
  function getAll() {
    return loadEnvelope().entries
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  /** Total number of completed workouts */
  function totalCount() {
    return loadEnvelope().entries.length;
  }

  /**
   * Current streak: consecutive days (up to today) with at least one workout.
   * A "day" is based on local time.
   */
  function streak() {
    const entries = loadEnvelope().entries;
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
    const entries = loadEnvelope().entries;
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    return entries.filter(e => new Date(e.completedAt) >= monday).length;
  }

  function clear() {
    _clear();
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

// Allow Node.js test imports while keeping browser globals working
if (typeof module !== "undefined") module.exports = WorkoutHistory;
