
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.error("API Key not found in environment.");
    process.exit(1);
}

async function listModels() {
    const genAI = new GoogleGenAI({ apiKey });
    try {
        // Note: The unified SDK might have a different method for listing models
        // If models.list() doesn't exist, we might have to use fetch
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
