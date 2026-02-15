/* ═══════════════════════════════════════════════════════════════
   Pajama Workout — Sync (Google Drive appdata)

   OAuth2 Authorization Code flow with PKCE (no client secret).
   Stores workout history in a hidden app-owned file on the user's
   Google Drive.  The file is invisible to the user and only
   accessible by this Client ID.

   Requires these globals from config.js:
     GOOGLE_CLIENT_ID, GOOGLE_SCOPES, SYNC_FILE_NAME

   Requires WorkoutHistory from history.js:
     .exportData()  — returns the local envelope
     .replaceEntries(entries) — overwrites local entries

   ═══════════════════════════════════════════════════════════════ */

const SyncManager = (function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────────
  const TOKEN_KEY      = "pajama-sync-tokens";
  const VERIFIER_KEY   = "pajama-sync-verifier";
  const REDIRECT_KEY   = "pajama-sync-redirect-uri";
  const TOKEN_URL   = "https://oauth2.googleapis.com/token";
  const AUTH_URL    = "https://accounts.google.com/o/oauth2/v2/auth";
  const DRIVE_API   = "https://www.googleapis.com/drive/v3";
  const UPLOAD_API  = "https://www.googleapis.com/upload/drive/v3";

  // ── PKCE helpers ───────────────────────────────────────────────

  function base64url(bytes) {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function generateVerifier() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return base64url(arr);
  }

  async function computeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return base64url(new Uint8Array(digest));
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

  // ── Token refresh ──────────────────────────────────────────────

  async function refreshAccessToken() {
    const t = loadTokens();
    if (!t || !t.refresh_token) { clearTokens(); return null; }

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     GOOGLE_CLIENT_ID,
        grant_type:    "refresh_token",
        refresh_token: t.refresh_token,
      }),
    });

    if (!res.ok) { clearTokens(); return null; }

    const data = await res.json();
    t.access_token = data.access_token;
    t.expires_at   = Date.now() + data.expires_in * 1000;
    storeTokens(t);
    return t.access_token;
  }

  async function getAccessToken() {
    const t = loadTokens();
    if (!t) return null;
    if (!isExpired(t)) return t.access_token;
    return refreshAccessToken();
  }

  // ── OAuth flow ─────────────────────────────────────────────────

  function getRedirectUri() {
    return window.location.origin + window.location.pathname;
  }

  /** Redirect the user to Google's consent screen. */
  async function signIn() {
    const verifier  = generateVerifier();
    const challenge = await computeChallenge(verifier);
    const redirectUri = getRedirectUri();
    localStorage.setItem(VERIFIER_KEY, verifier);
    localStorage.setItem(REDIRECT_KEY, redirectUri);

    const params = new URLSearchParams({
      client_id:             GOOGLE_CLIENT_ID,
      redirect_uri:          redirectUri,
      response_type:         "code",
      scope:                 GOOGLE_SCOPES,
      code_challenge:        challenge,
      code_challenge_method: "S256",
      access_type:           "offline",
      prompt:                "consent",
    });

    window.location.href = AUTH_URL + "?" + params.toString();
  }

  /**
   * Call on every page load.  If the URL contains an OAuth code,
   * exchange it for tokens and clean the URL.
   * Returns { wasRedirect, ok, error? }.
   */
  async function handleRedirect() {
    const params = new URLSearchParams(window.location.search);

    // Google may redirect with ?error=... if the user declined
    if (params.get("error")) {
      cleanUrl();
      return { wasRedirect: true, ok: false, error: params.get("error") };
    }

    const code = params.get("code");
    if (!code) return { wasRedirect: false, ok: false };

    const verifier    = localStorage.getItem(VERIFIER_KEY);
    const redirectUri = localStorage.getItem(REDIRECT_KEY);
    localStorage.removeItem(VERIFIER_KEY);
    localStorage.removeItem(REDIRECT_KEY);
    if (!verifier) {
      cleanUrl();
      return { wasRedirect: true, ok: false, error: "missing_verifier" };
    }

    try {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     GOOGLE_CLIENT_ID,
          code:          code,
          code_verifier: verifier,
          grant_type:    "authorization_code",
          redirect_uri:  redirectUri || getRedirectUri(),
        }),
      });

      if (!res.ok) {
        var errText = "";
        try { errText = await res.text(); } catch (_) {}
        var errCode = "token_exchange";
        try { errCode = JSON.parse(errText).error || errCode; } catch (_) {}
        cleanUrl();
        return { wasRedirect: true, ok: false, error: errCode + "_" + res.status, detail: errText };
      }

      const data = await res.json();
      const tokens = {
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        expires_at:    Date.now() + data.expires_in * 1000,
        email:         null,
      };

      // Decode email from the id_token JWT (no verification needed —
      // it came over HTTPS directly from Google's token endpoint).
      if (data.id_token) {
        try {
          const payload = JSON.parse(atob(data.id_token.split(".")[1]));
          tokens.email = payload.email || null;
        } catch (_) {}
      }

      storeTokens(tokens);
    } catch (e) {
      cleanUrl();
      return { wasRedirect: true, ok: false, error: "network_error" };
    }

    cleanUrl();
    return { wasRedirect: true, ok: isSignedIn() };
  }

  function cleanUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    history.replaceState(history.state, "", url.toString());
  }

  function signOut() { clearTokens(); }

  function isSignedIn() {
    const t = loadTokens();
    return !!(t && (t.access_token || t.refresh_token));
  }

  function getEmail() {
    const t = loadTokens();
    return t ? t.email || null : null;
  }

  // ── Google Drive helpers ───────────────────────────────────────

  /** Authenticated GET against Drive REST API (auto-refreshes once). */
  async function driveGet(path, params) {
    let token = await getAccessToken();
    if (!token) throw new Error("not_signed_in");

    const url = new URL(DRIVE_API + path);
    if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    let res = await fetch(url.toString(), { headers: { Authorization: "Bearer " + token } });

    if (res.status === 401) {
      token = await refreshAccessToken();
      if (!token) throw new Error("auth_expired");
      res = await fetch(url.toString(), { headers: { Authorization: "Bearer " + token } });
    }

    if (!res.ok) throw new Error("drive_error_" + res.status);
    return res;
  }

  /** Find the sync file in appDataFolder.  Returns fileId or null. */
  async function findSyncFile() {
    const res = await driveGet("/files", {
      spaces:   "appDataFolder",
      q:        "name = '" + SYNC_FILE_NAME + "'",
      fields:   "files(id)",
      pageSize: "1",
    });
    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }

  /** Read the sync file contents. */
  async function readSyncFile(fileId) {
    const res = await driveGet("/files/" + fileId, { alt: "media" });
    return res.json();
  }

  /** Create or update the sync file (multipart upload). */
  async function writeSyncFile(fileId, content) {
    let token = await getAccessToken();
    if (!token) throw new Error("not_signed_in");

    const metadata = fileId
      ? {}
      : { name: SYNC_FILE_NAME, parents: ["appDataFolder"] };

    const boundary = "----PajamaSync" + Date.now();
    const body =
      "--" + boundary + "\r\n" +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) + "\r\n" +
      "--" + boundary + "\r\n" +
      "Content-Type: application/json\r\n\r\n" +
      JSON.stringify(content) + "\r\n" +
      "--" + boundary + "--";

    const url = fileId
      ? UPLOAD_API + "/files/" + fileId + "?uploadType=multipart"
      : UPLOAD_API + "/files?uploadType=multipart";
    const method = fileId ? "PATCH" : "POST";

    const headers = {
      Authorization: "Bearer " + token,
      "Content-Type": "multipart/related; boundary=" + boundary,
    };

    let res = await fetch(url, { method, headers, body });

    if (res.status === 401) {
      token = await refreshAccessToken();
      if (!token) throw new Error("auth_expired");
      headers.Authorization = "Bearer " + token;
      res = await fetch(url, { method, headers, body });
    }

    if (!res.ok) throw new Error("drive_upload_" + res.status);
    return res.json();
  }

  // ── Sync logic ─────────────────────────────────────────────────

  /**
   * Merge two entry arrays by completedAt (union, no duplicates).
   * Entries are keyed by completedAt ISO string.
   */
  function mergeEntries(a, b) {
    const map = new Map();
    for (const e of a) map.set(e.completedAt, e);
    for (const e of b) { if (!map.has(e.completedAt)) map.set(e.completedAt, e); }
    return Array.from(map.values());
  }

  /**
   * Sync local ↔ remote.
   * Returns { ok: true } on success, { ok: false, reason } on failure.
   */
  async function sync() {
    if (!isSignedIn()) return { ok: false, reason: "not_signed_in" };

    try {
      // 1. Read local
      const local = WorkoutHistory.exportData();

      // 2. Read remote (if file exists)
      let remoteEntries = [];
      const fileId = await findSyncFile();
      if (fileId) {
        const remote = await readSyncFile(fileId);
        remoteEntries = (remote && Array.isArray(remote.entries)) ? remote.entries : [];
      }

      // 3. Merge
      const merged = mergeEntries(local.entries, remoteEntries);

      // 4. Save locally
      WorkoutHistory.replaceEntries(merged);

      // 5. Save to Drive
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
