
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!apiKey) {
    console.error("API_KEY not found");
    process.exit(1);
}

const genAI = new GoogleGenAI(apiKey);

async function list() {
    try {
        const models = await genAI.listModels();
        console.log("AVAILABLE MODELS:");
        models.models.forEach(m => console.log(`- ${m.name} (${m.displayName})`));
    } catch (e) {
        console.error("Error listing models:", e);
    }
}

list();
