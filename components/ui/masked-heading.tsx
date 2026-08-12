"use client";

/**
 * MaskedHeading — heading type used as a window onto a photo or video.
 *
 * From React Bits (reactbits.dev), ported to TypeScript for this codebase.
 * The words are laid out normally but painted transparent; an SVG clipPath
 * traces the same glyphs over the media, so the media is only visible inside
 * the letterforms. Pointer parallax and a slow idle drift move the media
 * behind the mask, which is what makes the letters feel like a window rather
 * than a gradient fill.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
} from "react";
import { gsap } from "gsap";

import "./masked-heading.css";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export type MaskedHeadingProps = {
  /** Heading copy. */
  text?: string;
  /** Element the heading renders as, so it can carry the right semantics. */
  tag?: ElementType;
  /** Whether the source showing through the letters is an image or a looping muted video. */
  mediaType?: "image" | "video";
  /** Image or video URL. */
  src?: string;
  /** Poster frame used while a video loads. */
  poster?: string;
  /** How far the media is zoomed past the heading. The overscan is what parallax travels into. */
  fillScale?: number;
  /** How far the media slides under the letters as the pointer moves, in px. */
  parallax?: number;
  /** Amplitude of the slow idle motion, in px. 0 holds the media still. */
  drift?: number;
  /** Brightness of the media. */
  brightness?: number;
  /** Saturation of the media. */
  saturation?: number;
  /** Render the media in black and white. */
  grayscale?: boolean;
  /** Entrance style: words rise into place, a wipe sweeps across, or the whole block fades up. */
  reveal?: "rise" | "wipe" | "fade" | "none";
  /** When the entrance runs. */
  trigger?: "view" | "mount" | "hover";
  /**
   * With `trigger="view"`, replay the entrance every time the heading comes
   * back into view instead of only the first time. Added on top of the React
   * Bits original, which always plays once.
   */
  replay?: boolean;
  /** Entrance duration, in seconds. */
  duration?: number;
  /** Delay between words, in seconds. Used by the rise reveal. */
  stagger?: number;
  /** Text alignment. */
  align?: "left" | "center" | "right";
  /** Font weight. */
  weight?: number;
  /** Letter spacing, in em. */
  tracking?: number;
  /** Line height. */
  lineHeight?: number;
  /** Type size as a fraction of the container width, so the heading stays responsive. */
  textScale?: number;
  className?: string;
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLElement>, "style" | "className">;

