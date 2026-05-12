import { categorizeMoodleError, logActivityFetch } from "../utils/moodleErrorHandler";
import { moodleFetch } from "./moodleClient";

export interface Category {
  id: number;
  name: string;
  parent: number;
  depth: number;
  path: string;
}

export async function getCategories(token: string, parentId?: number): Promise<Category[]> {
  const IS_DEV = process.env.NODE_ENV === "development";

  const tryFetch = async (tok: string, isAdmin: boolean = false): Promise<Category[]> => {
    // Build criteria to get all categories or filter by parent
    const criteria: any[] = [];
    if (parentId !== undefined) {
      criteria.push({ key: 'parent', value: parentId.toString() });
    }

    const params: any = {
      wstoken: tok,
      wsfunction: "core_course_get_categories",
      moodlewsrestformat: "json",
      addsubcategories: 1  // Include all subcategories recursively
    };

    if (criteria.length > 0) {
      params.criteria = criteria;
    }

    if (IS_DEV) {
      console.log(`[courseService] getCategories ${isAdmin ? '(admin)' : '(user)'} params:`, JSON.stringify(params));
    }

    const result = await moodleFetch("/webservice/rest/server.php", params, "POST");

    if (IS_DEV) {
      console.log(`[courseService] getCategories ${isAdmin ? '(admin)' : '(user)'} result type:`, typeof result, 'isArray:', Array.isArray(result), 'length:', Array.isArray(result) ? result.length : 'N/A');
      if (result?.exception) {
        console.log(`[courseService] getCategories ${isAdmin ? '(admin)' : '(user)'} exception:`, result.message);
      }
    }

    if (result?.exception) {
      throw new Error(result.message || 'API Error');
    }
    return Array.isArray(result) ? result : [];
  };

  try {
    const categories = await tryFetch(token, false);

    if (IS_DEV) {
      console.log(`[courseService] getCategories: found ${categories.length} categories` + (parentId ? ` for parent ${parentId}` : ''));
    }
    return categories;
  } catch (error) {
    console.warn("[courseService] getCategories failed:", error);
    return [];
  }
}

export async function getEnrolledCoursesByTimeline(token: string, forUserId?: number) {
  let params = {
    wstoken: token,
    wsfunction: "core_course_get_enrolled_courses_by_timeline_classification",
    classification: "all"
  };

  let result = await moodleFetch("/webservice/rest/server.php", params, "POST");

  // Removed admin token fallback for usernotfullysetup

  console.log("[courseService] API returned:", result ? "data" : "nothing", typeof result);
  return result;
}

export async function getUserCourses(token: string, userId?: number): Promise<any[]> {
  const params = {
    wstoken: token,
    wsfunction: "core_enrol_get_users_courses",
    userid: userId || 0
  };

  try {
    const result = await moodleFetch("/webservice/rest/server.php", params, "POST");

    if (result?.exception) {
      return [];
    }

    return Array.isArray(result) ? result : [];
  } catch (error) {
    return [];
  }
}

export async function getCoursesByCategory(token: string, categoryId: number, limit: number = 100, offset: number = 0): Promise<any[]> {
  const IS_DEV = process.env.NODE_ENV === "development";
  const params = {
    wstoken: token,
    wsfunction: "core_course_get_courses_by_field",
    moodlewsrestformat: "json",
    field: "category",
    value: categoryId.toString(),
  };

  try {
    const result = await moodleFetch("/webservice/rest/server.php", params, "POST");

    if (result?.exception) {
      const error = categorizeMoodleError(result, 'getCoursesByCategory');
      logActivityFetch('Course', 'ERROR', error);
      return [];
    }

    if (Array.isArray(result)) {
      logActivityFetch('Course', 'FOUND', { categoryId, count: result.length });
      return result;
    }

    if (result?.courses && Array.isArray(result.courses)) {
      logActivityFetch('Course', 'FOUND', { categoryId, count: result.courses.length });
      return result.courses;
    }

    logActivityFetch('Course', 'UNEXPECTED', typeof result);
    return [];
  } catch (error) {
    const err = categorizeMoodleError(error, 'getCoursesByCategory');
    logActivityFetch('Course', 'ERROR', err);
    return [];
  }
}

