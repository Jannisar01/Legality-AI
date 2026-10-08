import { gemini, route, text } from '../server/gemini';

export default route(async (body) => {
  const message = text(body, 'message', false);
  const context = text(body, 'context', false);
  const summary = text(body, 'summary', false);
  if (!message && !context) return { text: '' };

  let prompt = `You are an AI Contract Assistant. You are currently discussing a contract that has been analyzed.\n\n`;
  if (summary) prompt += `Here is the summary of the contract analysis:\n${summary}\n\n`;
  if (context) prompt += `The user has tagged the following context from the report: "${context}"\n\n`;
  prompt += `User message: ${message}\n\n`;
  prompt += `Please provide a helpful, concise response. Do not give legal advice.`;

  const response = await gemini().models.generateContent({
    model: process.env.CHAT_MODEL || 'gemini-3-flash-preview',
    contents: prompt,
  });
  return { text: response.text };
});
