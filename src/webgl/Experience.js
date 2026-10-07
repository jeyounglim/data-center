import * as THREE from "three";
import { Site } from "./Site.js";
import { Hotspots } from "./Hotspots.js";

const IVORY = 0xf6f1e8;

export class Experience {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.dragging = false;
    this.lastPointer = { x: 0, y: 0 };
    this.downPointer = { x: 0, y: 0 };
    this.ndc = new THREE.Vector2();
    this.home = { radius: 80, phi: 1.05, theta: 0.42 };
    this.desired = { ...this.home };
    this.spherical = new THREE.Spherical(
      this.home.radius,
      this.home.phi,
      this.home.theta,
    );
    this.lookAt = new THREE.Vector3();
    this.lookHome = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.outward = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.framed = false;
    this.paused = false;
    this.focusId = null;
    this.hotspots = null;
    this.onProgress = options.onProgress;

    this.init();
    this.bind();
    this.ready = this.site.loadPromise
      .then(() => this.frameSite())
      .then(() => this.createHotspots())
      .then(() => this.renderer.compileAsync(this.scene, this.camera))
      .catch((error) => {
        console.error("[Experience] setup failed", error);
      });
    this.tick();
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: window.devicePixelRatio < 2,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(IVORY, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(IVORY);

    this.camera = new THREE.PerspectiveCamera(
      32,
      window.innerWidth / window.innerHeight,
      0.1,
      4000,
    );
    this.camera.position.set(40, 28, 70);
    this.camera.lookAt(0, 0, 0);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.site = new Site({ onProgress: this.onProgress });
    this.group.add(this.site.root);

    this.createLights();
  }

  createLights() {
    this.scene.add(new THREE.HemisphereLight(0xf6f3eb, 0xbcb4a5, 2.1));

    this.key = new THREE.DirectionalLight(0xfff6e9, 2.3);
    this.key.position.set(-90, 150, 100);
    this.scene.add(this.key);

    this.fill = new THREE.DirectionalLight(0xe4edff, 0.75);
    this.fill.position.set(90, 50, -80);
    this.scene.add(this.fill);
  }

  frameSite() {
    if (!this.site.ready) return;

    const radius = this.site.radius;
    const mobile = window.innerWidth < 720;
    this.group.position.set(mobile ? 0 : radius * 0.16, 0, 0);
    this.lookHome.set(this.group.position.x * 0.55, radius * 0.04, 0);
    if (!this.focusId) {
      this.lookTarget.copy(this.lookHome);
      this.lookAt.copy(this.lookHome);
    }

    const vertical = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
    const nextRadius = (radius / Math.sin(Math.min(vertical, horizontal))) * 0.92;
    if (!this.framed) {
      this.home.radius = nextRadius;
      this.desired.radius = nextRadius;
      this.spherical.radius = nextRadius;
      this.framed = true;
    } else {
      const scale = nextRadius / this.home.radius;
      this.home.radius = nextRadius;
      this.desired.radius *= scale;
      this.spherical.radius *= scale;
    }

    this.camera.near = Math.max(radius / 60, 0.1);
    this.camera.far = this.home.radius * 6;
    this.camera.updateProjectionMatrix();

    const reach = radius * 1.8;
    this.key.position.set(-reach, reach * 1.6, reach);
    this.fill.position.set(reach, reach * 0.45, -reach * 0.85);
  }

  createHotspots() {
    this.hotspots = new Hotspots({
      group: this.group,
      site: this.site,
      camera: this.camera,
      onOpen: (data) => {
        this.setPaused(true);
        this.focusHotspot(data);
      },
      onClose: () => {
        this.setPaused(false);
        this.resetView();
      },
    });
  }

  setPaused(paused) {
    this.paused = paused;
    if (paused) this.dragging = false;
  }

  wrapTheta(next) {
    return this.spherical.theta + Math.atan2(
      Math.sin(next - this.spherical.theta),
      Math.cos(next - this.spherical.theta),
    );
  }

