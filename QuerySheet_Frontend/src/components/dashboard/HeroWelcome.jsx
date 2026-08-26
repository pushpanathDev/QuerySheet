import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260329_050842_be71947f-f16e-4a14-810c-06e83d23ddb5.mp4";

const FADE_MS = 250;
// Begin fading out when this many seconds remain before the clip ends.
const FADE_OUT_LEAD = 0.55;
const FONT_FUSTAT = "'Fustat', sans-serif";
const FONT_INTER = "'Inter', sans-serif";
const FONT_SCHIBSTED = "'Schibsted Grotesk', sans-serif";

/**
 * Looping video background with a JavaScript (requestAnimationFrame) fade system.
 *
 * Why not CSS transitions: the loop boundary needs the fade-out to start exactly
 * FADE_OUT_LEAD seconds before the end and the fade-in to resume from whatever
 * opacity is current (no snapping). A rAF tween gives us that precise control and
 * lets each new fade cancel the previous one mid-flight.
 */
function VideoBackground() {
  const videoRef = useRef(null);
  const rafRef = useRef(0);
  const restartTimerRef = useRef(0);
  const opacityRef = useRef(0);
  const fadingOutRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Tween current opacity → target over `duration`, cancelling any running tween.
    function animateOpacity(target, duration) {
      cancelAnimationFrame(rafRef.current);
      const start = opacityRef.current;
      const startTime = performance.now();

      const step = (now) => {
        const t = duration <= 0 ? 1 : Math.min((now - startTime) / duration, 1);
        const value = start + (target - start) * t;
        opacityRef.current = value;
        if (videoRef.current) videoRef.current.style.opacity = String(value);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        }
      };
      rafRef.current = requestAnimationFrame(step);
    }

    // Fires on initial autoplay AND after each manual restart → fade in.
    function handlePlaying() {
      fadingOutRef.current = false;
      animateOpacity(1, FADE_MS);
    }

    // Start fading out FADE_OUT_LEAD seconds before the end, exactly once per loop.
    function handleTimeUpdate() {
      const v = videoRef.current;
      if (!v || !Number.isFinite(v.duration)) return;
      const remaining = v.duration - v.currentTime;
      if (remaining <= FADE_OUT_LEAD && !fadingOutRef.current) {
        fadingOutRef.current = true;
        animateOpacity(0, FADE_MS);
      }
    }

    // Manual loop: hard-zero opacity, pause briefly, rewind, replay, fade back in.
    function handleEnded() {
      cancelAnimationFrame(rafRef.current);
      opacityRef.current = 0;
      if (videoRef.current) videoRef.current.style.opacity = "0";
      restartTimerRef.current = window.setTimeout(() => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = 0;
        fadingOutRef.current = false;
        v.play().catch(() => {});
      }, 100);
    }

    video.addEventListener("playing", handlePlaying);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    video.play().catch(() => {
      // Autoplay blocked (rare for muted video) — reveal a static frame instead.
      opacityRef.current = 1;
      if (videoRef.current) videoRef.current.style.opacity = "1";
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(restartTimerRef.current);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <video
        ref={videoRef}
        src={VIDEO_URL}
        muted
        autoPlay
        playsInline
        preload="auto"
        className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top"
        style={{ width: "115%", height: "115%", opacity: 0 }}
      />
      {/* Soft light wash keeps black headline text readable over any frame. */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/20 to-white/45" />
    </div>
  );
}

function StarIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2l2.4 6.3L21 9.2l-5 4.3L17.6 20 12 16.5 6.4 20 8 13.5 3 9.2l6.6-.9z" />
    </svg>
  );
}

function SparkleIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2l1.6 4.8L18 8.4l-4.4 1.6L12 15l-1.6-5L6 8.4l4.4-1.6L12 2zM19 14l.9 2.6L22.5 17.5l-2.6.9L19 21l-.9-2.6L15.5 17.5l2.6-.9L19 14z" />
    </svg>
  );
}

function ArrowUpIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.2}
        d="M12 19V5M5 12l7-7 7 7"
      />
    </svg>
  );
}

function AttachIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3 3 0 014.24 4.24l-9.2 9.19a1 1 0 01-1.41-1.41l8.49-8.49"
      />
    </svg>
  );
}

function HistoryIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3 3v5h5M3.05 13A9 9 0 106 5.3L3 8m9-1v5l3 2"
      />
    </svg>
  );
}

