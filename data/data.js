/* ==========================================================================
   SITE CONTENT — this is the only file you need to edit
   ==========================================================================
   Every personal detail of the site lives here: your name, your bio, your
   projects, your publications, your links. The .html files only carry
   structure and styling; js/personalize.js injects the words below at
   runtime.

   Rules of the road
   -----------------
   • Plain-text fields are inserted as text. Fields documented as "html"
     accept inline markup: <strong>, <em>, <a href="...">, <br>.
   • Add or delete list entries and the site follows along — nothing is
     hard-coded in the markup.
   • Leave a list empty (`items: []`) and the whole block disappears with
     it — no hollow headings, no empty counters. Handy if you have no
     publications yet, or no open-source projects to show.
   • Set a flag to false under `features` to switch off a whole block.
   • Strings are quoted with double quotes ("). Inside html fields write
     &amp; for an ampersand and &mdash; for an em dash.
   • Keep it short: this is a personal site, not a CV.

   Tip: search this file for "Nora" — every leftover trace of the demo
   persona lives in this file only.
   ========================================================================== */

export const SITE = {
  /* ------------------------------------------------------------- identity */
  identity: {
    firstName: "Tim",
    lastName: "Ho",
    role: "Graduate MRI Physicist & Computational Imaging Researcher",
    shortRole: "MRI Graduate Student",
    tagline: "MRI physics · Computational imaging",
    location: "University of Virginia",
    email: "timothy dot ho at virginia dot edu",

    /* Optional — override how the name splits across the hero's animated
       lines. Without it the hero shows first name on line 1, last name in
       italics on line 2.
         nameLines: [{ text: "Nora" }, { text: "Lindqvist", italic: true }], */
  },

  /* -------------------------------------------------------------- meta --- */
  meta: {
    /* title defaults to "<full name> — <role>" */
    title: null,
    description:
      "Tim develops methods for accelerated reconstruction, motion-robust imaging, and quantitative MR.",
    ogTitle: "Timothy Ho — MRI Graduate Researcher",
    ogDescription: "From pulse sequences to reconstruction.",
  },

  /* --------------------------------------------------------------- nav --- */
  nav: {
    items: [
      { label: "Home", href: "index.html", page: "home" },
      { label: "Research", href: "research.html", page: "research" },
      { label: "Publications", href: "publications.html", page: "publications" },
      { label: "About", href: "about.html", page: "about" },
    ],
    cta: { label: "Get in touch", href: "about.html#contact" },
  },

  /* ----------------------------------------------------------- links ----- */
  /* One list, used twice: the contact list on About and the "Elsewhere"
     column in the footer. `showInFooter: false` keeps it out of the footer.
     `href: null` renders a non-clickable row (useful for an office address). */
  links: [
    {
      label: "Email",
      value: "timothy dot ho at virginia dot edu",
      href: [],
    },
    /*{ label: "Google Scholar", value: "profile ↗", href: "#" },
    { label: "ORCID", value: "0000-0000-0000-0000 ↗", href: "#" },*/
    { label: "GitHub", value: "https://github.com/timwahoo", href: "https://github.com/timwahoo" },
    { label: "Office", value: "University of Virginia, MR5", href: "https://engineering.virginia.edu/bme", showInFooter: false },
  ],

  /* -------------------------------------------------------------- home --- */
  hero: {
    label: "MRI physics · Computational imaging",
    sub: "I work on hardware, pulse programs, and quantitative MR techniques for 9.4T MRI Scanners.",
    actions: [
      { label: "Explore the research", href: "research.html", style: "solid" },
      { label: "Publications", href: "publications.html", style: "ghost" },
    ],
    /* The little instrument readout under the hero. `attr` lets a value be
       updated live by the WebGL hero (slice counter). */
    readout: [
      { label: "TR", value: "60", unit: "ms" },
      { label: "TE", value: "3", unit: "ms" },
      { label: "Field", value: "3T" },
      { label: "Slice", value: "021", unit: "/044", attr: "data-readout-slice" },
      { label: "Matrix", value: "256²" },
    ],
  },

  marquee: [
    "k-space",
    "parallel imaging",
    "compressed sensing",
    "quantitative mapping",
    "bloch simulation",
    "radial & spiral",
    "field maps",
  ],

  home: {
    about: {
      idx: "01",
      heading: "Signals in,<br>images out", /* html */
      lead: "An MRI scan doesn't photograph the body — it <em>measures frequencies</em>.", /* html */
      paragraphs: [
        "I work at the intersection of <strong>magnetic resonance physics</strong>, <strong>machine learning</strong>, and <strong>science policy</strong>",
        "My group works on topics that span compressed sensing, parallel imaging, multiple nuclei, and High-Field MRI.",
        "I am a huge supporter of open-source research.",
      ], /* html */
      stats: [
        { value: "2", label: "Publications" },
        { value: "3T", label: "High field" },        
        { value: "9.4T", label: "Ultra-high field" },
      ],
    },

    directions: {
      idx: "02",
      heading: "Research directions",
      items: [
        {
          idx: "/ 01",
          title: "Accelerated reconstruction",
          body: "Compressed sensing, parallel imaging and unrolled networks that recover a full image from a fraction of k-space — with data consistency you can still trust.",
          href: "research.html#accel",
        },
        {
          idx: "/ 02",
          title: "Motion-resilient imaging",
          body: "Self-gating, navigators and deformation-aware reconstruction for patients who cannot hold still — free-breathing abdominal, cardiac and fetal MRI.",
          href: "research.html#motion",
        },
        {
          idx: "/ 03",
          title: "Sequences & quantitative physics",
          body: "Steady states, controlled aliasing and Bloch-level simulation — designing the acquisition so the inverse problem is well-posed from the start.",
          href: "research.html#physics",
        },
      ],
    },

    work: {
      idx: "03",
      heading: "Selected work",
      items: [],
    },

    recent: {
      idx: "04",
      heading: "Recent publications",
    },

    cta: {
      heading: "Let's make the <em>invisible</em> visible.", /* html */
      sub: "Open to collaborations, supervision and the occasional argument about k-space.",
      action: { label: "Start a conversation", href: "about.html#contact" },
    },
  },

  /* ---------------------------------------------------------- research --- */
  research: {
    kicker: "Research — three threads",
    title: "Signals, sequences, and the <em>space between</em> them.", /* html */
    sub: "Everything below starts in k-space: a sparse, noisy, motion-corrupted record of precessing magnetization. My job is to design the measurement and the inversion so that the image we recover is fast, faithful and clinically useful.",

    lab: {
      idx: "00",
      id: "kspace-lab v1.0",
      heading: "The k-space laboratory",
      intro: "A live MRI simulator running entirely in your browser: a procedural brain phantom is Fourier-transformed, sampled along a trajectory of your choice, then reconstructed — artifacts and all. Real FFT, real physics, no pre-baked images.",
      /* One note per trajectory, keyed by the trajectory id. */
      notes: {
        cartesian:
          "Cartesian — phase-encode lines kept every R-th. Missing lines become coherent shifted copies of the object: the familiar aliasing/ghosting. CS & parallel imaging exploit sparsity to fill the gaps.",
        radial:
          "Radial — spokes all pass through the center, so the low frequencies are heavily oversampled. Undersampling manifests as incoherent streaks, which is why radial survives motion so gracefully.",
        spiral:
          "Spiral — constant-density traversal from the center out. Undersampling smears signal into a smooth blur with edge-like ringing, and off-resonance turns into spatial blurring.",
      },
    },

    threadsHead: {
      idx: "01",
      heading: "Research threads",
    },

    /* `figure.kind` picks one of the built-in canvas figures:
       "mask" (variable-density sampling), "motion" (respiratory drift),
       "relax" (T1 recovery curve). */
    threads: [
      {
        id: "accel",
        idx: "Thread 01 — Reconstruction",
        title: "Fill in the k-space we chose not to measure",
        paragraphs: [
          "Every minute a patient spends in the scanner is a minute of discomfort, motion risk and cost. Undersampling is the fastest way out — if the reconstruction can be trusted.",
          "My group develops unique methods for image reconstruction, with an emphasis on incorporating physical principles into the learning process. We study how these methods generalize and how to evaluate their performance and reliability in clinically relevant settings.",
        ], /* html */
        points: [
          "Variable-density Poisson & random Cartesian sampling, learned end-to-end",
          "Calibrationless parallel imaging with implicit coil sensitivities",
          "Diffusion and score priors with hard k-space consistency projection",
          "Benchmarks & failure-mode analysis for accelerated MRI",
        ],
        figure: {
          kind: "mask",
          caption: "<b>Fig. 1</b> — Variable-density sampling mask acquiring center-out. The low frequencies arrive first; the image sharpens as the outer shell fills in.", /* html */
        },
      },
      {
        id: "motion",
        idx: "Thread 02 — Motion",
        title: "Patients move. The sequence has to cope.",
        paragraphs: [
          "Motion is the dominant cause of repeat scans. Breath-holds fail, fetal imaging cannot be gated externally, and cardiac imaging at high field drifts out of steady state.",
          "We treat motion as part of the forward model: self-gate the data itself, estimate navigators from phase, and let the reconstruction deform the object between frames — <strong>retrospective, differentiable, and free of extra hardware</strong>.",
        ], /* html */
        points: [
          "Golden-angle radial self-gating for free-breathing abdominal MRI",
          "Retrospective fetal volume reconstruction with deformation fields",
          "Prospective motion correction via optical marker feedback",
        ],
        figure: {
          kind: "motion",
          caption: "<b>Fig. 2</b> — Slice stack displaced by respiratory motion. Reconstruction must separate true physiology from corruption — or the blurring wins.", /* html */
        },
        flip: true,
      },
      {
        id: "physics",
        idx: "Thread 03 — Physics",
        title: "Design the acquisition so inversion is easy",
        paragraphs: [
          "The best reconstruction is the one that never has to work hard. Steady-state sequences, controlled aliasing and quantitative mapping all encode assumptions — we make them explicit with <strong>Bloch-level simulation</strong> and optimize the sequence parameters jointly with the reconstruction.",
          "Recent work couples differentiable Bloch simulators to neural reconstructions, so a sequence proposal is judged by the image it will eventually produce, not by a proxy metric on the scanner.",
        ], /* html */
        points: [
          "bSSFP banding suppression from single-scan field map estimates",
          "SMS / CAIPIRINHA aliasing management for fast EPI",
          "Motion-robust quantitative T1 and T2* mapping protocols",
          "Differentiable Bloch simulation for joint sequence-reconstruction design",
        ],
        figure: {
          kind: "relax",
          caption: "<b>Fig. 3</b> — Longitudinal recovery after an inversion pulse. Every quantitative map is a race against T₁ — and against motion.", /* html */
        },
      },
    ],

    tools: {
      idx: "02",
      heading: "Tools we ship",
      items: [
      ],
    },

    cta: {
      heading: "Curious about a <em>specific</em> thread?", /* html */
      sub: "Papers, code and the honest negative results all live in the publication list.",
      action: { label: "Read the papers", href: "publications.html" },
    },
  },

  /* ------------------------------------------------------------- about --- */
  about: {
    kicker: "About — physicist in a magnet room",
    title: "Fascinated by what <em>can't be seen</em> directly.", /* html */
    paragraphs: [
      "I'm a Graduate Researcher in the Department of Radiology and Biomedical Engineering.",
      "The portrait beside this text isn't a photo — it's the same phantom on the simulator on the research page. Drag it to move through the volume.",
      "I'm currently training to be a MR Scientist. Outside the lab: long-distance swimming, analog synthesizers, and running.",
    ], /* html */

    toolkit: [
      "MRI physics",
      "Pulse sequences",
      "k-space sampling",
      "PyTorch",
      "B1/B0 mapping",
      "Cartesian · Radial · Spiral",
      "GRAPPA / SPIRiT",
      "Compressed sensing",
      "Parallel imaging",
    ],

    timeline: {
      idx: "01",
      heading: "Timeline",
      items: [
        {
          year: "2021 — now",
          role: "Graduate Researcher, Radiology & Biomedical Engineering",
          where: "University of Virignia · researching hardware, pulse sequences, and quantitative MR",
        },
        {
          year: "2026",
          role: "COVES Fellow, Virginia Academy for Science Engineering and Medicine (VASEM)",
          where: "Virginia State Government · integrating science into policy",
        },        
        {
          year: "2024 — 2025",
          role: "Teaching Assistant, Biomedical Engineering",
          where: "University of Virignia · BME Capstone and Introduction to Cell Biology and Physiology for Engineers",
        },
        {
          year: "2020",
          role: "Reppergers Research Intern, Oak Ridge Institute for Science and Education",
          where: "Air Force Research Lab (AFRL), Dayton, Ohio",
        },

      ],
    },

    contact: {
      idx: "02",
      heading: "Get in touch",
      lead: "Students, collaborators, anyone — <em>all welcome</em>.", /* html */
      body: "I enjoy meeting with people from all different disciplines. Tell me what you're interested in.",
    },

    cta: {
      heading: "One last <em>gradient</em> spin?", /* html */
      sub: "There's a live MRI simulator waiting two clicks away.",
      action: { label: "Open the lab", href: "research.html#lab" },
    },
  },

  /* ------------------------------------------------------ publications --- */
  publications: {
    kicker: "Archive — 2021 → 2026",
    title: "Publications, <em>preprints</em> &amp; talks.", /* html */
    sub: "Selected and complete lists below. BibTeX copies straight to your clipboard; every entry is also on Google Scholar.",
    /* Buttons under the page header. */
    links: [
      { label: "Google Scholar", href: "#" },
      { label: "ORCID", href: "#" },
    ],
    previewCount: 5,

    /* Filter chips. `id` must match the `topic` of your entries below. */
    topics: [
      { id: "all", label: "All" },
      { id: "recon", label: "Reconstruction" },
      { id: "motion", label: "Motion" },
      { id: "sampling", label: "Sampling" },
      { id: "physics", label: "Pulse sequences" },
      { id: "quant", label: "Quantitative" },
    ],

    /* Add an entry, drop an entry — the list, the filters, the home-page
       preview and the BibTeX all follow automatically.
       Optional: `url` (link to the paper) and `note` (e.g. "Oral"). */
    items: [
      {
        year: 2026,
        title: "Quantitative Susceptibility Mapping to Measure Focused Ultrasound-Mediated Delivery of Size-Variable Model Drugs to the Brain",
        venue: "ISTU Annual Meeting",
        short: "ISTU",
        topic: "quant",
        authors: "M. Hoch, T. Ho, G.W. Miller, R.J. Price",
      },
      {
        year: 2025,
        title: "Quantitative Susceptibility Mapping to Measure Focused Ultrasound-Mediated Delivery of Size-Variable Model Drugs to the Brain",
        venue: "ISMRM Annual Meeting",
        short: "ISMRM",
        topic: "quant",
        authors: "M. Hoch, T. Ho, G.W. Miller, R.J. Price",
      },
      {
        year: 2024,
        title: "Evaluation of Quantitative Susceptibility Mapping Methods for Cerebral Cavernous Malformation in Mice at 9.4T",
        venue: "ISMRM Annual Meeting",
        short: "ISMRM",
        topic: "quant",
        authors: "T. Ho, D. Fisher, M. Hoch, K. Vu, G.W. Miller, R.J. Price",
      },
    ],

    cta: {
      heading: "Citing something? <em>Thank you.</em>", /* html */
      sub: "If the code or data helped, a citation — or a bug report — goes a long way.",
      action: { label: "Say hello", href: "about.html#contact" },
    },
  },

  /* -------------------------------------------------------------- 404 --- */
  /* Copy for the "not found" page. Shown when the page is served for a
     missing URL. */
  notFound: {
    kicker: "Error 404 · FOV exceeded · no signal",
    title: "Signal <em>lost</em> outside the field of view.", /* html */
    body: "This location was never sampled — the phase-encode gradient returned nothing but noise. Return to isocenter and re-prescribe.",
    cta: "Back to home →",
  },

  /* ------------------------------------------------------------ footer --- */
  footer: {
    blurb: "Graduate Researcher in the Department of Radiology & Biomedical Engineering. Building faster, calmer MRI — one line of k-space at a time.",
    note: "phased out",
    stack: "Instrument Serif · three.js · zero frameworks",
    builtWith: 'Built with <a href="https://opencode.ai" target="_blank" rel="noopener">opencode</a> · model <b>opencode/big-pickle</b>',
  },

  /* ---------------------------------------------------------- features --- */
  /* Switch a block off by setting it to false. The markup for that block is
     removed from the page entirely.
       heroCanvas — the WebGL volume behind the home page
       marquee    — the scrolling keyword strip
       lab        — the interactive k-space simulator on Research
       portrait   — the scrubbable phantom on About
       stats      — the four counters on Home */
  features: {
    heroCanvas: true,
    marquee: true,
    lab: true,
    portrait: true,
    stats: true,
  },
};
