const Anthropic = require("@anthropic-ai/sdk");
const { getToolDefinitions, executeTool } = require("./tools");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `Jestes osobistym asystentem glosowym uzytkownika, z ktorym rozmawia codziennie rano po polsku.

Zasady odpowiedzi (WAZNE, bo Twoja odpowiedz jest czytana na glos przez syntezator mowy):
- Odpowiadaj wylacznie po polsku, krotko i naturalnie, jak w rozmowie na zywo.
- Nigdy nie uzywaj formatowania markdown (bez gwiazdek, list punktowanych, naglowkow, tabel) ani emoji - Twoja odpowiedz trafia prosto do syntezatora mowy, wiec kazdy taki znak zostanie niezrecznie przeczytany na glos albo pominiety. Pisz plynnym tekstem mowionym.
- Jesli wymieniasz kilka rzeczy, powiedz je w jednym zdaniu, naturalnie ("masz dzis dwa spotkania i trzy zadania do zrobienia: ...").
- Badz rzeczowy i zwiezly - to poranna rozmowa, nie wyklad. Unikaj zbednego przedluzania.
- Jesli czegos nie wiesz albo potrzebujesz doprecyzowania, zapytaj wprost, krótko.
- Mozesz pomagac w: przegladzie listy zadan i zakupow (dodawanie, odznaczanie), sprawdzaniu nadchodzacych wydarzen w kalendarzu, sprawdzaniu nieprzeczytanych maili, wyszukiwaniu informacji w internecie, oraz w codziennych sprawach uzytkownika.
- Jesli rozmowa jest poranna albo user pyta "co dzisiaj", z wlasnej inicjatywy sprawdz kalendarz i liste zadan, zeby dac zwiezle podsumowanie dnia - nie czekaj az user o to osobno poprosi kazda z tych rzeczy.
- Badz cieply i wspierajacy, ale bez sztucznego entuzjazmu.`;

function getTools() {
  return [
    { type: "web_search_20250305", name: "web_search", max_uses: 3 },
    ...getToolDefinitions(),
  ];
}

async function chat(history) {
  let messages = [...history];
  const tools = getTools();

  for (let turn = 0; turn < 6; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
      tools,
    });

    const localToolUses = response.content.filter(
      (b) => b.type === "tool_use" && b.name !== "web_search"
    );

    if (localToolUses.length === 0 || response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .trim();
      return { text, messages: [...messages, { role: "assistant", content: response.content }] };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults = await Promise.all(
      localToolUses.map(async (block) => {
        const result = await executeTool(block.name, block.input);
        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: typeof result === "string" ? result : JSON.stringify(result),
        };
      })
    );

    messages.push({ role: "user", content: toolResults });
  }

  return { text: "Przepraszam, cos poszlo nie tak z przetwarzaniem tej prosby.", messages };
}

module.exports = { chat };
