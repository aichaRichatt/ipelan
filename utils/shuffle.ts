/**
 * Shuffle uniforme (Fisher-Yates) — remplace les patterns biaisés
 * du type `array.sort(() => Math.random() - 0.5)`.
 *
 * @param array Tableau d'origine (non muté).
 * @returns Une copie mélangée du tableau.
 */
export function shuffle<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
