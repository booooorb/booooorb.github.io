  const stage = document.getElementById("stage");
  const canvas = document.getElementById("stageCanvas");
  const storeToggle = document.getElementById("storeToggle");
  const storePanel = document.getElementById("storePanel");
  const storeList = document.getElementById("storeList");
  const storeHint = document.getElementById("storeHint");
  const currencyValue = document.getElementById("currencyValue");
  const attributionModal = document.getElementById("attributionModal");
  const attributionClose = document.getElementById("attributionClose");
  const attributionOpen = document.getElementById("attributionOpen");

  const ctx = canvas ? canvas.getContext("2d") : null;
  const GOOSE_MAYHEM_ACTIVE = !!stage && !!canvas && !!ctx;

  const ATTRIBUTION_DISMISSED_KEY = "gooseMayhem.attributionDismissed.v1";
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const FIXED_DT = 1 / 120;
  const TAU = Math.PI * 2;
  const SCREEN_UP = { x: 0, y: -1 };
  const GOOSE_COUNT = motionQuery.matches ? 24 : 60;
  const MAX_TABS = 80;
  const SEPARATION_RADIUS = 110;
  const GOOSE_SPATIAL_KEY_BIAS = 2048;
  const GOOSE_SPATIAL_KEY_STRIDE = GOOSE_SPATIAL_KEY_BIAS * 2;
  const CLOSE_BUTTON_SIZE = 16;
  const HONK_VOLUME = 0.055;
  const CURSOR_CHASE_TRIGGER_RADIUS = 155;
  const CURSOR_CHASE_GIVE_UP_DISTANCE = 300;
  const FLAME_RANGE = 268;
  const FLAME_DAMAGE = 1.05;
  const FLAME_MIN_ALIGNMENT = 0.22;
  const FLAME_DIRECTION = { x: -0.86, y: -0.51 };
  const NUKE_FUSE = motionQuery.matches ? 0.9 : 1.18;
  const NUKE_BLAST_DURATION = motionQuery.matches ? 1.65 : 2.15;
  const KATANA_SLICE_MIN = 26;
  const CURRENCY_PER_TAB = 1;
  const HEX_DIGITS = Array.from({ length: 256 }, (_, index) => (
    index.toString(16).toUpperCase().padStart(2, "0")
  ));
  const DESKTOP_FONT = '"Segoe UI", Tahoma, sans-serif';
  const MONO_FONT = '"Consolas", "Lucida Console", monospace';
  const PLAYFUL_FONT = '"Comic Sans MS", "Comic Sans", cursive';

  const COLORS = {
    shadow: "rgba(31, 43, 52, 0.18)",
    shadowCore: "rgba(19, 27, 34, 0.08)",
    bodyShadow: "#d9d9d9",
    body: "#ffffff",
    underbody: "#eeeeee",
    wing: "#f4f4f4",
    beak: "#f08d16",
    feet: "#e18b20",
    eye: "#101010",
    cargoShadow: "rgba(18, 46, 69, 0.2)",
    cargoPaper: "#fffdf7",
    cargoStroke: "rgba(31, 31, 31, 0.16)",
    flameCore: "rgba(255, 247, 187, 0.95)",
    flameMid: "rgba(255, 162, 66, 0.88)",
    flameEdge: "rgba(255, 91, 33, 0.58)",
    smoke: "rgba(63, 56, 50, 0.22)",
    ember: "rgba(255, 201, 96, 0.92)",
    scorch: "rgba(39, 25, 16, 0.72)",
    antiMalwareShadow: "rgba(5, 18, 10, 0.22)",
    antiMalwareIcon: "rgba(174, 255, 197, 0.95)",
    antiMalwareIconEdge: "rgba(57, 127, 81, 0.66)",
    antiMalwarePanel: "rgba(20, 32, 29, 0.96)",
    antiMalwarePanelEdge: "rgba(139, 246, 171, 0.38)",
    antiMalwareBar: "rgba(37, 57, 48, 0.98)",
    antiMalwareScreen: "rgba(7, 18, 12, 0.97)",
    antiMalwareGrid: "rgba(112, 255, 164, 0.08)",
    antiMalwareGlow: "rgba(111, 255, 163, 0.24)",
    antiMalwareText: "rgba(158, 255, 184, 0.94)",
    antiMalwareTextSoft: "rgba(158, 255, 184, 0.58)",
    antiMalwareHex: "rgba(124, 255, 154, 0.92)",
    recycleBinShadow: "rgba(20, 40, 62, 0.2)",
    recycleBinBody: "rgba(209, 237, 255, 0.96)",
    recycleBinBodyEdge: "rgba(66, 110, 150, 0.42)",
    recycleBinLid: "rgba(159, 210, 247, 0.98)",
    recycleBinGlow: "rgba(129, 214, 255, 0.28)",
    recycleBinBeam: "rgba(175, 233, 255, 0.32)",
    recycleBinText: "rgba(22, 57, 90, 0.88)",
    taskManagerShadow: "rgba(16, 24, 56, 0.2)",
    taskManagerPanel: "rgba(229, 236, 255, 0.97)",
    taskManagerPanelEdge: "rgba(102, 122, 196, 0.34)",
    taskManagerBar: "rgba(121, 145, 226, 0.96)",
    taskManagerScreen: "rgba(244, 247, 255, 0.98)",
    taskManagerGrid: "rgba(126, 149, 220, 0.1)",
    taskManagerText: "rgba(33, 45, 86, 0.92)",
    taskManagerSoft: "rgba(73, 87, 136, 0.72)",
    taskManagerKill: "rgba(255, 123, 104, 0.92)",
    taskManagerKillEdge: "rgba(147, 47, 40, 0.52)",
    gauntletDust: "rgba(26, 24, 24, 0.88)",
    gauntletDustWarm: "rgba(42, 38, 36, 0.9)",
    gauntletDustHot: "rgba(68, 62, 58, 0.9)",
    gauntletGlow: "rgba(74, 68, 62, 0.12)",
    katanaBlade: "rgba(246, 249, 255, 0.98)",
    katanaBladeEdge: "rgba(176, 194, 220, 0.88)",
    katanaHandle: "rgba(42, 44, 53, 0.96)",
    katanaWrap: "rgba(221, 229, 238, 0.72)",
    katanaTrail: "rgba(232, 245, 255, 0.62)",
    katanaTrailCore: "rgba(255, 255, 255, 0.9)",
    nukeBody: "#54606d",
    nukeMetal: "#9ea8b3",
    nukeFin: "#4a535e",
    nukeStripe: "#f4c84e",
    nukeWarning: "#201a10",
    nukeGlow: "rgba(255, 170, 84, 0.32)",
    nukeFlash: "rgba(255, 249, 235, 0.96)",
    nukeShock: "rgba(255, 186, 112, 0.58)",
    nukeBlastCore: "rgba(255, 245, 198, 0.95)",
    nukeBlastMid: "rgba(255, 168, 76, 0.88)",
    nukeBlastEdge: "rgba(255, 103, 52, 0.62)",
    nukeDebris: "rgba(255, 246, 222, 0.9)",
    thunderBoltCore: "rgba(255, 250, 198, 0.98)",
    thunderBoltEdge: "rgba(255, 214, 92, 0.9)",
    thunderGlow: "rgba(255, 202, 74, 0.36)",
    thunderArc: "rgba(255, 235, 156, 0.92)",
    thunderSpark: "rgba(255, 246, 188, 0.97)",
    breadCrust: "rgba(176, 104, 42, 0.98)",
    breadFace: "rgba(255, 228, 170, 0.98)",
    breadButter: "rgba(255, 235, 116, 0.96)",
    breadSeed: "rgba(122, 74, 28, 0.72)",
    fistSkin: "rgba(255, 215, 181, 0.98)",
    fistShade: "rgba(214, 162, 126, 0.92)",
    fistOutline: "rgba(96, 56, 36, 0.7)",
    glassCrack: "rgba(232, 245, 255, 0.9)",
    glassShadow: "rgba(41, 78, 118, 0.32)",
    glassGlow: "rgba(196, 230, 255, 0.28)",
    currencyGlow: "rgba(166, 255, 176, 0.86)",
    billFace: "rgba(155, 227, 156, 0.98)",
    billShade: "rgba(111, 192, 116, 0.98)",
    billEdge: "rgba(52, 118, 59, 0.96)",
    billSeal: "rgba(72, 145, 77, 0.96)",
    billText: "rgba(34, 86, 39, 0.96)",
  };

  const TASKS = {
    WANDER: "wander",
    DRAG_TAB: "dragTab",
    TRACK_MUD: "trackMud",
    CHASE_CURSOR: "chaseCursor",
    BREAD_CHASE: "breadChase",
  };

  const DRAG_STAGE = {
    EXITING: "exiting",
    WAITING: "waiting",
    DRAGGING: "dragging",
  };

  const SCREEN_DIRECTION = {
    LEFT: "left",
    TOP: "top",
    RIGHT: "right",
  };

  const MAYHEM_WEIGHTED = [
    TASKS.DRAG_TAB,
    TASKS.DRAG_TAB,
    TASKS.DRAG_TAB,
    TASKS.DRAG_TAB,
    TASKS.TRACK_MUD,
    TASKS.WANDER,
    TASKS.WANDER,
    TASKS.WANDER,
    TASKS.WANDER,
    TASKS.WANDER,
    TASKS.WANDER,
  ];

  const TAB_LINES = [
    ["we took this tab", "and we will take", "the next one too."],
    ["stop touching X", "or the flock", "touches everything."],
    ["your cursor looks", "slow enough to", "catch today."],
    ["you are already", "outnumbered and", "we can count."],
    ["this desktop now", "belongs to the", "honk council."],
    ["move carefully", "we bite first", "and ask never."],
    ["we saw you", "trying to close", "our art."],
    ["one more click", "and the geese", "rush the screen."],
    ["we dragged this", "in to prove", "we can."],
    ["you hide tabs", "we find tabs", "simple math."],
    ["back away from", "the memes and", "nobody panics."],
    ["the flock voted", "you lose custody", "of this window."],
    ["do not test", "the patience of", "forty geese."],
    ["this is your", "official warning", "from beak command."],
    ["we know where", "your cursor sleeps", "at night."],
    ["we honk because", "fear sounds better", "in chorus."],
    ["surrender snacks", "and maybe we", "spare the calendar."],
    ["the geese demand", "full desktop access", "and crumbs."],
    ["every closed tab", "becomes a reason", "to chase you."],
    ["the floor is", "mud now and", "so are you."],
    ["you are not", "managing chaos", "you are seasoning it."],
    ["we can smell", "hesitation through", "the glass."],
    ["hold still and", "we might only", "steal two more."],
    ["this note means", "the perimeter has", "already collapsed."],
    ["stop staring at", "this note and", "start running."],
    ["the flock prefers", "your screen messy", "and your hands busy."],
    ["we learned drag", "and drop before", "you learned panic."],
    ["your tabs are", "migrating now and", "we guide migration."],
    ["you had control", "for a moment", "it passed."],
    ["we left this", "here so fear", "has subtitles."],
    ["we only threaten", "because it is", "working beautifully."],
    ["another goose is", "already behind you", "probably two."],
    ["do not feed", "the geese ideas", "we have enough."],
    ["the flock requests", "silence while we", "loot your desktop."],
    ["we marked this", "screen as nesting", "territory."],
    ["your pointer keeps", "wandering into goose", "jurisdiction."],
    ["you call it", "clutter we call", "fortification."],
    ["there is no", "undo button for", "beak justice."],
    ["close this note", "and nearby geese", "take offense."],
    ["we are not", "lost we are", "occupying."],
    ["if you blink", "we redecorate", "the whole center."],
    ["we rehearsed this", "raid and you", "did not."],
    ["the memes stay", "the tabs stay", "you adapt."],
    ["we do not", "negotiate with", "empty hands."],
    ["the flock approves", "of your fear", "carry on."],
    ["you should have", "locked the screen", "before the honking."],
    ["this is a", "ransom note for", "your desktop peace."],
    ["every goose here", "thinks your cursor", "looks suspicious."],
    ["run the mouse", "if you want", "a sporting chance."],
    ["we entered quietly", "the next wave", "will not."],
    ["the geese noticed", "your confidence and", "fixed it."],
    ["our demands are", "simple more tabs", "less dignity."],
    ["you keep deleting", "we keep arriving", "choose wisely."],
    ["this swarm has", "excellent morale and", "terrible manners."],
    ["you are one", "honk away from", "total disorder."],
    ["look away once", "and we claim", "another corner."],
    ["the flock says", "thank you for", "keeping us entertained."],
  ];

  const TAB_TITLES = [
    "Goose Threat",
    "Flock Warning",
    "Ransom Note",
    "HONK Notice",
    "Beak Order",
  ];

  const MEME_TAB_TITLES = [
    "Goose Meme",
    "Camera Roll",
    "Recovered Image",
    "Desktop Meme",
    "Goose Selfie",
  ];

  const MEME_PATHS = [
    "memes/Meme1.png",
    "memes/Meme2.png",
    "memes/Meme3.png",
    "memes/Meme4.png",
    "memes/Meme5.png",
    "memes/Meme6.png",
    "memes/Meme7.png",
    "memes/selfie1.PNG",
    "memes/selfie2.PNG",
    "memes/selfie3.PNG",
    "memes/selfie4.PNG",
    "memes/selfie5.PNG",
    "memes/selfie6.PNG",
    "memes/selfie7.PNG",
  ];

  const HONK_TEXTS = [
    "HONK!",
    "hjonk",
    "HONK HONK",
    "honk?",
    "HRONK",
    "beep hjonk",
  ];

  const SOUND_PATHS = {
    honks: [
      "../desktop-goose/Assets/Sound/NotEmbedded/Honk1.mp3",
      "../desktop-goose/Assets/Sound/NotEmbedded/Honk2.mp3",
      "../desktop-goose/Assets/Sound/NotEmbedded/Honk3.mp3",
      "../desktop-goose/Assets/Sound/NotEmbedded/Honk4.mp3",
    ],
  };

  const DESKTOP_TOOL_APPS = [
    {
      id: "flamethrower",
      name: "Flamethrower",
      desktopLabel: "flamethrower.app",
      shortLabel: "flame.app",
      hotkey: "F",
    },
    {
      id: "katana",
      name: "Katana",
      desktopLabel: "katana.app",
      shortLabel: "katana.app",
      hotkey: "K",
    },
    {
      id: "nuke",
      name: "Nuke",
      desktopLabel: "nuke.app",
      shortLabel: "nuke.app",
      hotkey: "N",
    },
    {
      id: "thunder",
      name: "Thunder",
      desktopLabel: "thunder.app",
      shortLabel: "thunder.app",
      hotkey: "Y",
    },
    {
      id: "gauntlet",
      name: "Infinity Gauntlet",
      desktopLabel: "gauntlet.app",
      shortLabel: "gauntlet.app",
      hotkey: "G",
    },
    {
      id: "bread",
      name: "Bread",
      desktopLabel: "bread.app",
      shortLabel: "bread.app",
      hotkey: "B",
    },
    {
      id: "fist",
      name: "Fist",
      desktopLabel: "fist.app",
      shortLabel: "fist.app",
      hotkey: "H",
    },
  ];

  const STORE_APPS = [
    {
      id: "antiMalware",
      name: "Anti-Malware",
      desktopLabel: "anti-malware.app",
      shortLabel: "anti-malware",
      price: 0,
    },
    {
      id: "recycleBin",
      name: "Recycle Bin",
      desktopLabel: "Recycle Bin",
      shortLabel: "recycle bin",
      price: 0,
    },
    {
      id: "taskManager",
      name: "Task Manager",
      desktopLabel: "Task Manager",
      shortLabel: "task mgr",
      price: 0,
    },
    ...DESKTOP_TOOL_APPS.map((app) => ({
      ...app,
      price: 0,
    })),
  ];

  const pt = (x = 0, y = 0) => ({ x, y });
  const add = (a, b) => pt(a.x + b.x, a.y + b.y);
  const sub = (a, b) => pt(a.x - b.x, a.y - b.y);
  const mul = (a, s) => pt(a.x * s, a.y * s);
  const mag = (a) => Math.hypot(a.x, a.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const fract = (value) => value - Math.floor(value);
  const norm = (a) => {
    const m = mag(a);
    return m ? mul(a, 1 / m) : pt();
  };
  const dist = (a, b) => mag(sub(a, b));
  const perp = (a) => pt(-a.y, a.x);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpPt = (a, b, t) => pt(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const angleVec = (angle) => pt(Math.cos(angle), Math.sin(angle));
  const compactInPlace = (list, keepItem) => {
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < list.length; readIndex += 1) {
      const item = list[readIndex];
      if (!keepItem(item, readIndex)) {
        continue;
      }
      list[writeIndex] = item;
      writeIndex += 1;
    }
    list.length = writeIndex;
    return list;
  };
  const cubicEaseInOut = (t) => (
    t < 0.5
      ? 4 * t * t * t
      : 1 - (Math.pow(-2 * t + 2, 3) / 2)
  );

  const state = {
    time: 0,
    width: 0,
    height: 0,
    dpr: 1,
    acc: 0,
    last: performance.now(),
    geese: [],
    renderGeese: [],
    gooseSpatialIndex: {
      cellSize: SEPARATION_RADIUS,
      buckets: new Map(),
    },
    cargoes: [],
    nextCargoId: 1,
    currency: 0,
    currencyBursts: [],
    hoveredCargoId: null,
    hoveredUiTarget: null,
    pointer: {
      pos: pt(),
      inside: false,
    },
    sounds: {
      enabled: typeof Audio === "function",
      userInteracted: false,
      initialized: false,
      honkPool: [],
    },
    memeImages: [],
    shop: {
      open: false,
      message: "",
    },
    desktopApps: Object.fromEntries(
      DESKTOP_TOOL_APPS.map((app) => [
        app.id,
        {
          owned: false,
          selected: false,
          iconPos: pt(),
        },
      ])
    ),
    flamethrower: {
      active: false,
      firing: false,
      grabbed: false,
      hovered: false,
      aimDir: pt(1, 0),
      flameParticles: [],
      smokeParticles: [],
      emberParticles: [],
      pulse: 0,
    },
    katana: {
      active: false,
      slicing: false,
      slashTrail: [],
      splitPieces: [],
      aimDir: norm(pt(-1, -0.45)),
    },
    antiMalware: {
      deployed: false,
      windowOpen: false,
      selected: false,
      iconPos: pt(),
      windowPos: pt(),
      width: 266,
      height: 182,
      status: "idle",
      targetCargoId: null,
      connectionStart: 0,
      connectionDuration: 0,
      cooldownUntil: 0,
      pulse: 0,
      hexDigits: [],
      lastEvent: "",
      lastEventUntil: 0,
      drag: {
        active: false,
        target: null,
        offset: pt(),
        moved: false,
        ignoreClick: false,
      },
    },
    recycleBin: {
      deployed: false,
      selected: false,
      iconPos: pt(),
      pulse: 0,
      suctionRadius: motionQuery.matches ? 132 : 168,
    },
    taskManager: {
      deployed: false,
      selected: false,
      windowOpen: false,
      iconPos: pt(),
      windowPos: pt(),
      width: 312,
      height: 252,
      pulse: 0,
    },
    gauntlet: {
      snapping: false,
      cooldownUntil: 0,
      pulse: 0,
      dustParticles: [],
    },
    nuke: {
      active: false,
      dropping: false,
      armed: false,
      pos: pt(),
      targetPos: pt(),
      velocityY: 0,
      droppedAt: 0,
      detonateAt: 0,
      pulse: 0,
      flash: 0,
      blastAge: -1,
      blastPos: pt(),
      scorch: 0,
      cloud: {
        active: false,
        origin: pt(),
        age: 0,
        duration: 0,
        drift: 0,
        phase: 0,
      },
      aftermathFires: [],
      particles: [],
      debris: [],
    },
    thunder: {
      active: false,
      pulse: 0,
      flash: 0,
      cursorJitter: 0,
      strikes: [],
      scorches: [],
      sparks: [],
      vaporizing: [],
    },
    bread: {
      active: false,
      pulse: 0,
    },
    fist: {
      active: false,
      pulse: 0,
      impactFlash: 0,
      cracks: [],
      shards: [],
    },
  };

  if (GOOSE_MAYHEM_ACTIVE && typeof Image === "function") {
    state.memeImages = MEME_PATHS.map((src) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
      return {
        src,
        image,
      };
    });
  }