export async function getCoursesForLanguageAndGrade(token: string, language: string, grade: number): Promise<any[]> {
  const IS_DEV = process.env.NODE_ENV === "development";

  try {
    // Get ALL categories recursively (including subcategories)
    const categories = await getCategories(token);

    if (IS_DEV) {
      console.log("[courseService] All categories:", categories.map(c => ({ id: c.id, name: c.name, parent: c.parent })));
    }

    // Language names — correspond aux noms exacts des catégories Moodle
    const langMap: Record<string, string[]> = {
      'pulaar':  ['Pulaar', 'pulaar', 'PULAAR', 'Pular'],
      'soninke': ['Soninké', 'soninké', 'Soninke', 'soninke', 'SONINKE'],
      'wolof':   ['Wolof', 'wolof', 'WOLOF'],
    };

    // Grade names — noms exacts vus dans Moodle ("1ère année", "2 ème", "3 ème"…)
    const gradeMap: Record<number, string[]> = {
      1: ['1ère année', '1ere année', '1ère', '1ere', '1 ère', '1 ème', '1ème', '1eme'],
      2: ['2 ème', '2 eme', '2ème', '2eme', '2 ère', '2ère', '2ere', '2 ere'],
      3: ['3 ème', '3 eme', '3ème', '3eme', '3 ère', '3ère', '3ere', '3 ere'],
      4: ['4 ème', '4 eme', '4ème', '4eme', '4 ère', '4ère', '4ere', '4 ere'],
      5: ['5 ème', '5 eme', '5ème', '5eme', '5 ère', '5ère', '5ere', '5 ere'],
      6: ['6 ème', '6 eme', '6ème', '6eme', '6 ère', '6ère', '6ere', '6 ere'],
    };

    const possibleLangNames = langMap[language.toLowerCase()] || [language];
    const possibleGradeNames = gradeMap[grade] || [`${grade}ème`];

    // Find language category (exact match first, then partial)
    let langCategory = categories.find(c =>
      possibleLangNames.some(name => c.name.toLowerCase().trim() === name.toLowerCase().trim())
    );

    if (!langCategory) {
      langCategory = categories.find(c =>
        possibleLangNames.some(name => c.name.toLowerCase().includes(name.toLowerCase()))
      );
    }

    if (!langCategory) {
      if (IS_DEV) console.warn("[courseService] Language category not found. Looking for:", possibleLangNames);
      console.log("[courseService] Available categories:", categories.map(c => c.name).join(", "));
      return [];
    }

    if (IS_DEV) console.log("[courseService] Found language category:", { id: langCategory.id, name: langCategory.name, parent: langCategory.parent });

    let gradeCategories = categories.filter(c =>
      c.parent === langCategory.id &&
      possibleGradeNames.some(name => c.name.toLowerCase().trim() === name.toLowerCase().trim())
    );

    if (gradeCategories.length === 0) {
      gradeCategories = categories.filter(c =>
        c.parent === langCategory.id &&
        possibleGradeNames.some(name => c.name.toLowerCase().trim().includes(name.toLowerCase().trim()))
      );
    }

    if (gradeCategories.length === 0) {
      if (IS_DEV) {
        console.warn("[courseService] Grade category not found for grade", grade, "in", langCategory.name);
        const childNames = categories.filter(c => c.parent === langCategory.id).map(c => c.name);
        console.log("[courseService] Available subcategories:", childNames);
      }
      // Retourner [] — l'appelant dispose d'un fallback vers getAllCoursesFromLanguageCategory
      return [];
    }

    if (IS_DEV) console.log("[courseService] Found grade categories:", gradeCategories.map(c => c.name));

    const courses: any[] = [];
    for (const gradeCat of gradeCategories) {
      const gradeCourses = await getCoursesByCategory(token, gradeCat.id);
      courses.push(...gradeCourses);
    }

    if (IS_DEV) console.log("[courseService] Total courses found:", courses.length);

    return courses;
  } catch (error) {
    console.warn("[courseService] getCoursesForLanguageAndGrade failed:", error);
    return [];
  }
}

