"use client";

import { useEffect, useRef, useState } from "react";

export function MiraCompanion({ thinking, typing, answerKey }: { thinking: boolean; typing: boolean; answerKey: string }) {
  const host = useRef<HTMLDivElement>(null);
  const mode = useRef({ thinking, typing, until: 0 });
  const [failed, setFailed] = useState(false);
  useEffect(() => { mode.current = { thinking, typing, until: Date.now() + 1800 }; }, [thinking, typing, answerKey]);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let cancelled = false;
    let cleanup = () => {};
    Promise.all([import("three"), import("three/examples/jsm/loaders/GLTFLoader.js")]).then(async ([THREE, { GLTFLoader }]) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30);
      camera.position.set(0, 0.1, 4.8);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x153d32, 3));
      const key = new THREE.DirectionalLight(0xfff4dc, 4); key.position.set(-3, 5, 5); scene.add(key);
      container.appendChild(renderer.domElement);
      const resize = () => { renderer.setSize(container.clientWidth, container.clientHeight); camera.aspect = container.clientWidth / Math.max(1, container.clientHeight); camera.updateProjectionMatrix(); renderer.render(scene, camera); };
      const observer = new ResizeObserver(resize); observer.observe(container); resize();
      let frame = 0;
      let model: import("three").Group | undefined;
      const disposeModel = (object: import("three").Object3D) => object.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); (Array.isArray(child.material) ? child.material : [child.material]).forEach(material => material.dispose()); } });
      cleanup = () => { cancelAnimationFrame(frame); observer.disconnect(); if (model) disposeModel(model); renderer.dispose(); renderer.domElement.remove(); };
      const gltf = await new GLTFLoader().loadAsync("/models/mira.glb");
      if (cancelled) { disposeModel(gltf.scene); return; }
      model = gltf.scene; scene.add(model);
      const head = model.getObjectByName("Head");
      const mouth = model.getObjectByName("Mouth");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const animate = () => {
        if (!model) return;
        const time = performance.now() / 1000;
        if (!reduced.matches && !document.hidden) {
          model.position.y = Math.sin(time * 1.7) * 0.035;
          if (head) { head.rotation.y = mode.current.thinking ? Math.sin(time * 2) * 0.15 : mode.current.typing ? -0.12 : Math.sin(time * 0.7) * 0.08; head.rotation.z = mode.current.typing ? 0.08 : 0; }
          if (mouth) mouth.scale.y = Date.now() < mode.current.until && !mode.current.thinking && !mode.current.typing ? 0.028 + Math.abs(Math.sin(time * 9)) * 0.055 : 0.028;
        }
        renderer.render(scene, camera);
        frame = requestAnimationFrame(animate);
      };
      animate();
    }).catch(() => { cleanup(); if (!cancelled) setFailed(true); });
    return () => { cancelled = true; cleanup(); };
  }, []);
  return <div className="flex items-center gap-3">
    <div ref={host} aria-hidden="true" className="h-20 w-20 shrink-0">{failed && <span className="grid h-full place-items-center rounded-full bg-[#153d32] text-2xl text-white">M</span>}</div>
    <div><p className="font-semibold">Mira</p><p role="status" className="text-xs text-[var(--text-muted)]">{thinking ? "Thinking through your answer…" : typing ? "I’m listening" : "Your care companion"}</p></div>
  </div>;
}
