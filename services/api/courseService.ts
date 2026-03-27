import {  MoodleSection } from "@/types/course";
import { moodleFetch } from "./moodleClient";
import type { IPELANSection, SectionStatus } from "@/types/course";


export async function getUserCourses(token: string, userId?: number) {
  const params: any = {
    wstoken: token,
    wsfunction: "core_enrol_get_users_courses"
  };
  if (userId) params.userid = userId;
  
  return moodleFetch("/webservice/rest/server.php", params, "POST");
}

export async function getEnrolledCoursesByTimeline(token: string) {
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: token,
    wsfunction: "core_course_get_enrolled_courses_by_timeline_classification",
    classification: "all"
  }, "POST");
}

export async function getCourseSections(token: string, courseId: number) {
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: token,
    wsfunction: "core_course_get_contents",
    courseid: courseId
  }, "POST");
}

export async function getCompletion({ userId, courseId, token }: { userId: number; courseId: number; token: string }): Promise<any>  {
  return moodleFetch("/webservice/rest/server.php", {
    wstoken: token,
    wsfunction: "core_completion_get_course_completion_status",
    userid: userId,
    courseid: courseId
  }, "GET");
}

export const parseSections = (
  raw        : MoodleSection[],
  completion : any,
): IPELANSection[] => {
  const completionsArray = completion?.completionstatus?.completions || [];
  const completionMap = new Map(
    completionsArray.map((c: any) => [c?.cmid, c.state ?? c.CompletionState]),
  );

  return raw
    .filter((s) => s.visible === 1 && s.name)  
    .map((section, index) => {

      const modules   = section.modules ?? [];
      const total     = modules.filter((m) => m.completion > 0).length;
      const completed = modules.filter(
        (m) => Number(completionMap.get(m.id) ?? 0) >= 1,
      ).length;

      const progress  = total > 0 ? Math.round((completed / total) * 100) : 0;
      const isDone    = progress === 100;

      const tag = extractLevel(section.name);

      // const isFirst = index === 0;
      // const prevDone = index === 0 || true; 

      return {
        id       : section.id,
        title    : section.name,
        tag,
        icon     : section?.name,
        xpReward : total * 10,
        status   : getStatus(isDone, progress, index),
        progress,
        modules,
        isLocked : index > 0 && progress === 0,  
        isCurrent: progress > 0 && !isDone,
      } as IPELANSection;
    });
};
const getStatus = (done: boolean, progress: number, index: number): SectionStatus => {
  if (done)         return 'completed';
  if (progress > 0) return 'in_progress';
  if (index === 0)  return 'not_started';
  return 'locked';
};

const extractLevel = (name: string): 'fondamental' | 'intermediaire' | 'avance' => {  
  const n = name.toLowerCase();
  if (n.includes('inter'))  return 'intermediaire';
  if (n.includes('avan'))   return 'avance';
  return 'fondamental';
};
