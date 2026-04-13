import { moodleFetch } from "./moodleClient";

const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_TOKEN;

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
  
  console.log("[courseService] API returned:", result ? "data" : "nothing");
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

export async function getCoursesByCategory(token: string, categoryId?: number): Promise<any[]> {
  const params: any = {
    wstoken: token,
    wsfunction: "core_course_get_courses_by_field",
    field: "category"
  };
  
  if (categoryId) {
    params.value = categoryId;
  }
  
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

export async function getAllCourses(token: string): Promise<any[]> {
  const params = {
    wstoken: token,
    wsfunction: "core_course_get_courses"
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
    
    return Array.isArray(result) ? result : [];
  } catch (error) {
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
