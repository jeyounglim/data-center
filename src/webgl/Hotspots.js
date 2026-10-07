import * as THREE from "three";
import { HOTSPOTS, ICONS } from "../hotspots.js";

function drawIcon(ctx, type, cx, cy, s) {
  ctx.strokeStyle = "#2c2924";
  ctx.fillStyle = "#2c2924";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  if (type === "door") {
    ctx.strokeRect(cx - s * 0.28, cy - s * 0.38, s * 0.56, s * 0.76);
    ctx.beginPath();
    ctx.arc(cx + s * 0.14, cy + s * 0.02, 3.2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (type === "grid") {
    ctx.moveTo(cx, cy - s * 0.36);
    ctx.lineTo(cx + s * 0.36, cy);
    ctx.lineTo(cx, cy + s * 0.36);
    ctx.lineTo(cx - s * 0.36, cy);
    ctx.closePath();
    ctx.moveTo(cx - s * 0.16, cy - s * 0.16);
    ctx.lineTo(cx + s * 0.16, cy + s * 0.16);
    ctx.moveTo(cx + s * 0.16, cy - s * 0.16);
    ctx.lineTo(cx - s * 0.16, cy + s * 0.16);
    ctx.stroke();
    return;
  }
  if (type === "building") {
    ctx.strokeRect(cx - s * 0.28, cy - s * 0.36, s * 0.56, s * 0.72);
    for (const [x, y] of [[-0.12, -0.16], [0.1, -0.16], [-0.12, 0.04], [0.1, 0.04]]) {
      ctx.fillRect(cx + s * x, cy + s * y, 7, 7);
    }
    return;
  }
  if (type === "mark") {
    ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.12, cy + s * 0.06);
    ctx.lineTo(cx, cy - s * 0.16);
    ctx.lineTo(cx + s * 0.12, cy + s * 0.06);
    ctx.closePath();
    ctx.stroke();
    return;
  }
  if (type === "sun") {
    ctx.arc(cx, cy, s * 0.14, 0, Math.PI * 2);
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI / 4) * i;
      ctx.moveTo(cx + Math.cos(a) * s * 0.22, cy + Math.sin(a) * s * 0.22);
      ctx.lineTo(cx + Math.cos(a) * s * 0.34, cy + Math.sin(a) * s * 0.34);
    }
    ctx.stroke();
    return;
  }
  if (type === "fan") {
    ctx.arc(cx, cy, s * 0.08, 0, Math.PI * 2);
    ctx.moveTo(cx, cy - s * 0.32);
    ctx.quadraticCurveTo(cx + s * 0.28, cy - s * 0.18, cx + s * 0.1, cy - s * 0.04);
    ctx.moveTo(cx + s * 0.28, cy + s * 0.14);
    ctx.quadraticCurveTo(cx + s * 0.04, cy + s * 0.32, cx - s * 0.04, cy + s * 0.08);
    ctx.moveTo(cx - s * 0.28, cy + s * 0.1);
    ctx.quadraticCurveTo(cx - s * 0.2, cy - s * 0.2, cx - s * 0.06, cy - s * 0.04);
    ctx.stroke();
    return;
  }
  if (type === "car") {
    ctx.moveTo(cx - s * 0.3, cy + s * 0.06);
    ctx.lineTo(cx - s * 0.18, cy - s * 0.14);
    ctx.lineTo(cx + s * 0.18, cy - s * 0.14);
    ctx.lineTo(cx + s * 0.3, cy + s * 0.06);
    ctx.strokeRect(cx - s * 0.32, cy + s * 0.06, s * 0.64, s * 0.16);
    ctx.stroke();
    return;
  }
  if (type === "shield") {
    ctx.moveTo(cx, cy - s * 0.32);
    ctx.lineTo(cx + s * 0.26, cy - s * 0.2);
    ctx.lineTo(cx + s * 0.26, cy + s * 0.08);
    ctx.quadraticCurveTo(cx, cy + s * 0.38, cx - s * 0.26, cy + s * 0.08);
    ctx.lineTo(cx - s * 0.26, cy - s * 0.2);
    ctx.closePath();
    ctx.stroke();
  }
}

