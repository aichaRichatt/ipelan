/**
 * Calculateur de niveau centralisé
 * Source unique de vérité pour tous les calculs de niveau utilisateur
 */

export interface LevelInfo {
  level: number;
  title: string;
  minXP: number;
  maxXP: number;
  progress: number; // Pourcentage dans le niveau actuel
}

export const LEVELS = [
  { min: 0, max: 100, name: "Débutant" },
  { min: 100, max: 300, name: "Apprenant" },
  { min: 300, max: 600, name: "Intermédiaire" },
  { min: 600, max: 1000, name: "Avancé" },
  { min: 1000, max: 1500, name: "Expert" },
  { min: 1500, max: Infinity, name: "Maître" },
] as const;

/**
 * Calcule le niveau et les informations associées à partir de l'XP
 * Cette fonction est la source de vérité unique pour toute l'application
 */
export function getLevelFromXP(xp: number): LevelInfo {
  for (let i = 0; i < LEVELS.length; i++) {
    const lvl = LEVELS[i];
    if (xp < lvl.max) {
      const progress = ((xp - lvl.min) / (lvl.max - lvl.min)) * 100;
      return {
        level: i + 1,
        title: lvl.name,
        minXP: lvl.min,
        maxXP: lvl.max === Infinity ? xp : lvl.max,
        progress: Math.min(100, Math.max(0, progress)),
      };
    }
  }

  // Niveau max atteint
  const lastLevel = LEVELS[LEVELS.length - 1];
  return {
    level: LEVELS.length,
    title: lastLevel.name,
    minXP: lastLevel.min,
    maxXP: xp,
    progress: 100,
  };
}

/**
 * Version simplifiée retournant uniquement le niveau
 */
export function getLevelNumber(xp: number): number {
  return getLevelFromXP(xp).level;
}

/**
 * Version simplifiée retournant uniquement le titre
 */
export function getLevelTitle(xp: number): string {
  return getLevelFromXP(xp).title;
}

/**
 * Calcule l'XP nécessaire pour atteindre le prochain niveau
 */
export function getXPToNextLevel(xp: number): number {
  const info = getLevelFromXP(xp);
  if (info.maxXP === Infinity) return 0;
  return info.maxXP - xp;
}