/**
 * Post-login welcome hero shown on the Dashboard when no analysis is loaded.
 * The video background and fade system follow the supplied design; the content
 * is adapted to QuerySheet (upload-first flow, no marketing nav / credits).
 */
export default function HeroWelcome() {
  const navigate = useNavigate();

  // No dataset exists in this state, so the primary action funnels to upload.
  function goUpload() {
    navigate("/upload");
  }

  return (
    <div className="relative w-full min-h-[calc(100vh-3.5rem)] flex items-center justify-center overflow-hidden">
      <VideoBackground />

      {/* Hero content */}
      <div className="relative z-10 flex flex-col items-center px-6 -mt-[50px] w-full">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 bg-white/80 backdrop-blur rounded-full pl-1.5 pr-3 py-1.5 shadow-sm ring-1 ring-black/5"
          style={{ fontFamily: FONT_INTER }}
        >
          <span className="inline-flex items-center gap-1 bg-[#0e1311] text-white text-xs font-medium rounded-full px-2 py-0.5">
            <StarIcon className="w-3 h-3 text-amber-300" />
            New
          </span>
          <span className="text-sm text-[#0e1311]">
            Turn spreadsheets into insights
          </span>
        </div>

        {/* Headline */}
        <h1
          className="text-center text-black mt-[34px]"
          style={{
            fontFamily: FONT_FUSTAT,
            fontWeight: 700,
            fontSize: "clamp(40px, 8vw, 80px)",
            letterSpacing: "-0.06em",
            lineHeight: 1,
          }}
        >
          Transform Data Quickly
        </h1>

        {/* Subtitle */}
        <p
          className="text-center mt-[34px] max-w-[542px]"
          style={{
            fontFamily: FONT_FUSTAT,
            fontWeight: 500,
            fontSize: 20,
            letterSpacing: "-0.02em",
            color: "#505050",
          }}
        >
          Upload your information and get powerful insights right away. Work
          smarter and achieve goals effortlessly.
        </p>

        {/* Glass action card — a clear "get started" CTA (no free-text box: there
            is no dataset to query yet, so the primary action is to upload). */}
        <div
          className="mt-[44px] w-full max-w-[560px] rounded-[18px] p-3.5 backdrop-blur-md ring-1 ring-white/10 shadow-2xl"
          style={{ background: "rgba(0,0,0,0.24)" }}
        >
          {/* Top row — AI attribution */}
          <div className="flex items-center justify-between px-1 pb-2.5">
            <span
              className="text-white/70"
              style={{
                fontFamily: FONT_SCHIBSTED,
                fontWeight: 500,
                fontSize: 12,
              }}
            >
              Get started
            </span>
            <span
              className="inline-flex items-center gap-1.5 text-white/90"
              style={{
                fontFamily: FONT_SCHIBSTED,
                fontWeight: 500,
                fontSize: 12,
              }}
            >
              <SparkleIcon className="w-3.5 h-3.5 text-white/90" />
              AI-powered analysis
            </span>
          </div>

          {/* Primary CTA — the whole bar is the upload action */}
          <button
            type="button"
            onClick={goUpload}
            aria-label="Upload your data to begin"
            className="group w-full flex items-center justify-between gap-3 bg-white rounded-[12px] shadow px-4 py-3.5 hover:shadow-lg transition-shadow"
          >
            <span
              className="inline-flex items-center gap-2.5 text-[15px] font-medium"
              style={{ color: "rgba(0,0,0,0.85)" }}
            >
              <AttachIcon className="w-4 h-4" />
              Upload your data to begin
            </span>
            <span className="shrink-0 w-9 h-9 rounded-full bg-black text-white flex items-center justify-center group-hover:bg-gray-800 transition-colors">
              <ArrowUpIcon className="w-4 h-4 rotate-90" />
            </span>
          </button>

          {/* Bottom row */}
          <div className="flex items-center justify-between px-1 pt-2.5">
            <button
              type="button"
              onClick={() => navigate("/history")}
              className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs rounded-[6px] px-2.5 py-1.5 transition-colors"
              style={{ fontFamily: FONT_SCHIBSTED, fontWeight: 500 }}
            >
              <HistoryIcon className="w-3.5 h-3.5" />
              View history
            </button>
            <span
              className="text-white/55"
              style={{
                fontFamily: FONT_SCHIBSTED,
                fontWeight: 500,
                fontSize: 12,
              }}
            >
              CSV, Excel · up to 5 MB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
