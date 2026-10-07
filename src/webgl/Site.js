import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_NAME = "LG-CNS-Data-Center.glb";

export class Site {
  constructor({ onProgress } = {}) {
    this.root = new THREE.Group();
    this.ready = false;
    this.model = null;
    this.bounds = new THREE.Box3();
    this.sphere = new THREE.Sphere();
    this.radius = 1;
    this.onProgress = onProgress;
    this.loadPromise = this.load().catch((error) => {
      console.error("[Site] model load failed", error);
      throw error;
    });
  }

  async load() {
    const gltf = await this.loadModel();
    const model = gltf.scene;
    const extras = [];

    model.traverse((object) => {
      if (object.isCamera || object.isLight) extras.push(object);
      if (object.isMesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    extras.forEach((object) => object.removeFromParent());

    const center = new THREE.Vector3();
    this.bounds.setFromObject(model);
    this.bounds.getCenter(center);
    model.position.sub(center);

    this.bounds.setFromObject(model);
    this.bounds.getBoundingSphere(this.sphere);
    this.radius = Math.max(1, this.sphere.radius);

    this.model = model;
    this.root.add(model);
    this.ready = true;
  }

  loadModel() {
    const loader = new GLTFLoader();
    const url = import.meta.env?.BASE_URL
      ? `${import.meta.env.BASE_URL}models/${MODEL_NAME}`
      : new URL(`../../public/models/${MODEL_NAME}`, import.meta.url).href;

    return new Promise((resolve, reject) => {
      loader.load(
        url,
        resolve,
        (event) => {
          if (event.total > 0) this.onProgress?.(event.loaded / event.total);
        },
        reject,
      );
    });
  }

  dispose() {
    this.model?.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }
}
