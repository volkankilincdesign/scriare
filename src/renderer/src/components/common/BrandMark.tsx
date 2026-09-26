import logoPrimaryDark from "../../assets/logos/logo-primary-dark.svg";
import logoPrimaryLight from "../../assets/logos/logo-primary-light.svg";
import { isLightGround, useThemeStore } from "../../state/themeStore";

interface BrandMarkProps {
  className?: string;
}

/**
 * The Scriare circular badge mark (from other_materials/logos), swapped
 * between its Dark and Light variants to match the active app theme —
 * replaces the old .font-blackletter-mark typographic "S". Used wherever
 * the logo is rendered in-app (Welcome screen, TopBar); the OS-facing icon
 * (taskbar/window/app icon) is a separate, fixed asset — see build/icon.png
 * and resources/icon.png, generated from logo-icon-dark.svg.
 *
 * WHICH VARIANT (v0.53.0): by the theme's GROUND, not by its name. This
 * asked `theme === "light"` from v0.44.0 until now, which was right for
 * exactly one of the three light-ground themes — daylight and overcast got
 * the dark-theme logo, pale mark on a pale page. See isLightGround.
 */
export function BrandMark({ className }: BrandMarkProps) {
  const theme = useThemeStore((s) => s.theme);
  const src = isLightGround(theme) ? logoPrimaryLight : logoPrimaryDark;
  return <img src={src} alt="" aria-hidden className={className} />;
}