/**
 * Récupère TOUS les cours de la catégorie grade/langue de l'utilisateur
 * sans utiliser core_course_get_categories (non présent dans le service).
 *
 * Stratégie : les cours inscrits (core_enrol_get_users_courses) retournent
 * `category` (ID de la catégorie directe, ex. "1ère année").
 * On utilise ces IDs pour fetcher tous les cours du même grade via
 * core_course_get_courses_by_field (field=category) — présent dans ipelan_full.
 */
export async function getCoursesByCategoryFromEnrollments(
  token: string,
  userId: number
): Promise<any[]> {
  const IS_DEV = process.env.NODE_ENV === 'development';

  try {
    const userCourses = await getUserCourses(token, userId);
    if (userCourses.length === 0) return [];

    // Récupérer les IDs de catégories uniques des cours inscrits
    const categoryIds: number[] = [
      ...new Set(
        userCourses
          .map((c: any) => c.category)
          .filter((id: any): id is number => typeof id === 'number' && id > 0)
      ),
    ];

    if (IS_DEV) console.log('[courseService] Grade category IDs from enrollments:', categoryIds);

    // Pour chaque catégorie grade → récupérer TOUS les cours disponibles
    const allCourses: any[] = [];
    for (const catId of categoryIds) {
      const catCourses = await getCoursesByCategory(token, catId);
      if (catCourses.length > 0) {
        if (IS_DEV) console.log('[courseService] Category', catId, '→', catCourses.length, 'courses');
        allCourses.push(...catCourses);
      }
    }

    // Dédupliquer par course.id
    const unique = allCourses.filter(
      (c, i, self) => i === self.findIndex(x => x.id === c.id)
    );

    if (IS_DEV) console.log('[courseService] getCoursesByCategoryFromEnrollments → total:', unique.length);
    return unique;
  } catch (error) {
    if (IS_DEV) console.warn('[courseService] getCoursesByCategoryFromEnrollments failed:', error);
    return [];
  }
}

// Get only the FIRST course from the user's language and grade (for home screen)
export async function getFirstCourseFromLanguageAndGrade(token: string, language: string, grade: number): Promise<any | null> {
  const courses = await getCoursesForLanguageAndGrade(token, language, grade);
  if (courses.length > 0) {
    return courses[0]; // Return first course only
  }
  return null;
}

export async function getAllCourses(token: string): Promise<any[]> {
  const IS_DEV = process.env.NODE_ENV === "development";
  const params = {
    wstoken: token,
    wsfunction: "core_course_get_courses",
    moodlewsrestformat: "json"
  };

  try {
    const result = await moodleFetch("/webservice/rest/server.php", params, "POST");

    if (IS_DEV) {
      console.log("[courseService] getAllCourses result:", result ? `found ${Array.isArray(result) ? result.length : 'object'} items` : 'empty');
    }

    if (result?.exception) {
      console.warn("[courseService] getAllCourses exception:", result.message);
      return [];
    }

    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("[courseService] getAllCourses error:", error);
    return [];
  }
}

export async function getCourseContents(token: string, courseId: number): Promise<any[]> {
  const IS_DEV = process.env.NODE_ENV === "development";

  const tryFetch = async (authToken: string): Promise<any> => {
    const params = {
      wstoken: authToken,
      wsfunction: "core_course_get_contents",
      moodlewsrestformat: "json",
      courseid: courseId,
      options: [
        { name: "excludemodules", value: 0 }
      ]
    };

    const result = await moodleFetch("/webservice/rest/server.php", params, "POST");
    return result;
  };

  try {
    let result = await tryFetch(token);

    if (result?.exception) {
      if (IS_DEV) console.warn("[courseService] getCourseContents exception:", result.exception);
      return [];
    }

    if (Array.isArray(result)) {
      if (IS_DEV) console.log("[courseService] getCourseContents returned", result.length, "sections");
      return result;
    }

    if (result?.sections && Array.isArray(result.sections)) {
      if (IS_DEV) console.log("[courseService] getCourseContents returned", result.sections.length, "sections from result.sections");
      return result.sections;
    }

    if (IS_DEV) console.warn("[courseService] getCourseContents unexpected format:", typeof result);
    return [];
  } catch (error) {
    if (IS_DEV) console.warn("[courseService] getCourseContents error:", error);
    return [];
  }
}

