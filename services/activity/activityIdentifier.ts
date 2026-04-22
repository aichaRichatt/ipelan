/**
 * Service pour identifier correctement le type d'activité IPELAN
 * à partir des données Moodle (modname + titre + contenu)
 */

import { ActivityType } from '@/utils/xpCalculator';

export interface ActivityIdentification {
    type: ActivityType;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
}

/**
 * Identifie le type d'activité IPELAN basé sur:
 * 1. Le type Moodle (modname)
 * 2. Le titre/description
 * 3. Les mots-clés du contenu
 */
export function identifyActivityType(
    modname: string,
    title: string,
    description?: string
): ActivityIdentification {
    const modnameL = (modname || '').toLowerCase().trim();
    const titleL = (title || '').toLowerCase();
    const descL = (description || '').toLowerCase();
    const fullText = `${titleL} ${descL}`;

    // ✅ QUIZ
    if (modnameL === 'quiz') {
        return {
            type: 'quiz',
            confidence: 'high',
            reason: `Moodle type: Quiz`,
        };
    }

    // ✅ DICTÉE (Assign)
    if (modnameL === 'assign' || modnameL === 'assignment') {
        return {
            type: 'dictation',
            confidence: 'high',
            reason: `Moodle type: Assign/Assignment (Dictée)`,
        };
    }

    // ✅ LISTENING (Choice)
    if (modnameL === 'choice') {
        return {
            type: 'listening',
            confidence: 'high',
            reason: `Moodle type: Choice (Listening - Compréhension orale)`,
        };
    }

    // ✅ LESSON - Distinguer Association vs Ordre des mots
    if (modnameL === 'lesson') {
        // Mots-clés pour Association
        if (
            fullText.includes('association') ||
            fullText.includes('matching') ||
            fullText.includes('appariement') ||
            fullText.includes('animaux') ||
            fullText.includes('images') ||
            fullText.includes('pairs')
        ) {
            return {
                type: 'association',
                confidence: 'high',
                reason: `Lesson with keywords: association/matching`,
            };
        }

        // Mots-clés pour Ordre des mots
        if (
            fullText.includes('ordre') ||
            fullText.includes('order') ||
            fullText.includes('arrangement') ||
            fullText.includes('phrase') ||
            fullText.includes('sentence') ||
            fullText.includes('réorganiser') ||
            fullText.includes('rearrange')
        ) {
            return {
                type: 'wordOrder',
                confidence: 'high',
                reason: `Lesson with keywords: ordre/order/phrase`,
            };
        }

        // Défaut pour Lesson : Association
        return {
            type: 'association',
            confidence: 'low',
            reason: `Lesson type (assuming Association by default)`,
        };
    }

    // ❌ Type inconnu
    return {
        type: 'quiz', // Défaut
        confidence: 'low',
        reason: `Unknown modname: ${modname} - defaulting to quiz`,
    };
}

/**
 * Valide si les IDs fournis sont vraisemblablement corrects
 */
export function validateActivityIds(
    modname: string,
    moduleId?: number,
    instanceId?: number,
    cmid?: number
): { valid: boolean; message: string } {
    const modnameL = (modname || '').toLowerCase().trim();

    // Quiz doit avoir instanceId (quiz_id)
    if (modnameL === 'quiz' && !instanceId) {
        return {
            valid: false,
            message: `Quiz requires instanceId (quiz_id), got: ${instanceId}`,
        };
    }

    // Lesson doit avoir instanceId (lesson_id)
    if (modnameL === 'lesson' && !instanceId) {
        return {
            valid: false,
            message: `Lesson requires instanceId (lesson_id), got: ${instanceId}`,
        };
    }

    // Choice doit avoir instanceId (choice_id)
    if (modnameL === 'choice' && !instanceId) {
        return {
            valid: false,
            message: `Choice requires instanceId (choice_id), got: ${instanceId}`,
        };
    }

    // Assign doit avoir instanceId (assignment_id)
    if ((modnameL === 'assign' || modnameL === 'assignment') && !instanceId) {
        return {
            valid: false,
            message: `Assign requires instanceId (assignment_id), got: ${instanceId}`,
        };
    }

    return { valid: true, message: 'IDs validated successfully' };
}

/**
 * Génère une ordre de retry pour les IDs en cas d'erreur
 * Essaie d'abord instanceId, puis cmid, puis moduleId
 */
export function generateIdRetryOrder(
    instanceId?: number,
    cmid?: number,
    moduleId?: number
): Array<{ id: number; type: string }> {
    const order: Array<{ id: number; type: string }> = [];

    if (instanceId) {
        order.push({ id: instanceId, type: 'instanceId' });
    }
    if (cmid) {
        order.push({ id: cmid, type: 'cmid' });
    }
    if (moduleId) {
        order.push({ id: moduleId, type: 'moduleId' });
    }

    return order;
}
