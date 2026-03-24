const url: string |undefined = process.env.MOODLE_API_URL

const query = new URLSearchParams({ "wsfunction": "", "wstoken": "dsadsadasdas" })

fetch(`${url}/${query}`,
  {
    method: "GET",
    headers: {
      "Content-Type":"application/josn",
    },
    body: { "e": 3 }.toString(),
  })
