// Calls GPT-6 Luna through OpenRouter and returns the parsed JSON that matches `schema`.
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export async function completeJson({ name, schema, system, user, log = () => {} }) {
  const keys = [process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_API_KEY_FALLBACK].filter(Boolean);
  if (keys.length === 0) throw new Error('OPENROUTER_API_KEY is not set');

  for (const [index, key] of keys.entries()) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-6-luna',
        reasoning: { effort: 'low' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
      }),
    });
    // Use the fallback key only when the first key is out of credits.
    if (response.status === 402 && index < keys.length - 1) {
      log('OpenRouter returned 402, trying the fallback key');
      continue;
    }
    if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenRouter returned no content');
    return JSON.parse(content);
  }
  throw new Error('OpenRouter: no usable key');
}
