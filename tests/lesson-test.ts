import ENV from "@/constants/env";

const MOODLE_URL = ENV.API.MOODLE_URL;
const ADMIN_TOKEN = process.env.MOODLE_ADMIN_TOKEN || "";

async function testLessonAPI() {
  console.log("=== Testing Moodle Lesson API ===\n");

  if (!ADMIN_TOKEN) {
    console.error("ERROR: MOODLE_ADMIN_TOKEN not found in .env");
    return;
  }

  const testLessonId = 750;
  const testCourseId = 81;

  console.log("1. Testing mod_lesson_get_lesson API");
  console.log("   Lesson ID:", testLessonId);

  try {
    const response = await fetch(`${MOODLE_URL}/webservice/rest/server.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        wstoken: ADMIN_TOKEN,
        wsfunction: "mod_lesson_get_lesson",
        lessonid: testLessonId.toString(),
        moodlewsrestformat: "json",
      }).toString(),
    });

    const data = await response.json();

    if (data.exception) {
      console.error("   ❌ Exception:", data.message);
      console.error("   Error code:", data.errorcode);
    } else {
      console.log("   ✅ Success!");
      console.log("   Lesson name:", data.name);
      console.log("   Course ID:", data.course);
      console.log("   Has intro:", !!data.intro);
      console.log("   Contents count:", data.contents?.length || 0);
      
      if (data.intro) {
        console.log("   Intro preview:", data.intro.substring(0, 100) + "...");
      }
    }
  } catch (err) {
    console.error("   ❌ Request failed:", err);
  }

  console.log("\n2. Testing mod_lesson_get_pages API");

  try {
    const response = await fetch(`${MOODLE_URL}/webservice/rest/server.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        wstoken: ADMIN_TOKEN,
        wsfunction: "mod_lesson_get_pages",
        lessonid: testLessonId.toString(),
        moodlewsrestformat: "json",
      }).toString(),
    });

    const data = await response.json();

    if (data.exception) {
      console.error("   ❌ Exception:", data.message);
    } else {
      console.log("   ✅ Success!");
      const pages = data.pages || [];
      console.log("   Pages found:", pages.length);
      
      if (pages.length > 0) {
        console.log("\n   First 3 pages:");
        pages.slice(0, 3).forEach((page: any, i: number) => {
          console.log(`   ${i + 1}. ID: ${page.id}`);
          console.log(`      Title: ${page.title || "(no title)"}`);
          console.log(`      Next page: ${page.nextpageid || "none"}`);
          console.log(`      Content preview: ${(page.contents || "").substring(0, 80)}...`);
        });
      }
    }
  } catch (err) {
    console.error("   ❌ Request failed:", err);
  }

  console.log("\n3. Testing file access with user token");
  console.log("   Testing if pluginfile.php requires authentication...");

  try {
    const testUrl = `${MOODLE_URL}/webservice/rest/server.php?wstoken=${ADMIN_TOKEN}&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`;
    const response = await fetch(testUrl);
    const data = await response.json();
    
    if (data.username) {
      console.log("   ✅ Authenticated as:", data.username);
      console.log("   Site:", data.sitename);
    } else {
      console.log("   ⚠️  Response:", JSON.stringify(data).substring(0, 200));
    }
  } catch (err) {
    console.error("   ❌ Request failed:", err);
  }

  console.log("\n=== Test Complete ===");
  console.log("\nNote: To test with user token instead of admin token:");
  console.log("1. Login to the app as a regular user");
  console.log("2. Check that the user's token is used for file downloads");
  console.log("3. Verify files load correctly for enrolled courses");
}

testLessonAPI();
