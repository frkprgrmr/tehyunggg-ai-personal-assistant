import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function main() {
  const models = await ai.models.list();
  const testModels = [];
  for await (const model of models) {
    if (!model.name) continue;
    if (model.name.includes("flash") && !model.name.includes("preview") && !model.name.includes("audio") && !model.name.includes("image")) {
      testModels.push(model.name.replace('models/', ''));
    }
  }
  
  console.log("Testing models:", testModels.join(", "));
  
  for (const model of testModels) {
    try {
      console.log(`\nTesting ${model}...`);
      const response = await ai.models.generateContent({
        model: model,
        contents: "Balas dengan kata 'OK'",
      });
      console.log(`✅ Success for ${model}: ${response.text}`);
      break; // Found one that works!
    } catch (e: any) {
      console.log(`❌ Error for ${model}: ${e.message}`);
    }
  }
}
main().catch(console.error);
