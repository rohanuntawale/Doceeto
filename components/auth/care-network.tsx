"use client";

/**
 * CareNetwork — the interactive right-panel experience on the desktop login page.
 *
 * Concept: Doceeto's gold dot represents care in motion. When a user grabs it,
 * a care network wakes up around them — connecting to Doctor, Nurse, Medicine,
 * and Urgent Care. The dot is not ripped from the logo; it emanates from it,
 * and snaps back to reunite with the logo on release.
 *
 * Component tree:
 *   CareNetwork
 *   ├── BrandMark (anchored logo, hideDot=true)
 *   ├── NetworkLines (SVG tether line + node connection lines)
 *   ├── CareNode × 4 (proximity-reactive nodes)
 *   ├── CareMessage (short message when a node is reached)
 *   └── CareDot (draggable interactive gold dot)
 */

import {
  forwardRef,
  useRef,
  useState,
  useCallback,
  useEffect,
  useId,
  type RefObject,
} from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import { BrandMark, GOLD_DOT, VIEWBOX } from "@/components/brand/wordmark";

// ─── Brand colour tokens ────────────────────────────────────────────────────

const GOLD = "#C9A13F";
const GOLD_FAINT = "rgba(201, 161, 63, 0.20)";
const GOLD_MID = "rgba(201, 161, 63, 0.42)";
const GOLD_STRONG = "rgba(201, 161, 63, 0.72)";

// ─── Interaction constants ───────────────────────────────────────────────────

/** Distance (px) at which a node begins reacting to the dot. */
const PROXIMITY_THRESHOLD = 130;
/** Distance (px) at which a node is "active" (message shown). */
const ACTIVE_THRESHOLD = 48;
/** Keyboard step size per arrow-key press (px). */
const KB_STEP = 14;

// ─── Node definitions ────────────────────────────────────────────────────────

/** Positions are percentages of the panel container — organic, not symmetrical. */
const NODES = [
  {
    id: "doctor" as const,
    label: "Doctor",
    message: "A doctor, when you need one.",
    x: 48,
    y: 18,
  },
  {
    id: "nurse" as const,
    label: "Nurse",
    message: "Care that stays close.",
    x: 80,
    y: 38,
  },
  {
    id: "medicine" as const,
    label: "Medicine",
    message: "Medicine, delivered to you.",
    x: 20,
    y: 48,
  },
  {
    id: "urgent-care" as const,
    label: "Urgent Care",
    message: "Help when it can't wait.",
    x: 55,
    y: 78,
  },
];

