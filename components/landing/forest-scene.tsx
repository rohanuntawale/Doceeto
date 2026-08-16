"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The forest, in three dimensions, behind the closing band.
 *
 * ── Why here ──
 *
 * The brand's own colour is Doceeto forest green and the page is built from
 * forest bands with paper panels resting on them. A mountain forest is the
 * literal picture of the thing the palette has been alluding to all the way
 * down the page, so it closes the argument rather than decorating it. It sits
 * BEHIND the bloom and under the copy — atmosphere, never a subject. If you
 * notice it as a 3D model, it is turned up too far.
 *
 * ── The 12 MB problem, and what is done about it ──
 *
 * forest.glb is 11.7 MB. On the 4G most of this product's users are on that is
 * several seconds and real money, for scenery. So it is treated as a luxury the
 * page earns, never as part of the page:
 *
 *   • It is not in the bundle. `three` and GLTFLoader are dynamically imported
 *     inside the effect, so a visitor who never qualifies downloads no 3D code
 *     at all — not the model, not the renderer.
 *   • It does not start until the section is nearly in view
 *     (IntersectionObserver, 200px of runway). Most visitors never scroll here.
 *   • It is skipped outright on a narrow viewport, on Save-Data, on 2G/3G, and
 *     for prefers-reduced-motion. Each of those is someone for whom the trade
 *     is obviously bad.
 *   • Any failure — no WebGL, a decode error, a dropped connection — resolves
 *     to nothing rendered. The band beneath already looks finished on its own,
 *     which is what makes all of the above safe.
 *
 * If this file ever feels slow, the fix is the ASSET, not the code: run the glb
 * through Draco/meshopt compression (`gltf-transform optimize`), which usually
 * takes a landscape like this under 2 MB.
 */

/** Don't spend a phone's data on scenery. */
const MIN_VIEWPORT = 1024;

interface NetworkInfo {
  saveData?: boolean;
  effectiveType?: string;
}

/** Is this a connection we should be spending 12 MB on? */
function connectionAllows(): boolean {
  const nav = navigator as Navigator & { connection?: NetworkInfo };
  const c = nav.connection;
  if (!c) return true; // Unknown: assume fine rather than punish Safari.
  if (c.saveData) return false;
  return !(c.effectiveType === "slow-2g" || c.effectiveType === "2g" || c.effectiveType === "3g");
}

