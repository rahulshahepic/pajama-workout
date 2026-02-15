/**
 * Manifest validation tests — required PWA fields, icon files exist.
 *
 * Run: node --test tests/manifest.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));

describe("manifest.json required fields", () => {
  it("has a name", () => {
    assert.equal(typeof manifest.name, "string");
    assert.ok(manifest.name.length > 0);
  });

  it("has a short_name", () => {
    assert.equal(typeof manifest.short_name, "string");
    assert.ok(manifest.short_name.length > 0);
  });

  it("has a start_url", () => {
    assert.equal(typeof manifest.start_url, "string");
  });

  it("has display mode", () => {
    const valid = ["standalone", "fullscreen", "minimal-ui", "browser"];
    assert.ok(valid.includes(manifest.display), `Invalid display: ${manifest.display}`);
  });

  it("has a theme_color", () => {
    assert.equal(typeof manifest.theme_color, "string");
    assert.ok(manifest.theme_color.length > 0);
  });

  it("has a background_color", () => {
    assert.equal(typeof manifest.background_color, "string");
    assert.ok(manifest.background_color.length > 0);
  });
});

describe("manifest.json icons", () => {
  it("has at least one icon", () => {
    assert.ok(Array.isArray(manifest.icons));
    assert.ok(manifest.icons.length > 0);
  });

  for (const icon of manifest.icons) {
    it(`icon "${icon.src}" exists on disk`, () => {
      const fullPath = path.join(ROOT, icon.src);
      assert.ok(fs.existsSync(fullPath), `Missing icon: ${icon.src}`);
    });

    it(`icon "${icon.src}" has required fields`, () => {
      assert.equal(typeof icon.src, "string");
      assert.equal(typeof icon.sizes, "string");
      assert.equal(typeof icon.type, "string");
    });
  }

  it("has a 192x192 icon (required for installability)", () => {
    assert.ok(manifest.icons.some(i => i.sizes === "192x192" || i.sizes === "any"));
  });

  it("has a 512x512 icon (required for installability)", () => {
    assert.ok(manifest.icons.some(i => i.sizes === "512x512" || i.sizes === "any"));
  });
});
