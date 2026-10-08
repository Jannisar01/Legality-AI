import { gemini, route, text } from '../server/gemini';

export default route(async (body) => {
  const instructions = text(body, 'instructions');
  const contractText = text(body, 'contractText');
  const response = await gemini().models.generateContent({
    model: process.env.ANALYSIS_MODEL || 'gemini-3.1-pro-preview',
    contents: `You are an expert corporate lawyer. Revise the following contract based on these instructions: "${instructions}".

        Original Contract:
        ${contractText}

        Output ONLY the full revised contract text. Do not include any markdown formatting, explanations, or introductory text. Just the raw text of the revised contract.`,
  });
  return { text: response.text };
});
