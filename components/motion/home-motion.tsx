"use client";

import { useEffect } from "react";

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

type Cleanup = () => void;

function addTilt(card: HTMLElement): Cleanup {
  let frame = 0;
  let nextX = 0;
  let nextY = 0;

  const apply = () => {
    frame = 0;
    card.style.setProperty("--tilt-x", `${nextY * -5}deg`);
    card.style.setProperty("--tilt-y", `${nextX * 5}deg`);
    card.style.setProperty("--spotlight-x", `${(nextX + 1) * 50}%`);
    card.style.setProperty("--spotlight-y", `${(nextY + 1) * 50}%`);
  };

  const onMove = (event: PointerEvent) => {
    const bounds = card.getBoundingClientRect();
    nextX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    nextY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    if (!frame) frame = window.requestAnimationFrame(apply);
  };

  const reset = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    card.style.setProperty("--tilt-x", "0deg");
    card.style.setProperty("--tilt-y", "0deg");
    card.style.setProperty("--spotlight-x", "50%");
    card.style.setProperty("--spotlight-y", "50%");
  };

  card.addEventListener("pointermove", onMove, { passive: true });
  card.addEventListener("pointerleave", reset, { passive: true });
  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    card.removeEventListener("pointermove", onMove);
    card.removeEventListener("pointerleave", reset);
    card.removeAttribute("data-motion-tilt");
    ["--tilt-x", "--tilt-y", "--spotlight-x", "--spotlight-y"].forEach((property) => card.style.removeProperty(property));
  };
}

function addMagnetic(element: HTMLElement): Cleanup {
  let frame = 0;
  let offsetX = 0;
  let offsetY = 0;

  const apply = () => {
    frame = 0;
    element.style.setProperty("--magnetic-x", `${offsetX}px`);
    element.style.setProperty("--magnetic-y", `${offsetY}px`);
  };

  const onMove = (event: PointerEvent) => {
    const bounds = element.getBoundingClientRect();
    offsetX = (event.clientX - (bounds.left + bounds.width / 2)) * 0.12;
    offsetY = (event.clientY - (bounds.top + bounds.height / 2)) * 0.12;
    if (!frame) frame = window.requestAnimationFrame(apply);
  };

  const reset = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    offsetX = 0;
    offsetY = 0;
    element.style.setProperty("--magnetic-x", "0px");
    element.style.setProperty("--magnetic-y", "0px");
  };

  element.addEventListener("pointermove", onMove, { passive: true });
  element.addEventListener("pointerleave", reset, { passive: true });
  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("pointerleave", reset);
    element.removeAttribute("data-motion-magnetic");
    element.style.removeProperty("--magnetic-x");
    element.style.removeProperty("--magnetic-y");
  };
}

/**
 * Presentation-only motion for the existing legacy homepage. It writes CSS
 * variables directly, so pointer movement never triggers React re-renders.
 */
