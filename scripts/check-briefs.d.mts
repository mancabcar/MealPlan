export const STATUSES: string[];
export const VERDICTS: string[];
export function checkBrief(text: string, dir: string): string[];
export function githubRefs(text: string): { status: string; prs: number[]; issue: number | null } | null;
export function compareWithGitHub(
  refs: { status: string; prs: number[]; issue: number | null },
  prStates: Record<number, string | null>,
  issueState: string | null,
): { errors: string[]; warnings: string[] };
