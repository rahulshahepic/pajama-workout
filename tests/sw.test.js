/**
 * Service worker validation tests — ASSETS list matches disk, cache name is well-formed.
 *
 * Run: node --test tests/sw.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const swSource = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

// Parse the ASSETS array from the source text
const assetsMatch = swSource.match(/const ASSETS\s*=\s*\[([\s\S]*?)\];/);
assert.ok(assetsMatch, "Could not find ASSETS array in sw.js");

const ASSETS = assetsMatch[1]
  .split(",")
  .map(s => s.trim().replace(/^["']|["']$/g, ""))
  .filter(s => s.length > 0);

const { APP_VERSION } = require("../js/config.js");

describe("Service worker ASSETS", () => {
  it("has at least the core files", () => {
    assert.ok(ASSETS.length >= 5, `Expected at least 5 assets, got ${ASSETS.length}`);
  });

  for (const asset of ASSETS) {
    // "." resolves to the root directory, which is a directory not a file
    if (asset === ".") continue;

    it(`"${asset}" exists on disk`, () => {
      const fullPath = path.join(ROOT, asset);
      assert.ok(fs.existsSync(fullPath), `Missing file: ${asset}`);
    });
  }

  it("includes index.html", () => {
    assert.ok(ASSETS.includes("index.html"));
  });

  it("includes the main JS files", () => {
    assert.ok(ASSETS.includes("js/config.js"));
    assert.ok(ASSETS.includes("js/app.js"));
  });

  it("includes the stylesheet", () => {
    assert.ok(ASSETS.includes("css/styles.css"));
  });
});

describe("CACHE_NAME", () => {
  it("is built from APP_VERSION", () => {
    const expected = "pajama-workout-v" + APP_VERSION;
    assert.ok(swSource.includes(`"pajama-workout-v" + APP_VERSION`), "CACHE_NAME should use APP_VERSION");
  });

  it("APP_VERSION is a positive integer (so cache names sort cleanly)", () => {
    assert.ok(Number.isInteger(APP_VERSION));
    assert.ok(APP_VERSION > 0);
  });
});

describe("sw.js structure", () => {
  it("imports config.js via importScripts", () => {
    assert.ok(swSource.includes('importScripts("js/config.js")'));
  });

  it("has install, activate, and fetch handlers", () => {
    assert.ok(swSource.includes('"install"'));
    assert.ok(swSource.includes('"activate"'));
    assert.ok(swSource.includes('"fetch"'));
  });
});
