"use client";

/**
 * CareNetwork — the interactive right-panel experience on the desktop login page.
 *
 * Concept: Doceeto's gold dot represents care in motion. When a user grabs it,
 * a care network wakes up around them — connecting to Doctor, Nurse, Medicine,
 * and Urgent Care. The dot is anchored to the logo in idle state, emanates from
 * it when dragged, and snaps back smoothly to reunite on release.
 *
 * Visual hierarchy:
 * - Dark, calm, premium forest background with subtle radial depth.
 * - Balanced logo (~135px wide), prominent 48px nodes, readable 14px labels.
 * - High-contrast, clear 20px CareMessage text.
 * - 100% mathematically exact gold dot placement in idle state.
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
import { Stethoscope, Syringe, Pill, HeartPulse } from "lucide-react";
import { BrandMark, GOLD_DOT, VIEWBOX } from "@/components/brand/wordmark";

// ─── Brand colour tokens ────────────────────────────────────────────────────

const GOLD = "#C9A13F";
const GOLD_FAINT = "rgba(201, 161, 63, 0.22)";
const GOLD_MID = "rgba(201, 161, 63, 0.55)";
const GOLD_STRONG = "rgba(201, 161, 63, 0.88)";

// ─── Interaction constants ───────────────────────────────────────────────────

/** Distance (px) at which a node begins reacting to the dot. */
const PROXIMITY_THRESHOLD = 140;
/** Distance (px) at which a node is "active" (message shown). */
const ACTIVE_THRESHOLD = 52;
/** Keyboard step size per arrow-key press (px). */
const KB_STEP = 14;

// ─── Node definitions ────────────────────────────────────────────────────────

const NODES = [
  {
    id: "doctor" as const,
    label: "Doctor",
    message: "A doctor, when you need one.",
    x: 48,
    y: 18,
    icon: Stethoscope,
  },
  {
    id: "nurse" as const,
    label: "Nurse",
    message: "Care that stays close.",
    x: 80,
    y: 38,
    icon: Syringe,
  },
  {
    id: "medicine" as const,
    label: "Medicine",
    message: "Medicine, delivered to you.",
    x: 20,
    y: 48,
    icon: Pill,
  },
  {
    id: "urgent-care" as const,
    label: "Urgent Care",
    message: "Help when it can't wait.",
    x: 55,
    y: 78,
    icon: HeartPulse,
  },
];

