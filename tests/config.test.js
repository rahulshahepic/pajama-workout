/**
 * Config validation tests — ensures every workout is well-formed
 * and all constants are consistent.
 *
 * Run: node --test tests/config.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { APP_VERSION, WORKOUTS, COUNTDOWN_SECS, THEME, DONE_THEME, SOUNDS } = require("../js/config.js");

const VALID_TYPES = new Set(["work", "rest", "stretch"]);

describe("APP_VERSION", () => {
  it("is a positive integer", () => {
    assert.equal(typeof APP_VERSION, "number");
    assert.ok(Number.isInteger(APP_VERSION));
    assert.ok(APP_VERSION > 0);
  });
});

describe("WORKOUTS", () => {
  const keys = Object.keys(WORKOUTS);

  it("has at least one workout", () => {
    assert.ok(keys.length > 0);
  });

  for (const key of keys) {
    describe(`"${key}"`, () => {
      const w = WORKOUTS[key];

      it("has an id matching its key", () => {
        assert.equal(w.id, key);
      });

      it("has a non-empty title", () => {
        assert.equal(typeof w.title, "string");
        assert.ok(w.title.length > 0);
      });

      it("has a non-empty subtitle", () => {
        assert.equal(typeof w.subtitle, "string");
        assert.ok(w.subtitle.length > 0);
      });

      it("has at least one phase", () => {
        assert.ok(Array.isArray(w.phases));
        assert.ok(w.phases.length > 0);
      });

      for (let i = 0; i < w.phases.length; i++) {
        const p = w.phases[i];

        it(`phase[${i}] "${p.name}" has valid type`, () => {
          assert.ok(VALID_TYPES.has(p.type), `invalid type: "${p.type}"`);
        });

        it(`phase[${i}] "${p.name}" has positive integer duration`, () => {
          assert.ok(Number.isInteger(p.duration));
          assert.ok(p.duration > 0);
        });

        it(`phase[${i}] "${p.name}" has a hint string`, () => {
          assert.equal(typeof p.hint, "string");
          assert.ok(p.hint.length > 0);
        });
      }
    });
  }
});

describe("COUNTDOWN_SECS", () => {
  it("is a non-negative number", () => {
    assert.equal(typeof COUNTDOWN_SECS, "number");
    assert.ok(COUNTDOWN_SECS >= 0);
  });
});

describe("THEME", () => {
  // Every phase type used in any workout should have a theme entry
  const usedTypes = new Set();
  for (const w of Object.values(WORKOUTS)) {
    for (const p of w.phases) usedTypes.add(p.type);
  }

  for (const type of usedTypes) {
    it(`has entry for phase type "${type}"`, () => {
      assert.ok(THEME[type], `missing THEME["${type}"]`);
      assert.equal(typeof THEME[type].bg, "string");
      assert.equal(typeof THEME[type].accent, "string");
      assert.equal(typeof THEME[type].glow, "string");
      assert.equal(typeof THEME[type].progress, "string");
    });
  }

  it("has countdown theme", () => {
    assert.ok(THEME.countdown);
  });

  it("has idle theme", () => {
    assert.ok(THEME.idle);
  });
});

describe("DONE_THEME", () => {
  it("has bg, glow, and accent", () => {
    assert.equal(typeof DONE_THEME.bg, "string");
    assert.equal(typeof DONE_THEME.glow, "string");
    assert.equal(typeof DONE_THEME.accent, "string");
  });
});

describe("SOUNDS", () => {
  const required = ["done", "transition", "start", "tick"];
  for (const name of required) {
    it(`has "${name}" with [freq, durMs, count]`, () => {
      const s = SOUNDS[name];
      assert.ok(Array.isArray(s), `SOUNDS.${name} is not an array`);
      assert.equal(s.length, 3);
      assert.ok(s[0] > 0, "freq > 0");
      assert.ok(s[1] > 0, "durMs > 0");
      assert.ok(Number.isInteger(s[2]) && s[2] > 0, "count is positive int");
    });
  }
});