export function ForestScene({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Drives the fade-in, so the scene arrives rather than popping.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < MIN_VIEWPORT) return;
    if (!connectionAllows()) return;

    let disposed = false;
    /** Everything that must be torn down, whatever order we got to. */
    let cleanup: (() => void) | undefined;

    async function start() {
      // Dynamic, and inside the guards: this is where the ~600 KB of renderer
      // is fetched, and it only happens for a visitor who is going to see it.
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (disposed || !host) return;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      // Capped at 1.5: a 3x retina buffer for a background costs three times
      // the fill rate and looks identical through the bloom on top of it.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        38,
        host.clientWidth / host.clientHeight,
        0.1,
        1000,
      );

      // Lighting is deliberately flat and cool. A dramatic key light would
      // make this a hero object; the job is a silhouette that the section's
      // own mint bloom can sit in front of.
      scene.add(new THREE.HemisphereLight(0x9fd6bd, 0x0b1f18, 2.2));
      const key = new THREE.DirectionalLight(0xd8f0e4, 1.1);
      key.position.set(-4, 6, 4);
      scene.add(key);

      const loader = new GLTFLoader();
      loader.load(
        "/landing/forest.glb",
        (gltf) => {
          if (disposed) return;
          const model = gltf.scene;

          /* Frame whatever we were given. The model's own scale and origin are
             unknown, so measure it and fit the camera to the result, hard-coded
             camera numbers break the moment the asset is re-exported. */
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const centre = box.getCenter(new THREE.Vector3());
          model.position.sub(centre);

          /* Pull the camera back only as far as the WIDER of the two
             constraints demands, so the landscape spans its container instead
             of floating as an object in the middle of it. Distance depends on
             the aspect ratio, so it is re-derived on resize, framing once at
             load left the model undersized on a window that later widened. */
          const frame = () => {
            const halfFov = ((camera.fov * Math.PI) / 180) / 2;
            const spread = Math.tan(halfFov) || 1;
            // Depth counts: the model rotates, so its footprint sweeps between
            // size.x and size.z and must fit at either extreme.
            const span = Math.max(size.x, size.z) || 1;
            const forWidth = span / 2 / (spread * (camera.aspect || 1));
            const forHeight = (size.y || 1) / 2 / spread;
            const dist = Math.max(forWidth, forHeight) * 1.04;
            camera.position.set(0, dist * 0.12, dist);
            camera.lookAt(0, 0, 0);
            camera.updateProjectionMatrix();
          };
          frame();

          scene.add(model);
          setReady(true);

          // One slow rotation, nothing else. A landscape that drifts reads as
          // weather; a landscape that spins reads as a product viewer.
          let raf = 0;
          let last = performance.now();
          const tick = (now: number) => {
            raf = requestAnimationFrame(tick);
            const dt = (now - last) / 1000;
            last = now;
            model.rotation.y += dt * 0.035;
            renderer.render(scene, camera);
          };
          raf = requestAnimationFrame(tick);

          const onResize = () => {
            if (!host) return;
            camera.aspect = host.clientWidth / host.clientHeight;
            renderer.setSize(host.clientWidth, host.clientHeight);
            frame();
          };
          window.addEventListener("resize", onResize);

          /* Stop rendering when the section is off screen or the tab is hidden.
             A background canvas quietly burning a laptop battery behind another
             app is the most antisocial thing this component could do. */
          const onVisibility = () => {
            if (document.hidden) cancelAnimationFrame(raf);
            else {
              last = performance.now();
              raf = requestAnimationFrame(tick);
            }
          };
          document.addEventListener("visibilitychange", onVisibility);

          cleanup = () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
            document.removeEventListener("visibilitychange", onVisibility);
            // Textures and geometries are not garbage-collected — three holds
            // them on the GPU until told otherwise.
            scene.traverse((o) => {
              const mesh = o as import("three").Mesh;
              mesh.geometry?.dispose?.();
              const mat = mesh.material;
              if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
              else mat?.dispose?.();
            });
            renderer.dispose();
            renderer.domElement.remove();
          };
        },
        undefined,
        // A failed load is not an error worth surfacing — the section is
        // complete without it.
        () => undefined,
      );

      if (!cleanup) {
        cleanup = () => {
          renderer.dispose();
          renderer.domElement.remove();
        };
      }
    }

    /**
     * Never before the page is done and the browser is idle.
     *
     * This matters most where the scene sits ABOVE THE FOLD, as it does in the
     * hero: the IntersectionObserver below fires immediately there, so it is
     * this gate — not visibility — that keeps 12 MB of scenery from competing
     * with the headline, the background video and the fonts for the first few
     * seconds of the page. The hero must be readable long before the forest
     * shows up, and if the visitor scrolls straight past, it may never need to.
     */
    let idleHandle = 0;
    const whenIdle = () => {
      const run = () => {
        if (disposed) return;
        const ric = (
          window as Window & {
            requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
          }
        ).requestIdleCallback;
        // Safari has no requestIdleCallback; a short timeout is close enough
        // for something with no deadline.
        if (ric) idleHandle = ric(() => void start(), { timeout: 3000 });
        else idleHandle = window.setTimeout(() => void start(), 800);
      };
      if (document.readyState === "complete") run();
      else window.addEventListener("load", run, { once: true });
    };

    // Still gated on visibility as well: below the fold this is what stops the
    // download entirely for the many visitors who never scroll that far.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        whenIdle();
      },
      { rootMargin: "200px" },
    );
    observer.observe(host);

    return () => {
      disposed = true;
      observer.disconnect();
      if (idleHandle) {
        const cic = (window as Window & { cancelIdleCallback?: (h: number) => void })
          .cancelIdleCallback;
        if (cic) cic(idleHandle);
        clearTimeout(idleHandle);
      }
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={className}
      style={{ opacity: ready ? 1 : 0, transition: "opacity 1.4s ease" }}
    />
  );
}