type NodeId = (typeof NODES)[number]["id"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute the floating gold dot's position within the panel as percentages,
 * and calculate its exact rendered diameter in pixels based on the SVG viewBox.
 */
function getDotAnchor(
  panelRect: DOMRect,
  logoRect: DOMRect,
): { x: number; y: number; diameterPx: number } {
  const vbX = VIEWBOX.x; // 96
  const vbY = VIEWBOX.y; // 121
  const vbW = VIEWBOX.w; // 366
  const vbH = VIEWBOX.h; // 270

  // Fractional position of the dot center inside the SVG artwork (0.0 to 1.0)
  const fx = (GOLD_DOT.cx - vbX) / vbW; // 324 / 366 = 0.885246
  const fy = (GOLD_DOT.cy - vbY) / vbH; // 135 / 270 = 0.500000

  // Absolute center of the dot relative to panel top-left
  const dotCenterX = logoRect.left - panelRect.left + fx * logoRect.width;
  const dotCenterY = logoRect.top - panelRect.top + fy * logoRect.height;

  // Exact rendered diameter matching the SVG dot (2 * r = 56 in 270-unit height)
  const diameterPx = ((2 * GOLD_DOT.r) / vbH) * logoRect.height;

  return {
    x: (dotCenterX / panelRect.width) * 100,
    y: (dotCenterY / panelRect.height) * 100,
    diameterPx,
  };
}

// ─── CareNetwork (root) ──────────────────────────────────────────────────────

export interface CareNetworkProps {
  boundsRef: RefObject<HTMLDivElement>;
}

export function CareNetwork({ boundsRef }: CareNetworkProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const descId = useId();
  const logoWrapperRef = useRef<HTMLDivElement>(null);

  // Interaction state
  const [isInteracting, setIsInteracting] = useState(false);
  const [activeNode, setActiveNode] = useState<NodeId | null>(null);
  const [proximities, setProximities] = useState<Record<NodeId, number>>({
    doctor: 0,
    nurse: 0,
    medicine: 0,
    "urgent-care": 0,
  });

  // Motion values for the draggable dot delta offset (from origin)
  const dotX = useMotionValue(0);
  const dotY = useMotionValue(0);

  // Spring-smoothed values for SVG lines
  const smoothX = useSpring(dotX, { stiffness: 160, damping: 22 });
  const smoothY = useSpring(dotY, { stiffness: 160, damping: 22 });

  // Measured dot anchor position & size
  const [dotAnchor, setDotAnchor] = useState<{
    x: number;
    y: number;
    diameterPx: number;
  } | null>(null);

  // ── Anchor measurement ────────────────────────────────────────────────────

  const measureAnchor = useCallback(() => {
    if (!boundsRef.current || !logoWrapperRef.current) return;
    const panelRect = boundsRef.current.getBoundingClientRect();
    const logoRect = logoWrapperRef.current.getBoundingClientRect();
    setDotAnchor(getDotAnchor(panelRect, logoRect));
  }, [boundsRef]);

  useEffect(() => {
    const rafId = requestAnimationFrame(measureAnchor);
    const ro = new ResizeObserver(measureAnchor);
    if (boundsRef.current) ro.observe(boundsRef.current);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [measureAnchor, boundsRef]);

  // ── Proximity engine ──────────────────────────────────────────────────────

  const runProximity = useCallback(() => {
    if (!boundsRef.current || !dotAnchor) return;
    const { width: W, height: H } =
      boundsRef.current.getBoundingClientRect();

    const dotAbsX = (dotAnchor.x / 100) * W + dotX.get();
    const dotAbsY = (dotAnchor.y / 100) * H + dotY.get();

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
  }, [boundsRef, dotAnchor, dotX, dotY]);

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

  const [tingle, setTingle] = useState(false);

  useEffect(() => {
    if (reducedMotion || isInteracting) return;
    let timeoutId: ReturnType<typeof setTimeout>;

    const fire = () => {
      setTingle(true);
      timeoutId = setTimeout(() => {
        setTingle(false);
        timeoutId = setTimeout(fire, 5000 + Math.random() * 4000);
      }, 700);
    };

    timeoutId = setTimeout(fire, 3000);
    return () => clearTimeout(timeoutId);
  }, [reducedMotion, isInteracting]);

  const activeNodeData = activeNode
    ? NODES.find((n) => n.id === activeNode) ?? null
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full w-full select-none">
      {/* SR description */}
      <p id={descId} className="sr-only">
        Interactive care network. Use arrow keys to explore the gold dot and
        discover Doceeto&rsquo;s care connections. Press Escape to return the
        dot to the logo.
      </p>

      {/* Anchored logo — sized proportionally (~135px wide) with aspect ratio 366/270 */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center z-10"
        aria-hidden="true"
      >
        <div
          ref={logoWrapperRef}
          className="relative w-[130px] sm:w-[140px] aspect-[366/270]"
        >
          <BrandMark
            className="w-full h-full drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)]"
            hideDot
          />
        </div>
      </div>

      {/* SVG overlay: tether line + node connection lines */}
      <AnimatePresence>
        {dotAnchor && isInteracting && (
          <NetworkLines
            key="network-lines"
            dotAnchorPct={dotAnchor}
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
              icon={node.icon}
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

      {/* The interactive gold dot — sits 100% exact in idle state over logo */}
      {dotAnchor && (
        <CareDot
          boundsRef={boundsRef}
          dotX={dotX}
          dotY={dotY}
          anchorPct={dotAnchor}
          diameterPx={dotAnchor.diameterPx}
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

      const dotPx = ax + (dx / W) * 100;
      const dotPy = ay + (dy / H) * 100;

      // Tether line
      if (tetherRef.current) {
        const dist = Math.hypot(dx, dy);
        const maxDist = Math.hypot(W, H) * 0.4;
        const opacity = Math.max(0, (1 - dist / maxDist) * 0.5);
        const el = tetherRef.current;
        el.setAttribute("x2", `${dotPx}%`);
        el.setAttribute("y2", `${dotPy}%`);
        el.style.opacity = String(opacity);
      }

      // Node connection lines
      for (const node of NODES) {
        const el = lineRefs.current[node.id];
        if (!el) continue;
        const prox = proximities[node.id] ?? 0;
        el.setAttribute("x1", `${dotPx}%`);
        el.setAttribute("y1", `${dotPy}%`);
        el.style.opacity = String(0.18 + prox * 0.75);
        el.setAttribute(
          "stroke",
          prox > 0.65 ? GOLD_STRONG : prox > 0.3 ? GOLD_MID : GOLD_FAINT,
        );
        el.setAttribute("stroke-width", String(1.5 + prox * 0.75));
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [ax, ay, dotX, dotY, proximities]);

  return (
    <motion.svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 h-full w-full z-15"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.3 }}
    >
      {/* Tether line */}
      <line
        ref={(el) => {
          tetherRef.current = el;
        }}
        x1={`${ax}%`}
        y1={`${ay}%`}
        x2={`${ax}%`}
        y2={`${ay}%`}
        stroke={GOLD}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="3 4"
        style={{ opacity: 0 }}
      />

      {/* Node lines */}
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
          strokeWidth="1.5"
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
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  proximity: number;
  active: boolean;
  enterDelay: number;
}

function CareNode({
  label,
  x,
  y,
  icon: Icon,
  proximity,
  active,
  enterDelay,
}: CareNodeProps) {
  const scale = 1 + proximity * 0.22 + (active ? 0.08 : 0);
  const ringOpacity = 0.35 + proximity * 0.65;
  const labelOpacity = 0.6 + proximity * 0.4;

  return (
    <motion.div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 z-20"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{
        delay: enterDelay,
        duration: 0.38,
        ease: [0.16, 1, 0.3, 1],
      }}
      aria-hidden="true"
    >
      {/* Node circle (~48px diameter) */}
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
              style={{ border: `1.5px solid ${GOLD}` }}
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeOut", repeat: Infinity }}
            />
          )}
        </AnimatePresence>

        {/* 48px circle node */}
        <div
          className="h-12 w-12 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md transition-colors duration-300"
          style={{
            border: `1.5px solid rgba(201, 161, 63, ${ringOpacity})`,
            background: active
              ? "rgba(201, 161, 63, 0.25)"
              : "rgba(15, 41, 34, 0.85)",
            boxShadow: active
              ? "0 0 20px rgba(201, 161, 63, 0.4)"
              : "0 4px 14px rgba(0, 0, 0, 0.35)",
          }}
        >
          <Icon
            className="h-5 w-5 transition-transform duration-200"
            style={{
              color: active ? "#FFFFFF" : GOLD,
              transform: active ? "scale(1.1)" : "scale(1)",
            }}
          />
        </div>
      </motion.div>

      {/* Prominent, readable 14px label */}
      <span
        className="pointer-events-none select-none text-center text-[14px] font-semibold tracking-wide text-paper drop-shadow-md"
        style={{
          opacity: labelOpacity,
          color: active ? "#FFFFFF" : "#ECEAE0",
          transition: "opacity 0.2s ease, color 0.2s ease",
        }}
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
      className="pointer-events-none absolute inset-x-0 bottom-14 z-30 flex justify-center px-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="rounded-full bg-forest-800/80 px-5 py-2.5 border border-gold/30 shadow-card backdrop-blur-md">
        <p className="font-serif text-[18px] sm:text-[20px] font-medium italic text-paper text-center tracking-tight">
          {message}
        </p>
      </div>
    </motion.div>
  );
}

// ─── CareDot ─────────────────────────────────────────────────────────────────

interface CareDotProps {
  boundsRef: RefObject<HTMLDivElement>;
  dotX: ReturnType<typeof useMotionValue<number>>;
  dotY: ReturnType<typeof useMotionValue<number>>;
  anchorPct: { x: number; y: number };
  diameterPx: number;
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
    diameterPx,
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
  const tingleVariants = {
    idle: { scale: 1 },
    tingle: {
      scale: [1, 1.25, 0.92, 1.12, 1],
      transition: { duration: 0.65, ease: "easeInOut" as const },
    },
  };

  // Safe fallback size (~20px) if diameterPx is not yet measured
  const dPx = diameterPx > 0 ? diameterPx : 22;

  return (
    <motion.div
      ref={ref}
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none outline-none active:cursor-grabbing z-30"
      style={{
        left: `${anchorPct.x}%`,
        top: `${anchorPct.y}%`,
        x: dotX,
        y: dotY,
        width: `${dPx}px`,
        height: `${dPx}px`,
      }}
      drag
      dragConstraints={boundsRef}
      dragElastic={0.18}
      dragSnapToOrigin
      dragTransition={{ bounceStiffness: 260, bounceDamping: 18 }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.1 }}
      tabIndex={0}
      role="button"
      aria-label="Explore Doceeto care network"
      aria-describedby={descId}
      aria-pressed={isInteracting}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      <motion.div
        variants={reducedMotion ? {} : tingleVariants}
        animate={
          reducedMotion
            ? undefined
            : tingle && !isInteracting
              ? "tingle"
              : "idle"
        }
        className="relative h-full w-full"
      >
        {/* Glow halo when dragging */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(201,161,63,0.4) 0%, transparent 70%)",
          }}
          initial={{ scale: 1, opacity: 0 }}
          animate={
            isInteracting
              ? { scale: 2.8, opacity: 1 }
              : { scale: 1, opacity: 0 }
          }
          transition={{ duration: 0.35, ease: "easeOut" }}
        />

        {/* The actual gold dot — exact size matching SVG dot */}
        <div
          className="h-full w-full rounded-full"
          style={{
            background: GOLD,
            boxShadow: isInteracting
              ? `0 0 0 3px rgba(201,161,63,0.3), 0 4px 20px rgba(201,161,63,0.5)`
              : `0 2px 8px rgba(201,161,63,0.35)`,
            transition: "box-shadow 0.3s ease",
          }}
        />
      </motion.div>
    </motion.div>
  );
});
