import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const adminRoot = join(root, "apps/admin/src");
const uiRoot = join(root, "packages/cms-ui/src");
const failures = [];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    if (!/\.(tsx|ts)$/.test(name) || /\.test\./.test(name)) return [];
    return [path];
  });
}

function fail(file, rule, detail) {
  failures.push(`${relative(root, file)} — ${rule}: ${detail}`);
}

const paletteClass =
  /\b(?:text|bg|border|ring|outline|fill|stroke)-(?:red|blue|amber|green|purple|slate|gray|zinc|neutral|stone|black|white)(?:-|\/|\b)/g;
const rawControl = /<(button|select|textarea|dialog)\b/g;
const rawInput = /<input\b[\s\S]*?>/g;
const arbitraryRadius = /\brounded(?:-[trblxyse]{1,2})?-\[[^\]]+\]/g;
const arbitraryCoreBreakpoint = /(?:min|max)-\[(?:560|860|1280|1480)px\]:/g;
const outOfSystemDuration = /\bduration-(?:75|100|200|300|500|700|1000)\b/g;

for (const file of walk(adminRoot)) {
  const source = readFileSync(file, "utf8");

  for (const match of source.matchAll(paletteClass)) {
    fail(file, "cor direta", match[0]);
  }
  for (const match of source.matchAll(rawControl)) {
    fail(file, "controle HTML ad-hoc", `<${match[1]}>`);
  }
  for (const match of source.matchAll(rawInput)) {
    if (!/type\s*=\s*["']hidden["']/.test(match[0])) {
      fail(
        file,
        "input HTML ad-hoc",
        match[0].replace(/\s+/g, " ").slice(0, 100),
      );
    }
  }
  if (/\btext-xs\b/.test(source)) {
    fail(file, "tipografia fora dos tokens", "text-xs");
  }
  for (const match of source.matchAll(arbitraryRadius)) {
    fail(file, "radius arbitrário", match[0]);
  }
  for (const match of source.matchAll(arbitraryCoreBreakpoint)) {
    fail(file, "breakpoint central arbitrário", match[0]);
  }
  for (const match of source.matchAll(outOfSystemDuration)) {
    fail(file, "motion fora de 120–180ms", match[0]);
  }
  if (source.includes('role="dialog"') || source.includes("<dialog")) {
    fail(file, "dialog ad-hoc", "use Dialog/Sheet de @nite/cms-ui");
  }
}

// Primitives may render native controls internally, but their styling must still be tokenized.
for (const file of walk(uiRoot)) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(paletteClass)) {
    fail(file, "cor direta no primitive", match[0]);
  }
  if (/\btext-xs\b/.test(source)) {
    fail(file, "tipografia fora dos tokens no primitive", "text-xs");
  }
  for (const match of source.matchAll(arbitraryRadius)) {
    fail(file, "radius arbitrário no primitive", match[0]);
  }
  for (const match of source.matchAll(outOfSystemDuration)) {
    fail(file, "motion fora de 120–180ms no primitive", match[0]);
  }
}

function mustContain(file, fragments) {
  const source = readFileSync(join(root, file), "utf8");
  for (const fragment of fragments) {
    if (!source.includes(fragment))
      fail(join(root, file), "contrato v0.1 ausente", fragment);
  }
}

mustContain("packages/cms-ui/src/theme.css", [
  "--canvas: #f7f8fa;",
  "--surface: #ffffff;",
  "--border: #d9dee5;",
  "--text-primary: #171a1f;",
  "--text-muted: #68717c;",
  "--nite-brand-blue: #1d4ed8;",
  "--success: #18794e;",
  "--warning: #a15c00;",
  "--danger: #c93434;",
  "--breakpoint-mobile: 35rem;",
  "--breakpoint-editor-stack: 53.75rem;",
  "--breakpoint-inspector-rail: 80rem;",
  "--breakpoint-wide-editor: 92.5rem;",
  "--text-ui-md: 0.875rem;",
  "--text-editor-body: 1.125rem;",
  "--text-editor-summary: 1.125rem;",
  "--text-editor-title: 2.5rem;",
  "--radius-md: 8px;",
  "--motion-duration-fast: 120ms;",
  "--motion-duration-normal: 160ms;",
  "@media (prefers-reduced-motion: reduce)",
]);

mustContain("apps/admin/src/components/workspace-shell.tsx", [
  "md:[--workspace-sidebar-width:248px]",
  "inspector-rail:[--workspace-sidebar-width:248px]",
]);

mustContain("apps/admin/src/components/editor/editor-canvas.tsx", [
  "max-w-[760px]",
  "font-editorial text-editor-title",
  "font-editorial text-editor-summary",
  "max-w-[72ch]",
]);

mustContain("apps/admin/src/components/editor/editor-toolbar.tsx", [
  "Toolbar",
  "ToolbarGroup",
  "ToolbarButton",
  "ToolbarSeparator",
]);

mustContain("apps/admin/src/components/article-editor.tsx", [
  "inspector-rail:grid",
  "SheetContent",
  'side={inspectorMode === "sheet" ? "bottom" : "right"}',
]);

mustContain("apps/admin/src/app/(workspace)/page.tsx", [
  "<Table>",
  "<ArticleRowActions",
  'className="h-14 min-h-14"',
]);

const uiIndex = readFileSync(
  join(root, "packages/cms-ui/src/index.ts"),
  "utf8",
);
for (const moduleName of [
  "alert",
  "avatar",
  "badge",
  "button",
  "checkbox",
  "dialog",
  "dropdown-menu",
  "empty-state",
  "field",
  "icon-button",
  "input",
  "popover",
  "radio",
  "select",
  "separator",
  "sheet",
  "skeleton",
  "spinner",
  "status-badge",
  "switch",
  "table",
  "tabs",
  "textarea",
  "toolbar",
  "tooltip",
]) {
  if (!uiIndex.includes(`export * from "./${moduleName}";`)) {
    fail(
      join(root, "packages/cms-ui/src/index.ts"),
      "primitive não exportado",
      moduleName,
    );
  }
}

if (failures.length > 0) {
  console.error("Design System v0.1: violações encontradas:\n");
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Design System v0.1: governança estática aprovada.");
