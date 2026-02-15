/**
 * History module tests — schema versioning, migrations, CRUD, streaks.
 *
 * We mock localStorage so tests are self-contained and fast.
 *
 * Run: node --test tests/history.test.js
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// ── Mock localStorage ──────────────────────────────────────────
const store = {};
global.localStorage = {
  getItem(key) { return store[key] ?? null; },
  setItem(key, val) { store[key] = String(val); },
  removeItem(key) { delete store[key]; },
};

const WorkoutHistory = require("../js/history.js");
const STORAGE_KEY = "pajama-workout-history";

function seedRaw(val) {
  store[STORAGE_KEY] = JSON.stringify(val);
}

function readRaw() {
  return JSON.parse(store[STORAGE_KEY] || "null");
}

function makeEntry(overrides = {}) {
  return {
    workoutId: "test",
    title: "Test",
    durationSecs: 60,
    phasesCompleted: 5,
    phasesTotal: 5,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe("empty state", () => {
  it("getAll returns empty array", () => {
    assert.deepEqual(WorkoutHistory.getAll(), []);
  });

  it("totalCount is 0", () => {
    assert.equal(WorkoutHistory.totalCount(), 0);
  });

  it("streak is 0", () => {
    assert.equal(WorkoutHistory.streak(), 0);
  });

  it("thisWeekCount is 0", () => {
    assert.equal(WorkoutHistory.thisWeekCount(), 0);
  });
});

describe("record()", () => {
  it("writes a versioned envelope", () => {
    WorkoutHistory.record(makeEntry());
    const raw = readRaw();
    assert.equal(raw.version, 1);
    assert.equal(raw.entries.length, 1);
    assert.equal(raw.entries[0].workoutId, "test");
    assert.ok(raw.entries[0].completedAt);
  });

  it("appends to existing entries", () => {
    WorkoutHistory.record(makeEntry({ title: "A" }));
    WorkoutHistory.record(makeEntry({ title: "B" }));
    assert.equal(WorkoutHistory.totalCount(), 2);
  });
});

describe("getAll()", () => {
  it("returns newest first", () => {
    seedRaw({
      version: 1,
      entries: [
        { workoutId: "a", title: "Old", completedAt: "2025-01-01T00:00:00Z", durationSecs: 60, phasesCompleted: 1, phasesTotal: 1 },
        { workoutId: "b", title: "New", completedAt: "2025-12-01T00:00:00Z", durationSecs: 60, phasesCompleted: 1, phasesTotal: 1 },
      ],
    });
    const all = WorkoutHistory.getAll();
    assert.equal(all[0].title, "New");
    assert.equal(all[1].title, "Old");
  });
});

describe("clear()", () => {
  it("removes all data", () => {
    WorkoutHistory.record(makeEntry());
    assert.equal(WorkoutHistory.totalCount(), 1);
    WorkoutHistory.clear();
    assert.equal(WorkoutHistory.totalCount(), 0);
  });
});

describe("legacy migration (bare array → envelope)", () => {
  it("wraps a bare array in a versioned envelope", () => {
    const legacy = [
      { workoutId: "old", title: "Old Workout", completedAt: "2025-06-15T10:00:00Z", durationSecs: 300, phasesCompleted: 10, phasesTotal: 10 },
    ];
    seedRaw(legacy);

    // Any read triggers migration
    const all = WorkoutHistory.getAll();
    assert.equal(all.length, 1);
    assert.equal(all[0].title, "Old Workout");

    // Check the storage was upgraded
    const raw = readRaw();
    assert.equal(raw.version, 1);
    assert.ok(Array.isArray(raw.entries));
  });
});

describe("corrupt data handling", () => {
  it("returns empty for corrupt JSON", () => {
    store[STORAGE_KEY] = "not-json{{{";
    assert.equal(WorkoutHistory.totalCount(), 0);
  });

  it("returns empty for unexpected types", () => {
    seedRaw("hello");
    assert.equal(WorkoutHistory.totalCount(), 0);
  });

  it("returns empty for number", () => {
    seedRaw(42);
    assert.equal(WorkoutHistory.totalCount(), 0);
  });
});

describe("normaliseEntry (defensive defaults)", () => {
  it("fills missing fields with defaults", () => {
    seedRaw({
      version: 1,
      entries: [{ completedAt: "2025-06-01T00:00:00Z" }],
    });
    const all = WorkoutHistory.getAll();
    assert.equal(all[0].workoutId, "unknown");
    assert.equal(all[0].title, "Workout");
    assert.equal(all[0].durationSecs, 0);
  });
});

describe("streak()", () => {
  it("counts consecutive days up to today", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    seedRaw({
      version: 1,
      entries: [
        { workoutId: "a", title: "A", completedAt: today.toISOString(), durationSecs: 60, phasesCompleted: 1, phasesTotal: 1 },
        { workoutId: "b", title: "B", completedAt: yesterday.toISOString(), durationSecs: 60, phasesCompleted: 1, phasesTotal: 1 },
      ],
    });
    assert.equal(WorkoutHistory.streak(), 2);
  });

  it("returns 0 if no workout today or yesterday", () => {
    const old = new Date();
    old.setDate(old.getDate() - 5);

    seedRaw({
      version: 1,
      entries: [
        { workoutId: "a", title: "A", completedAt: old.toISOString(), durationSecs: 60, phasesCompleted: 1, phasesTotal: 1 },
      ],
    });
    assert.equal(WorkoutHistory.streak(), 0);
  });

  it("breaks at a gap day", () => {
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);

    seedRaw({
      version: 1,
      entries: [
        { workoutId: "a", title: "A", completedAt: today.toISOString(), durationSecs: 60, phasesCompleted: 1, phasesTotal: 1 },
        // yesterday is missing
        { workoutId: "b", title: "B", completedAt: twoDaysAgo.toISOString(), durationSecs: 60, phasesCompleted: 1, phasesTotal: 1 },
      ],
    });
    assert.equal(WorkoutHistory.streak(), 1);
  });
});

describe("thisWeekCount()", () => {
  it("counts entries since Monday", () => {
    const now = new Date();
    WorkoutHistory.record(makeEntry());
    assert.equal(WorkoutHistory.thisWeekCount(), 1);
  });

  it("excludes entries from last week", () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 8);

    seedRaw({
      version: 1,
      entries: [
        { workoutId: "a", title: "A", completedAt: lastWeek.toISOString(), durationSecs: 60, phasesCompleted: 1, phasesTotal: 1 },
      ],
    });
    assert.equal(WorkoutHistory.thisWeekCount(), 0);
  });
});

describe("exportData()", () => {
  it("returns a versioned envelope", () => {
    WorkoutHistory.record(makeEntry());
    const data = WorkoutHistory.exportData();
    assert.equal(typeof data.version, "number");
    assert.ok(Array.isArray(data.entries));
    assert.equal(data.entries.length, 1);
  });
});

describe("replaceEntries()", () => {
  it("replaces all local entries with the given array", () => {
    WorkoutHistory.record(makeEntry());
    assert.equal(WorkoutHistory.totalCount(), 1);

    WorkoutHistory.replaceEntries([
      { workoutId: "x", title: "X", completedAt: "2025-01-01T00:00:00Z", durationSecs: 60, phasesCompleted: 1, phasesTotal: 1 },
      { workoutId: "y", title: "Y", completedAt: "2025-02-01T00:00:00Z", durationSecs: 120, phasesCompleted: 2, phasesTotal: 2 },
    ]);
    assert.equal(WorkoutHistory.totalCount(), 2);
    const all = WorkoutHistory.getAll();
    assert.equal(all[0].title, "Y");
    assert.equal(all[1].title, "X");
  });

  it("normalises entries with missing fields", () => {
    WorkoutHistory.replaceEntries([{ completedAt: "2025-03-01T00:00:00Z" }]);
    const all = WorkoutHistory.getAll();
    assert.equal(all[0].workoutId, "unknown");
    assert.equal(all[0].title, "Workout");
    assert.equal(all[0].durationSecs, 0);
  });
});
