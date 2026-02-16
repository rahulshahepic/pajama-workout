/**
 * App pure-logic tests — fmt, buildPhases, encode/decode, filterHidden, etc.
 *
 * Run: node --test tests/app.test.js
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  fmt, hintSpeechSecs, escHtml, fmtMultiplier,
  buildPhases, filterHidden, encodeWorkout, decodeWorkout,
  needsOnboarding, applyPreset,
  _settings: settings, _hiddenExercises: hiddenExercises,
} = require("../js/app.js");

// ── fmt ─────────────────────────────────────────────────────────
describe("fmt()", () => {
  it("formats 0 seconds", () => {
    assert.equal(fmt(0), "0:00");
  });

  it("formats seconds < 60", () => {
    assert.equal(fmt(5), "0:05");
    assert.equal(fmt(59), "0:59");
  });

  it("formats exact minutes", () => {
    assert.equal(fmt(60), "1:00");
    assert.equal(fmt(120), "2:00");
    assert.equal(fmt(300), "5:00");
  });

  it("formats minutes + seconds", () => {
    assert.equal(fmt(65), "1:05");
    assert.equal(fmt(125), "2:05");
    assert.equal(fmt(599), "9:59");
  });

  it("pads single-digit seconds with leading zero", () => {
    assert.equal(fmt(61), "1:01");
    assert.equal(fmt(9), "0:09");
  });
});

// ── hintSpeechSecs ──────────────────────────────────────────────
describe("hintSpeechSecs()", () => {
  it("returns 0 for empty or falsy text", () => {
    assert.equal(hintSpeechSecs(""), 0);
    assert.equal(hintSpeechSecs(null), 0);
    assert.equal(hintSpeechSecs(undefined), 0);
  });

  it("estimates short text", () => {
    // 2 words → ceil(2/2.5) + 1 = 1 + 1 = 2
    assert.equal(hintSpeechSecs("hello world"), 2);
  });

  it("estimates longer text", () => {
    // 10 words → ceil(10/2.5) + 1 = 4 + 1 = 5
    assert.equal(hintSpeechSecs("one two three four five six seven eight nine ten"), 5);
  });

  it("trims whitespace before counting", () => {
    assert.equal(hintSpeechSecs("  hello  "), 2);
  });
});

// ── escHtml ─────────────────────────────────────────────────────
describe("escHtml()", () => {
  it("escapes ampersand", () => {
    assert.equal(escHtml("a & b"), "a &amp; b");
  });

  it("escapes double quotes", () => {
    assert.equal(escHtml('say "hi"'), "say &quot;hi&quot;");
  });

  it("escapes angle brackets", () => {
    assert.equal(escHtml("<script>"), "&lt;script>");
  });

  it("passes through safe strings unchanged", () => {
    assert.equal(escHtml("hello world"), "hello world");
  });
});

// ── fmtMultiplier ───────────────────────────────────────────────
describe("fmtMultiplier()", () => {
  it("formats 1 as 1×", () => {
    assert.equal(fmtMultiplier(1), "1\u00D7");
  });

  it("formats integers without decimals", () => {
    assert.equal(fmtMultiplier(2), "2\u00D7");
    assert.equal(fmtMultiplier(3), "3\u00D7");
  });

  it("formats 0.5", () => {
    assert.equal(fmtMultiplier(0.5), "0.5\u00D7");
  });

  it("formats 1.5", () => {
    assert.equal(fmtMultiplier(1.5), "1.5\u00D7");
  });

  it("formats 1.25 (two decimal places, trailing zero trimmed)", () => {
    const result = fmtMultiplier(1.25);
    assert.ok(result.endsWith("\u00D7"));
    assert.ok(result.startsWith("1.25"));
  });
});

// ── buildPhases ─────────────────────────────────────────────────
describe("buildPhases()", () => {
  const rawPhases = [
    { name: "Squats", type: "work", duration: 40, hint: "Go deep" },
    { name: "Rest",   type: "rest", duration: 20, hint: "" },
    { name: "Lunges", type: "work", duration: 40, hint: "Alternate legs" },
  ];

  beforeEach(() => {
    settings.announceHints = false;
  });

  it("applies work multiplier to work phases", () => {
    const result = buildPhases(rawPhases, 2, 1);
    assert.equal(result[0].duration, 80); // 40 * 2
    assert.equal(result[2].duration, 80); // 40 * 2
  });

  it("applies rest multiplier to rest phases", () => {
    const result = buildPhases(rawPhases, 1, 2);
    assert.equal(result[1].duration, 40); // 20 * 2
  });

  it("applies different multipliers to work and rest", () => {
    const result = buildPhases(rawPhases, 1.5, 0.5);
    assert.equal(result[0].duration, 60);  // 40 * 1.5
    assert.equal(result[1].duration, 10);  // 20 * 0.5
    assert.equal(result[2].duration, 60);  // 40 * 1.5
  });

  it("preserves name, type, and hint", () => {
    const result = buildPhases(rawPhases, 1, 1);
    assert.equal(result[0].name, "Squats");
    assert.equal(result[0].type, "work");
    assert.equal(result[0].hint, "Go deep");
    assert.equal(result[1].type, "rest");
  });

  it("rounds durations to integers", () => {
    const phases = [{ name: "X", type: "work", duration: 10, hint: "" }];
    const result = buildPhases(phases, 0.75, 1);
    // 10 * 0.75 = 7.5 → Math.round → 8
    assert.equal(result[0].duration, 8);
    assert.ok(Number.isInteger(result[0].duration));
  });

  it("returns empty array for empty input", () => {
    assert.deepEqual(buildPhases([], 1, 1), []);
  });

  it("extends rest when announceHints is on and next phase has a long hint", () => {
    settings.announceHints = true;
    const phases = [
      { name: "Rest", type: "rest", duration: 5, hint: "" },
      { name: "Move", type: "work", duration: 30, hint: "one two three four five six seven eight nine ten eleven twelve" },
    ];
    const result = buildPhases(phases, 1, 1);
    const needed = hintSpeechSecs("Next: Move. one two three four five six seven eight nine ten eleven twelve");
    assert.ok(result[0].duration >= needed);
    settings.announceHints = false;
  });

  it("injects rest before hinted phase when no preceding rest", () => {
    settings.announceHints = true;
    const phases = [
      { name: "Squats", type: "work", duration: 40, hint: "Go deep" },
      { name: "Lunges", type: "work", duration: 40, hint: "Alternate legs" },
    ];
    const result = buildPhases(phases, 1, 1);
    assert.equal(result.length, 4);
    assert.equal(result[0].type, "rest");
    assert.equal(result[1].name, "Squats");
    assert.equal(result[2].type, "rest");
    assert.equal(result[3].name, "Lunges");
    settings.announceHints = false;
  });

  it("does not inject rest when one already precedes the hinted phase", () => {
    settings.announceHints = true;
    const phases = [
      { name: "Squats", type: "work", duration: 40, hint: "Go deep" },
      { name: "Rest",   type: "rest", duration: 20, hint: "" },
      { name: "Lunges", type: "work", duration: 40, hint: "Alternate legs" },
    ];
    const result = buildPhases(phases, 1, 1);
    // Should inject before Squats, extend existing Rest before Lunges
    const restCount = result.filter(p => p.type === "rest").length;
    assert.equal(restCount, 2);
    assert.equal(result[0].type, "rest");   // injected
    assert.equal(result[1].name, "Squats");
    assert.equal(result[2].type, "rest");   // existing, extended
    assert.equal(result[3].name, "Lunges");
    settings.announceHints = false;
  });

  it("injected rest duration accounts for full TTS announcement", () => {
    settings.announceHints = true;
    const phases = [
      { name: "Push-ups", type: "work", duration: 40, hint: "Hands wider than shoulders body straight" },
    ];
    const result = buildPhases(phases, 1, 1);
    const needed = hintSpeechSecs("Next: Push-ups. Hands wider than shoulders body straight");
    assert.equal(result[0].type, "rest");
    assert.equal(result[0].duration, needed);
    settings.announceHints = false;
  });

  it("does not inject rests when announceHints is off", () => {
    settings.announceHints = false;
    const phases = [
      { name: "Squats", type: "work", duration: 40, hint: "Go deep" },
      { name: "Lunges", type: "work", duration: 40, hint: "Step forward" },
    ];
    const result = buildPhases(phases, 1, 1);
    assert.equal(result.length, 2);
    assert.equal(result[0].name, "Squats");
    assert.equal(result[1].name, "Lunges");
  });

  it("does not inject rest before phases without hints", () => {
    settings.announceHints = true;
    const phases = [
      { name: "Squats", type: "work", duration: 40, hint: "" },
      { name: "Lunges", type: "work", duration: 40, hint: "" },
    ];
    const result = buildPhases(phases, 1, 1);
    assert.equal(result.length, 2);
    settings.announceHints = false;
  });

  it("injects rest before hinted stretch and yoga phases", () => {
    settings.announceHints = true;
    const phases = [
      { name: "Quad Stretch",  type: "stretch", duration: 25, hint: "Pull heel to glute" },
      { name: "Mountain Pose", type: "yoga",    duration: 20, hint: "Stand tall" },
    ];
    const result = buildPhases(phases, 1, 1);
    assert.equal(result.length, 4);
    assert.equal(result[0].type, "rest");
    assert.equal(result[1].type, "stretch");
    assert.equal(result[2].type, "rest");
    assert.equal(result[3].type, "yoga");
    settings.announceHints = false;
  });
});

// ── filterHidden ────────────────────────────────────────────────
describe("filterHidden()", () => {
  beforeEach(() => {
    for (const k of Object.keys(hiddenExercises)) delete hiddenExercises[k];
  });

  const phases = [
    { name: "Squats",  type: "work", duration: 40, hint: "" },
    { name: "Rest",    type: "rest", duration: 20, hint: "" },
    { name: "Lunges",  type: "work", duration: 40, hint: "" },
    { name: "Rest",    type: "rest", duration: 20, hint: "" },
    { name: "Plank",   type: "work", duration: 30, hint: "" },
  ];

  it("returns all phases when nothing is hidden", () => {
    const result = filterHidden("wk1", phases);
    assert.equal(result.length, 5);
  });

  it("removes hidden exercise and its orphaned rest", () => {
    hiddenExercises["wk1:Lunges"] = true;
    const result = filterHidden("wk1", phases);
    assert.ok(!result.some(p => p.name === "Lunges"));
    // Should not have consecutive rests
    for (let i = 1; i < result.length; i++) {
      assert.ok(!(result[i].type === "rest" && result[i - 1].type === "rest"));
    }
  });

  it("removes trailing rest", () => {
    hiddenExercises["wk1:Plank"] = true;
    const result = filterHidden("wk1", phases);
    assert.notEqual(result[result.length - 1].type, "rest");
  });

  it("removes leading rest", () => {
    hiddenExercises["wk1:Squats"] = true;
    const result = filterHidden("wk1", phases);
    assert.notEqual(result[0].type, "rest");
  });

  it("does not hide exercises from a different workout", () => {
    hiddenExercises["other:Squats"] = true;
    const result = filterHidden("wk1", phases);
    assert.equal(result.length, 5);
  });
});

// ── encodeWorkout / decodeWorkout ───────────────────────────────
describe("encodeWorkout / decodeWorkout roundtrip", () => {
  const workout = {
    title: "Test Workout",
    phases: [
      { name: "Push-ups", type: "work", duration: 30, hint: "Keep back straight" },
      { name: "Rest",     type: "rest", duration: 15, hint: "" },
      { name: "Squats",   type: "work", duration: 30, hint: "Knees over toes" },
    ],
  };

  it("roundtrips a workout", () => {
    const encoded = encodeWorkout(workout);
    const decoded = decodeWorkout(encoded);
    assert.equal(decoded.title, workout.title);
    assert.equal(decoded.phases.length, workout.phases.length);
    for (let i = 0; i < workout.phases.length; i++) {
      assert.equal(decoded.phases[i].name, workout.phases[i].name);
      assert.equal(decoded.phases[i].type, workout.phases[i].type);
      assert.equal(decoded.phases[i].duration, workout.phases[i].duration);
      assert.equal(decoded.phases[i].hint, workout.phases[i].hint);
    }
  });

  it("handles unicode characters in title and hints", () => {
    const w = {
      title: "Yoga \u2014 Morning Flow",
      phases: [{ name: "Om \u{1F9D8}", type: "yoga", duration: 60, hint: "Br\u00E9athe d\u00E9eply" }],
    };
    const decoded = decodeWorkout(encodeWorkout(w));
    assert.equal(decoded.title, w.title);
    assert.equal(decoded.phases[0].hint, w.phases[0].hint);
  });

  it("returns null for invalid base64", () => {
    assert.equal(decodeWorkout("!!!invalid!!!"), null);
  });

  it("returns null for valid base64 but invalid JSON", () => {
    assert.equal(decodeWorkout(btoa("not json")), null);
  });

  it("returns null for valid JSON but missing fields", () => {
    assert.equal(decodeWorkout(btoa(JSON.stringify({ x: 1 }))), null);
  });
});

// ── needsOnboarding ──────────────────────────────────────────────
describe("needsOnboarding()", () => {
  it("returns true when onboardingDone is false", () => {
    settings.onboardingDone = false;
    assert.equal(needsOnboarding(), true);
  });

  it("returns false when onboardingDone is true", () => {
    settings.onboardingDone = true;
    assert.equal(needsOnboarding(), false);
    settings.onboardingDone = false;
  });
});

// ── applyPreset ──────────────────────────────────────────────────
describe("applyPreset()", () => {
  beforeEach(() => {
    // Reset to defaults
    settings.multiplier = 1;
    settings.restMultiplier = 1;
    settings.tts = false;
    settings.announceHints = false;
  });

  it("sets guided preset values", () => {
    applyPreset("guided");
    assert.equal(settings.multiplier, 1.5);
    assert.equal(settings.restMultiplier, 1.5);
    assert.equal(settings.tts, true);
    assert.equal(settings.announceHints, true);
  });

  it("sets quick preset values", () => {
    applyPreset("quick");
    assert.equal(settings.multiplier, 1);
    assert.equal(settings.restMultiplier, 1);
    assert.equal(settings.tts, false);
    assert.equal(settings.announceHints, false);
  });

  it("guided then quick returns to defaults", () => {
    applyPreset("guided");
    applyPreset("quick");
    assert.equal(settings.multiplier, 1);
    assert.equal(settings.restMultiplier, 1);
    assert.equal(settings.tts, false);
    assert.equal(settings.announceHints, false);
  });
});
