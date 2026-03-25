import { moodleFetch } from "../services/api/moodleClient";

async function testConnection() {
  console.log("Starting Moodle Connection Test...");
  const token = process.env.EXPO_PUBLIC_MOODLE_TOKEN;
  
  if (!token) {
    console.error("EXPO_PUBLIC_MOODLE_TOKEN is missing in .env");
    return;
  }

  try {
    const info = await moodleFetch("/webservice/rest/server.php", {
      wstoken: token,
      wsfunction: "core_webservice_get_site_info",
    }, "POST");

    console.log("Connection Successful!");
    console.log("Site Info:", JSON.stringify(info, null, 2));
  } catch (error: any) {
    console.error("Connection Test Failed!",error.message);
  }
}

testConnection();
