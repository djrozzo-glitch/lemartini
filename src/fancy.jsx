import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

// Adapted from Fancy Components' Basic Number Ticker (Daniel Petho, MIT).
export function NumberTicker({ value }) {
  const count = useMotionValue(value);
  const rounded = useTransform(count, current => "$" + Math.round(current));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      count.jump(value);
      return;
    }
    const animation = animate(count, value, { duration: .28, ease: "easeOut" });
    return () => animation.stop();
  }, [count, value, reduced]);
  return <strong id="score" aria-label={"$" + value}><motion.span aria-hidden="true">{rounded}</motion.span></strong>;
}

// Adapted from Fancy Components' Center Underline (Daniel Petho, MIT).
const underline = { hidden: { scaleX: 0 }, visible: { scaleX: 1 } };
export function CenterUnderline({ children, ...props }) {
  return <motion.a {...props} initial="hidden" animate="hidden" whileHover="visible" whileFocus="visible">
    <span className="stream-copy">{children}<motion.span className="stream-underline"
      aria-hidden="true" variants={underline} transition={{ duration: .22, ease: "easeOut" }} /></span>
  </motion.a>;
}
