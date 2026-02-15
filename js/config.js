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

/** Which workout to load by default */
const DEFAULT_WORKOUT = "pajama-classic";

/**
 * Theme colours for each phase type.
 * bg       — page background
 * accent   — primary accent colour (ring, text highlights)
 * glow     — radial glow behind the timer
 * progress — progress-bar fill
 */
const THEME = {
  work:    { bg: "#1a2332", accent: "#4ECDC4", glow: "rgba(78,205,196,0.25)",  progress: "#4ECDC4" },
  rest:    { bg: "#1a1a2e", accent: "#6C63FF", glow: "rgba(108,99,255,0.2)",   progress: "#8B85FF" },
  stretch: { bg: "#1a2118", accent: "#A8D08D", glow: "rgba(168,208,141,0.15)", progress: "#A8D08D" },
};

/** Completion screen overrides */
const DONE_THEME = {
  bg: "#0f1a0f",
  glow: "rgba(168,208,141,0.08)",
  accent: "#A8D08D",
};
