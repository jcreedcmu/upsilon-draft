export const alphabet = 'tkpcdgb5shfxzqv4n6m3aoeyijuwrl';
export const alphaMap: { [k: string]: string } = {};
alphabet.split('').forEach((a, i) => {
  alphaMap[a] = String.fromCharCode(129 + i);
});
export function translit(s: string): string {
  return s.split('').map(c => alphaMap[c] || c).join('');
}
