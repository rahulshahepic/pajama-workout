/* ═══════════════════════════════════════════════════════════════
   Pajama Workout — Sync (Google Drive appdata)

   Uses Google Identity Services (GIS) token model to get an
   access token directly — no client secret, no code exchange.
   Stores workout history in a hidden app-owned file on the user's
   Google Drive.

   Requires these globals from config.js:
     GOOGLE_CLIENT_ID, GOOGLE_SCOPES, SYNC_FILE_NAME

   Requires WorkoutHistory from history.js:
     .exportData()  — returns the local envelope
     .replaceEntries(entries) — overwrites local entries

   Requires the GIS library loaded in index.html:
     <script src="https://accounts.google.com/gsi/client"></script>

   ═══════════════════════════════════════════════════════════════ */

const SyncManager = (function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────────
  const TOKEN_KEY  = "pajama-sync-tokens";
  const DRIVE_API  = "https://www.googleapis.com/drive/v3";
  const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

  // ── GIS token client (lazy-initialized) ───────────────────────
  var tokenClient = null;
  var pendingResolve = null;

  function ensureClient() {
    if (tokenClient) return;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope:     GOOGLE_SCOPES,
      callback:  function (response) {
        if (response.error) {
          if (pendingResolve) { pendingResolve(null); pendingResolve = null; }
          return;
        }
        var tokens = {
          access_token: response.access_token,
          expires_at:   Date.now() + response.expires_in * 1000,
          email:        null,
        };
        storeTokens(tokens);
        if (pendingResolve) { pendingResolve(tokens); pendingResolve = null; }
      },
    });
  }

  /** Request an access token from Google. Shows consent popup if needed. */
  function requestToken(options) {
    return new Promise(function (resolve) {
      ensureClient();
      pendingResolve = resolve;
      tokenClient.requestAccessToken(options || {});
    });
  }

  // ── Token storage ──────────────────────────────────────────────

  function storeTokens(t) {
    try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)); } catch (_) {}
  }

  function loadTokens() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY)); } catch (_) { return null; }
  }

  function clearTokens() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
  }

  function isExpired(t) {
    return !t || !t.expires_at || Date.now() >= t.expires_at - 60000;
  }

  // ── Token access ──────────────────────────────────────────────

  async function getAccessToken() {
    var t = loadTokens();
    if (t && !isExpired(t)) return t.access_token;
    // Token missing or expired — silently request a new one
    var fresh = await requestToken({ prompt: "" });
    return fresh ? fresh.access_token : null;
  }

  async function refreshAccessToken() {
    var fresh = await requestToken({ prompt: "" });
    return fresh ? fresh.access_token : null;
  }

  // ── OAuth flow ─────────────────────────────────────────────────

  /** Open Google's consent popup. Resolves when the token arrives. */
  async function signIn() {
    var tokens = await requestToken({ prompt: "consent" });
    if (tokens && tokens.access_token) {
      // Fetch email from userinfo
      try {
        var res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: "Bearer " + tokens.access_token },
        });
        if (res.ok) {
          var info = await res.json();
          tokens.email = info.email || null;
          storeTokens(tokens);
        }
      } catch (_) {}
    }
  }

  /**
   * No-op for GIS flow.  Kept for API compatibility with app.js.
   * Returns { wasRedirect: false, ok: false } so init() skips the redirect path.
   */
  function handleRedirect() {
    return Promise.resolve({ wasRedirect: false, ok: false });
  }

  function signOut() {
    var t = loadTokens();
    if (t && t.access_token) {
      google.accounts.oauth2.revoke(t.access_token);
    }
    clearTokens();
  }

  function isSignedIn() {
    var t = loadTokens();
    return !!(t && t.access_token);
  }

  function getEmail() {
    var t = loadTokens();
    return t ? t.email || null : null;
  }

  // ── Google Drive helpers ───────────────────────────────────────

  async function driveGet(path, params) {
    var token = await getAccessToken();
    if (!token) throw new Error("not_signed_in");

    var url = new URL(DRIVE_API + path);
    if (params) for (var k in params) url.searchParams.set(k, params[k]);

    var res = await fetch(url.toString(), { headers: { Authorization: "Bearer " + token } });

    if (res.status === 401) {
      token = await refreshAccessToken();
      if (!token) throw new Error("auth_expired");
      res = await fetch(url.toString(), { headers: { Authorization: "Bearer " + token } });
    }

    if (!res.ok) throw new Error("drive_error_" + res.status);
    return res;
  }

  async function findSyncFile() {
    var res = await driveGet("/files", {
      spaces:   "appDataFolder",
      q:        "name = '" + SYNC_FILE_NAME + "'",
      fields:   "files(id)",
      pageSize: "1",
    });
    var data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }

  async function readSyncFile(fileId) {
    var res = await driveGet("/files/" + fileId, { alt: "media" });
    return res.json();
  }

  async function writeSyncFile(fileId, content) {
    var token = await getAccessToken();
    if (!token) throw new Error("not_signed_in");

    var metadata = fileId
      ? {}
      : { name: SYNC_FILE_NAME, parents: ["appDataFolder"] };

    var boundary = "----PajamaSync" + Date.now();
    var body =
      "--" + boundary + "\r\n" +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) + "\r\n" +
      "--" + boundary + "\r\n" +
      "Content-Type: application/json\r\n\r\n" +
      JSON.stringify(content) + "\r\n" +
      "--" + boundary + "--";

    var url = fileId
      ? UPLOAD_API + "/files/" + fileId + "?uploadType=multipart"
      : UPLOAD_API + "/files?uploadType=multipart";
    var method = fileId ? "PATCH" : "POST";

    var headers = {
      Authorization: "Bearer " + token,
      "Content-Type": "multipart/related; boundary=" + boundary,
    };

    var res = await fetch(url, { method: method, headers: headers, body: body });

    if (res.status === 401) {
      token = await refreshAccessToken();
      if (!token) throw new Error("auth_expired");
      headers.Authorization = "Bearer " + token;
      res = await fetch(url, { method: method, headers: headers, body: body });
    }

    if (!res.ok) throw new Error("drive_upload_" + res.status);
    return res.json();
  }

  // ── Sync logic ─────────────────────────────────────────────────

  function mergeEntries(a, b) {
    var map = new Map();
    for (var i = 0; i < a.length; i++) map.set(a[i].completedAt, a[i]);
    for (var j = 0; j < b.length; j++) { if (!map.has(b[j].completedAt)) map.set(b[j].completedAt, b[j]); }
    return Array.from(map.values());
  }

  async function sync() {
    if (!isSignedIn()) return { ok: false, reason: "not_signed_in" };

    try {
      var local = WorkoutHistory.exportData();

      var remoteEntries = [];
      var fileId = await findSyncFile();
      if (fileId) {
        var remote = await readSyncFile(fileId);
        remoteEntries = (remote && Array.isArray(remote.entries)) ? remote.entries : [];
      }

      var merged = mergeEntries(local.entries, remoteEntries);
      WorkoutHistory.replaceEntries(merged);
      await writeSyncFile(fileId, { version: local.version, entries: merged });

      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  // ── Public API ─────────────────────────────────────────────────
  return { signIn, signOut, isSignedIn, getEmail, sync, handleRedirect };
})();

if (typeof module !== "undefined") module.exports = SyncManager;
