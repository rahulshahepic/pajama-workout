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
 *   "yoga"    — yoga pose / flow  (warm amber accent)
 *
 * Each phase: { name, type, duration (seconds), hint }
 */

/** Bump this when any cached asset changes.  SW uses it for cache-busting. */
const APP_VERSION = 31;

/** Google OAuth — public identifier, not a secret.  Change if you fork. */
const GOOGLE_CLIENT_ID = "778429434640-gqtggq705n8p70ged1m1k9bkuss0ghcg.apps.googleusercontent.com";
const GOOGLE_SCOPES    = "https://www.googleapis.com/auth/drive.appdata openid email";
const SYNC_FILE_NAME   = "pajama-workout-history.json";

/**
 * Workout categories — used for colour-coded picker cards.
 * Each: { label, color } where color is used for the left-border accent.
 */
const CATEGORIES = {
  strength: { label: "Strength",  color: "#4ECDC4" },
  mobility: { label: "Mobility",  color: "#A8D08D" },
  yoga:     { label: "Yoga",      color: "#E8A44A" },
  quick:    { label: "Quick",     color: "#8B85FF" },
  custom:   { label: "Custom",    color: "#FF8C69" },
};

const WORKOUTS = {
  /* ── Default 5 + 5 routine ──────────────────────────────────── */
  "pajama-classic": {
    id: "pajama-classic",
    title: "Pajama Workout",
    category: "strength",
    subtitle: "5 min workout + 5 min stretch",
    description: "Full-body basics you can do in your pajamas, plus a deep stretch cool-down.",
    phases: [
      // ─── Workout block ───
      { name: "Squats",          type: "work",    duration: 40, hint: "Feet shoulder-width, sit back like there's a chair behind you. Lower until thighs are parallel, push through your heels to stand." },
      { name: "Rest",            type: "rest",    duration: 20, hint: "Shake out your legs, grab water if you need it." },
      { name: "Push-ups",        type: "work",    duration: 40, hint: "Hands just wider than shoulders, body in a straight line. Lower your chest to the floor and press up. Knees down is totally fine." },
      { name: "Rest",            type: "rest",    duration: 20, hint: "Roll your wrists, catch your breath." },
      { name: "Dead Bugs",       type: "work",    duration: 40, hint: "Lie on your back, arms up, knees at 90\u00B0. Extend opposite arm and leg toward the floor, then switch. Keep your lower back pressed flat." },
      { name: "Rest",            type: "rest",    duration: 20, hint: "Stay on your back, let your arms relax." },
      { name: "Reverse Lunges",  type: "work",    duration: 40, hint: "Step one foot back, drop the back knee toward the floor, then drive through the front heel to stand. Alternate legs each rep." },
      { name: "Rest",            type: "rest",    duration: 20, hint: "Shake it out — one more exercise to go." },
      { name: "Plank",           type: "work",    duration: 40, hint: "Forearms on the floor, body straight from head to heels. Squeeze your glutes and brace your core. Drop to knees if you need to." },
      { name: "Rest",            type: "rest",    duration: 20, hint: "Nice work — stretches coming up. Grab a mat or towel." },

      // ─── Stretch block ───
      { name: "Quad Stretch — L",  type: "stretch", duration: 25, hint: "Stand on your right leg, grab your left foot behind you and pull heel toward glute. Hold something for balance." },
      { name: "Quad Stretch — R",  type: "stretch", duration: 25, hint: "Same thing, other side. Keep knees close together and stand tall." },
      { name: "Hip Flexor — L",    type: "stretch", duration: 30, hint: "Half-kneeling with left knee down. Push your hips forward gently until you feel a stretch in the front of your hip." },
      { name: "Hip Flexor — R",    type: "stretch", duration: 30, hint: "Switch sides. Squeeze the glute of the kneeling leg to deepen the stretch." },
      { name: "Chest Stretch",     type: "stretch", duration: 30, hint: "Place your forearm on a doorframe at shoulder height. Step through and rotate your chest away until you feel the stretch across your pec." },
      { name: "Figure Four — L",   type: "stretch", duration: 30, hint: "Lie on your back, cross left ankle over right knee. Pull right thigh toward you to stretch the left glute." },
      { name: "Figure Four — R",   type: "stretch", duration: 30, hint: "Switch sides. Keep your head on the floor and relax your shoulders." },
      { name: "Spinal Twist — L",  type: "stretch", duration: 25, hint: "Lie on your back, drop both knees to the left. Spread your arms wide and look right. Let gravity pull your knees down." },
      { name: "Spinal Twist — R",  type: "stretch", duration: 25, hint: "Other side. Breathe slowly and let your lower back release." },
      { name: "Child's Pose",      type: "stretch", duration: 50, hint: "Knees wide, arms stretched forward, forehead on the floor. Sink your hips back and breathe. The day is done. You showed up." },
    ],
  },

  /* ── Rotator Cuff / Shoulder Impingement Stretches ──────────── */
  "rotator-cuff": {
    id: "rotator-cuff",
    title: "Rotator Cuff Rescue",
    category: "mobility",
    subtitle: "~10 min shoulder stretches for impingement relief",
    description: "Targeted stretches and gentle strengthening for cranky shoulders and impingement.",
    phases: [
      // ─── Warm-up ───
      { name: "Pendulum Swings — L",       type: "work",    duration: 30, hint: "Lean on a table with your right hand, let your left arm hang. Swing it in small circles, gradually getting bigger. Keep the shoulder completely relaxed." },
      { name: "Pendulum Swings — R",       type: "work",    duration: 30, hint: "Switch sides. Let gravity and momentum do the work — don't actively muscle the arm around." },
      { name: "Rest",                      type: "rest",    duration: 15, hint: "Roll both shoulders back slowly a few times." },

      // ─── Cross-body & posterior capsule ───
      { name: "Cross-Body Stretch — L",    type: "stretch", duration: 30, hint: "Bring your left arm straight across your chest. Use your right hand to pull it closer. Keep your left shoulder blade down — don't let it hike up." },
      { name: "Cross-Body Stretch — R",    type: "stretch", duration: 30, hint: "Same thing, other side. You should feel this in the back of your shoulder, not the front." },
      { name: "Sleeper Stretch — L",       type: "stretch", duration: 30, hint: "Lie on your left side, left arm at 90\u00B0. Use your right hand to gently push your left wrist toward the floor. Stop before any sharp pain." },
      { name: "Sleeper Stretch — R",       type: "stretch", duration: 30, hint: "Switch sides. Easy pressure — this stretches the posterior capsule of the shoulder." },
      { name: "Rest",                      type: "rest",    duration: 15, hint: "Shake out both arms, let them hang loose." },

      // ─── Doorframe / pec opening ───
      { name: "Doorframe Stretch — Low",   type: "stretch", duration: 30, hint: "Place your forearm on a doorframe at waist height. Step through with the same-side foot and lean forward to open the lower chest." },
      { name: "Doorframe Stretch — Mid",   type: "stretch", duration: 30, hint: "Move your elbow up to shoulder height on the frame. Step through gently. This targets the middle pec fibers." },
      { name: "Doorframe Stretch — High",  type: "stretch", duration: 30, hint: "Hand above your head on the frame, elbow high. Lean forward to stretch the upper pec and front deltoid." },
      { name: "Rest",                      type: "rest",    duration: 15, hint: "Drop your arms, let them dangle and shake out." },

      // ─── External rotation & strengthening ───
      { name: "Wall Slide",               type: "work",    duration: 30, hint: "Stand with your back flat against a wall. Start with arms in a W shape, then slowly slide them up into a Y overhead and back down. Keep contact with the wall." },
      { name: "Rest",                      type: "rest",    duration: 10, hint: "Quick breather." },
      { name: "Prone Y-T-W",              type: "work",    duration: 40, hint: "Lie face down, arms hanging off the edge of a bed or mat. Lift into a Y, hold briefly, then T, then W. Squeeze your shoulder blades together on each rep." },
      { name: "Rest",                      type: "rest",    duration: 15, hint: "Almost done with the active work." },

      // ─── Lat & upper trap release ───
      { name: "Overhead Lat Stretch — L",  type: "stretch", duration: 30, hint: "Grab a doorframe or pole overhead with your left hand. Step away and lean your hips to the right to stretch the lat. Tight lats pull your shoulder forward — this opens it up." },
      { name: "Overhead Lat Stretch — R",  type: "stretch", duration: 30, hint: "Same thing, other side. You should feel a long stretch from your armpit down your side." },
      { name: "Upper Trap Stretch — L",    type: "stretch", duration: 25, hint: "Tilt your head to the right, ear toward shoulder. Gently pull with your right hand while keeping your left arm relaxed at your side." },
      { name: "Upper Trap Stretch — R",    type: "stretch", duration: 25, hint: "Switch sides. Breathe into the tight side of your neck. Don't pull hard — let the weight of your hand do the work." },
      { name: "Rest",                      type: "rest",    duration: 10, hint: "One more section to go." },

      // ─── Cool-down ───
      { name: "Thread the Needle — L",     type: "stretch", duration: 30, hint: "Start on all fours. Slide your left arm under your body and rotate, letting your left shoulder and temple rest on the floor. Opens up the thoracic spine." },
      { name: "Thread the Needle — R",     type: "stretch", duration: 30, hint: "Switch sides. Let your chest melt toward the floor as you rotate." },
      { name: "Child's Pose w/ Reach",     type: "stretch", duration: 40, hint: "Walk your hands as far forward as you can, then sink your hips back toward your heels. Forehead down, breathe deep. You showed up." },
    ],
  },

  /* ── Lower Back & Hips — mobility and relief ────────────────── */
  "lower-back-hips": {
    id: "lower-back-hips",
    title: "Lower Back & Hips",
    category: "mobility",
    subtitle: "~10 min to loosen up the whole posterior chain",
    description: "Gentle mobility work for tight hips, stiff lower back, and the whole posterior chain.",
    phases: [
      // ─── Warm-up ───
      { name: "Cat-Cow",                  type: "work",    duration: 40, hint: "On all fours, hands under shoulders, knees under hips. Inhale and arch your back (cow), exhale and round it (cat). Move slowly and breathe into each position." },
      { name: "Rest",                     type: "rest",    duration: 10, hint: "Stay on all fours, relax your spine to neutral." },
      { name: "Pelvic Tilts",             type: "work",    duration: 30, hint: "Lie on your back with knees bent, feet flat. Flatten your lower back into the floor (posterior tilt), then release. Find a gentle rhythm." },
      { name: "Rest",                     type: "rest",    duration: 10, hint: "Stay on your back, knees bent, feet flat." },

      // ─── Hip openers ───
      { name: "90/90 Stretch — L",        type: "stretch", duration: 30, hint: "Sit on the floor. Front left leg bent 90\u00B0, back right leg bent 90\u00B0. Sit tall, then lean gently forward over the front shin. Keep both sit bones on the ground." },
      { name: "90/90 Stretch — R",        type: "stretch", duration: 30, hint: "Switch sides. This targets the deep hip rotators. If it's intense, just sit tall without leaning." },
      { name: "Pigeon Pose — L",          type: "stretch", duration: 35, hint: "From all fours, bring your left shin forward across your mat. Extend your right leg back. Walk your hands forward and fold over the front leg if you can." },
      { name: "Pigeon Pose — R",          type: "stretch", duration: 35, hint: "Switch sides. Breathe deeply into the hip. Don't force the stretch — let gravity do the work over time." },
      { name: "Rest",                     type: "rest",    duration: 15, hint: "Shake out your legs, roll your ankles." },

      // ─── Glute & hamstring ───
      { name: "Figure Four — L",          type: "stretch", duration: 30, hint: "Lie on your back. Cross your left ankle over your right knee, then pull your right thigh toward your chest. You'll feel this deep in the left glute." },
      { name: "Figure Four — R",          type: "stretch", duration: 30, hint: "Switch sides. Keep your head down and shoulders relaxed on the floor." },
      { name: "Hamstring Stretch — L",    type: "stretch", duration: 30, hint: "Lie on your back, lift your left leg up. Loop a towel behind the thigh or grab it with both hands. Gently straighten the leg. Flex the foot." },
      { name: "Hamstring Stretch — R",    type: "stretch", duration: 30, hint: "Switch legs. A micro-bend at the knee is fine — don't lock it out." },
      { name: "Rest",                     type: "rest",    duration: 10, hint: "Quick breather. Stay on your back." },

      // ─── Low back release ───
      { name: "Knees-to-Chest",           type: "stretch", duration: 30, hint: "Hug both knees into your chest. Rock gently side to side to massage your lower back against the floor." },
      { name: "Spinal Twist — L",         type: "stretch", duration: 30, hint: "Lie on your back, drop both knees to the left. Spread your arms wide and look to the right. Let gravity pull your knees down." },
      { name: "Spinal Twist — R",         type: "stretch", duration: 30, hint: "Switch sides. Relax your shoulders and breathe into the twist. Don't force your knees to the floor." },
      { name: "Cobra / Sphinx",           type: "stretch", duration: 30, hint: "Lie face down, press up onto your forearms (sphinx) or hands (cobra). Open your chest and gently extend your lower back. Don't clench your glutes." },
      { name: "Rest",                     type: "rest",    duration: 10, hint: "Almost done. Lie flat on your back." },

      // ─── Cool-down ───
      { name: "Happy Baby",               type: "stretch", duration: 30, hint: "Lie on your back, grab the outside edges of your feet. Pull your knees wide toward your armpits. Rock gently side to side." },
      { name: "Child's Pose",             type: "stretch", duration: 45, hint: "Knees wide, arms stretched forward, forehead on the floor. Sink your hips back and let everything release. You showed up." },
    ],
  },

  /* ── Keyboard Warrior — quick desk reset ─────────────────────── */
  "keyboard-warrior": {
    id: "keyboard-warrior",
    title: "Keyboard Warrior",
    category: "quick",
    subtitle: "1 min neck, shoulders & arms — no excuses",
    description: "A quick desk reset for neck, shoulders, and wrists. Do it between meetings.",
    phases: [
      { name: "Neck Tilt — L",         type: "stretch", duration: 10, hint: "Tilt your head to the left, ear toward shoulder. Place your left hand gently on top and let its weight deepen the stretch. Don't pull." },
      { name: "Neck Tilt — R",         type: "stretch", duration: 10, hint: "Same thing, other side. You should feel this along the side of your neck and into the upper trap." },
      { name: "Chin Tucks",            type: "work",    duration: 10, hint: "Pull your chin straight back to make a double chin. Hold for 2 seconds, release, repeat. Fights forward head posture from screen time." },
      { name: "Shoulder Shrugs",       type: "work",    duration: 10, hint: "Raise both shoulders up toward your ears, hold for 2 seconds, then drop them completely. Repeat. Release the tension you've been holding." },
      { name: "Wrist Circles",         type: "work",    duration: 10, hint: "Interlace your fingers in front of you. Make slow, wide circles with your wrists in both directions. Great for typing fatigue." },
      { name: "Chest Opener",          type: "stretch", duration: 10, hint: "Hands behind your head, elbows wide. Squeeze your shoulder blades together and open your chest. Hold and breathe. Reverses the desk hunch." },
    ],
  },

  /* ── Morning Flow — sun salutation yoga ────────────────────── */
  "morning-flow": {
    id: "morning-flow",
    title: "Morning Flow",
    category: "yoga",
    subtitle: "~10 min sun salutation + standing poses",
    description: "Wake up your body with a gentle vinyasa-inspired flow. No equipment needed.",
    phases: [
      { name: "Mountain Pose",          type: "yoga", duration: 20, hint: "Stand tall, feet together, arms at sides. Ground through all four corners of your feet. Lift your chest, soften your shoulders, and breathe." },
      { name: "Forward Fold",           type: "yoga", duration: 25, hint: "Hinge at the hips, let your head hang heavy. Bend your knees as much as you need to. Grab opposite elbows and sway gently." },
      { name: "Halfway Lift",           type: "yoga", duration: 15, hint: "Hands to shins, flatten your back parallel to the floor. Gaze forward, lengthen your spine. This is your reset between folds." },
      { name: "Low Lunge — R",          type: "yoga", duration: 30, hint: "Step your right foot back into a low lunge, left knee over ankle. Sink your hips and reach your arms overhead. Breathe into the hip flexor." },
      { name: "Downward Dog",           type: "yoga", duration: 30, hint: "Press back, hands shoulder-width, feet hip-width. Push your hips up and back. Pedal your heels. Let your head hang between your arms." },
      { name: "Low Lunge — L",          type: "yoga", duration: 30, hint: "Step your left foot back, right foot forward. Sink your hips, arms overhead. Keep your front knee tracking over your ankle." },
      { name: "Downward Dog",           type: "yoga", duration: 25, hint: "Press back again. Spread your fingers wide, press through the knuckles. Find length in your spine — it's okay if heels don't touch." },
      { name: "Warrior I — R",          type: "yoga", duration: 30, hint: "Step your right foot forward, back foot angled 45\u00B0. Bend the front knee, arms overhead. Square your hips forward and lift your chest." },
      { name: "Warrior II — R",         type: "yoga", duration: 30, hint: "Open your hips and arms to the side. Front knee stays bent, gaze over your front fingertips. Strong legs, relaxed shoulders." },
      { name: "Downward Dog",           type: "yoga", duration: 20, hint: "Flow back through plank and lower to down dog. Take three slow breaths here." },
      { name: "Warrior I — L",          type: "yoga", duration: 30, hint: "Step left foot forward. Back foot angled, hips squared, arms reaching up. Ground through your back foot." },
      { name: "Warrior II — L",         type: "yoga", duration: 30, hint: "Open to the side. Front knee bent, arms wide. Settle into the pose — find ease in the effort." },
      { name: "Downward Dog",           type: "yoga", duration: 20, hint: "Last down dog. Breathe deeply, let your neck release completely." },
      { name: "Forward Fold",           type: "yoga", duration: 20, hint: "Walk your feet to your hands. Fold over your legs. Shake your head yes and no to release the neck." },
      { name: "Mountain Pose",          type: "yoga", duration: 20, hint: "Roll up slowly, one vertebra at a time. Stand tall. Close your eyes. Notice how your body feels. You showed up." },
    ],
  },

  /* ── Wind-Down Yoga — evening relaxation ────────────────────── */
  "wind-down-yoga": {
    id: "wind-down-yoga",
    title: "Wind-Down Yoga",
    category: "yoga",
    subtitle: "~12 min gentle floor poses for sleep",
    description: "Slow, restorative poses to calm your nervous system before bed. All on the floor.",
    phases: [
      { name: "Seated Breathing",       type: "yoga", duration: 30, hint: "Sit cross-legged, hands on knees. Close your eyes. Inhale for 4 counts, hold for 2, exhale for 6. Repeat. Let your day dissolve." },
      { name: "Seated Side Bend — L",   type: "yoga", duration: 25, hint: "Left hand down, right arm overhead. Lean left, opening the right side body. Keep both sit bones grounded." },
      { name: "Seated Side Bend — R",   type: "yoga", duration: 25, hint: "Switch sides. Right hand down, left arm over. Breathe into the stretch along your left ribs." },
      { name: "Cat-Cow",                type: "yoga", duration: 30, hint: "Come to all fours. Inhale, drop your belly and lift your gaze (cow). Exhale, round your spine and tuck your chin (cat). Move with your breath." },
      { name: "Thread the Needle — L",  type: "yoga", duration: 30, hint: "From all fours, slide your left arm under your right. Rest your left shoulder and temple on the floor. Breathe into the twist." },
      { name: "Thread the Needle — R",  type: "yoga", duration: 30, hint: "Switch sides. Slide right arm under left. Let your chest rotate open. Don't force it — gravity is your friend." },
      { name: "Child's Pose",           type: "yoga", duration: 40, hint: "Knees wide, big toes together. Walk your hands forward, forehead down. This is your home base. Breathe slowly and deeply." },
      { name: "Supine Twist — L",       type: "yoga", duration: 35, hint: "Lie on your back, hug knees in, then drop them to the left. Arms wide, look right. Let your lower back unwind." },
      { name: "Supine Twist — R",       type: "yoga", duration: 35, hint: "Bring knees back to center, then drop to the right. Look left. Breathe and release." },
      { name: "Happy Baby",             type: "yoga", duration: 30, hint: "Grab the outside edges of your feet, knees wide toward armpits. Rock gently side to side. Release your lower back." },
      { name: "Reclined Butterfly",     type: "yoga", duration: 40, hint: "Soles of feet together, knees falling open. Arms at your sides, palms up. Close your eyes. This opens hips and calms the mind." },
      { name: "Legs Up the Wall",       type: "yoga", duration: 45, hint: "Scoot your hips to a wall, swing your legs up. Arms relaxed at sides. This reverses blood flow and deeply relaxes. Stay here and breathe." },
      { name: "Savasana",               type: "yoga", duration: 60, hint: "Lie flat, arms at sides, palms up. Close your eyes. Let every muscle release completely. You showed up. Now rest." },
    ],
  },

  /* ── Quick 5 min — no stretches ─────────────────────────────── */
  "quick-five": {
    id: "quick-five",
    title: "Quick Five",
    category: "strength",
    subtitle: "5 minutes, no excuses",
    description: "Five exercises, no stretches, no rest longer than 20 seconds. Just get it done.",
    phases: [
      { name: "Jumping Jacks",   type: "work", duration: 40, hint: "Feet together, arms at sides. Jump feet wide while raising arms overhead, then jump back. Keep a steady rhythm to get your heart rate up." },
      { name: "Rest",            type: "rest", duration: 20, hint: "Breathe. Shake out your arms." },
      { name: "Push-ups",        type: "work", duration: 40, hint: "Hands wider than shoulders, body straight. Lower your chest toward the floor and press back up. Drop to knees if you need to — keep going." },
      { name: "Rest",            type: "rest", duration: 20, hint: "Shake out your wrists and catch your breath." },
      { name: "Bodyweight Squats", type: "work", duration: 40, hint: "Feet shoulder-width apart. Sit back and down like you're sitting in a chair. Go slow on the way down, push through heels on the way up." },
      { name: "Rest",            type: "rest", duration: 20, hint: "Almost there — two more to go." },
      { name: "Mountain Climbers", type: "work", duration: 40, hint: "Start in a high plank. Drive one knee toward your chest, then switch legs. Keep your hips level and maintain a steady pace — no need to sprint." },
      { name: "Rest",            type: "rest", duration: 20, hint: "Last one coming up. You've got this." },
      { name: "Plank",           type: "work", duration: 40, hint: "Forearms or hands on the floor, body in a straight line from head to heels. Squeeze everything tight. If you need to drop to knees, do it — just don't quit." },
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
  yoga:      { bg: "#2a1a0e", accent: "#E8A44A", glow: "rgba(232,164,74,0.2)",   progress: "#E8A44A" },
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

/**
 * Exercise substitutions — keyed by exercise name.
 * Each value is an array of { name, hint } alternatives.
 * Only "work" and "yoga" types show a swap option on the Ready screen.
 */
const SUBSTITUTIONS = {
  "Squats":             [{ name: "Wall Sit",           hint: "Lean against a wall, slide down until thighs are parallel. Hold the position. Great if lunges hurt your knees." },
                         { name: "Glute Bridges",      hint: "Lie on your back, feet flat, push hips up and squeeze glutes at the top. Lower and repeat." }],
  "Push-ups":           [{ name: "Incline Push-ups",   hint: "Hands on a counter or sturdy chair. Same movement, less load. Keep your body straight." },
                         { name: "Knee Push-ups",      hint: "Drop to your knees, cross your ankles. Same upper body movement, easier on the shoulders." }],
  "Dead Bugs":          [{ name: "Bird Dogs",          hint: "On all fours, extend opposite arm and leg, hold briefly, switch. Trains the same core stability." },
                         { name: "Hollow Hold",        hint: "Lie on your back, arms overhead, legs straight and slightly off the floor. Hold and breathe." }],
  "Reverse Lunges":     [{ name: "Step-ups",           hint: "Step up onto a sturdy chair or stair, alternate legs. Easier on the knees than lunges." },
                         { name: "Bodyweight Squats",  hint: "Feet shoulder-width, sit back and down. A simpler movement if lunges are tricky." }],
  "Plank":              [{ name: "Knee Plank",         hint: "Same as a plank but knees on the floor. Keep your core tight and body straight from head to knees." },
                         { name: "Dead Bug Hold",      hint: "Lie on your back, arms up, knees at 90\u00B0. Hold this position while pressing your lower back flat." }],
  "Jumping Jacks":      [{ name: "March in Place",     hint: "High knees, pump your arms. Same cardio effect, no jumping. Easier on the joints." },
                         { name: "Step Jacks",         hint: "Same arm motion as jumping jacks but step one foot out at a time instead of jumping." }],
  "Mountain Climbers":  [{ name: "Standing Knee Drives", hint: "Stand tall, drive one knee up toward your chest, alternate. Same cardio, no plank position needed." },
                         { name: "Slow Climbers",      hint: "Same as mountain climbers but at half speed. Focus on control, not pace." }],
  "Bodyweight Squats":  [{ name: "Chair Squats",       hint: "Squat down to touch a chair seat, then stand back up. The chair gives you a depth target and safety net." },
                         { name: "Wall Sit",           hint: "Back against the wall, slide to a 90\u00B0 seat. Hold. Burns in a different way." }],
};

// Allow Node.js test imports while keeping browser globals working
if (typeof module !== "undefined") {
  module.exports = { APP_VERSION, WORKOUTS, CATEGORIES, COUNTDOWN_SECS, DEFAULT_WORKOUT, THEME, DONE_THEME, SOUNDS, SUBSTITUTIONS, GOOGLE_CLIENT_ID, GOOGLE_SCOPES, SYNC_FILE_NAME };
}
