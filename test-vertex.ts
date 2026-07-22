import { GoogleGenAI } from "@google/genai";
process.env.GOOGLE_APPLICATION_CREDENTIALS = "/home/umam/khairi/personal-assistant-tehyunggg/mydata/google-api-key.json";
// Try to get auth using standard google-auth-library or just pass vertex project in constructor
const ai = new GoogleGenAI({ project: "bill-scanner-ocr", location: "us-central1", vertexai: { project: "bill-scanner-ocr", location: "us-central1" } } as any);

async function main() {
  console.log("Testing Vertex AI...");
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "Balas dengan kata 'OK'",
  });
  console.log("Response:", response.text);
}
main().catch(console.error);
