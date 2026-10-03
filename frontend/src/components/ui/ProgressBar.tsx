import { motion, useReducedMotion } from "framer-motion";
export function ProgressBar({
  value,
  max = 70,
  tone = "blue",
  label = "Cycle hours used",
}: {
  value: number;
  max?: number;
  tone?: string;
  label?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className={`progress-track ${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(max, Math.max(0, value))}
      aria-valuetext={`${value} of ${max} hours`}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{
          width: `${Math.min(100, Math.max(0, (value / max) * 100))}%`,
        }}
        transition={{ duration: reduced ? 0 : 0.7 }}
      />
    </div>
  );
}
