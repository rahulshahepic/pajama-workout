/**
 * Pajama Workout — Configuration
 *
 * Edit the WORKOUTS object below to change exercises, durations, or add
 * entirely new workout routines.  The app reads from this file at startup
 * so changes take effect on next reload.
 *
 * Phase types:
 *   "work"    — active exercise  (teal accent)
 *   "rest"    — rest period      (purple accent)
 *   "stretch" — stretch / cool-down (green accent)
 *
 * Each phase: { name, type, duration (seconds), hint }
 */

/** Bump this when any cached asset changes.  SW uses it for cache-busting. */
const APP_VERSION = 18;

/** Google OAuth — public identifier, not a secret.  Change if you fork. */
const GOOGLE_CLIENT_ID = "778429434640-gqtggq705n8p70ged1m1k9bkuss0ghcg.apps.googleusercontent.com";
const GOOGLE_SCOPES    = "https://www.googleapis.com/auth/drive.appdata openid email";
const SYNC_FILE_NAME   = "pajama-workout-history.json";

const WORKOUTS = {
  /* ── Default 5 + 5 routine ──────────────────────────────────── */
  "pajama-classic": {
    id: "pajama-classic",
    title: "Pajama Workout",
    subtitle: "5 min workout + 5 min stretch",
    phases: [
      // ─── Workout block ───
      { name: "Squats",          type: "work",    duration: 40, hint: "Slow & controlled, not too deep" },
      { name: "Rest",            type: "rest",    duration: 20, hint: "Shake it out" },
      { name: "Push-ups",        type: "work",    duration: 40, hint: "Knees down is fine — go slow" },
      { name: "Rest",            type: "rest",    duration: 20, hint: "Shake it out" },
      { name: "Dead Bugs",       type: "work",    duration: 40, hint: "On your back, opposite arm & leg" },
      { name: "Rest",            type: "rest",    duration: 20, hint: "Shake it out" },
      { name: "Reverse Lunges",  type: "work",    duration: 40, hint: "Alternate legs, hold counter if needed" },
      { name: "Rest",            type: "rest",    duration: 20, hint: "Shake it out" },
      { name: "Plank",           type: "work",    duration: 40, hint: "Knees down when you need to" },
      { name: "Rest",            type: "rest",    duration: 20, hint: "Nice work — stretches next" },

      // ─── Stretch block ───
      { name: "Quad Stretch — L",  type: "stretch", duration: 25, hint: "Grab foot behind you, hold the counter" },
      { name: "Quad Stretch — R",  type: "stretch", duration: 25, hint: "Same thing, other side" },
      { name: "Hip Flexor — L",    type: "stretch", duration: 30, hint: "Half-kneeling, push hips forward" },
      { name: "Hip Flexor — R",    type: "stretch", duration: 30, hint: "This is the money stretch" },
      { name: "Chest Stretch",     type: "stretch", duration: 30, hint: "Forearm on doorframe, lean through" },
      { name: "Figure Four — L",   type: "stretch", duration: 30, hint: "On your back, ankle over knee, pull in" },
      { name: "Figure Four — R",   type: "stretch", duration: 30, hint: "Breathe into it" },
      { name: "Spinal Twist — L",  type: "stretch", duration: 25, hint: "Knees to one side, arms out" },
      { name: "Spinal Twist — R",  type: "stretch", duration: 25, hint: "Let gravity do the work" },
      { name: "Child's Pose",      type: "stretch", duration: 50, hint: "The day is over. You showed up." },
    ],
  },

  /* ── Rotator Cuff / Shoulder Impingement Stretches ──────────── */
  "rotator-cuff": {
    id: "rotator-cuff",
    title: "Rotator Cuff Rescue",
    subtitle: "~10 min shoulder stretches for impingement relief",
    phases: [
      // ─── Warm-up ───
      { name: "Pendulum Swings — L",       type: "work",    duration: 30, hint: "Lean on a table, let arm hang & swing small circles" },
      { name: "Pendulum Swings — R",       type: "work",    duration: 30, hint: "Relax the shoulder, let gravity do the work" },
      { name: "Rest",                      type: "rest",    duration: 15, hint: "Roll your shoulders back a few times" },

      // ─── Cross-body & posterior capsule ───
      { name: "Cross-Body Stretch — L",    type: "stretch", duration: 30, hint: "Pull left arm across chest with right hand, keep shoulder down" },
      { name: "Cross-Body Stretch — R",    type: "stretch", duration: 30, hint: "Same thing, other side — don't shrug up" },
      { name: "Sleeper Stretch — L",       type: "stretch", duration: 30, hint: "Lie on left side, arm at 90°, gently push wrist toward floor" },
      { name: "Sleeper Stretch — R",       type: "stretch", duration: 30, hint: "Easy pressure — stop before any sharp pain" },
      { name: "Rest",                      type: "rest",    duration: 15, hint: "Shake out your arms" },

      // ─── Doorframe / pec opening ───
      { name: "Doorframe Stretch — Low",   type: "stretch", duration: 30, hint: "Forearm on frame at waist height, lean through & open chest" },
      { name: "Doorframe Stretch — Mid",   type: "stretch", duration: 30, hint: "Elbow at shoulder height, step through gently" },
      { name: "Doorframe Stretch — High",  type: "stretch", duration: 30, hint: "Hand above head on frame, lean forward to stretch upper pec" },
      { name: "Rest",                      type: "rest",    duration: 15, hint: "Let your arms hang loose" },

      // ─── External rotation & strengthening ───
      { name: "Wall Slide",               type: "work",    duration: 30, hint: "Back to wall, arms in W, slide up to Y and back — slow" },
      { name: "Rest",                      type: "rest",    duration: 10, hint: "Quick breather" },
      { name: "Prone Y-T-W",              type: "work",    duration: 40, hint: "Face down, lift arms into Y, T, then W — squeeze shoulder blades" },
      { name: "Rest",                      type: "rest",    duration: 15, hint: "Almost done with the work" },

      // ─── Lat & upper trap release ───
      { name: "Overhead Lat Stretch — L",  type: "stretch", duration: 30, hint: "Grab a doorframe overhead, lean away to stretch the lat" },
      { name: "Overhead Lat Stretch — R",  type: "stretch", duration: 30, hint: "Tight lats pull the shoulder forward — this helps" },
      { name: "Upper Trap Stretch — L",    type: "stretch", duration: 25, hint: "Tilt head right, gently pull with right hand, left arm relaxed" },
      { name: "Upper Trap Stretch — R",    type: "stretch", duration: 25, hint: "Ear toward shoulder — breathe into the tight side" },
      { name: "Rest",                      type: "rest",    duration: 10, hint: "One more to go" },

      // ─── Cool-down ───
      { name: "Thread the Needle — L",     type: "stretch", duration: 30, hint: "On all fours, slide left arm under & rotate — opens the thoracic spine" },
      { name: "Thread the Needle — R",     type: "stretch", duration: 30, hint: "Let your chest melt toward the floor" },
      { name: "Child's Pose w/ Reach",     type: "stretch", duration: 40, hint: "Walk hands forward, sink hips back, forehead down. You showed up." },
    ],
  },

  /* ── Lower Back & Hips — mobility and relief ────────────────── */
  "lower-back-hips": {
    id: "lower-back-hips",
    title: "Lower Back & Hips",
    subtitle: "~10 min to loosen up the whole posterior chain",
    phases: [
      // ─── Warm-up ───
      { name: "Cat-Cow",                  type: "work",    duration: 40, hint: "On all fours — arch on inhale, round on exhale, nice and slow" },
      { name: "Rest",                     type: "rest",    duration: 10, hint: "Stay on all fours" },
      { name: "Pelvic Tilts",             type: "work",    duration: 30, hint: "On your back, flatten low back to floor then release — find the rhythm" },
      { name: "Rest",                     type: "rest",    duration: 10, hint: "Knees bent, feet flat" },

      // ─── Hip openers ───
      { name: "90/90 Stretch — L",        type: "stretch", duration: 30, hint: "Front leg 90°, back leg 90° — sit tall, lean gently forward" },
      { name: "90/90 Stretch — R",        type: "stretch", duration: 30, hint: "Same thing, other side — keep both sit bones down" },
      { name: "Pigeon Pose — L",          type: "stretch", duration: 35, hint: "Front shin across mat, back leg long — fold forward if you can" },
      { name: "Pigeon Pose — R",          type: "stretch", duration: 35, hint: "Breathe into the deep hip — don't force it" },
      { name: "Rest",                     type: "rest",    duration: 15, hint: "Shake out the legs" },

      // ─── Glute & hamstring ───
      { name: "Figure Four — L",          type: "stretch", duration: 30, hint: "On your back, ankle over knee, pull thigh toward you" },
      { name: "Figure Four — R",          type: "stretch", duration: 30, hint: "Keep head down, relax the shoulders" },
      { name: "Hamstring Stretch — L",    type: "stretch", duration: 30, hint: "Leg up, loop a towel or grab behind the thigh, straighten gently" },
      { name: "Hamstring Stretch — R",    type: "stretch", duration: 30, hint: "Flex the foot, micro-bend at the knee is fine" },
      { name: "Rest",                     type: "rest",    duration: 10, hint: "Quick breather" },

      // ─── Low back release ───
      { name: "Knees-to-Chest",           type: "stretch", duration: 30, hint: "Hug both knees in, rock gently side to side" },
      { name: "Spinal Twist — L",         type: "stretch", duration: 30, hint: "Knees fall left, arms out wide, look right" },
      { name: "Spinal Twist — R",         type: "stretch", duration: 30, hint: "Let gravity pull the knees down — don't force" },
      { name: "Cobra / Sphinx",           type: "stretch", duration: 30, hint: "Face down, press up on forearms, open the front body" },
      { name: "Rest",                     type: "rest",    duration: 10, hint: "Almost done" },

      // ─── Cool-down ───
      { name: "Happy Baby",               type: "stretch", duration: 30, hint: "Grab outer feet, pull knees wide toward armpits, rock gently" },
      { name: "Child's Pose",             type: "stretch", duration: 45, hint: "Knees wide, arms long, melt into the floor. You showed up." },
    ],
  },

  /* ── Keyboard Warrior — quick desk reset ─────────────────────── */
  "keyboard-warrior": {
    id: "keyboard-warrior",
    title: "Keyboard Warrior",
    subtitle: "1 min neck, shoulders & arms — no excuses",
    phases: [
      { name: "Neck Tilt — L",         type: "stretch", duration: 10, hint: "Ear toward left shoulder, gentle pull with left hand" },
      { name: "Neck Tilt — R",         type: "stretch", duration: 10, hint: "Other side — let the weight of your hand do the work" },
      { name: "Chin Tucks",            type: "work",    duration: 10, hint: "Pull chin straight back, make a double chin — hold 2s, repeat" },
      { name: "Shoulder Shrugs",       type: "work",    duration: 10, hint: "Shoulders up to ears, hold 2s, drop — repeat" },
      { name: "Wrist Circles",         type: "work",    duration: 10, hint: "Interlace fingers, slow circles both directions" },
      { name: "Chest Opener",          type: "stretch", duration: 10, hint: "Hands behind head, squeeze shoulder blades, open elbows wide" },
    ],
  },

  /* ── Quick 5 min — no stretches ─────────────────────────────── */
  "quick-five": {
    id: "quick-five",
    title: "Quick Five",
    subtitle: "5 minutes, no excuses",
    phases: [
      { name: "Jumping Jacks",   type: "work", duration: 40, hint: "Wake up those joints" },
      { name: "Rest",            type: "rest", duration: 20, hint: "Breathe" },
      { name: "Push-ups",        type: "work", duration: 40, hint: "Knees down is fine" },
      { name: "Rest",            type: "rest", duration: 20, hint: "Shake it out" },
      { name: "Bodyweight Squats", type: "work", duration: 40, hint: "Slow on the way down" },
      { name: "Rest",            type: "rest", duration: 20, hint: "Almost there" },
      { name: "Mountain Climbers", type: "work", duration: 40, hint: "Steady pace, don't rush" },
      { name: "Rest",            type: "rest", duration: 20, hint: "Last one coming up" },
      { name: "Plank",           type: "work", duration: 40, hint: "Hold strong, you got this" },
    ],
  },
};

