"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function HomepageClientInteractions() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const dashboardHref =
        user.role === "superadmin" ||
        user.role === "admin" ||
        user.role === "subadmin"
          ? "/admin"
          : "/documents";
      document.querySelectorAll('a[href="/login"]').forEach((el) => {
        el.setAttribute("href", dashboardHref);
        el.textContent = "Dashboard";
      });
    }
  }, [user]);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 1. Vaultline reveal motion
    const revealTargets = document.querySelectorAll<HTMLElement>(
      "main section, body > x-dc section, x-dc section, section#services .vl-card, section#team .vl-card, #foundations > div, #press > div"
    );

    let revealObserver: IntersectionObserver | null = null;
    if (!reduceMotion && "IntersectionObserver" in window) {
      revealTargets.forEach((el, index) => {
        if (!el.classList.contains("vl-reveal")) {
          el.classList.add("vl-reveal");
          el.style.setProperty("--vl-delay", (index % 4) * 85 + "ms");
        }
      });

      revealObserver = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("vl-visible");
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -35px 0px" }
      );

      revealTargets.forEach((el) => revealObserver?.observe(el));
    } else {
      revealTargets.forEach((el) => el.classList.add("vl-visible"));
    }

    // 2. Process section reveal motion
    const processSection = document.querySelector<HTMLElement>(
      "section.vl-process-motion"
    );
    let processObserver: IntersectionObserver | null = null;
    if (processSection) {
      if (reduceMotion || !("IntersectionObserver" in window)) {
        processSection.classList.add("vl-process-visible");
      } else {
        processObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                processSection.classList.add("vl-process-visible");
                processObserver?.disconnect();
              }
            });
          },
          { threshold: 0.18 }
        );
        processObserver.observe(processSection);
      }
    }

    return () => {
      revealObserver?.disconnect();
      processObserver?.disconnect();
    };
  }, []);

  return null;
}