export function MaskedHeading({
  text = "Designed in the details",
  tag = "h2",
  mediaType = "image",
  src = "",
  poster = "",
  fillScale = 1.25,
  parallax = 26,
  drift = 18,
  brightness = 1,
  saturation = 1,
  grayscale = false,
  reveal = "rise",
  duration = 1.1,
  stagger = 0.09,
  trigger = "view",
  replay = false,
  align = "center",
  weight = 700,
  tracking = -0.03,
  lineHeight = 1.06,
  textScale = 0.115,
  className = "",
  style,
  ...rest
}: MaskedHeadingProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const revealRef = useRef<HTMLSpanElement | null>(null);
  const mediaRef = useRef<HTMLSpanElement | null>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const baseRefs = useRef<(HTMLElement | null)[]>([]);
  const glyphRefs = useRef<(SVGTextElement | null)[]>([]);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const offsetRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const clipId = `mh-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const words = useMemo(
    () => String(text).split(/\s+/).filter(Boolean),
    [text],
  );

  const settingsRef = useRef({
    fillScale,
    parallax,
    drift,
    brightness,
    saturation,
    grayscale,
    textScale,
  });
  settingsRef.current = {
    fillScale,
    parallax,
    drift,
    brightness,
    saturation,
    grayscale,
    textScale,
  };

  const place = useCallback(() => {
    const root = rootRef.current;
    const media = mediaRef.current;
    if (!root || !media) return;
    const s = settingsRef.current;
    const W = root.clientWidth;
    const H = root.clientHeight;
    const off = offsetRef.current;

    const maxX = Math.max(0, ((s.fillScale - 1) / 2) * W);
    const maxY = Math.max(0, ((s.fillScale - 1) / 2) * H);

    media.style.transform = `translate3d(${clamp(off.x, -maxX, maxX).toFixed(2)}px, ${clamp(off.y, -maxY, maxY).toFixed(2)}px, 0) scale(${s.fillScale})`;
    media.style.filter = `brightness(${s.brightness}) saturate(${s.saturation})${s.grayscale ? " grayscale(1)" : ""}`;
  }, []);

  const sync = useCallback(() => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!root || !measure) return;
    const s = settingsRef.current;

    root.style.fontSize = `${clamp(root.clientWidth * s.textScale, 20, 200).toFixed(1)}px`;

    const cs = window.getComputedStyle(measure);
    for (let i = 0; i < wordRefs.current.length; i += 1) {
      const box = wordRefs.current[i];
      const base = baseRefs.current[i];
      const glyph = glyphRefs.current[i];
      if (!box || !base || !glyph) continue;
      glyph.setAttribute("x", `${box.offsetLeft}`);
      glyph.setAttribute("y", `${base.offsetTop}`);
      glyph.style.fontFamily = cs.fontFamily;
      glyph.style.fontSize = cs.fontSize;
      glyph.style.fontWeight = cs.fontWeight;
      glyph.style.fontStyle = cs.fontStyle;
      glyph.style.letterSpacing = cs.letterSpacing;
    }
    place();
  }, [place]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(root);
    if (document.fonts?.ready) document.fonts.ready.then(sync).catch(() => {});

    let raf = 0;
    let last = performance.now();
    let clock = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      const s = settingsRef.current;
      const off = offsetRef.current;

      const dx = Math.sin(clock * 0.21) * s.drift;
      const dy = Math.cos(clock * 0.17) * s.drift * 0.6;

      const ease = 1 - Math.exp(-dt / 0.18);
      off.x += (off.tx + dx - off.x) * ease;
      off.y += (off.ty + dy - off.y) * ease;

      place();
      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      const s = settingsRef.current;
      if (s.parallax <= 0) return;
      const r = root.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / (r.width || 1)) * 2 - 1;
      const ny = ((e.clientY - r.top) / (r.height || 1)) * 2 - 1;
      offsetRef.current.tx = clamp(nx, -1, 1) * -s.parallax;
      offsetRef.current.ty = clamp(ny, -1, 1) * -s.parallax;
    };

    const onLeave = () => {
      offsetRef.current.tx = 0;
      offsetRef.current.ty = 0;
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [place, sync]);

  useEffect(() => {
    sync();
  }, [sync, words, tag, align, weight, tracking, lineHeight, textScale]);

  useEffect(() => {
    const root = rootRef.current;
    const layer = revealRef.current;
    if (!root || !layer) return;
    const glyphs = glyphRefs.current.filter(Boolean) as SVGTextElement[];
    if (!glyphs.length) return;

    const riseDistance = () =>
      (parseFloat(window.getComputedStyle(root).fontSize) || 48) * 1.15;

    const settle = () => {
      gsap.set(glyphs, { y: 0 });
      gsap.set(layer, { opacity: 1, scale: 1, clipPath: "inset(0% 0% 0% 0%)" });
    };

    const restState = () => {
      if (reveal === "rise") {
        gsap.set(glyphs, { y: riseDistance() });
      } else if (reveal === "wipe") {
        gsap.set(layer, { clipPath: "inset(0% 100% 0% 0%)" });
      } else if (reveal === "fade") {
        gsap.set(layer, { opacity: 0, scale: 1.08 });
      }
    };

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reveal === "none" || reduce) {
      settle();
      return;
    }

    const play = () => {
      tweenRef.current?.kill();
      if (reveal === "rise") {
        gsap.set(layer, {
          opacity: 1,
          scale: 1,
          clipPath: "inset(0% 0% 0% 0%)",
        });
        tweenRef.current = gsap.fromTo(
          glyphs,
          { y: riseDistance() },
          { y: 0, duration, stagger, ease: "power4.out", overwrite: "auto" },
        );
      } else if (reveal === "wipe") {
        gsap.set(glyphs, { y: 0 });
        const state = { p: 100 };
        tweenRef.current = gsap.to(state, {
          p: 0,
          duration,
          ease: "power3.inOut",
          overwrite: "auto",
          onUpdate: () => {
            layer.style.clipPath = `inset(0% ${state.p}% 0% 0%)`;
          },
        });
      } else {
        gsap.set(glyphs, { y: 0 });
        tweenRef.current = gsap.fromTo(
          layer,
          { opacity: 0, scale: 1.08 },
          {
            opacity: 1,
            scale: 1,
            duration,
            ease: "power3.out",
            overwrite: "auto",
          },
        );
      }
    };

    if (trigger === "hover") {
      settle();
      root.addEventListener("pointerenter", play);
      return () => {
        root.removeEventListener("pointerenter", play);
        tweenRef.current?.kill();
      };
    }

    if (trigger === "view") {
      settle();
      restState();

      // `armed` gates the entrance so it fires once per visit rather than on
      // every threshold crossing. When `replay` is on we re-arm — but only
      // once the heading is FULLY out of view (ratio 0), never at the 0.25
      // play threshold: rewinding while a sliver is still on screen would
      // blank the words at the edge of the viewport on the way past.
      let armed = true;
      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
            if (!armed) return;
            armed = false;
            play();
            if (!replay) io.disconnect();
          } else if (replay && !entry.isIntersecting) {
            armed = true;
            tweenRef.current?.kill();
            restState();
          }
        },
        { threshold: replay ? [0, 0.25] : 0.25 },
      );
      io.observe(root);
      return () => {
        io.disconnect();
        tweenRef.current?.kill();
      };
    }

    play();
    return () => tweenRef.current?.kill();
  }, [reveal, trigger, replay, duration, stagger, words]);

  const Tag = tag as ElementType;

  return (
    <Tag
      ref={rootRef}
      className={`masked-heading ${className}`.trim()}
      style={{
        textAlign: align,
        fontWeight: weight,
        letterSpacing: `${tracking}em`,
        lineHeight,
        ...style,
      }}
      {...rest}
    >
      <span ref={measureRef} className="masked-heading__measure">
        {words.map((word, i) => (
          <span
            key={`${word}-${i}`}
            ref={(el) => {
              wordRefs.current[i] = el;
            }}
            className="masked-heading__word"
          >
            {word}
            <i
              ref={(el) => {
                baseRefs.current[i] = el;
              }}
              className="masked-heading__baseline"
            />
          </span>
        ))}
      </span>

      <svg
        className="masked-heading__defs"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            {words.map((word, i) => (
              <text
                key={`${word}-${i}`}
                ref={(el) => {
                  glyphRefs.current[i] = el;
                }}
              >
                {word}
              </text>
            ))}
          </clipPath>
        </defs>
      </svg>

      <span ref={revealRef} className="masked-heading__reveal">
        <span
          className="masked-heading__clip"
          style={{ clipPath: `url(#${clipId})` }}
        >
          <span ref={mediaRef} className="masked-heading__media">
            {mediaType === "video" ? (
              <video
                className="masked-heading__source"
                src={src}
                poster={poster}
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- the mask
              // needs a plain element it can size to the letterforms; next/image
              // wraps it in its own sized span, which breaks the clip geometry.
              <img
                className="masked-heading__source"
                src={src}
                alt=""
                draggable={false}
              />
            )}
          </span>
        </span>
      </span>
    </Tag>
  );
}

export default MaskedHeading;
