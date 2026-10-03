import {
  DirectionalLight,
  HalfFloatType,
  LinearFilter,
  NoToneMapping,
  PerspectiveCamera,
  RGBAFormat,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Texture,
} from "three";
import { frame } from "../frame";
import { vanta } from "../store";
import { exploded as explodedContent, dash as dashContent, mass as massContent, product as productContent } from "../content";
import { Bike } from "./bike/Bike";
import { carbonTwill, engravingTexture } from "./bike/textures";
import { globalU } from "./bike/materials";
import { tryLoadGlb } from "./bike/loadGlb";
import type { GroupId } from "./bike/builder";
import { buildEnv } from "./env/studio";
import { Floor } from "./env/Floor";
import { ContactShadow, SHADOW_BOUNDS } from "./passes/ContactShadow";
import { FluidSim } from "./passes/FluidSim";
import { createComposite } from "./passes/Composite";
import { Bloom } from "./passes/Bloom";
import { AeroFlow } from "./passes/AeroFlow";
import { SpeedEnv } from "./passes/SpeedEnv";
import { MaterialPlates } from "./passes/MaterialPlates";
import { detectTier, FrameMonitor, settingsFor, type QualitySettings } from "./Quality";
import { CAMERA, CUTS, TRACKS, num, pose, type Pose } from "./choreo/tracks";
import type { LoadStepId } from "../store";

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export interface InitProgress {
  (step: LoadStepId, p: number, detail?: string): void;
}

/** which group a mass callout highlights */
const CALLOUT_GROUP: Record<string, GroupId> = {
  monocoque: "chassis",
  exhaust: "exhaust",
  wheels: "wheels",
  battery: "electronics",
  rearsets: "chassis",
};

/** node whose settling reveals each exploded label */
const LABEL_NODE: Record<string, string> = {
  bodywork: "panelR",
  electronics: "electronics",
  exhaust: "exhaust",
  wheels: "wheelF",
  chassis: "frame",
  engine: "engine",
};

export class Engine {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(24, 1, 0.05, 80);
  q: QualitySettings;
  bike!: Bike;
  private floor!: Floor;
  private shadow!: ContactShadow;
  private fluid!: FluidSim;
  private composite = createComposite();
  private bloom!: Bloom;
  private aero!: AeroFlow;
  private speedEnv!: SpeedEnv;
  private plates!: MaterialPlates;
  private envs: Record<string, Texture> = {};
  private envName = "";
  private rtScene!: WebGLRenderTarget;
  private empty = new Scene();
  private key = new DirectionalLight(0xffffff, 1.4);
  private rim = new DirectionalLight(0xbfd4ff, 1.1);
  private monitor = new FrameMonitor();
  private size = new Vector2(1, 1);
  private dpr = 1;

  private targetPose: Pose = { tx: 0, ty: 0, tz: 0, az: 0, el: 0, dist: 5, fov: 24, roll: 0, sx: 0, sy: 0, fit: 0 };
  private cam: Pose = { ...this.targetPose };
  private camInit = false;
  private prevT = 0;
  private cutTimer = 0;
  private cutKind: "flash" | "dip" | "none" = "none";
  private crank = 0;
  private wheelAngle = 0;
  private travel = 0;
  private sampleTimer = 0;
  private lastShadowKey = "";
  private pointerPrev = new Vector2();
  private phantomT = 0;
  private envRot = 0;
  private drl = 1;
  private posture = 0;
  private running = false;
  private disposed = false;
  private tmpV = new Vector3();
  private speedSmoothed = 0;
  private statT = 0;
  private statFrames = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: true,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.localClippingEnabled = true;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.autoClear = false;
    const tier = detectTier(this.renderer);
    this.q = settingsFor(tier);
    vanta.setState({ tier });