function makePinTexture(type) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 96, 0, Math.PI * 2);
  ctx.fillStyle = "#fffdf8";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#2c2924";
  ctx.stroke();
  drawIcon(ctx, type, 128, 128, 150);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Hotspots {
  constructor({ group, site, camera, onOpen, onClose }) {
    this.group = group;
    this.site = site;
    this.camera = camera;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.activeId = null;
    this.raycaster = new THREE.Raycaster();
    this.items = [];

    this.modal = document.querySelector("#modal");
    this.title = document.querySelector("#modal-title");
    this.kicker = document.querySelector("#modal-kicker");
    this.body = document.querySelector("#modal-body");
    this.icon = document.querySelector("#modal-icon");
    this.prevLabel = document.querySelector("#modal-prev-label");
    this.nextLabel = document.querySelector("#modal-next-label");

    this.mount();
    this.bind();
  }

  mount() {
    const size = Math.max(10, this.site.radius * 0.12);
    this.markers = new THREE.Group();
    this.markers.name = "HotspotMarkers";
    this.group.add(this.markers);

    for (const data of HOTSPOTS) {
      const texture = makePinTexture(data.icon);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.fromArray(data.position);
      sprite.scale.set(size, size, 1);
      sprite.userData.hotspotId = data.id;
      sprite.renderOrder = 20;
      this.markers.add(sprite);
      this.items.push({ data, sprite, size });
    }
  }

  bind() {
    document.querySelector("#modal-close")?.addEventListener("click", this.close);
    document.querySelector("#modal-backdrop")?.addEventListener("click", this.close);
    document.querySelector("#modal-prev")?.addEventListener("click", () => this.step(-1));
    document.querySelector("#modal-next")?.addEventListener("click", () => this.step(1));
    window.addEventListener("keydown", this.onKey);
  }

  onKey = (event) => {
    if (!this.activeId) return;
    if (event.key === "Escape") this.close();
    if (event.key === "ArrowLeft") this.step(-1);
    if (event.key === "ArrowRight") this.step(1);
  };

  indexOf(id) {
    return this.items.findIndex((item) => item.data.id === id);
  }

  pick(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.markers.children, false);
    const id = hits[0]?.object.userData.hotspotId;
    if (id) this.open(id);
    return Boolean(id);
  }

  hover(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.markers.children, false);
    const id = hits[0]?.object.userData.hotspotId ?? null;
    for (const item of this.items) {
      const on = item.data.id === id || item.data.id === this.activeId;
      item.sprite.scale.setScalar(item.size * (on ? 1.25 : 1));
    }
    return Boolean(id);
  }

  open(id) {
    const item = this.items.find((entry) => entry.data.id === id);
    if (!item) return;
    this.activeId = id;
    this.renderModal(item.data);
    this.modal.hidden = false;
    document.body.classList.add("is-modal");
    this.onOpen?.(item.data);
  }

  close = () => {
    if (!this.activeId) return;
    this.activeId = null;
    this.modal.hidden = true;
    document.body.classList.remove("is-modal");
    this.onClose?.();
  };

  step(dir) {
    if (!this.items.length) return;
    const current = Math.max(0, this.indexOf(this.activeId));
    const next = (current + dir + this.items.length) % this.items.length;
    this.open(this.items[next].data.id);
  }

  renderModal(data) {
    const index = this.indexOf(data.id);
    const prev = this.items[(index - 1 + this.items.length) % this.items.length];
    const next = this.items[(index + 1) % this.items.length];
    this.kicker.textContent = data.kicker;
    this.title.textContent = data.title;
    this.body.textContent = data.body;
    this.icon.innerHTML = ICONS[data.icon] ?? "";
    this.prevLabel.textContent = prev.data.title;
    this.nextLabel.textContent = next.data.title;
  }

  dispose() {
    window.removeEventListener("keydown", this.onKey);
    this.markers.traverse((object) => {
      if (object.material) {
        object.material.map?.dispose();
        object.material.dispose();
      }
    });
    this.markers.removeFromParent();
  }
}
