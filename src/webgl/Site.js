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

  async loadModel() {
    const loader = new GLTFLoader();
    const base = import.meta.env?.BASE_URL || "./";
    const urls = [
      `${base}models/${MODEL_NAME}`,
      `${base}public/models/${MODEL_NAME}`,
      `./models/${MODEL_NAME}`,
      `./public/models/${MODEL_NAME}`,
    ];

    let lastError;
    for (const url of urls) {
      try {
        return await new Promise((resolve, reject) => {
          loader.load(
            url,
            resolve,
            (event) => {
              if (event.total > 0) this.onProgress?.(event.loaded / event.total);
            },
            reject,
          );
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error(`${MODEL_NAME} 를 찾지 못했습니다.`);
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
