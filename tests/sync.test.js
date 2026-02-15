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
const { _mergeEntries: mergeEntries, _mergeCustomWorkouts: mergeCustomWorkouts, _mergeSettings: mergeSettings } = SyncManager;

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

// ── mergeCustomWorkouts ─────────────────────────────────────────
describe("mergeCustomWorkouts()", () => {
  it("combines disjoint workout sets", () => {
    const local = { a: { title: "A" } };
    const remote = { b: { title: "B" } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(Object.keys(merged).length, 2);
    assert.equal(merged.a.title, "A");
    assert.equal(merged.b.title, "B");
  });

  it("remote wins on conflict (same key)", () => {
    const local = { a: { title: "Local A" } };
    const remote = { a: { title: "Remote A" } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(merged.a.title, "Remote A");
  });

  it("preserves local-only entries", () => {
    const local = { a: { title: "A" }, b: { title: "B" } };
    const remote = { a: { title: "Remote A" } };
    const merged = mergeCustomWorkouts(local, remote);
    assert.equal(merged.b.title, "B");
  });

  it("handles empty inputs", () => {
    assert.deepEqual(mergeCustomWorkouts({}, {}), {});
    assert.equal(Object.keys(mergeCustomWorkouts({}, { a: 1 })).length, 1);
    assert.equal(Object.keys(mergeCustomWorkouts({ a: 1 }, {})).length, 1);
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
});