/** Seconds to count down before the first phase starts (0 to disable) */
const COUNTDOWN_SECS = 10;

/** Which workout to load by default */
const DEFAULT_WORKOUT = "pajama-classic";

/**
 * Theme colours for each phase type + special states.
 * bg       — page background
 * accent   — primary accent colour (ring, text highlights)
 * glow     — radial glow behind the timer
 * progress — progress-bar fill
 */
const THEME = {
  work:      { bg: "#1a2332", accent: "#4ECDC4", glow: "rgba(78,205,196,0.25)",  progress: "#4ECDC4" },
  rest:      { bg: "#1a1a2e", accent: "#6C63FF", glow: "rgba(108,99,255,0.2)",   progress: "#8B85FF" },
  stretch:   { bg: "#1a2118", accent: "#A8D08D", glow: "rgba(168,208,141,0.15)", progress: "#A8D08D" },
  countdown: { bg: "#1a2332", accent: "rgba(255,255,255,0.6)", glow: "rgba(255,255,255,0.08)", progress: "rgba(255,255,255,0.2)" },
  idle:      { bg: "#1a2332", accent: "#4ECDC4", glow: "rgba(78,205,196,0.25)",  progress: "#4ECDC4" },
};

/** Completion screen overrides */
const DONE_THEME = {
  bg: "#0f1a0f",
  glow: "rgba(168,208,141,0.08)",
  accent: "#A8D08D",
};

/**
 * Audio cues — [frequency Hz, duration ms, repeat count].
 * Named semantically so call-sites read clearly.
 */
const SOUNDS = {
  done:       [880, 200, 3],   // workout complete
  transition: [770, 150, 2],   // phase type changed / countdown end
  start:      [660, 100, 1],   // phase started (same type)
  tick:       [550,  80, 1],   // last 3 seconds warning
};

// Allow Node.js test imports while keeping browser globals working
if (typeof module !== "undefined") {
  module.exports = { APP_VERSION, WORKOUTS, COUNTDOWN_SECS, DEFAULT_WORKOUT, THEME, DONE_THEME, SOUNDS, GOOGLE_CLIENT_ID, GOOGLE_SCOPES, SYNC_FILE_NAME };
}
