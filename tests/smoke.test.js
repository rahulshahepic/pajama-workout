/**
 * Smoke tests — verify index.html references valid files and basic structure.
 *
 * Run: node --test tests/smoke.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

describe("index.html script references", () => {
  // Match local script tags (skip external URLs)
  const scriptSrcs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)]
    .map(m => m[1])
    .filter(src => !src.startsWith("http"));

  it("has at least one local script", () => {
    assert.ok(scriptSrcs.length > 0);
  });

  for (const src of scriptSrcs) {
    it(`script "${src}" exists on disk`, () => {
      assert.ok(fs.existsSync(path.join(ROOT, src)), `Missing script: ${src}`);
    });
  }

  it("loads config.js before app.js (dependency order)", () => {
    const configIdx = scriptSrcs.indexOf("js/config.js");
    const appIdx = scriptSrcs.indexOf("js/app.js");
    assert.ok(configIdx >= 0, "config.js not found in scripts");
    assert.ok(appIdx >= 0, "app.js not found in scripts");
    assert.ok(configIdx < appIdx, "config.js must load before app.js");
  });

  it("loads history.js before app.js", () => {
    const histIdx = scriptSrcs.indexOf("js/history.js");
    const appIdx = scriptSrcs.indexOf("js/app.js");
    assert.ok(histIdx >= 0, "history.js not found in scripts");
    assert.ok(histIdx < appIdx, "history.js must load before app.js");
  });

  it("loads sync.js before app.js", () => {
    const syncIdx = scriptSrcs.indexOf("js/sync.js");
    const appIdx = scriptSrcs.indexOf("js/app.js");
    assert.ok(syncIdx >= 0, "sync.js not found in scripts");
    assert.ok(syncIdx < appIdx, "sync.js must load before app.js");
  });
});

describe("index.html stylesheet references", () => {
  const stylesheets = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]
    .map(m => m[1])
    .filter(src => !src.startsWith("http"));

  it("has at least one local stylesheet", () => {
    assert.ok(stylesheets.length > 0);
  });

  for (const href of stylesheets) {
    it(`stylesheet "${href}" exists on disk`, () => {
      assert.ok(fs.existsSync(path.join(ROOT, href)), `Missing stylesheet: ${href}`);
    });
  }
});

describe("index.html manifest reference", () => {
  it("links to manifest.json", () => {
    assert.ok(html.includes('href="manifest.json"'));
  });

  it("manifest.json exists on disk", () => {
    assert.ok(fs.existsSync(path.join(ROOT, "manifest.json")));
  });
});

describe("index.html required DOM elements", () => {
  // Elements that app.js caches in cacheDOM()
  const requiredIds = [
    "glow", "progress-fill", "section-label", "counter-label",
    "timer-container", "timer-display", "timer-ring", "done-check",
    "exercise-name", "exercise-hint", "controls",
    "btn-start", "btn-pause", "btn-resume", "btn-reset", "btn-skip",
    "picker-screen", "timer-screen", "history-screen", "builder-screen",
    "btn-history", "btn-home", "btn-settings",
    "settings-backdrop", "settings-panel",
    "multiplier-slider", "multiplier-label",
    "tts-toggle", "hints-toggle", "ambient-toggle",
    "fab-create", "wake-indicator",
    "swap-backdrop", "swap-panel",
    // Onboarding
    "onboarding-backdrop", "onboarding-modal", "onboarding-step1", "onboarding-step2",
    "onboarding-guided", "onboarding-quick", "onboarding-skip", "onboarding-done",
    // Settings presets
    "preset-guided", "preset-quick",
  ];

  for (const id of requiredIds) {
    it(`has element with id="${id}"`, () => {
      const pattern = new RegExp(`id=["']${id}["']`);
      assert.ok(pattern.test(html), `Missing DOM element: #${id}`);
    });
  }
});

describe("index.html onboarding accessibility", () => {
  it("onboarding modal has role=dialog", () => {
    assert.ok(/id=["']onboarding-modal["'][^>]*role=["']dialog["']/.test(html) ||
              /role=["']dialog["'][^>]*id=["']onboarding-modal["']/.test(html));
  });

  it("onboarding modal has aria-modal=true", () => {
    assert.ok(html.includes('aria-modal="true"'));
  });

  it("onboarding modal has aria-labelledby", () => {
    assert.ok(html.includes('aria-labelledby="onboarding-title"'));
  });

  it("settings preset buttons have aria-pressed", () => {
    assert.ok(/id=["']preset-guided["'][^>]*aria-pressed/.test(html) ||
              /aria-pressed[^>]*id=["']preset-guided["']/.test(html));
    assert.ok(/id=["']preset-quick["'][^>]*aria-pressed/.test(html) ||
              /aria-pressed[^>]*id=["']preset-quick["']/.test(html));
  });
});

describe("index.html basic structure", () => {
  it("has a doctype", () => {
    assert.ok(html.trimStart().startsWith("<!DOCTYPE html>") || html.trimStart().startsWith("<!doctype html>"));
  });

  it("has lang attribute", () => {
    assert.ok(/<html[^>]*\blang=/.test(html));
  });

  it("has a viewport meta tag", () => {
    assert.ok(html.includes('name="viewport"'));
  });

  it("has a title", () => {
    assert.ok(/<title>[^<]+<\/title>/.test(html));
  });

  it("has PWA meta tags", () => {
    assert.ok(html.includes('name="theme-color"'));
    assert.ok(html.includes('apple-mobile-web-app-capable'));
  });
});
