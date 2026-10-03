// Single source for every visible string and specification on the site.
// VANTA and the R1 are fictional; the numbers are invented but internally consistent
// (1,099.4 cc from 83.0 x 50.8 mm, 25.7 m/s mean piston speed at the 15,200 rpm limiter).

export const product = {
  brand: "VANTA",
  model: "R1",
  price: "$48,000",
  units: 99,
  unitsLabel: "99 UNITS WORLDWIDE",
  /** authored GLB that replaces the procedural parts by name, e.g. "/models/r1.glb" */
  glb: null as string | null,
};

export const reveal = {
  model: "VANTA / R1",
  units: "99 UNITS.",
  price: "$48,000.",
};

export const mass = {
  dry: 164,
  reference: 201,
  line: "37 KG UNDER THE CLASS REFERENCE. THIS IS WHERE IT WENT.",
  // shown as callouts on the machine, in draw order
  callouts: [
    { id: "monocoque", anchor: "chassis.spar", label: "CARBON MONOCOQUE", kg: 6.8 },
    { id: "exhaust", anchor: "exhaust.silencer", label: "TITANIUM EXHAUST", kg: 4.6 },
    { id: "wheels", anchor: "wheels.rear", label: "FORGED MAGNESIUM WHEELS", kg: 2.9 },
    { id: "battery", anchor: "electronics.battery", label: "LITHIUM POWER UNIT", kg: 2.7 },
    { id: "rearsets", anchor: "chassis.rearset", label: "MACHINED REARSETS", kg: 0.6 },
  ],
  remainder: { label: "BODYWORK, ENGINE, FASTENERS, WIRING", kg: 19.4 },
  dimensions: [
    { id: "wheelbase", label: "WHEELBASE", value: "1,428 MM" },
    { id: "seat", label: "SEAT", value: "845 MM" },
    { id: "length", label: "LENGTH", value: "2,052 MM" },
  ],
};

export const ledger = [
  { label: "Carbon monocoque", kg: 6.8 },
  { label: "Engine internals and cases", kg: 5.8 },
  { label: "Pre-preg carbon bodywork", kg: 5.1 },
  { label: "Titanium exhaust", kg: 4.6 },
  { label: "Forged magnesium wheels", kg: 2.9 },
  { label: "Lithium power unit", kg: 2.7 },
  { label: "Carbon subframe", kg: 2.2 },
  { label: "Cooling", kg: 2.0 },
  { label: "CAN-bus wiring", kg: 1.7 },
  { label: "Monobloc brakes", kg: 1.4 },
  { label: "Titanium fasteners", kg: 1.2 },
  { label: "Machined rearsets", kg: 0.6 },
];

export const aero = {
  lines: ["THE AIR", "IS PART", "OF THE MACHINE."],
  readouts: [
    { label: "DOWNFORCE", value: "17.8 KG AT 270 KM/H" },
    { label: "CdA, TUCKED", value: "0.291 M²" },
  ],
};

export const exploded = {
  count: "1,186",
  line: ["1,186 PARTS.", "NONE OF THEM DECORATIVE."],
  // label shown when each system settles; not every system is labelled
  labels: [
    { group: "bodywork", title: "PRE-PREG CARBON BODYWORK", detail: "3.9 KG, 11 PANELS" },
    { group: "electronics", title: "6-AXIS IMU", detail: "SAMPLED AT 1 KHZ" },
    { group: "exhaust", title: "TITANIUM 4-2-1", detail: "5.3 KG, BACK-PURGED WELDS" },
    { group: "wheels", title: "FORGED MAGNESIUM", detail: "17 IN, 2.6 / 3.4 KG" },
    { group: "chassis", title: "CARBON MONOCOQUE", detail: "9.4 KG, DOUBLES AS AIRBOX" },
    { group: "engine", title: "1,099 CC V4", detail: "FULLY STRESSED MEMBER" },
  ],
};

export const power = {
  hp: 214,
  line: "1,099 CC. NATURALLY ASPIRATED 90° V4.",
  note: "PEAK POWER AT 13,600. THE LIMITER AT 15,200.",
  clusters: [
    [
      { label: "BORE × STROKE", value: "83.0 × 50.8 MM" },
      { label: "COMPRESSION", value: "14.1 : 1" },
      { label: "TORQUE", value: "121 NM AT 11,250" },
      { label: "REDLINE", value: "15,200 RPM" },
    ],
    [
      { label: "GEARBOX", value: "6-SPEED CASSETTE" },
      { label: "SHIFT", value: "BIDIRECTIONAL QUICKSHIFT" },
      { label: "THROTTLE", value: "RIDE-BY-WIRE" },
      { label: "MAPS", value: "4" },
    ],
  ],
  idle: 1400,
  redline: 15200,
};

