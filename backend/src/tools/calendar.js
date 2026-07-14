const { google } = require("googleapis");
const { getAuthorizedClient } = require("../googleAuth");

async function getCalendarApi() {
  const auth = getAuthorizedClient();
  if (!auth) throw new Error("NOT_CONNECTED");
  return google.calendar({ version: "v3", auth });
}

async function listUpcomingEvents(maxResults = 5) {
  const calendarApi = await getCalendarApi();
  const { data } = await calendarApi.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });
  return (data.items || []).map((e) => ({
    title: e.summary || "(bez tytulu)",
    start: e.start?.dateTime || e.start?.date,
    allDay: !e.start?.dateTime,
  }));
}

async function createEvent({ title, start, end, allDay }) {
  const calendarApi = await getCalendarApi();
  const timeZone = "Europe/Warsaw";
  const eventBody = { summary: title };

  if (allDay) {
    eventBody.start = { date: start };
    eventBody.end = { date: end || start };
  } else {
    eventBody.start = { dateTime: start, timeZone };
    eventBody.end = { dateTime: end, timeZone };
  }

  const { data } = await calendarApi.events.insert({
    calendarId: "primary",
    requestBody: eventBody,
  });
  return { id: data.id, summary: data.summary };
}

module.exports = { listUpcomingEvents, createEvent };
