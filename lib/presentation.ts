export function csvCell(value: string): string {
  const safe = /^[\s]*[=+@-]/.test(value) || /^[\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function wordDiff(before: string, after: string): Array<{ kind: "same" | "add" | "remove"; text: string }> {
  const a = before.match(/\s*\S+\s*/g) || [], b = after.match(/\s*\S+\s*/g) || [];
  if (a.length * b.length > 1500000) return [{ kind: "remove", text: before }, { kind: "add", text: after }];
  const width = b.length + 1, matrix = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) matrix[i * width + j] = a[i] === b[j] ? matrix[(i + 1) * width + j + 1] + 1 : Math.max(matrix[(i + 1) * width + j], matrix[i * width + j + 1]);
  const result: Array<{ kind: "same" | "add" | "remove"; text: string }> = [];
  const push = (kind: "same" | "add" | "remove", text: string) => { if (result.at(-1)?.kind === kind) result[result.length - 1].text += text; else result.push({ kind, text }); };
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { push("same", a[i++]); j++; }
    else if (j < b.length && (i === a.length || matrix[i * width + j + 1] > matrix[(i + 1) * width + j])) push("add", b[j++]);
    else push("remove", a[i++]);
  }
  return result;
}
