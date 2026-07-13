const { google } = require("googleapis");
const { getAuthorizedClient } = require("../googleAuth");

const LIST_TITLES = { zakupy: "Zakupy", zadania: "Zadania" };

function resolveTitle(listKey) {
  return LIST_TITLES[listKey] || listKey;
}

async function getTasksApi() {
  const auth = getAuthorizedClient();
  if (!auth) throw new Error("NOT_CONNECTED");
  return google.tasks({ version: "v1", auth });
}

// Cache po tytule listy zapobiega tworzeniu duplikatow, gdy kilka wywolan
// narzedzia leci rownolegle (np. dodawanie kilku produktow naraz).
const listIdCache = new Map();

function ensureList(tasksApi, title) {
  if (listIdCache.has(title)) return listIdCache.get(title);

  const promise = (async () => {
    const { data } = await tasksApi.tasklists.list({ maxResults: 100 });
    const existing = (data.items || []).find((l) => l.title === title);
    if (existing) return existing.id;
    const { data: created } = await tasksApi.tasklists.insert({ requestBody: { title } });
    return created.id;
  })();

  listIdCache.set(title, promise);
  promise.catch(() => listIdCache.delete(title));
  return promise;
}

async function listTasks(listKey) {
  const tasksApi = await getTasksApi();
  const listId = await ensureList(tasksApi, resolveTitle(listKey));
  const { data } = await tasksApi.tasks.list({ tasklist: listId, showCompleted: false });
  return (data.items || []).map((t) => ({ id: t.id, title: t.title }));
}

async function addTask(listKey, title) {
  const tasksApi = await getTasksApi();
  const listId = await ensureList(tasksApi, resolveTitle(listKey));
  const { data } = await tasksApi.tasks.insert({ tasklist: listId, requestBody: { title } });
  return { id: data.id, title: data.title };
}

async function completeTask(listKey, itemQuery) {
  const tasksApi = await getTasksApi();
  const listId = await ensureList(tasksApi, resolveTitle(listKey));
  const { data } = await tasksApi.tasks.list({ tasklist: listId, showCompleted: false });
  const match = (data.items || []).find((t) =>
    t.title.toLowerCase().includes(String(itemQuery).toLowerCase())
  );
  if (!match) return { ok: false, message: `Nie znalazlem pozycji "${itemQuery}" na tej liscie.` };
  await tasksApi.tasks.patch({
    tasklist: listId,
    task: match.id,
    requestBody: { status: "completed" },
  });
  return { ok: true, title: match.title };
}

module.exports = { listTasks, addTask, completeTask };
