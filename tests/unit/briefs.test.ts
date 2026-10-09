import { describe, expect, it } from "vitest";
import { checkBrief, compareWithGitHub, githubRefs } from "../../scripts/check-briefs.mjs";
import { markMerged } from "../../scripts/mark-brief-merged.mjs";

const R = "https://github.com/o/r";
const ok =
  `_Status: in review · Updated: 2026-10-05 · Issue: [#7](${R}/issues/7) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#9](${R}/pull/9)_`;
const brief = (line: string) => `# Titulo\n${line}\n\n## Problema\n`;
const dir = "tests/fixtures/briefs"; // sin spec.md ni tech.md: se prueban con Spec/Tech ausentes

describe("checkBrief", () => {
  it("acepta la línea canónica sin campos opcionales", () => {
    const line = `_Status: in review · Updated: 2026-10-05 · Issue: [#7](${R}/issues/7) · PR: [#9](${R}/pull/9)_`;
    expect(checkBrief(brief(line), dir)).toEqual([]);
  });

  it("acepta estado con fecha, varios PRs y un issue relacionado", () => {
    const line =
      `_Status: shipped (2026-10-05) · Updated: 2026-10-05 · Issue: [#22](${R}/issues/22) (relacionado: [#66](${R}/issues/66)) · PR: [#1](${R}/pull/1), [#2](${R}/pull/2)_`;
    expect(checkBrief(brief(line), dir)).toEqual([]);
  });

  it("rechaza un estado fuera de la lista", () => {
    const line = ok.replace("in review", "mergeado");
    expect(checkBrief(brief(line), dir).join()).toContain("no válido");
  });

  it("rechaza texto libre dentro de la línea", () => {
    const line = ok.replace(" · Spec", " · review: ok · Spec");
    expect(checkBrief(brief(line), dir).join()).toContain("texto libre");
  });

  it("rechaza campos fuera de orden", () => {
    const line = `_Status: in review · Updated: 2026-10-05 · PR: [#9](${R}/pull/9) · Issue: [#7](${R}/issues/7)_`;
    expect(checkBrief(brief(line), dir).join()).toContain("fuera de orden");
  });

  it("exige PR en in review, merged y shipped", () => {
    for (const s of ["in review", "merged", "shipped"]) {
      const line = `_Status: ${s} · Updated: 2026-10-05 · Issue: [#7](${R}/issues/7)_`;
      expect(checkBrief(brief(line), dir).join()).toContain("exige un PR");
    }
  });

  it("exige Updated y rechaza un veredicto inventado", () => {
    expect(checkBrief(brief("_Status: spec_"), dir).join()).toContain("falta Updated");
    const line = ok.replace(" · Spec: [spec.md](spec.md)", "").replace(" · Tech: [tech.md](tech.md)", "") +
      "";
    const bad = line.slice(0, -1) + " · Review: [review.md](review.md) — aprobado_";
    expect(checkBrief(brief(bad), dir).join()).toContain("veredicto");
  });

  it("falla sin línea de estado", () => {
    expect(checkBrief("# Titulo\n", dir)).toHaveLength(1);
  });
});

describe("markMerged", () => {
  it("pasa in review a merged con la fecha del merge", () => {
    const out = markMerged(brief(ok), 9, "2026-10-06")!;
    expect(out).toContain("_Status: merged (2026-10-06) · Updated: 2026-10-06 ·");
    expect(checkBrief(out, dir).filter((e) => !e.includes("no existe"))).toEqual([]);
  });

  it("no toca briefs de otro PR, ni en otro estado, ni con varios PRs", () => {
    expect(markMerged(brief(ok), 10, "2026-10-06")).toBeNull();
    expect(markMerged(brief(ok.replace("in review", "coding")), 9, "2026-10-06")).toBeNull();
    const multi = ok.replace(`PR: [#9](${R}/pull/9)`, `PR: [#9](${R}/pull/9), [#10](${R}/pull/10)`);
    expect(markMerged(brief(multi), 9, "2026-10-06")).toBeNull();
  });

  it("respeta los finales de línea CRLF", () => {
    const out = markMerged(brief(ok).replace(/\n/g, "\r\n"), 9, "2026-10-06")!;
    expect(out).toContain("\r\n");
    expect(out).not.toMatch(/[^\r]\n/);
  });
});

describe("githubRefs y compareWithGitHub", () => {
  it("lee estado, PRs e issue de la línea", () => {
    const line =
      `_Status: shipped (2026-10-05) · Updated: 2026-10-05 · Issue: [#23](${R}/issues/23) · PR: [#120](${R}/pull/120), [#121](${R}/pull/121)_`;
    expect(githubRefs(brief(line))).toEqual({ status: "shipped", prs: [120, 121], issue: 23 });
  });

  it("error si el PR está mergeado y el brief sigue en un estado temprano", () => {
    const r = compareWithGitHub({ status: "in review", prs: [9], issue: 7 }, { 9: "MERGED" }, "OPEN");
    expect(r.errors.join()).toContain("está mergeado");
  });

  it("error si dice merged o shipped y el PR no está mergeado", () => {
    for (const status of ["merged", "shipped"]) {
      const r = compareWithGitHub({ status, prs: [9], issue: null }, { 9: "OPEN" }, null);
      expect(r.errors.join()).toContain("está OPEN");
    }
  });

  it("un issue cerrado con el brief en merged es un aviso, no un error", () => {
    const r = compareWithGitHub({ status: "merged", prs: [9], issue: 7 }, { 9: "MERGED" }, "CLOSED");
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toContain("¿ya es shipped?");
  });

  it("shipped con PR mergeado e issue cerrado no da nada", () => {
    const r = compareWithGitHub({ status: "shipped", prs: [9], issue: 7 }, { 9: "MERGED" }, "CLOSED");
    expect(r).toEqual({ errors: [], warnings: [] });
  });
});