export const dash = {
  line: "THE DASH IS LIVE. CHANGE SOMETHING.",
  modes: ["RACE", "TRACK", "ROAD", "WET"] as const,
  presets: {
    RACE: { tc: 1, eb: 1, sus: 1, map: "FULL" },
    TRACK: { tc: 3, eb: 2, sus: 1, map: "FULL" },
    ROAD: { tc: 4, eb: 2, sus: 2, map: "HIGH" },
    WET: { tc: 7, eb: 3, sus: 3, map: "LOW" },
  },
};

export type RideMode = (typeof dash.modes)[number];

export const materials = [
  { id: "carbon", caption: "2×2 TWILL CARBON, T800, AUTOCLAVED", src: null as string | null },
  { id: "billet", caption: "BILLET ALUMINUM, TITANIUM FASTENERS", src: null as string | null },
  { id: "weld", caption: "TIG-WELDED GRADE 2 TITANIUM", src: null as string | null },
  { id: "disc", caption: "330 MM FLOATING DISCS", src: null as string | null },
  { id: "suede", caption: "PERFORATED MICROSUEDE", src: null as string | null },
  { id: "knurl", caption: "KNURLED SWITCHGEAR", src: null as string | null },
  { id: "paint", caption: "SATIN NOIR OVER A METALLIC GROUND COAT", src: null as string | null },
];

export const motion = {
  top: 299,
  unit: "KM/H, LIMITED.",
  times: [
    { label: "0-100 KM/H", value: "2.9 S" },
    { label: "0-200 KM/H", value: "7.1 S" },
  ],
};

export const ninety = {
  big: "99 BUILT.",
  lines: ["NUMBERED ON THE MONOCOQUE.", "AFTER 099, THE TOOLING IS DESTROYED."],
  serial: "001 / 099",
};

export const final = {
  title: "VANTA / R1",
  price: "$48,000",
  units: "99 UNITS WORLDWIDE",
  primary: "REQUEST ALLOCATION",
  secondary: "TECHNICAL DOSSIER",
};

export const dossier = {
  title: "VANTA R1 TECHNICAL DOSSIER",
  groups: [
    {
      title: "Engine",
      rows: [
        ["Type", "90° V4, naturally aspirated"],
        ["Displacement", "1,099 cc"],
        ["Bore × stroke", "83.0 × 50.8 mm"],
        ["Compression", "14.1 : 1"],
        ["Power", "214 hp (160 kW) at 13,600 rpm"],
        ["Torque", "121 Nm at 11,250 rpm"],
        ["Redline", "15,200 rpm"],
        ["Gearbox", "6-speed cassette, bidirectional quickshift"],
      ],
    },
    {
      title: "Chassis",
      rows: [
        ["Frame", "Carbon monocoque, engine fully stressed"],
        ["Front suspension", "Semi-active 43 mm USD fork, 120 mm"],
        ["Rear suspension", "Semi-active monoshock, 130 mm"],
        ["Swingarm", "Single-sided, cast and machined"],
        ["Brakes", "2 × 330 mm floating discs, radial monobloc"],
        ["Wheels", "Forged magnesium, 3.50 × 17 / 6.00 × 17"],
      ],
    },
    {
      title: "Dimensions",
      rows: [
        ["Dry mass", "164 kg"],
        ["Wheelbase", "1,428 mm"],
        ["Seat height", "845 mm"],
        ["Length", "2,052 mm"],
        ["Rake / trail", "24.1° / 100 mm"],
        ["Fuel", "16.5 L"],
      ],
    },
    {
      title: "Electronics",
      rows: [
        ["Throttle", "Ride-by-wire, 4 maps"],
        ["IMU", "6-axis, 1 kHz"],
        ["Traction control", "9 levels, lean-sensitive"],
        ["Engine braking", "3 levels"],
        ["Display", "Optically bonded TFT"],
        ["Battery", "Lithium iron phosphate"],
      ],
    },
  ],
};

export const allocation = {
  title: "REQUEST ALLOCATION",
  intro: "Allocation is confirmed by VANTA within 72 hours. Nothing is charged at request.",
  countries: [
    "United States",
    "United Kingdom",
    "Germany",
    "Italy",
    "France",
    "Switzerland",
    "Monaco",
    "Japan",
    "Singapore",
    "United Arab Emirates",
    "Australia",
    "Canada",
    "Other",
  ],
};