export function HomeMotion() {
  useEffect(() => {
    const html = document.documentElement;
    const hero = document.querySelector<HTMLElement>(".legacy-page .home-hero");
    const pointerGlow = document.querySelector<HTMLElement>(".home-pointer-glow");
    const finePointer = window.matchMedia(FINE_POINTER);
    const reducedMotion = window.matchMedia(REDUCED_MOTION);
    const cleanups: Cleanup[] = [];
    let revealObserver: IntersectionObserver | null = null;
    let heroFrame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let glowX = -200;
    let glowY = -200;

    const resetMotion = () => {
      html.classList.remove("home-motion-active");
      hero?.removeAttribute("data-hero-active");
      hero?.style.removeProperty("--hero-x");
      hero?.style.removeProperty("--hero-y");
    };

    const allowsPointerMotion = () => finePointer.matches && window.innerWidth > 900;

    if (reducedMotion.matches) {
      html.classList.add("home-motion-reduced");
      return () => html.classList.remove("home-motion-reduced");
    }

    html.classList.add("home-motion-active");
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>(
      ".legacy-page .home-hero, .legacy-page .quick-stats, .legacy-page .section, .home-v2-preview .home-v2-section",
    ));

    revealTargets.forEach((element, index) => {
      element.dataset.homeReveal = index === 0 ? "hero" : "section";
    });

    if ("IntersectionObserver" in window) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).dataset.homeRevealed = "true";
          revealObserver?.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -10%", threshold: 0.12 });
      revealTargets.forEach((element) => revealObserver?.observe(element));
    } else {
      revealTargets.forEach((element) => { element.dataset.homeRevealed = "true"; });
    }

    const cards = Array.from(document.querySelectorAll<HTMLElement>(
      ".legacy-page .route-card, .home-v2-preview [data-home-card]",
    ));
    cards.forEach((card, index) => {
      card.dataset.motionTilt = "true";
      card.style.setProperty("--motion-index", String(index));
      if (allowsPointerMotion()) cleanups.push(addTilt(card));
    });

    const magneticTargets = Array.from(document.querySelectorAll<HTMLElement>(
      ".legacy-page .hero-actions .btn, .home-v2-preview [data-home-magnetic]",
    ));
    if (allowsPointerMotion()) {
      magneticTargets.forEach((element) => {
        element.dataset.motionMagnetic = "true";
        cleanups.push(addMagnetic(element));
      });
    }

    const updateHero = () => {
      heroFrame = 0;
      if (!hero) return;
      hero.style.setProperty("--hero-x", String(pointerX));
      hero.style.setProperty("--hero-y", String(pointerY));
      pointerGlow?.style.setProperty("transform", `translate3d(${glowX}px, ${glowY}px, 0)`);
    };

    const onHeroMove = (event: PointerEvent) => {
      if (!hero || !allowsPointerMotion()) return;
      const bounds = hero.getBoundingClientRect();
      pointerX = (event.clientX - (bounds.left + bounds.width / 2)) / bounds.width;
      pointerY = (event.clientY - (bounds.top + bounds.height / 2)) / bounds.height;
      glowX = event.clientX;
      glowY = event.clientY;
      hero.dataset.heroActive = "true";
      pointerGlow?.style.setProperty("opacity", "1");
      if (!heroFrame) heroFrame = window.requestAnimationFrame(updateHero);
    };

    const onHeroLeave = () => {
      if (!hero) return;
      pointerX = 0;
      pointerY = 0;
      hero.removeAttribute("data-hero-active");
      pointerGlow?.style.setProperty("opacity", "0");
      if (!heroFrame) heroFrame = window.requestAnimationFrame(updateHero);
    };

    hero?.addEventListener("pointermove", onHeroMove, { passive: true });
    hero?.addEventListener("pointerleave", onHeroLeave, { passive: true });
    cleanups.push(() => {
      if (heroFrame) window.cancelAnimationFrame(heroFrame);
      hero?.removeEventListener("pointermove", onHeroMove);
      hero?.removeEventListener("pointerleave", onHeroLeave);
    });

    const onPreferenceChange = () => window.location.reload();
    reducedMotion.addEventListener("change", onPreferenceChange);
    cleanups.push(() => reducedMotion.removeEventListener("change", onPreferenceChange));

    return () => {
      revealObserver?.disconnect();
      revealTargets.forEach((element) => {
        element.removeAttribute("data-home-reveal");
        element.removeAttribute("data-home-revealed");
      });
      cards.forEach((card) => {
        card.style.removeProperty("--motion-index");
        card.removeAttribute("data-motion-tilt");
      });
      cleanups.forEach((cleanup) => cleanup());
      resetMotion();
      pointerGlow?.style.removeProperty("transform");
      pointerGlow?.style.removeProperty("opacity");
    };
  }, []);

  return <div className="home-pointer-glow" aria-hidden="true" />;
}