  focusHotspot(data) {
    this.focusId = data.id;
    const world = this.group.localToWorld(new THREE.Vector3().fromArray(data.position));
    this.outward.copy(world).sub(this.lookHome);
    this.outward.y = 0;
    if (this.outward.lengthSq() < 0.01) this.outward.set(0, 0, 1);
    this.outward.normalize();

    this.lookTarget.copy(world).addScaledVector(this.outward, -this.site.radius * 0.06);
    this.desired.theta = this.wrapTheta(Math.atan2(this.outward.x, this.outward.z));
    const height = THREE.MathUtils.smoothstep(-16, 20, data.position[1]);
    this.desired.phi = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(1.18, 0.82, height),
      0.45,
      Math.PI / 2 - 0.08,
    );
    this.desired.radius = THREE.MathUtils.clamp(
      this.site.radius * 1.12,
      this.site.radius * 0.7,
      this.home.radius,
    );
  }

  resetView() {
    this.focusId = null;
    this.lookTarget.copy(this.lookHome);
    this.desired.radius = this.home.radius;
    this.desired.phi = this.home.phi;
    this.desired.theta = this.wrapTheta(this.home.theta);
  }

  bind() {
    window.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("wheel", this.onWheel, { passive: false });
  }

  onPointerDown = (event) => {
    if (this.paused) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest?.("a, button, .modal")) return;
    this.dragging = true;
    this.lastPointer.x = event.clientX;
    this.lastPointer.y = event.clientY;
    this.downPointer.x = event.clientX;
    this.downPointer.y = event.clientY;
  };

  onPointerMove = (event) => {
    this.pointer.tx = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.ty = -(event.clientY / window.innerHeight) * 2 + 1;

    this.setNdc(event.clientX, event.clientY);
    if (!this.paused) this.hotspots?.hover(this.ndc);

    if (this.paused || !this.dragging) return;

    const size = Math.min(window.innerWidth, window.innerHeight);
    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    this.desired.theta -= (dx / size) * Math.PI * 2;
    this.desired.phi = THREE.MathUtils.clamp(
      this.desired.phi - (dy / window.innerHeight) * Math.PI * 1.2,
      0.28,
      Math.PI / 2 - 0.08,
    );
    this.lastPointer.x = event.clientX;
    this.lastPointer.y = event.clientY;
  };

  onPointerUp = (event) => {
    const dragged = Math.hypot(
      event.clientX - this.downPointer.x,
      event.clientY - this.downPointer.y,
    );
    this.dragging = false;
    if (this.paused || dragged > 6) return;
    this.setNdc(event.clientX, event.clientY);
    this.hotspots?.pick(this.ndc);
  };

  setNdc(x, y) {
    this.ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  }

  onWheel = (event) => {
    if (this.paused || !this.site.ready) return;
    event.preventDefault();
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    const factor = Math.exp(THREE.MathUtils.clamp(event.deltaY * units * 0.001, -0.5, 0.5));
    this.desired.radius = THREE.MathUtils.clamp(
      this.desired.radius * factor,
      this.site.radius * 0.7,
      this.home.radius * 2.4,
    );
  };

  onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.frameSite();
  };

  tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    const kp = 1 - Math.exp(-dt / 0.14);
    const kc = 1 - Math.exp(-dt / 0.36);
    this.pointer.x += (this.pointer.tx - this.pointer.x) * kp;
    this.pointer.y += (this.pointer.ty - this.pointer.y) * kp;

    this.lookAt.lerp(this.lookTarget, kc);
    this.spherical.radius += (this.desired.radius - this.spherical.radius) * kc;
    this.spherical.phi += (this.desired.phi - this.spherical.phi) * kc;
    this.spherical.theta += (this.desired.theta - this.spherical.theta) * kc;

    this.offset.setFromSpherical(this.spherical);
    this.camera.position.copy(this.lookAt).add(this.offset);
    this.camera.lookAt(this.lookAt);
    this.renderer.render(this.scene, this.camera);
  };

  getPointer() {
    return this.pointer;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("wheel", this.onWheel);
    this.hotspots?.dispose();
    this.site.dispose();
    this.renderer.dispose();
  }
}
