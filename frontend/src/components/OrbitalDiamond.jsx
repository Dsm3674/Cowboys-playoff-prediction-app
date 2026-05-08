import React, { useId } from "react";

/**
 * OrbitalDiamond — signature decorative illustration for hero and card surfaces.
 *
 * Three concentric ellipses, a central four-point diamond, and three labeled
 * nodes orbiting the rings. The component is intentionally data-light and
 * purely presentational so it can be dropped into any React surface.
 */
function OrbitalDiamond({
  size = 600,
  labels = ["Content", "Ads", "Outreach"],
  glow = "navy",
  ringColor = "cream",
  labelColor = "cream",
  animated = true,
  className = "",
  style = {},
}) {
  const gradientId = `orbital-glow-${useId().replace(/:/g, "")}`;

  const colors = {
    cream: "#F4EFE6",
    ink: "#0A0A0A",
    navy: "#003594",
    electric: "#1F2BFF",
    muted: "rgba(244,239,230,0.55)",
  };

  const ring = colors[ringColor] || colors.cream;
  const label = colors[labelColor] || colors.cream;
  const glowColor = glow === "none" ? null : colors[glow] || colors.navy;

  const nodes = [
    { x: 240, y: -95, label: labels[0] || "" },
    { x: 335, y: 25, label: labels[1] || "" },
    { x: 230, y: 150, label: labels[2] || "" },
  ];

  return (
    <svg
      className={`orbital-diamond ${animated ? "is-animated" : ""} ${className}`.trim()}
      style={style}
      width={size}
      height={size * 0.75}
      viewBox="0 0 800 600"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      {glowColor && (
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={glowColor} stopOpacity="0.85" />
            <stop offset="55%" stopColor={glowColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
          </radialGradient>
        </defs>
      )}

      <g transform="translate(400 300)">
        <g className="orbital-diamond__orbit" transform="rotate(-20)">
          {glowColor && (
            <ellipse cx="0" cy="0" rx="280" ry="180" fill={`url(#${gradientId})`} opacity="0.6" />
          )}

          <ellipse cx="0" cy="0" rx="340" ry="220" fill="none" stroke={ring} strokeOpacity="0.18" strokeWidth="1" />
          <ellipse cx="0" cy="0" rx="270" ry="175" fill="none" stroke={ring} strokeOpacity="0.18" strokeWidth="1" />
          <ellipse cx="0" cy="0" rx="195" ry="125" fill="none" stroke={ring} strokeOpacity="0.18" strokeWidth="1" />

          {nodes.map((node, index) => (
            <g key={`${node.x}-${node.y}-${index}`}>
              <circle cx={node.x} cy={node.y} r="3" fill={ring} />
              {node.label && (
                <text
                  x={node.x + 12}
                  y={node.y + 4}
                  fill={label}
                  fontSize="13"
                  fontFamily="'Geist', 'Manrope', system-ui, sans-serif"
                  fontWeight="500"
                  letterSpacing="0.02em"
                >
                  {node.label}
                </text>
              )}
            </g>
          ))}

          <path d="M 0 -22 L 8 0 L 0 22 L -8 0 Z" fill={ring} />
        </g>
      </g>

      <g className="orbital-diamond__sparkles" fill={ring} opacity="0.35">
        <text x="40" y="60" fontSize="14" fontFamily="'Geist', 'Manrope', system-ui, sans-serif">+</text>
        <text x="720" y="120" fontSize="14" fontFamily="'Geist', 'Manrope', system-ui, sans-serif">+</text>
        <text x="60" y="540" fontSize="14" fontFamily="'Geist', 'Manrope', system-ui, sans-serif">+</text>
        <text x="760" y="500" fontSize="14" fontFamily="'Geist', 'Manrope', system-ui, sans-serif">+</text>
      </g>
    </svg>
  );
}

export default OrbitalDiamond;
