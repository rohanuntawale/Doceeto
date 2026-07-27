"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

/**
 * macOS-style magnifying dock. Adapted from the 21st.dev/Framer component to
 * render React icon nodes (lucide app squircles) instead of image URLs, and
 * with the optional GSAP branch removed so it stays dependency- and lint-clean.
 * Used as the desktop web navigation.
 */
export interface DockApp {
  id: string;
  name: string;
  /** Rendered icon — a full-bleed squircle tile that fills its slot. */
  icon: React.ReactNode;
}

interface MacOSDockProps {
  apps: DockApp[];
  onAppClick: (appId: string) => void;
  openApps?: string[];
  className?: string;
}

const MacOSDock: React.FC<MacOSDockProps> = ({
  apps,
  onAppClick,
  openApps = [],
  className = "",
}) => {
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [currentScales, setCurrentScales] = useState<number[]>(apps.map(() => 1));
  const [currentPositions, setCurrentPositions] = useState<number[]>([]);
  const dockRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastMouseMoveTime = useRef<number>(0);

  /**
   * The server has no viewport, so it and the first client render MUST agree
   * on these numbers — measuring the window during render makes hydration
   * mismatch on every `style` the dock emits. Both start here (the desktop
   * size), and the real measurement lands in an effect just after mount.
   */
  const SSR_CONFIG = { baseIconSize: 56, maxScale: 1.75, effectWidth: 300 };

  /** Client-only: never call this during render. */
  const getResponsiveConfig = useCallback(() => {
    const smaller = Math.min(window.innerWidth, window.innerHeight);
    if (smaller < 480) {
      return { baseIconSize: Math.max(40, smaller * 0.08), maxScale: 1.4, effectWidth: smaller * 0.4 };
    } else if (smaller < 768) {
      return { baseIconSize: Math.max(46, smaller * 0.07), maxScale: 1.5, effectWidth: smaller * 0.35 };
    } else if (smaller < 1024) {
      return { baseIconSize: 52, maxScale: 1.6, effectWidth: smaller * 0.3 };
    }
    return SSR_CONFIG;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [config, setConfig] = useState(SSR_CONFIG);
  const { baseIconSize, maxScale, effectWidth } = config;
  const minScale = 1.0;
  const baseSpacing = Math.max(6, baseIconSize * 0.1);

  useEffect(() => {
    const apply = () => setConfig(getResponsiveConfig());
    apply(); // swap to the real viewport size once hydration is done
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [getResponsiveConfig]);

  // Authentic macOS cosine-based magnification.
  const calculateTargetMagnification = useCallback(
    (mousePosition: number | null) => {
      if (mousePosition === null) return apps.map(() => minScale);
      return apps.map((_, index) => {
        const normalIconCenter = index * (baseIconSize + baseSpacing) + baseIconSize / 2;
        const minX = mousePosition - effectWidth / 2;
        const maxX = mousePosition + effectWidth / 2;
        if (normalIconCenter < minX || normalIconCenter > maxX) return minScale;
        const theta = ((normalIconCenter - minX) / effectWidth) * 2 * Math.PI;
        const cappedTheta = Math.min(Math.max(theta, 0), 2 * Math.PI);
        const scaleFactor = (1 - Math.cos(cappedTheta)) / 2;
        return minScale + scaleFactor * (maxScale - minScale);
      });
    },
    [apps, baseIconSize, baseSpacing, effectWidth, maxScale, minScale],
  );

  const calculatePositions = useCallback(
    (scales: number[]) => {
      let currentX = 0;
      return scales.map((scale) => {
        const scaledWidth = baseIconSize * scale;
        const centerX = currentX + scaledWidth / 2;
        currentX += scaledWidth + baseSpacing;
        return centerX;
      });
    },
    [baseIconSize, baseSpacing],
  );

  useEffect(() => {
    const initialScales = apps.map(() => minScale);
    setCurrentScales(initialScales);
    setCurrentPositions(calculatePositions(initialScales));
  }, [apps, calculatePositions, minScale, config]);

  const animateToTarget = useCallback(() => {
    const targetScales = calculateTargetMagnification(mouseX);
    const targetPositions = calculatePositions(targetScales);
    const lerpFactor = mouseX !== null ? 0.2 : 0.12;

    setCurrentScales((prev) =>
      prev.map((s, i) => s + (targetScales[i] - s) * lerpFactor),
    );
    setCurrentPositions((prev) =>
      prev.map((p, i) => p + ((targetPositions[i] ?? p) - p) * lerpFactor),
    );

    const scalesNeedUpdate = currentScales.some(
      (s, i) => Math.abs(s - targetScales[i]) > 0.002,
    );
    const positionsNeedUpdate = currentPositions.some(
      (p, i) => Math.abs(p - (targetPositions[i] ?? p)) > 0.1,
    );

    if (scalesNeedUpdate || positionsNeedUpdate || mouseX !== null) {
      animationFrameRef.current = requestAnimationFrame(animateToTarget);
    }
  }, [mouseX, calculateTargetMagnification, calculatePositions, currentScales, currentPositions]);

  useEffect(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(animateToTarget);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [animateToTarget]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const now = performance.now();
      if (now - lastMouseMoveTime.current < 16) return;
      lastMouseMoveTime.current = now;
      if (dockRef.current) {
        const rect = dockRef.current.getBoundingClientRect();
        const padding = Math.max(8, baseIconSize * 0.12);
        setMouseX(e.clientX - rect.left - padding);
      }
    },
    [baseIconSize],
  );

  const handleMouseLeave = useCallback(() => setMouseX(null), []);

  const createBounceAnimation = (element: HTMLElement) => {
    const bounceHeight = Math.max(-8, -baseIconSize * 0.15);
    element.style.transition = "transform 0.2s ease-out";
    element.style.transform = `translateY(${bounceHeight}px)`;
    setTimeout(() => {
      element.style.transform = "translateY(0px)";
    }, 200);
  };

  const handleAppClick = (appId: string, index: number) => {
    const el = iconRefs.current[index];
    if (el) createBounceAnimation(el);
    onAppClick(appId);
  };

  const contentWidth =
    currentPositions.length > 0
      ? Math.max(
          ...currentPositions.map(
            (pos, index) => pos + (baseIconSize * currentScales[index]) / 2,
          ),
        )
      : apps.length * (baseIconSize + baseSpacing) - baseSpacing;

  const padding = Math.max(8, baseIconSize * 0.12);

  return (
    <div
      ref={dockRef}
      className={`backdrop-blur-md ${className}`}
      style={{
        width: `${contentWidth + padding * 2}px`,
        background: "rgba(30, 30, 32, 0.72)",
        borderRadius: `${Math.max(16, baseIconSize * 0.42)}px`,
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: `0 ${Math.max(4, baseIconSize * 0.1)}px ${Math.max(
          16,
          baseIconSize * 0.4,
        )}px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12)`,
        padding: `${padding}px`,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative" style={{ height: `${baseIconSize}px`, width: "100%" }}>
        {apps.map((app, index) => {
          const scale = currentScales[index];
          const position = currentPositions[index] || 0;
          const scaledSize = baseIconSize * scale;
          return (
            <div
              key={app.id}
              ref={(el) => {
                iconRefs.current[index] = el;
              }}
              className="absolute flex cursor-pointer flex-col items-center justify-end"
              title={app.name}
              onClick={() => handleAppClick(app.id, index)}
              style={{
                left: `${position - scaledSize / 2}px`,
                bottom: "0px",
                width: `${scaledSize}px`,
                height: `${scaledSize}px`,
                transformOrigin: "bottom center",
                zIndex: Math.round(scale * 10),
              }}
            >
              <div style={{ width: scaledSize, height: scaledSize }}>{app.icon}</div>

              {openApps.includes(app.id) && (
                <div
                  className="absolute"
                  style={{
                    bottom: `${Math.max(-3, -baseIconSize * 0.08)}px`,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: `${Math.max(3, baseIconSize * 0.06)}px`,
                    height: `${Math.max(3, baseIconSize * 0.06)}px`,
                    borderRadius: "50%",
                    backgroundColor: "rgba(255, 255, 255, 0.85)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MacOSDock;
