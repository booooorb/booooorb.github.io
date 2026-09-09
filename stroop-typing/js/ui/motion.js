export function initMotion() {
  const { gsap } = window;
  if (!gsap) return;

  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    gsap.from(".top, .bar", {
      opacity: 0,
      y: 6,
      duration: 0.55,
      stagger: 0.08,
      ease: "power2.out",
      clearProps: "all",
    });
  });

  media.add("(min-width: 641px) and (hover: hover) and (prefers-reduced-motion: no-preference)", (context) => {
    const cleanups = [];
    document.querySelectorAll(".btn").forEach((button) => {
      const enter = context.add(() => {
        if (!button.disabled) gsap.to(button, { y: -1, duration: 0.2, overwrite: true });
      });
      const leave = context.add(() => gsap.to(button, { y: 0, duration: 0.2, overwrite: true }));
      button.addEventListener("pointerenter", enter);
      button.addEventListener("pointerleave", leave);
      button.addEventListener("blur", leave);
      cleanups.push(() => {
        button.removeEventListener("pointerenter", enter);
        button.removeEventListener("pointerleave", leave);
        button.removeEventListener("blur", leave);
      });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  });
}