type NodeId = (typeof NODES)[number]["id"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute the floating gold dot's position within the panel as percentages.
 * The logo SVG is centered inside the panel; the dot is at a known SVG
 * coordinate. We measure both DOMRects to get the exact panel-relative position.
 */
function getDotAnchorPercent(
  panelRect: DOMRect,
  logoEl: HTMLElement,
): { x: number; y: number } {
  const logoRect = logoEl.getBoundingClientRect();

  // Fractional position of the dot within the rendered SVG element.
  const dotXRatio = (GOLD_DOT.cx - VIEWBOX.x) / VIEWBOX.w;
  const dotYRatio = (GOLD_DOT.cy - VIEWBOX.y) / VIEWBOX.h;

  // Dot center in panel-relative px.
  const dotXpx =
    logoRect.left - panelRect.left + dotXRatio * logoRect.width;
  const dotYpx =
    logoRect.top - panelRect.top + dotYRatio * logoRect.height;

  return {
    x: (dotXpx / panelRect.width) * 100,
    y: (dotYpx / panelRect.height) * 100,
  };
}

// ─── CareNetwork (root) ──────────────────────────────────────────────────────

export interface CareNetworkProps {
  /** The panel's own ref — used for drag constraint bounds and measurements. */
  boundsRef: RefObject<HTMLDivElement>;
}

export function CareNetwork({ boundsRef }: CareNetworkProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const descId = useId();
  const logoRef = useRef<HTMLDivElement>(null);

  // Interaction state — only these trigger React re-renders.
  const [isInteracting, setIsInteracting] = useState(false);
  const [activeNode, setActiveNode] = useState<NodeId | null>(null);
  const [proximities, setProximities] = useState<Record<NodeId, number>>({
    doctor: 0,
    nurse: 0,
    medicine: 0,
    "urgent-care": 0,
  });

  // Dot position as a delta from its origin (motion values = no re-renders on move).
  const dotX = useMotionValue(0);
  const dotY = useMotionValue(0);

  // Spring-smoothed values used by the SVG lines for an organic feel.
  const smoothX = useSpring(dotX, { stiffness: 160, damping: 22 });
  const smoothY = useSpring(dotY, { stiffness: 160, damping: 22 });

  // Dot anchor — the % position of the gold dot within the panel.
  // Null until the logo is measured.
  const [dotAnchorPct, setDotAnchorPct] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // ── Anchor measurement ────────────────────────────────────────────────────

  const measureAnchor = useCallback(() => {
    if (!boundsRef.current || !logoRef.current) return;
    const panelRect = boundsRef.current.getBoundingClientRect();
    setDotAnchorPct(getDotAnchorPercent(panelRect, logoRef.current));
  }, [boundsRef]);

  useEffect(() => {
    // Initial measurement after paint.
    const rafId = requestAnimationFrame(measureAnchor);
    const ro = new ResizeObserver(measureAnchor);
    if (boundsRef.current) ro.observe(boundsRef.current);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [measureAnchor, boundsRef]);

  // ── Proximity engine ──────────────────────────────────────────────────────
  // Subscribes to motion value changes — no RAF loop, no re-renders per frame.

  const runProximity = useCallback(() => {
    if (!boundsRef.current || !dotAnchorPct) return;
    const { width: W, height: H } =
      boundsRef.current.getBoundingClientRect();

    const dotAbsX = (dotAnchorPct.x / 100) * W + dotX.get();
    const dotAbsY = (dotAnchorPct.y / 100) * H + dotY.get();

    const next: Record<NodeId, number> = {
      doctor: 0,
      nurse: 0,
      medicine: 0,
      "urgent-care": 0,
    };
    let nextActive: NodeId | null = null;

    for (const node of NODES) {
      const dist = Math.hypot(
        dotAbsX - (node.x / 100) * W,
        dotAbsY - (node.y / 100) * H,
      );
      next[node.id] = clamp(1 - dist / PROXIMITY_THRESHOLD, 0, 1);
      if (dist < ACTIVE_THRESHOLD) nextActive = node.id;
    }

    setProximities(next);
    setActiveNode(nextActive);
  }, [boundsRef, dotAnchorPct, dotX, dotY]);

  useEffect(() => {
    const unX = dotX.on("change", runProximity);
    const unY = dotY.on("change", runProximity);
    return () => {
      unX();
      unY();
    };
  }, [dotX, dotY, runProximity]);

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback(() => {
    setIsInteracting(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsInteracting(false);
    setActiveNode(null);
    setProximities({ doctor: 0, nurse: 0, medicine: 0, "urgent-care": 0 });
  }, []);

  // ── Keyboard navigation ───────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const delta: Record<string, [number, number]> = {
        ArrowUp: [0, -KB_STEP],
        ArrowDown: [0, KB_STEP],
        ArrowLeft: [-KB_STEP, 0],
        ArrowRight: [KB_STEP, 0],
      };
      if (delta[e.key]) {
        e.preventDefault();
        if (!isInteracting) setIsInteracting(true);
        const [dx, dy] = delta[e.key];
        dotX.set(dotX.get() + dx);
        dotY.set(dotY.get() + dy);
        runProximity();
      } else if (e.key === "Escape") {
        // Snap back to origin.
        dotX.set(0);
        dotY.set(0);
        setIsInteracting(false);
        setActiveNode(null);
        setProximities({ doctor: 0, nurse: 0, medicine: 0, "urgent-care": 0 });
      }
    },
    [dotX, dotY, isInteracting, runProximity],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        // Snap back after arrow key released.
        dotX.set(0);
        dotY.set(0);
        setIsInteracting(false);
        setActiveNode(null);
        setProximities({ doctor: 0, nurse: 0, medicine: 0, "urgent-care": 0 });
      }
    },
    [dotX, dotY],
  );

  // ── Idle tingle ───────────────────────────────────────────────────────────
  // Fires occasionally to hint that the dot is interactive.

  const [tingle, setTingle] = useState(false);

  useEffect(() => {
    if (reducedMotion || isInteracting) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const fire = () => {
      setTingle(true);
      timeoutId = setTimeout(() => {
        setTingle(false);
        // Schedule next tingle 5–9 seconds later.
        timeoutId = setTimeout(fire, 5000 + Math.random() * 4000);
      }, 700);
    };

    // First tingle after 3 seconds.
    timeoutId = setTimeout(fire, 3000);
    return () => clearTimeout(timeoutId);
  }, [reducedMotion, isInteracting]);

  // ── Active node lookup ────────────────────────────────────────────────────

  const activeNodeData = activeNode
    ? NODES.find((n) => n.id === activeNode) ?? null
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full w-full">
      {/* SR description — keyboard users understand how to interact */}
      <p id={descId} className="sr-only">
        Interactive care network. Use arrow keys to explore the gold dot and
        discover Doceeto&rsquo;s care connections. Press Escape to return the
        dot to the logo.
      </p>

      {/* Anchored logo — the gold dot is omitted; CareDot renders it */}
      <div
        ref={logoRef}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <BrandMark
          className="animate-float h-[min(11rem,26vh)] w-[min(11rem,26vh)] drop-shadow-[0_18px_35px_rgba(16,45,35,0.35)] motion-reduce:animate-none"
          hideDot
        />
      </div>

      {/* SVG overlay: tether line + node connection lines */}
      <AnimatePresence>
        {dotAnchorPct && isInteracting && (
          <NetworkLines
            key="network-lines"
            dotAnchorPct={dotAnchorPct}
            dotX={smoothX}
            dotY={smoothY}
            proximities={proximities}
            reducedMotion={reducedMotion}
          />
        )}
      </AnimatePresence>

      {/* Care nodes — staggered entrance */}
      <AnimatePresence>
        {isInteracting &&
          NODES.map((node, i) => (
            <CareNode
              key={node.id}
              label={node.label}
              x={node.x}
              y={node.y}
              proximity={proximities[node.id]}
              active={activeNode === node.id}
              enterDelay={reducedMotion ? 0 : i * 0.07}
            />
          ))}
      </AnimatePresence>

      {/* Node activation message */}
      <AnimatePresence mode="wait">
        {activeNodeData && (
          <CareMessage
            key={activeNodeData.id}
            message={activeNodeData.message}
          />
        )}
      </AnimatePresence>

      {/* The interactive gold dot */}
      {dotAnchorPct && (
        <CareDot
          boundsRef={boundsRef}
          dotX={dotX}
          dotY={dotY}
          anchorPct={dotAnchorPct}
          tingle={tingle}
          isInteracting={isInteracting}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          reducedMotion={reducedMotion}
          descId={descId}
        />
      )}
    </div>
  );
}

