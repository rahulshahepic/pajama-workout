/**
 * Sync module tests — merge logic for entries, custom workouts, settings.
 *
 * Run: node --test tests/sync.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Mock localStorage (sync.js references it at function-call time, not load time)
const store = {};
global.localStorage = {
  getItem(key) { return store[key] ?? null; },
  setItem(key, val) { store[key] = String(val); },
  removeItem(key) { delete store[key]; },
};

const SyncManager = require("../js/sync.js");
const { _mergeEntries: mergeEntries, _mergeCustomWorkouts: mergeCustomWorkouts, _mergeSettings: mergeSettings, _workoutTimestamp: workoutTimestamp } = SyncManager;

// ── mergeEntries ────────────────────────────────────────────────
describe("mergeEntries()", () => {
  it("returns union of two disjoint arrays", () => {
    const a = [{ completedAt: "2025-01-01T00:00:00Z", title: "A" }];
    const b = [{ completedAt: "2025-02-01T00:00:00Z", title: "B" }];
    const merged = mergeEntries(a, b);
    assert.equal(merged.length, 2);
  });

  it("deduplicates by completedAt (first array wins)", () => {
    const a = [{ completedAt: "2025-01-01T00:00:00Z", title: "Local" }];
    const b = [{ completedAt: "2025-01-01T00:00:00Z", title: "Remote" }];
    const merged = mergeEntries(a, b);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, "Local");
  });

  it("handles empty arrays", () => {
    assert.deepEqual(mergeEntries([], []), []);
    assert.equal(mergeEntries([], [{ completedAt: "x" }]).length, 1);
    assert.equal(mergeEntries([{ completedAt: "x" }], []).length, 1);
  });

  it("merges many entries preserving all unique timestamps", () => {
    const a = Array.from({ length: 5 }, (_, i) => ({ completedAt: `2025-01-0${i + 1}T00:00:00Z` }));
    const b = Array.from({ length: 5 }, (_, i) => ({ completedAt: `2025-02-0${i + 1}T00:00:00Z` }));
    const merged = mergeEntries(a, b);
    assert.equal(merged.length, 10);
  });

  it("handles overlapping subsets", () => {
    const a = [
      { completedAt: "2025-01-01T00:00:00Z" },
      { completedAt: "2025-01-02T00:00:00Z" },
      { completedAt: "2025-01-03T00:00:00Z" },
    ];
    const b = [
      { completedAt: "2025-01-02T00:00:00Z" },
      { completedAt: "2025-01-03T00:00:00Z" },
      { completedAt: "2025-01-04T00:00:00Z" },
    ];
    const merged = mergeEntries(a, b);
    assert.equal(merged.length, 4);
  });
});

// ── workoutTimestamp ─────────────────────────────────────────────
describe("workoutTimestamp()", () => {
  it("returns 0 for null/undefined", () => {
    assert.equal(workoutTimestamp(null), 0);
    assert.equal(workoutTimestamp(undefined), 0);
  });

  it("returns _updatedAt for a live workout", () => {
    assert.equal(workoutTimestamp({ title: "A", _updatedAt: 5000 }), 5000);
  });

  it("returns _deletedAt for a tombstone", () => {
    assert.equal(workoutTimestamp({ _deleted: true, _deletedAt: 7000 }), 7000);
  });

  it("returns 0 for a workout with no timestamp", () => {
    assert.equal(workoutTimestamp({ title: "old" }), 0);
  });
});

// ── mergeCustomWorkouts ─────────────────────────────────────────
describe("mergeCustomWorkouts()", () => {
  it("combines disjoint workout sets", () => {
    const local = { a: { title: "A", _updatedAt: 100 } };
    const remote = { b: { title: "B", _updatedAt: 200 } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(Object.keys(merged).length, 2);
    assert.equal(merged.a.title, "A");
    assert.equal(merged.b.title, "B");
  });

  it("newer remote wins on conflict", () => {
    const local = { a: { title: "Local A", _updatedAt: 100 } };
    const remote = { a: { title: "Remote A", _updatedAt: 200 } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(merged.a.title, "Remote A");
  });

  it("newer local wins on conflict", () => {
    const local = { a: { title: "Local A", _updatedAt: 300 } };
    const remote = { a: { title: "Remote A", _updatedAt: 200 } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(merged.a.title, "Local A");
  });

  it("preserves local-only entries", () => {
    const local = { a: { title: "A", _updatedAt: 100 }, b: { title: "B", _updatedAt: 100 } };
    const remote = { a: { title: "Remote A", _updatedAt: 200 } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(merged.b.title, "B");
  });

  it("handles empty inputs", () => {
    assert.deepEqual(mergeCustomWorkouts({}, {}), {});
    assert.equal(Object.keys(mergeCustomWorkouts({}, { a: { _updatedAt: 1 } })).length, 1);
    assert.equal(Object.keys(mergeCustomWorkouts({ a: { _updatedAt: 1 } }, {})).length, 1);
  });

  // ── Tombstone / deletion tests ──────────────────────────────
  it("local deletion wins over older remote version", () => {
    const local = { a: { _deleted: true, _deletedAt: 300 } };
    const remote = { a: { title: "A", _updatedAt: 200 } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(merged.a._deleted, true);
  });

  it("remote deletion wins over older local version", () => {
    const local = { a: { title: "A", _updatedAt: 200 } };
    const remote = { a: { _deleted: true, _deletedAt: 300 } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(merged.a._deleted, true);
  });

  it("newer re-creation wins over older deletion", () => {
    const local = { a: { _deleted: true, _deletedAt: 200 } };
    const remote = { a: { title: "Re-created", _updatedAt: 300 } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(merged.a.title, "Re-created");
    assert.equal(merged.a._deleted, undefined);
  });

  it("deletion from remote propagates to local-only set", () => {
    const local = {};
    const remote = { a: { _deleted: true, _deletedAt: 100 } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(merged.a._deleted, true);
  });

  it("deleted workout does not resurrect on sync", () => {
    // The core bug scenario: user deletes locally, remote still has it
    const local = { a: { _deleted: true, _deletedAt: 500 } };
    const remote = { a: { title: "Old workout", _updatedAt: 100 } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(merged.a._deleted, true, "deleted workout should stay deleted");
  });

  it("equal timestamps: remote wins", () => {
    const local = { a: { title: "Local", _updatedAt: 100 } };
    const remote = { a: { title: "Remote", _updatedAt: 100 } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(merged.a.title, "Remote");
  });

  it("legacy workouts without timestamps: remote wins", () => {
    const local = { a: { title: "Local" } };
    const remote = { a: { title: "Remote" } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(merged.a.title, "Remote");
  });
});

// ── mergeSettings ───────────────────────────────────────────────
describe("mergeSettings()", () => {
  it("returns remote when it has a newer _syncedAt", () => {
    const local = { multiplier: 1, _syncedAt: 1000 };
    const remote = { multiplier: 2, _syncedAt: 2000 };
    const merged = mergeSettings(local, remote);
    assert.equal(merged.multiplier, 2);
  });

  it("returns local when it has a newer _syncedAt", () => {
    const local = { multiplier: 1, _syncedAt: 3000 };
    const remote = { multiplier: 2, _syncedAt: 2000 };
    const merged = mergeSettings(local, remote);
    assert.equal(merged.multiplier, 1);
  });

  it("returns remote when timestamps are equal", () => {
    const local = { multiplier: 1, _syncedAt: 1000 };
    const remote = { multiplier: 2, _syncedAt: 1000 };
    const merged = mergeSettings(local, remote);
    assert.equal(merged.multiplier, 2);
  });

  it("returns local when remote is null", () => {
    const local = { multiplier: 1 };
    assert.equal(mergeSettings(local, null).multiplier, 1);
  });

  it("returns remote when local is null", () => {
    const remote = { multiplier: 2 };
    assert.equal(mergeSettings(null, remote).multiplier, 2);
  });

  it("handles missing _syncedAt (treated as 0)", () => {
    const local = { multiplier: 1 };
    const remote = { multiplier: 2, _syncedAt: 1 };
    const merged = mergeSettings(local, remote);
    assert.equal(merged.multiplier, 2);
  });

  it("preserves onboardingDone when remote wins", () => {
    const local = { multiplier: 1, onboardingDone: false, _syncedAt: 1000 };
    const remote = { multiplier: 2, onboardingDone: true, _syncedAt: 2000 };
    const merged = mergeSettings(local, remote);
    assert.equal(merged.onboardingDone, true);
  });

  it("preserves onboardingDone when local wins", () => {
    const local = { multiplier: 1, onboardingDone: true, _syncedAt: 3000 };
    const remote = { multiplier: 2, onboardingDone: false, _syncedAt: 1000 };
    const merged = mergeSettings(local, remote);
    assert.equal(merged.onboardingDone, true);
  });

  it("syncs all settings fields including onboardingDone", () => {
    const local = { multiplier: 1, restMultiplier: 1, tts: false, announceHints: false, weeklyGoal: 3, ambient: false, onboardingDone: false, _syncedAt: 100 };
    const remote = { multiplier: 1.5, restMultiplier: 1.5, tts: true, announceHints: true, weeklyGoal: 5, ambient: true, onboardingDone: true, _syncedAt: 200 };
    const merged = mergeSettings(local, remote);
    assert.equal(merged.multiplier, 1.5);
    assert.equal(merged.restMultiplier, 1.5);
    assert.equal(merged.tts, true);
    assert.equal(merged.announceHints, true);
    assert.equal(merged.weeklyGoal, 5);
    assert.equal(merged.ambient, true);
    assert.equal(merged.onboardingDone, true);
  });
});
