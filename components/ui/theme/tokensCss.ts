/**
 * The design tokens as CSS custom properties, generated from DESIGN_TOKENS so the two can
 * never disagree. The Vite plugin (designTokensCss, below) serves it as the virtual module
 * `virtual:design-tokens.css`, which main.tsx loads before the base styles. Palette colours
 * are not here: preferences.ts sets them on :root at runtime from the member's appearance.
 */
import { DESIGN_TOKENS } from "./designTokens";

type Tokens = typeof DESIGN_TOKENS;

const px = (n: number) => `${n}px`;
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** CSS name of each layout token. Every key of DESIGN_TOKENS.layout is named here. */
export const LAYOUT_NAMES: Record<keyof Tokens["layout"], string> = {
  mobileBreakpoint: "bp-mobile", desktopBreakpoint: "bp-desktop",
  railExpanded: "rail-expanded", railCollapsed: "rail-collapsed", topbarHeight: "topbar-height",
  moduleNavWidth: "module-nav-width", moduleNavCompactWidth: "module-nav-compact", contentMinWidth: "content-min",
  desktopGutter: "gutter-desktop", desktopWideGutter: "gutter-desktop-wide", mobileGutter: "gutter-mobile",
  maxWorkspaceWidth: "max-workspace", panelPaddingDesktop: "panel-pad-desktop", panelPaddingMobile: "panel-pad-mobile",
  headerToContentGap: "header-content-gap", toolbarToRecordsGap: "toolbar-records-gap", sectionGap: "section-gap",
  fieldGap: "field-gap", labelToControlGap: "label-control-gap",
  tableMinContentWidth: "table-min-content", tableRowHeight: "table-row-height", recordRowMinHeight: "record-row-min",
  bottomNavHeight: "bottom-nav-height", creationDisc: "creation-disc", launcherClearance: "launcher-clearance",
  floatingActionContentClearance: "floating-action-clearance",
};

/** CSS name of each control token. */
export const CONTROL_NAMES: Record<keyof Tokens["control"], string> = {
  desktopHeight: "control-height", desktopIconTarget: "control-icon-target", mobileMinTarget: "control-mobile-target",
  shortWidth: "control-short", mediumWidth: "control-medium", longWidth: "control-long", maxMultilineWidth: "control-max-multiline",
};

/** CSS name of each typography role. */
export const TEXT_NAMES: Record<"largeBody" | "desktopBody" | "mobileBody" | "metadata" | "pageHeading" | "overviewHeading" | "sectionHeading" | "overlayHeading" | "metric", string> = {
  largeBody: "text-body-large", desktopBody: "text-body-desktop", mobileBody: "text-body-mobile", metadata: "text-metadata",
  pageHeading: "text-page-heading", overviewHeading: "text-overview-heading", sectionHeading: "text-section-heading",
  overlayHeading: "text-overlay-heading", metric: "text-metric",
};

/** The custom properties, name to value, in the order the stylesheet lists them. */
export function tokenProperties(tokens: Tokens = DESIGN_TOKENS): [string, string][] {
  const out: [string, string][] = [];
  const t = tokens.typography;
  out.push(["font-family", t.family], ["font-regular", String(t.regular)], ["font-medium", String(t.medium)],
    ["font-semibold", String(t.semibold)], ["font-bold", String(t.bold)]);
  for (const [role, name] of Object.entries(TEXT_NAMES) as [keyof typeof TEXT_NAMES, string][]) {
    const r = t[role] as { size: number; line: number; weight?: number };
    out.push([name, `${r.weight ? `${r.weight} ` : ""}${r.size}px/${r.line}px var(--font-family)`]);
  }
  out.push(["shadow-panel", tokens.shadow.panel], ["shadow-control", tokens.shadow.control],
    ["shadow-overlay", tokens.shadow.overlay], ["scrim", tokens.shadow.scrim]);
  for (const step of tokens.spacing) out.push([`sp-${step / 4}`, px(step)]);
  for (const [key, value] of Object.entries(tokens.radius)) out.push([`radius-${kebab(key)}`, px(value)]);
  out.push(["icon-inline", px(tokens.icons.inline)], ["icon-standard", px(tokens.icons.standard)],
    ["icon-navigation", px(tokens.icons.navigation)], ["icon-stroke", String(tokens.icons.strokeWidth)]);
  for (const [key, name] of Object.entries(CONTROL_NAMES) as [keyof Tokens["control"], string][]) out.push([name, px(tokens.control[key])]);
  for (const [key, name] of Object.entries(LAYOUT_NAMES) as [keyof Tokens["layout"], string][]) out.push([name, px(tokens.layout[key])]);
  out.push(["mobile-dock-inset", "var(--sp-3)"], ["mobile-dock-bottom", "max(var(--mobile-dock-inset), env(safe-area-inset-bottom, 0px))"]);
  const o = tokens.overlay;
  out.push(["drawer-width", px(o.drawerDefaultWidth)], ["drawer-min", px(o.drawerMinWidth)], ["drawer-max", px(o.drawerMaxWidth)],
    ["sheet-max-vh", `${o.sheetMaxViewportPercent}dvh`], ["menu-max-vh", `${o.menuMaxViewportPercent}dvh`]);
  out.push(["motion-state", `${tokens.motion.stateMs}ms`], ["motion-overlay", `${tokens.motion.overlayMs}ms`], ["motion-max", `${tokens.motion.maxMs}ms`]);
  for (const [key, value] of Object.entries(tokens.layers)) out.push([`z-${kebab(key)}`, String(value)]);
  out.push(["focus-width", px(tokens.validation.focusWidth)], ["focus-offset", px(tokens.validation.focusOffset)]);
  for (const [key, value] of Object.entries(tokens.expressive)) out.push([`expressive-${kebab(key)}`, value]);
  return out;
}

/** The stylesheet: the properties on :root, and motion reduced to nothing on request. */
export function tokensCss(tokens: Tokens = DESIGN_TOKENS): string {
  const lines = tokenProperties(tokens).map(([name, value]) => `  --${name}: ${value};`);
  const mobile = Object.entries(tokens.mobileTypography).map(([role, r]) =>
    `    --${TEXT_NAMES[role as keyof typeof tokens.mobileTypography]}: ${r.weight} ${r.size}px/${r.line}px var(--font-family);`);
  const reduced = (["motion-state", "motion-overlay", "motion-max"] as const).map((name) => `    --${name}: ${tokens.motion.reducedMs}ms;`);
  return `/* Generated from src/theme/designTokens.ts (tokensCss.ts). Do not edit. */\n:root {\n${lines.join("\n")}\n}\n\n@media (max-width: ${tokens.layout.mobileBreakpoint - 1}px) {\n  :root {\n${mobile.join("\n")}\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  :root {\n${reduced.join("\n")}\n  }\n}\n`;
}

const VIRTUAL_ID = "virtual:design-tokens.css";
const RESOLVED_ID = "\0virtual:design-tokens.css";

/** The Vite plugin that serves tokensCss() as `virtual:design-tokens.css`. */
export function designTokensCss() {
  return {
    name: "andishi-design-tokens",
    resolveId(id: string) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id: string) {
      return id === RESOLVED_ID ? tokensCss() : undefined;
    },
  };
}