    this.camera.layers.enableAll();
    this.key.position.set(-1.5, 4, 2.5);
    this.rim.position.set(-3, 2.5, -4);
    this.scene.add(this.key, this.rim);
  }

  async init(progress: InitProgress) {
    const r = this.renderer;
    // ---------------- GEOMETRY ----------------
    progress("geometry", 0.05, "PROCEDURAL BUILD");
    const carbon = carbonTwill();
    const engraving = engravingTexture(
      [
        { text: "VANTA R1", size: 54, y: 0.3, weight: 600, spacing: 10 },
        { text: "001 / 099", size: 118, y: 0.64, weight: 400, spacing: 4 },
      ],
      1024,
      360,
    );
    this.bike = await Bike.build(carbon, engraving, (p, d) => progress("geometry", 0.08 + p * 0.92, d));
    this.scene.add(this.bike.root);
    // an authored model, when present, replaces the procedural parts by name
    const glb = await tryLoadGlb(productContent.glb);
    if (glb) {
      const n = this.bike.applyGlb(glb);
      progress("geometry", 1, `MODEL R1.GLB  ${n} SYSTEMS`);
    } else progress("geometry", 1, `${this.bike.stats.parts} PARTS  ${(this.bike.stats.verts / 1000).toFixed(0)}K VERTS`);

    // ---------------- MATERIALS ----------------
    progress("materials", 0.1, "CARBON T800 2×2");
    await tick();
    this.envs.studio = buildEnv(r, "studio");
    progress("materials", 0.45, "STUDIO LIGHT");
    await tick();
    this.envs.tunnel = buildEnv(r, "tunnel");
    progress("materials", 0.7, "TUNNEL LIGHT");
    await tick();
    this.envs.final = buildEnv(r, "final");
    this.setEnv("studio");
    this.shadow = new ContactShadow(this.q.tier === 1 ? 256 : 512);
    this.floor = new Floor(this.shadow.target.texture);
    this.floor.material.uniforms.uShadowBounds.value.set(SHADOW_BOUNDS.x, SHADOW_BOUNDS.y, 0);
    this.floor.mesh.layers.set(1);
    this.scene.add(this.floor.mesh);
    progress("materials", 1, "16 MATERIAL SYSTEMS");

    // ---------------- TELEMETRY ----------------
    progress("telemetry", 0.1, "RENDER TARGETS");
    this.allocate();
    this.fluid = new FluidSim(r, { simRes: this.q.simRes, dyeRes: this.q.dyeRes, iterations: this.q.iterations });
    this.fluid.allocate(this.size.x / this.size.y);
    this.bloom = new Bloom(this.q.tier === 3 ? 5 : 4);
    this.bloom.setSize(this.size.x, this.size.y);
    progress("telemetry", 0.35, "SHADER PROGRAMS");
    this.applyCamera(true);
    try {
      await r.compileAsync(this.scene, this.camera);
    } catch {
      r.compile(this.scene, this.camera);
    }
    const programs = (r.info.programs ?? []).length;
    progress("telemetry", 1, `${programs} PROGRAMS COMPILED`);

    // ---------------- AERODYNAMICS ----------------
    progress("aerodynamics", 0.2, "SILHOUETTE FIELD");
    await tick();
    this.aero = new AeroFlow(r, this.q.aeroLines, this.q.aeroPerLine);
    this.aero.setSize(this.size.x, this.size.y);
    progress("aerodynamics", 0.55, `${this.q.aeroLines * this.q.aeroPerLine} PARTICLES`);
    await tick();
    this.speedEnv = new SpeedEnv();
    this.speedEnv.setSize(this.size.x, this.size.y);
    this.plates = new MaterialPlates(this.q.plateScale);
    progress("aerodynamics", 0.8, "MATERIAL PLATES");
    // warm-up frames so the first visible frame is not a compile hitch
    for (let i = 0; i < 3; i++) {
      this.render(1 / 60, true);
      await tick();
    }
    progress("aerodynamics", 1, "READY");
    frame.engineReady = true;
  }

  private setEnv(name: string) {
    if (this.envName === name) return;
    this.envName = name;
    this.scene.environment = this.envs[name];
  }

  private allocate() {
    const w = this.size.x, h = this.size.y;
    this.rtScene?.dispose();
    this.rtScene = new WebGLRenderTarget(w, h, {
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      samples: this.q.msaa,
      depthBuffer: true,
    });
  }

  resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    frame.viewport.w = vw;
    frame.viewport.h = vh;
    frame.viewport.portrait = vh > vw * 1.08;
    const dpr = Math.min(window.devicePixelRatio || 1, this.q.maxDpr) * this.monitor.scale;
    frame.viewport.dpr = dpr;
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(vw, vh, false);
    const w = Math.max(1, Math.floor(vw * dpr)), h = Math.max(1, Math.floor(vh * dpr));
    const aspectChanged = Math.abs(w / h - this.size.x / this.size.y) > 0.01;
    this.size.set(w, h);
    this.camera.aspect = vw / vh;
    if (this.rtScene) {
      this.allocate();
      this.bloom.setSize(w, h);
      this.aero.setSize(w, h);
      this.speedEnv.setSize(w, h);
      if (aspectChanged) this.fluid.allocate(w / h);
    }
    this.applyCamera(true);
  }

  start() {
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  /** called from the shared gsap ticker */
  update(dtMs: number) {
    if (!this.running || this.disposed) return;
    const dt = Math.min(Math.max(dtMs / 1000, 1 / 240), 1 / 20);
    if (this.monitor.push(dt)) this.resize();
    this.renderer.info.autoReset = false;
    this.renderer.info.reset();
    this.render(dt, false);
    this.statFrames++;
    this.statT += dt;
    if (this.statT > 0.5) {
      const st = frame.stats;
      st.fps = Math.round(this.statFrames / this.statT);
      st.calls = this.renderer.info.render.calls;
      st.tris = this.renderer.info.render.triangles;
      st.dpr = this.dpr;
      st.tier = this.q.tier;
      this.statT = 0;
      this.statFrames = 0;
    }
  }

  // ------------------------------------------------------------------ frame

  private render(dt: number, warmup: boolean) {
    const r = this.renderer;
    const t = frame.scroll.t;
    const portrait = frame.viewport.portrait;
    const reduced = vanta.getState().reducedMotion;
    frame.time += dt;
    frame.dt = dt;
    globalU.uTime.value = frame.time;

    // ---------------- cuts (time-based, so a stopped scroll never holds a black frame)
    for (const c of CUTS) {
      if ((this.prevT < c.t && t >= c.t) || (this.prevT >= c.t && t < c.t)) {
        this.cutKind = c.kind;
        this.cutTimer = c.kind === "flash" ? 0.075 : c.kind === "dip" ? 0.62 : 0;
        this.camInit = false; // snap the camera on a cut
        if (this.shadow) this.shadow.dirty = true;
      }
    }
    this.prevT = t;
    this.cutTimer = Math.max(0, this.cutTimer - dt);
    let flash = 0, dip = 0;
    if (this.cutKind === "flash" && this.cutTimer > 0) flash = 1;
    if (this.cutKind === "dip" && this.cutTimer > 0) dip = Math.min(1, this.cutTimer / 0.5);

    // ---------------- evaluate the film
    // reduced motion: every scene holds one composition and cuts to the next
    const tCam = reduced ? Math.floor(t) + (Math.floor(t) === 0 ? 0 : Math.floor(t) === 9 ? 0.6 : 0.55) : t;
    pose(CAMERA, tCam, portrait, this.targetPose);
    const smoke = num(TRACKS.smoke, t);
    const smokeTarget = num(TRACKS.smokeTarget, t);
    const wind = num(TRACKS.wind, t);
    const exposure = num(TRACKS.exposure, t);
    const clay = num(TRACKS.clay, t);
    const tunnel = num(TRACKS.tunnel, t);
    const aeroAmt = num(TRACKS.aero, t);
    const explode = reduced && t > 3 && t < 5 ? (t < 3.3 ? 0 : 1) : num(TRACKS.explode, t);
    const dimOthers = num(TRACKS.dimOthers, t);
    const cut = num(TRACKS.cut, t);
    const rpm = num(TRACKS.rpm, t);
    const bikeOn = num(TRACKS.bike, t) > 0.5;
    const speedT = num(TRACKS.speed, t);
    const road = num(TRACKS.road, t);
    const lights = reduced && t > 8.5 ? (t >= 9 ? 1 : 0) : num(TRACKS.lights, t);
    const fadeScroll = num(TRACKS.fade, t);
    const vignette = num(TRACKS.vignette, t);
    const floorOp = num(TRACKS.floor, t);
    const scene = Math.floor(t);
    const local = t - scene;

    // ---------------- pointer smoothing (parallax, light)
    const p = frame.pointer;
    p.sx = damp(p.sx, p.x, 3.2, dt);
    p.sy = damp(p.sy, p.y, 3.2, dt);

    // ---------------- camera
    const tp = this.targetPose;
    const stable = scene === 5 || scene === 8;
    const par = reduced || stable ? 0.25 : 1;
    tp.az += p.sx * 0.032 * par;
    tp.el += p.sy * 0.018 * par;
    if (scene === 9) {
      // final turntable: slow auto rotation plus drag with inertia
      const tt = frame.turntable;
      if (!tt.dragging) {
        tt.velocity *= Math.exp(-2.2 * dt);
        if (!reduced) tt.angle += (0.045 + tt.velocity) * dt;
        else tt.angle += tt.velocity * dt;
      }
      tp.az += tt.angle * Math.min(1, Math.max(0, (local - 0.12) / 0.2));
      frame.live.rotation = tp.az;
    }
    if (!this.camInit || warmup || reduced) {
      Object.assign(this.cam, tp);
      this.camInit = true;
    } else {
      const k = 7.5;
      const c = this.cam;
      c.tx = damp(c.tx, tp.tx, k, dt);
      c.ty = damp(c.ty, tp.ty, k, dt);
      c.tz = damp(c.tz, tp.tz, k, dt);
      c.az = damp(c.az, tp.az, k, dt);
      c.el = damp(c.el, tp.el, k, dt);
      c.dist = damp(c.dist, tp.dist, k, dt);
      c.fov = damp(c.fov, tp.fov, k, dt);
      c.roll = damp(c.roll, tp.roll, k, dt);
      c.sx = damp(c.sx, tp.sx, k, dt);
      c.sy = damp(c.sy, tp.sy, k, dt);
      c.fit = tp.fit;
    }

    // ---------------- speed scene: velocity, shake, optical compression
    const energy = frame.scroll.energy;
    const speedTarget = road > 0.5 ? Math.min(1.25, speedT + energy * 0.5) : 0;
    this.speedSmoothed = damp(this.speedSmoothed, speedTarget, 3, dt);
    const speed = this.speedSmoothed;
    let shakeX = 0, shakeY = 0;
    if (road > 0.5 && !reduced) {
      const s2 = speed * speed;
      const tt = frame.time;
      shakeX = (Math.sin(tt * 63.1) * 0.6 + Math.sin(tt * 97.3) * 0.4) * 0.0032 * s2;
      shakeY = (Math.sin(tt * 71.7) * 0.5 + Math.sin(tt * 123.1) * 0.5) * 0.0042 * s2;
    }
    this.applyCamera(false, shakeX, shakeY);

    // ---------------- lights and environment
    const exploding = scene === 3 || (scene === 4 && local < 0.2);
    this.setEnv(t > 8.95 || exploding ? "final" : t > 2.0 && t < 3.0 ? "tunnel" : "studio");
    this.envRot = damp(this.envRot, p.sx * 0.42 * par, 2.5, dt);
    this.scene.environmentRotation.y = 0.3 + this.envRot;
    let envI = 1, keyI = 1.4 * (1 - clay * 0.3), rimI = 1.1;
    this.key.position.set(-1.5 + p.sx * 1.2, 4, 2.5 + p.sy * 0.8);
    if (scene === 3) envI = 0.85;
    if (scene === 4) {
      // the engine on a stand: a hard top light and darkness around it
      envI = 0.55;
      keyI = 2.2;
      this.key.position.set(0.6 + p.sx * 0.6, 3.2, 1.8);
    }
    if (road > 0.5) {
      // overhead tunnel lights sweep over the machine as it passes beneath them
      const pass = Math.pow(Math.max(0, Math.sin((this.travel / 6) * Math.PI * 2)), 6);
      keyI = 0.7 + pass * 1.6;
      rimI = 1.7;
      this.key.position.set(0.6, 4.6, 0.6);
    }
    if (scene === 8) {
      // a raking light crosses the serial plate as you scroll
      envI = 0.18;
      keyI = 2.6;
      this.key.position.set(0.292 + (local - 0.5) * 3.2, 0.95, 0.17 + 0.9);
    }
    if (t > 8.5 && scene !== 8) {
      envI = 0.15 + 1.25 * lights;
      keyI = 0.2 + 2.0 * lights;
      rimI = 0.3 + 1.3 * lights;
    }
    this.scene.environmentIntensity = envI;
    this.key.intensity = keyI;
    this.rim.intensity = rimI;
    this.key.updateMatrixWorld();
    const kd = this.tmpV.copy(this.key.position).normalize().transformDirection(this.camera.matrixWorldInverse);
    globalU.uKeyDirView.value.copy(kd);

    // ---------------- bike state
    const bike = this.bike;
    bike.root.visible = bikeOn;
    this.floor.mesh.visible = bikeOn;
    bike.setExplode(explode);
    // lift the whole assembly while it separates, like a technical illustration
    bike.root.position.y = explode * 0.4;
    frame.live.explode = explode;
    globalU.uClay.value = clay;

    // dim systems: power isolates the engine, the rest recede and then leave the frame
    const groups: GroupId[] = ["bodywork", "front", "chassis", "intake", "fuel", "exhaust", "rearSusp", "swingarm", "wheels", "electronics"];
    for (const g of groups) {
      bike.setDim(g, dimOthers);
      bike.setGroupVisible(g, dimOthers < 0.9);
    }
    bike.setDim("engine", 0);
    bike.setGroupVisible("engine", true);

    // mass callouts: highlight the system being annotated
    let rimGroup: GroupId | null = null;
    if (scene === 1) {
      const idx = Math.floor((local - 0.14) / 0.12);
      const c = massContent.callouts[idx];
      if (c && local > 0.14 && local < 0.8) rimGroup = CALLOUT_GROUP[c.id];
    }
    // exploded view: a faint rim on every system separates the parts from the dark
    const baseRim = scene === 3 ? 0.22 : 0;
    for (const g of [...groups, "engine" as GroupId]) bike.setRim(g, damp(bike.groupU.get(g)!.uRim.value, g === rimGroup ? 0.55 : baseRim, 6, dt));

    // engine internals
    const rps = (rpm / 60) * (reduced ? 0 : 1);
    // visual crank speed is capped; higher RPM reads through pulse rate and trace instead
    this.crank += Math.min(rps, 9) * Math.PI * 2 * dt * (scene === 4 ? 1 : 0);
    const tdc = bike.setEngine(this.crank, cut > 0.02, cut);
    frame.live.rpm = rpm;
    for (let i = 0; i < 4; i++) {
      const pulse = Math.pow(tdc[i], 40);
      frame.live.firing[i] = Math.max(frame.live.firing[i] * Math.exp(-16 * dt), pulse);
    }
    bike.setPulses(cut > 0.5 ? frame.live.firing : [0, 0, 0, 0]);

    // ride settings from the dash: DRL by mode, posture by suspension
    const ride = vanta.getState().ride;
    const drlTarget = ride.mode === "RACE" ? 1.25 : ride.mode === "TRACK" ? 1 : ride.mode === "ROAD" ? 0.8 : 0.55;
    this.drl = damp(this.drl, scene === 0 ? 0.2 + 0.8 * (1 - smoke * 0.6) : drlTarget, 4, dt);
    bike.setDrl(this.drl * (1 - dimOthers));
    const postureTarget = scene >= 5 ? (ride.sus - 2) * 0.006 : 0;
    this.posture = damp(this.posture, postureTarget, 5, dt);
    bike.setPosture(this.posture * 0.5, -Math.abs(this.posture) * 0.4 - (ride.sus === 1 ? 0.004 : 0));

    // wheels turn in the motion scene
    if (road > 0.5 && !reduced) {
      const v = 12 + speed * 70; // m/s
      this.wheelAngle += (v / 0.31) * dt;
      this.travel += v * dt;
    }
    bike.setWheelSpin(this.wheelAngle, this.wheelAngle * (0.3 / 0.315));
    bike.setSpokeBlur(road > 0.5 && !reduced ? Math.min(1, 0.55 + speed * 0.5) : 0);
    frame.live.speed = road > 0.5 ? Math.round(80 + speed * 219) : 0;

    // floor
    const fu = this.floor.material.uniforms;
    fu.uGrid.value = tunnel;
    fu.uOpacity.value = floorOp * (t > 8.5 ? 0.25 + 0.75 * lights : 1) * (road > 0.5 ? 0.3 : 1);
    fu.uShadow.value = 0.92 * (1 - explode * 0.6);
    fu.uTime.value = frame.time;

    // exploded labels: a label appears as its system settles; only the latest three stay
    if (scene === 3) {
      const settled = explodedContent.labels.map((l) => bike.nodeSettle(LABEL_NODE[l.group], explode) > 0.9);
      const count = settled.filter(Boolean).length;
      explodedContent.labels.forEach((_, i) => {
        const visible = settled[i] && i >= count - 3 && local < 0.9 ? 1 : 0;
        frame.labelVis[i] = damp(frame.labelVis[i], visible, 5, dt);
      });
    } else frame.labelVis.fill(0);

    // ---------------- fluid (the smoke)
    const fluidActive = smoke > 0.001 && scene === 0 && !reduced;
    if (fluidActive) this.stepFluid(dt, smokeTarget, wind, reduced);

    // ---------------- passes
    const plateMode = scene === 6;
    if (!plateMode && bikeOn) {
      // contact shadow when the bike moved
      const key = `${explode.toFixed(3)}|${this.posture.toFixed(4)}|${frame.live.rotation.toFixed(3)}`;
      if (key !== this.lastShadowKey) {
        this.lastShadowKey = key;
        this.shadow.dirty = true;
      }
      this.shadow.render(r, this.scene);

      r.setRenderTarget(this.rtScene);
      r.setClearColor(0x000000, 0);
      r.clear(true, true, false);
      r.render(this.scene, this.camera);
    } else {
      // a bare clear() on a multisampled target is never resolved to its texture, so
      // render an empty scene to resolve the cleared buffer
      r.setRenderTarget(this.rtScene);
      r.setClearColor(0x000000, 0);
      r.clear(true, true, false);
      r.render(this.empty, this.camera);
    }

    // aero streamlines
    let aeroTex: Texture | null = null;
    if (aeroAmt > 0.001 && bikeOn) {
      const airspeed = num(TRACKS.airspeed, t) + energy * 140;
      frame.live.airspeed = Math.round(airspeed);
      aeroTex = this.aero.step(r, this.scene, this.camera, dt, airspeed / 270, reduced);
    }

    // speed environment
    let envTex: Texture | null = null;
    if (road > 0.5) {
      envTex = this.speedEnv.render(r, this.camera, this.travel, speed, frame.time);
    }

    // bloom
    let bloomTex: Texture | null = null;
    if (this.q.bloom && bikeOn && !plateMode) bloomTex = this.bloom.render(r, this.rtScene.texture, 3.6);

    // ---------------- composite to screen
    const u = this.composite.u;
    u.tScene.value = this.rtScene.texture;
    u.tDye.value = this.fluid.dyeTexture;
    u.tVel.value = this.fluid.velocityTexture;
    u.tBloom.value = bloomTex ?? this.rtScene.texture;
    u.uBloom.value = bloomTex ? (road > 0.5 ? 0.3 : 0.55) : 0;
    u.tAero.value = aeroTex ?? this.rtScene.texture;
    u.uAero.value = aeroTex ? aeroAmt : 0;
    u.tEnv.value = envTex ?? this.rtScene.texture;
    u.uEnv.value = envTex ? 1 : 0;
    u.uSpeed.value = reduced ? 0 : speed;
    u.uRes.value.copy(this.size);
    u.uDyeTexel.value.copy(this.fluid.dyeTexel);
    u.uAspect.value = this.size.x / this.size.y;
    u.uTime.value = frame.time;
    u.uExposure.value = exposure;
    u.uSmoke.value = fluidActive ? smoke : 0;
    u.uVignette.value = vignette;
    u.uGrain.value = reduced ? 0.012 : 0.028;
    u.uFlash.value = flash;
    u.uFade.value = Math.max(fadeScroll, dip);
    u.uTunnel.value = tunnel;
    u.uKey.value.set(-0.45 + p.sx * 0.5, 0.65 + p.sy * 0.3, 0.6);
    u.uVanish.value.set(portrait ? 0.7 : 0.78, 0.48);
    r.setRenderTarget(null);
    r.setViewport(0, 0, this.size.x / this.dpr, this.size.y / this.dpr);
    r.setScissorTest(false);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, false);
    this.composite.render(r, null);

    // material plates draw straight into the canvas over the composite
    if (plateMode) this.plates.render(r, this.dpr, frame.time, reduced, local);

    // ---------------- DOM-facing outputs
    if (bikeOn && !plateMode) {
      bike.project(this.camera, frame.viewport.w, frame.viewport.h, frame.anchors);
      this.projectDash();
    }
    this.telemetry(scene, local, rpm, explode);
  }

  private stepFluid(dt: number, target: number, wind: number, reduced: boolean) {
    const f = this.fluid;
    const p = frame.pointer;
    f.params.target = target;
    f.params.boundary = target;
    f.params.reform = 0.17 + (1 - target) * 0.6;
    f.params.drift = reduced ? 0.15 : 1;
    f.params.curl = reduced ? 6 : 24;
    // wind: from the left, slightly rising; scroll velocity gusts it
    const gust = wind * (1 + frame.scroll.energy * 0.6);
    f.params.wind.set(gust * 900, gust * 110);
    const simW = f.velocity.read.width;

    // pointer splats
    const now = performance.now();
    const ux = (p.x + 1) / 2, uy = (p.y + 1) / 2;
    if (p.dirty) {
      p.dirty = false;
      const dx = ux - (this.pointerPrev.x || ux);
      const dy = uy - (this.pointerPrev.y || uy);
      const dist = Math.hypot(dx * (this.size.x / this.size.y), dy);
      const spd = dist / Math.max(dt, 1 / 120); // screen-heights per second
      const sn = Math.min(1, spd / 2.4);
      const touch = p.touch;
      const radius = (0.0011 + 0.0058 * Math.pow(sn, 0.85)) * (touch ? 2.1 : 1);
      const stretch = sn * 7;
      const clear = 0.92 - sn * 0.3;
      const force = (0.55 + 1.1 * sn) * simW;
      const steps = Math.min(8, Math.max(1, Math.ceil(dist / (Math.sqrt(radius) * 0.7))));
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        const x = this.pointerPrev.x + dx * k;
        const y = this.pointerPrev.y + dy * k;
        f.splat(x, y, (dx / dt) * force * 0.5 / steps, (dy / dt) * force * 0.5 / steps, radius, stretch, clear / Math.sqrt(steps), 0.4 + sn * 0.6);
      }
      if (this.pointerPrev.x === 0 && this.pointerPrev.y === 0) {
        // first contact
      }
      this.pointerPrev.set(ux, uy);
    }
    if (p.tap) {
      // touch "breath": an outward ring of momentum and a soft clearing
      p.tap = false;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        f.splat(ux + Math.cos(a) * 0.02, uy + Math.sin(a) * 0.02 * (this.size.x / this.size.y), Math.cos(a) * 420, Math.sin(a) * 420, 0.0026, 0, 0, 0);
      }
      f.splat(ux, uy, 0, 0, 0.012, 0, 0.75, 1);
    }

    // idle phantom: teaches the interaction without words
    const idle = (now - p.last) / 1000;
    if (!reduced && idle > 2.6 && vanta.getState().revealStage < 3) {
      this.phantomT += dt * 0.32;
      const tt = this.phantomT;
      const x = 0.55 + Math.sin(tt * 1.3) * 0.22 + Math.sin(tt * 0.47) * 0.08;
      const y = 0.45 + Math.sin(tt * 1.9 + 1.1) * 0.13;
      const vx = Math.cos(tt * 1.3) * 1.3 * 0.22 + Math.cos(tt * 0.47) * 0.47 * 0.08;
      const vy = Math.cos(tt * 1.9 + 1.1) * 1.9 * 0.13;
      f.splat(x, y, vx * 160, vy * 160, 0.0016, 2, 0.12, 0.3);
    }

    f.step(dt, this.rtScene.texture);
    this.sampleTimer -= dt;
    if (this.sampleTimer <= 0) {
      this.sampleTimer = 0.3;
      f.sample();
      frame.reveal.discovered = f.discoveredFraction;
    }
  }

  private applyCamera(snap: boolean, shakeX = 0, shakeY = 0) {
    const c = snap ? this.targetPose : this.cam;
    const cam = this.camera;
    const vw = frame.viewport.w, vh = frame.viewport.h;
    const aspect = vw / vh;
    cam.aspect = aspect;
    cam.fov = c.fov;
    let dist = c.dist;
    if (c.fit > 0) {
      const hfov = 2 * Math.atan(Math.tan((c.fov * Math.PI) / 360) * aspect);
      const need = (c.fit / 2 / Math.tan(hfov / 2)) * 1.04;
      dist = Math.max(dist, need);
    }
    const ce = Math.cos(c.el);
    cam.position.set(c.tx + dist * Math.sin(c.az) * ce, c.ty + dist * Math.sin(c.el), c.tz + dist * Math.cos(c.az) * ce);
    cam.up.set(0, 1, 0);
    cam.lookAt(c.tx, c.ty, c.tz);
    cam.rotateZ(c.roll);
    if (shakeX || shakeY) {
      cam.rotateY(shakeX);
      cam.rotateX(shakeY);
    }
    cam.setViewOffset(vw, vh, -c.sx * vw, c.sy * vh, vw, vh);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  private projectDash() {
    const a = frame.anchors;
    const names = ["dash.tl", "dash.tr", "dash.br", "dash.bl"];
    let ok = true;
    names.forEach((n, i) => {
      const r = a.get(n);
      if (!r || !r.v) ok = false;
      else {
        frame.dashQuad[i * 2] = r.x;
        frame.dashQuad[i * 2 + 1] = r.y;
      }
    });
    frame.dashQuadValid = ok;
  }

  private telemetry(scene: number, local: number, rpm: number, explode: number) {
    let s = "";
    switch (scene) {
      case 0:
        s = `FIELD ${(1 - frame.reveal.discovered * 0.6).toFixed(2)}   REVEALED ${Math.round(frame.reveal.discovered * 100)}%`;
        break;
      case 1:
        s = `PROFILE 0.00°   FOCAL ${Math.round(18 / Math.tan((this.camera.fov * Math.PI) / 360))} MM`;
        break;
      case 2:
        s = `AIRSPEED ${frame.live.airspeed} KM/H   YAW 0.0°`;
        break;
      case 3:
        s = `SEPARATION ${Math.round(explode * 100)}%   SYSTEMS 12`;
        break;
      case 4:
        s = `${Math.round(rpm).toLocaleString("en-US")} RPM   SECTION Z 0.0`;
        break;
      case 5: {
        const r = vanta.getState().ride;
        s = `MAP ${dashContent.presets[r.mode].map}   TC ${r.tc}   EB ${r.eb}   SUS A${r.sus}`;
        break;
      }
      case 6:
        s = `MACRO 1:1   FOCUS ${(0.21 + local * 0.08).toFixed(3)} M`;
        break;
      case 7:
        s = `${frame.live.speed} KM/H   GEAR ${Math.min(6, 3 + Math.floor(this.speedSmoothed * 3.2))}`;
        break;
      case 8:
        s = `SERIAL 001 / 099`;
        break;
      case 9:
        s = `ROTATION ${(((((frame.live.rotation * 180) / Math.PI) % 360) + 360) % 360).toFixed(1)}°`;
        break;
    }
    frame.telemetry = s;
  }

  dispose() {
    this.disposed = true;
    this.running = false;
    this.bike?.dispose();
    this.floor?.dispose();
    this.shadow?.dispose();
    this.fluid?.dispose();
    this.composite.dispose();
    this.bloom?.dispose();
    this.aero?.dispose();
    this.speedEnv?.dispose();
    this.plates?.dispose();
    this.rtScene?.dispose();
    Object.values(this.envs).forEach((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    frame.engineReady = false;
  }
}

const tick = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
