import { moodleFetch } from "./moodleClient";
import { categorizeMoodleError, logActivityFetch } from "../utils/moodleErrorHandler";

const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_TOKEN;

export interface Category {
  id: number;
  name: string;
  parent: number;
  depth: number;
  path: string;
}

export async function getCategories(token: string): Promise<Category[]> {
  const params = {
    wstoken: token,
    wsfunction: "core_course_get_categories",
    moodlewsrestformat: "json"
  };

  try {
    const result = await moodleFetch("/webservice/rest/server.php", params, "POST");
    if (result?.exception) {
      return [];
    }
    return Array.isArray(result) ? result : [];
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

  if (result?.exception?.errorcode === "usernotfullysetup" && ADMIN_TOKEN) {
    params = {
      wstoken: ADMIN_TOKEN,
      wsfunction: "core_course_get_enrolled_courses_by_timeline_classification",
      classification: "all"
    };
    result = await moodleFetch("/webservice/rest/server.php", params, "POST");

    if (result?.exception && ADMIN_TOKEN) {
      const fallbackResult = await getUserCourses(ADMIN_TOKEN, forUserId);
      return { courses: fallbackResult };
    }
  }

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

  const getToken = () => {
    if (token && token.length > 10) return token;
    if (ADMIN_TOKEN) return ADMIN_TOKEN;
    return token;
  };

  try {
    const categories = await getCategories(getToken() || token);

    if (IS_DEV) {
      console.log("[courseService] All categories:", categories.map(c => ({ id: c.id, name: c.name, parent: c.parent })));
    }

    const langMap: Record<string, string[]> = {
      'pulaar': ['Pulaar', 'pulaar', 'PULAAR', 'Pular'],
      'soninke': ['Soninké', 'soninké', 'Soninke', 'soninke', 'SONINKE'],
      'wolof': ['Wolof', 'wolof', 'WOLOF']
    };

    const gradeMap: Record<number, string[]> = {
      1: ['1ère année', '1ere année', '1ème année', '1eme année', '1e année', '1e', '1 ère année', '1 ème', '1è', '1 è'],
      2: ['2ème année', '2eme année', '2ème', '2eme', '2e année', '2e', '2 ère année', '2 ème', '2è', '2 è', '2 ème'],
      3: ['3ème année', '3eme année', '3ème', '3eme', '3e année', '3e', '3 ère année', '3 ème', '3è', '3 è', '3 ème'],
      4: ['4ème année', '4eme année', '4ème', '4eme', '4e année', '4e', '4 ère année', '4 ème', '4è', '4 è', '4 ème'],
      5: ['5ème année', '5eme année', '5ème', '5eme', '5e année', '5e', '5 ère année', '5 ème', '5è', '5 è', '5 ème'],
      6: ['6ème année', '6eme année', '6ème', '6eme', '6e année', '6e', '6 ère année', '6 ème', '6è', '6 è', '6 ème'],
    };

    const possibleLangNames = langMap[language.toLowerCase()] || [language];
    const possibleGradeNames = gradeMap[grade] || [`${grade}ème année`];

    let langCategory = categories.find(c =>
      possibleLangNames.some(name => c.name.toLowerCase() === name.toLowerCase())
    );

    if (!langCategory) {
      langCategory = categories.find(c =>
        possibleLangNames.some(name => c.name.toLowerCase().includes(name.toLowerCase()))
      );
    }

    if (!langCategory) {
      if (IS_DEV) console.warn("[courseService] Language category not found. Looking for:", possibleLangNames);
      return [];
    }

    if (IS_DEV) console.log("[courseService] Found language category:", langCategory);

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
      if (IS_DEV) console.log("[courseService] No grade-specific category, getting all courses from language category");
      const allChildCategories = categories.filter(c => c.parent === langCategory.id);

      if (IS_DEV) console.log("[courseService] Child categories:", allChildCategories.map(c => ({ id: c.id, name: c.name })));

      const courses: any[] = [];
      for (const cat of allChildCategories) {
        const gradeCourses = await getCoursesByCategory(getToken() || token, cat.id);
        if (IS_DEV && gradeCourses.length > 0) console.log("[courseService] Courses in", cat.name, ":", gradeCourses.length, gradeCourses);
        courses.push(...gradeCourses);
      }

      return courses;
    }

    if (IS_DEV) console.log("[courseService] Found grade categories:", gradeCategories.map(c => c.name));

    const courses: any[] = [];
    for (const gradeCat of gradeCategories) {
      const gradeCourses = await getCoursesByCategory(getToken() || token, gradeCat.id);
      courses.push(...gradeCourses);
    }

    if (IS_DEV) console.log("[courseService] Total courses found:", courses.length);

    return courses;
  } catch (error) {
    console.warn("[courseService] getCoursesForLanguageAndGrade failed:", error);
    return [];
  }
}

export async function getAllCourses(token: string, limit: number = 100, offset: number = 0): Promise<any[]> {
  const params = {
    wstoken: token,
    wsfunction: "core_course_get_courses",
    options: [
      { name: "limit", value: limit },
      { name: "offset", value: offset }
    ]
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

    if (result?.exception && ADMIN_TOKEN) {
      if (IS_DEV) console.log("[courseService] getCourseContents user token failed, trying admin...");
      result = await tryFetch(ADMIN_TOKEN);
    }

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

  const getToken = () => {
    if (token && token.length > 10) return token;
    if (ADMIN_TOKEN) return ADMIN_TOKEN;
    return token;
  };

  const effectiveToken = getToken();
  if (!effectiveToken) {
    if (IS_DEV) console.warn("[courseService] No token available");
    return [];
  }

  try {
    if (IS_DEV) console.log("[courseService] Fetching all courses from category:", rootCategoryId);

    const categories = await getCategories(effectiveToken);

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
      const courses = await getCoursesByCategory(effectiveToken, categoryId);
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