export async function getCourseSections(token: string, courseId: number): Promise<any[]> {
  const params = {
    wstoken: token,
    wsfunction: "core_course_get_contents",
    courseid: courseId
  };

  try {
    const result = await moodleFetch("/webservice/rest/server.php", params, "POST");

    if (result?.exception) {
      return [];
    }

    if (!Array.isArray(result)) {
      return [];
    }

    const sections = result.map((section: any, index: number) => ({
      id: section.id || index,
      title: section.name || `Section ${index + 1}`,
      summary: section.summary || '',
      modules: (section.modules || []).map((mod: any) => ({
        id: mod.id,
        name: mod.name,
        modname: mod.modname,
        modplural: mod.modplural,
        url: mod.url,
        description: mod.description || '',
        visible: mod.visible ?? 1,
        contents: mod.contents || [],
        completion: mod.completion || 0
      })),
      status: 'not_started',
      progress: 0,
      isLocked: false,
      isCurrent: index === 0
    }));

    return sections;
  } catch (error) {
    return [];
  }
}

export async function getCompletion(params: { userId: number; courseId: number; token: string }): Promise<any> {
  const fetchParams = {
    wstoken: params.token,
    wsfunction: "core_completion_get_activities_completion_status",
    courseid: params.courseId,
    userid: params.userId
  };

  try {
    const result = await moodleFetch("/webservice/rest/server.php", fetchParams, "POST");

    if (result?.exception) {
      return null;
    }

    return result;
  } catch (error) {
    return null;
  }
}

export function parseSections(data: any[], completion: any): any[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((section: any, index: number) => {
    const completionData = completion?.Completions?.[index];

    return {
      ...section,
      id: section.id || index,
      title: section.title || section.name || `Section ${index + 1}`,
      status: completionData?.completionstate === 1 ? 'completed' :
        completionData?.completionstate === 2 ? 'in_progress' : 'not_started',
      progress: completionData ? 100 : 0
    };
  });
}

export async function getCourseLevel(token: string, courseId: number): Promise<string> {
  console.log("[courseService] getCourseLevel called for course:", courseId);

  try {
    const courses = await getUserCourses(token);
    const course = courses.find((c: any) => c.id === courseId);

    if (course?.categoryid) {
      return String(course.categoryid);
    }

    return "1";
  } catch (error) {
    console.error("[courseService] getCourseLevel error:", error);
    return "1";
  }
}

export async function getAllCoursesFromLanguageCategory(token: string, rootCategoryId: number = 18): Promise<any[]> {
  const IS_DEV = process.env.NODE_ENV === "development";

  if (!token || token.length < 10) {
    if (IS_DEV) console.warn("[courseService] No valid user token available");
    return [];
  }

  try {
    if (IS_DEV) console.log("[courseService] Fetching all courses from category:", rootCategoryId);

    const categories = await getCategories(token);

    if (categories.length === 0) {
      if (IS_DEV) console.warn("[courseService] No categories returned");
      return [];
    }

    const findAllSubcategories = (parentId: number): number[] => {
      const directChildren = categories
        .filter(c => c.parent === parentId)
        .map(c => c.id);

      let allChildren = [...directChildren];
      for (const childId of directChildren) {
        allChildren = [...allChildren, ...findAllSubcategories(childId)];
      }

      return allChildren;
    };

    const allCategoryIds = [rootCategoryId, ...findAllSubcategories(rootCategoryId)];

    if (IS_DEV) {
      const categoryNames = categories
        .filter(c => allCategoryIds.includes(c.id))
        .map(c => ({ id: c.id, name: c.name, parent: c.parent }));
      console.log("[courseService] All categories to search:", categoryNames);
    }

    const allCourses: any[] = [];

    for (const categoryId of allCategoryIds) {
      const courses = await getCoursesByCategory(token, categoryId);
      if (courses.length > 0) {
        if (IS_DEV) console.log("[courseService] Found", courses.length, "courses in category", categoryId);
        allCourses.push(...courses);
      }
    }

    const uniqueCourses = allCourses.filter((course, index, self) =>
      index === self.findIndex((c) => c.id === course.id)
    );

    if (IS_DEV) console.log("[courseService] Total unique courses found:", uniqueCourses.length);

    return uniqueCourses;
  } catch (error) {
    if (IS_DEV) console.error("[courseService] getAllCoursesFromLanguageCategory error:", error);
    return [];
  }
}
