import styles from "./Badge.module.css";

type BadgeVariant = "success" | "warn" | "danger" | "neutral" | "purple";

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  glow?: boolean;
}

export default function Badge({ variant, children, glow }: BadgeProps) {
  const className = [
    styles.badge,
    styles[variant],
    glow ? styles.glow : "",
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={className}>{children}</span>;
}
