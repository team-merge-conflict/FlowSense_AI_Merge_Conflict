/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize Gemini API client
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  // API Route: Explain
  app.post('/api/explain', async (req, res) => {
    const { triggerType, evidence, provider, details } = req.body;

    // Default/fallback templates
    const fallbackResponses: Record<string, any> = {
      smurfing_detected: {
        explanation_english: `Suspicious smurfing activity detected on ${provider}. ${evidence}`,
        explanation_bengali: `${provider} অ্যাকাউন্টে সন্দেহজনক স্মারফিং (Smurfing) শনাক্ত হয়েছে। মাত্র ১০ মিনিটে ১০,০০০ টাকার ৪টি ক্যাশ-আউট হয়েছে, যা লেনদেন বিভক্ত করে সীমা এড়ানোর নির্দেশক।`,
        explanation_banglish: `${provider} acc-e suspicious smurfing detected. Matro 10 min-e 10,000 takar 4ta cash-out hoise, ja transaction limit bypass korar pattern.`,
        recommendedAction: "Hold transaction payout and manually verify sender and recipient NIDs before releasing funds.",
        assignTo: "Risk Team"
      },
      velocity_high: {
        explanation_english: `High cash-out velocity detected on ${provider}. ${evidence}`,
        explanation_bengali: `${provider} ক্যাশ-আউটের কারণে আপনার ক্যাশ ড্রয়ার খালি হচ্ছে! বর্তমান ক্যাশ-আউটের গতি বজায় থাকলে আপনার ফিজিক্যাল ক্যাশ ড্রয়ার শূন্য হয়ে যাবে।`,
        explanation_banglish: `${provider} cash-out er karone apnar cash drawer khali hocche! Current velocity thakle physical cash drawer khub druto zero hoye jabe.`,
        recommendedAction: "Arrange physical cash conversion or coordinate a liquidity top-up from the distributor channel immediately.",
        assignTo: "Local Agent"
      }
    };

    const typeKey = triggerType || 'smurfing_detected';
    const fallback = fallbackResponses[typeKey] || fallbackResponses.smurfing_detected;

    if (!ai) {
      console.log("No Gemini API key configured, returning high-quality deterministic fallback.");
      return res.json({
        ...fallback,
        _isFallback: true
      });
    }

    try {
      const prompt = `Algorithmic Trigger:
Type: ${triggerType}
Provider: ${provider}
Evidence: ${evidence}
Details: ${JSON.stringify(details)}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          systemInstruction: `You are FlowSense_AI, a risk assistant for a Mobile Financial Services (MFS) super agent. You received this algorithmic trigger: [Insert Data]. Generate an advisory warning explaining the evidence and a safe human-review step. DO NOT suggest auto-blocking or auto-freezing. The platform is strictly advisory.
          
          You MUST return ONLY a valid JSON object matching this exact schema:
          {
            "explanation_english": "Formal English explanation for the Risk/Compliance Analyst, analyzing the quantitative evidence and patterns",
            "explanation_bengali": "Clear Bengali script (বাংলা) for the local multi-provider Agent, detailing what happened. CRITICAL: Never say 'account balance is emptying/খালি হচ্ছে'. Instead, say 'your physical cash drawer is emptying' / 'আপনার ক্যাশ ড্রয়ার খালি হচ্ছে', because high cash-outs drain physical cash while filling digital vaults.",
            "explanation_banglish": "Casual Banglish (Bengali written in English alphabet) for Field Officers on the ground, explaining the situation clearly, mentioning that the cash drawer is emptying ('apnar cash drawer khali hocche')",
            "recommendedAction": "A specific action for human review or cash replenishment (DO NOT suggest auto-blocking accounts or transactions)",
            "assignTo": "Who this should be assigned to, either 'Local Agent' or 'Risk Team'"
          }`,
          responseMimeType: 'application/json',
        }
      });

      const responseText = response.text;
      if (responseText) {
        try {
          const parsed = JSON.parse(responseText.trim());
          return res.json({
            ...parsed,
            _isFallback: false
          });
        } catch (parseErr) {
          console.error("Failed to parse Gemini response as JSON:", responseText, parseErr);
        }
      }
      
      return res.json({
        ...fallback,
        _isFallback: true
      });
    } catch (err) {
      console.error("Gemini API call failed:", err);
      return res.json({
        ...fallback,
        _isFallback: true,
        _error: String(err)
      });
    }
  });

  // Integrate Vite dev middleware or serve static dist folder
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
