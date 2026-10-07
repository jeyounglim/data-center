import { Experience } from "./webgl/Experience.js";

export function boot(options = {}) {
  const canvas = document.querySelector("#webgl");
  const loader = document.querySelector("#loader");
  const progress = document.querySelector("#progress");
  const experience = new Experience(canvas, {
    ...options,
    onProgress(value) {
      if (progress) progress.style.width = `${Math.round(value * 100)}%`;
    },
  });

  const coords = document.querySelector("#coords");
  const parallaxNodes = document.querySelectorAll("[data-parallax]");

  window.addEventListener("error", (event) => {
    console.error("[window.error]", event.message, event.filename, event.lineno);
  });

  experience.ready.then(() => {
    loader?.classList.add("is-done");
  });

  const format = (n) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));

  const loop = () => {
    const pointer = experience.getPointer();
    if (coords) coords.textContent = `${format(pointer.x)} / ${format(pointer.y)}`;

    parallaxNodes.forEach((node, index) => {
      const depth = 10 + index * 6;
      node.style.transform = `translate3d(${pointer.x * depth}px, ${-pointer.y * depth * 0.6}px, 0)`;
    });

    requestAnimationFrame(loop);
  };

  loop();
  return experience;
}
