import { en, id } from "./locales.js";
import { system } from "@minecraft/server";

const D = { en, id };

const L = (p) =>
  p?.getTags?.().find((t) => t.startsWith("lang:"))?.split(":")[1] || "en";

export const Lang = {
  t: (p, k, ...a) => {
    let s = D[L(p)]?.[k] ?? D.en[k] ?? k;
    a.forEach((x) => (s = s.replace("%s", x)));
    return s;
  },
  set: (p, l) => {
    if (!D[l]) return false;
    
    system.run(() => {
      try {
        const tags = p.getTags();
        for (const t of tags) {
          if (t.startsWith("lang:")) {
            p.removeTag(t);
          }
        }
        p.addTag(`lang:${l}`);
      } catch (e) {
        console.warn("Failed to set language tag:", e);
      }
    });
    
    return true;
  },
};