// ─── NetworkLines ─────────────────────────────────────────────────────────────

interface NetworkLinesProps {
  dotAnchorPct: { x: number; y: number };
  dotX: ReturnType<typeof useSpring>;
  dotY: ReturnType<typeof useSpring>;
  proximities: Record<NodeId, number>;
  reducedMotion: boolean;
}

function NetworkLines({
  dotAnchorPct,
  dotX,
  dotY,
  proximities,
  reducedMotion,
}: NetworkLinesProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tetherRef = useRef<SVGLineElement | null>(null);
  const lineRefs = useRef<Partial<Record<NodeId, SVGLineElement | null>>>({});

  const ax = dotAnchorPct.x;
  const ay = dotAnchorPct.y;

  // Drive all SVG DOM mutations via RAF — no React re-renders during drag.
  useEffect(() => {
    let rafId: number;

    const tick = () => {
      if (!svgRef.current) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const W = svgRef.current.clientWidth || 1;
      const H = svgRef.current.clientHeight || 1;
      const dx = dotX.get();
      const dy = dotY.get();

      // Current dot position as % of panel.
      const dotPx = ax + (dx / W) * 100;
      const dotPy = ay + (dy / H) * 100;

      // Tether line (logo anchor → dot, fades with distance).
      if (tetherRef.current) {
        const dist = Math.hypot(dx, dy);
        const maxDist = Math.hypot(W, H) * 0.38;
        const opacity = Math.max(0, (1 - dist / maxDist) * 0.45);
        const el = tetherRef.current;
        el.setAttribute("x2", `${dotPx}%`);
        el.setAttribute("y2", `${dotPy}%`);
        el.style.opacity = String(opacity);
      }

      // Node connection lines.
      for (const node of NODES) {
        const el = lineRefs.current[node.id];
        if (!el) continue;
        const prox = proximities[node.id] ?? 0;
        el.setAttribute("x1", `${dotPx}%`);
        el.setAttribute("y1", `${dotPy}%`);
        el.style.opacity = String(0.1 + prox * 0.58);
        el.setAttribute(
          "stroke",
          prox > 0.6 ? GOLD_STRONG : prox > 0.28 ? GOLD_MID : GOLD_FAINT,
        );
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [ax, ay, dotX, dotY, proximities]);

  return (
    <motion.svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.3 }}
    >
      {/* Tether: dashed, fades as dot travels farther from the logo */}
      <line
        ref={(el) => {
          tetherRef.current = el;
        }}
        x1={`${ax}%`}
        y1={`${ay}%`}
        x2={`${ax}%`}
        y2={`${ay}%`}
        stroke={GOLD}
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="2 5"
        style={{ opacity: 0 }}
      />

      {/* Node lines — solid, colour/opacity driven by proximity */}
      {NODES.map((node) => (
        <line
          key={node.id}
          ref={(el) => {
            lineRefs.current[node.id] = el;
          }}
          x1={`${ax}%`}
          y1={`${ay}%`}
          x2={`${node.x}%`}
          y2={`${node.y}%`}
          stroke={GOLD_FAINT}
          strokeWidth="0.7"
          strokeLinecap="round"
          style={{ opacity: 0 }}
        />
      ))}
    </motion.svg>
  );
}

// ─── CareNode ────────────────────────────────────────────────────────────────

interface CareNodeProps {
  label: string;
  x: number;
  y: number;
  proximity: number;
  active: boolean;
  enterDelay: number;
}

function CareNode({ label, x, y, proximity, active, enterDelay }: CareNodeProps) {
  const scale = 1 + proximity * 0.3 + (active ? 0.07 : 0);
  const ringOpacity = 0.18 + proximity * 0.72;
  const labelOpacity = 0.35 + proximity * 0.6;

  return (
    <motion.div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0.55 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.55 }}
      transition={{ delay: enterDelay, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      aria-hidden="true"
    >
      {/* Node circle with proximity-driven scale */}
      <motion.div
        className="relative flex items-center justify-center"
        animate={{ scale }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
      >
        {/* Active pulse ring */}
        <AnimatePresence>
          {active && (
            <motion.div
              key="pulse"
              className="absolute inset-0 rounded-full"
              style={{ border: `1px solid ${GOLD}` }}
              initial={{ scale: 1, opacity: 0.65 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeOut", repeat: Infinity }}
            />
          )}
        </AnimatePresence>

        {/* Ring */}
        <div
          className="h-3 w-3 rounded-full"
          style={{
            border: `1.5px solid rgba(201, 161, 63, ${ringOpacity})`,
            background: active
              ? "rgba(201, 161, 63, 0.16)"
              : "rgba(201, 161, 63, 0.05)",
            transition: "background 0.3s ease, border-color 0.3s ease",
          }}
        />
      </motion.div>

      {/* Label */}
      <span
        className="pointer-events-none select-none text-center text-[8.5px] font-semibold uppercase tracking-[0.13em]"
        style={{ color: `rgba(201, 161, 63, ${labelOpacity})`, transition: "color 0.2s ease" }}
      >
        {label}
      </span>
    </motion.div>
  );
}

// ─── CareMessage ──────────────────────────────────────────────────────────────

interface CareMessageProps {
  message: string;
}

function CareMessage({ message }: CareMessageProps) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-10"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      aria-live="polite"
      aria-atomic="true"
    >
      <p
        className="font-serif text-[14px] font-medium italic leading-snug"
        style={{ color: "rgba(201, 161, 63, 0.85)" }}
      >
        {message}
      </p>
    </motion.div>
  );
}

// ─── CareDot ─────────────────────────────────────────────────────────────────

interface CareDotProps {
  boundsRef: RefObject<HTMLDivElement>;
  dotX: ReturnType<typeof useMotionValue<number>>;
  dotY: ReturnType<typeof useMotionValue<number>>;
  anchorPct: { x: number; y: number };
  tingle: boolean;
  isInteracting: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onKeyUp: (e: React.KeyboardEvent) => void;
  reducedMotion: boolean;
  descId: string;
}

const CareDot = forwardRef<HTMLDivElement, CareDotProps>(function CareDot(
  {
    boundsRef,
    dotX,
    dotY,
    anchorPct,
    tingle,
    isInteracting,
    onDragStart,
    onDragEnd,
    onKeyDown,
    onKeyUp,
    reducedMotion,
    descId,
  },
  ref,
) {
  // Tingle: a brief scale pulse that fires occasionally at idle.
  const tingleVariants = {
    idle: { scale: 1 },
    tingle: {
      scale: [1, 1.22, 0.94, 1.1, 1],
      transition: { duration: 0.6, ease: "easeInOut" as const },
    },
  };

  return (
    <motion.div
      ref={ref}
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none outline-none active:cursor-grabbing"
      style={{
        left: `${anchorPct.x}%`,
        top: `${anchorPct.y}%`,
        x: dotX,
        y: dotY,
        zIndex: 20,
      }}
      drag
      dragConstraints={boundsRef}
      dragElastic={0.18}
      dragSnapToOrigin
      dragTransition={{ bounceStiffness: 260, bounceDamping: 18 }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 0.9 }}
      tabIndex={0}
      role="button"
      aria-label="Explore Doceeto care network"
      aria-describedby={descId}
      aria-pressed={isInteracting}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      {/* Tingle wrapper */}
      <motion.div
        variants={reducedMotion ? {} : tingleVariants}
        animate={
          reducedMotion
            ? undefined
            : tingle && !isInteracting
              ? "tingle"
              : "idle"
        }
        className="relative"
      >
        {/* Glow halo — appears when dragging */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(201,161,63,0.22) 0%, transparent 68%)",
          }}
          initial={{ scale: 1, opacity: 0 }}
          animate={
            isInteracting
              ? { scale: 2.6, opacity: 1 }
              : { scale: 1, opacity: 0 }
          }
          transition={{ duration: 0.4, ease: "easeOut" }}
        />

        {/* The gold dot */}
        <div
          className="relative h-[22px] w-[22px] rounded-full"
          style={{
            background: GOLD,
            boxShadow: isInteracting
              ? `0 0 0 3px rgba(201,161,63,0.18), 0 4px 18px rgba(201,161,63,0.32)`
              : `0 2px 8px rgba(201,161,63,0.28)`,
            transition: "box-shadow 0.3s ease",
          }}
        />
      </motion.div>
    </motion.div>
  );
});
