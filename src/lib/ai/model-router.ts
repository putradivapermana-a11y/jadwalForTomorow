export interface AIRequestOptions {
  modelType?: 'fast' | 'worker' | 'review';
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: 'json_object' | 'text';
}

export async function askAI(options: AIRequestOptions): Promise<string | null> {
  const provider = process.env.AI_PROVIDER;
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;

  // Simple fallback/mock if no real provider configured
  if (!provider || !apiKey || provider === 'mock') {
    return mockAI(options.userPrompt);
  }

  const model = getModelConfig(options.modelType || 'fast');

  try {
    if (provider === 'google') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: { text: options.systemPrompt }
          },
          contents: [{
            parts: [{ text: options.userPrompt }]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: options.responseFormat === 'json_object' ? 'application/json' : 'text/plain'
          }
        }),
      });

      if (!response.ok) {
        console.error(`AI Provider error: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.error(text);
        return null;
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } else {
      // openai-compatible provider
      const url = baseUrl ? `${baseUrl}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: options.systemPrompt },
            { role: 'user', content: options.userPrompt }
          ],
          response_format: options.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
          temperature: 0.1, // keep it deterministic for parsing
        }),
      });

      if (!response.ok) {
        console.error(`AI Provider error: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.error(text);
        return null;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    }
  } catch (error) {
    console.error("Failed to connect to AI provider:", error);
    return null;
  }
}

function getModelConfig(type: 'fast' | 'worker' | 'review') {
  switch (type) {
    case 'fast': return process.env.AI_MODEL_FAST || 'gpt-3.5-turbo';
    case 'worker': return process.env.AI_MODEL_WORKER || 'gpt-4o-mini';
    case 'review': return process.env.AI_MODEL_REVIEW || 'gpt-4o';
    default: return 'gpt-3.5-turbo';
  }
}

// Minimal mock implementation for local dev fallback
function mockAI(userPrompt: string): string | null {
  const lowercasePrompt = userPrompt.toLowerCase();
  
  if (lowercasePrompt.includes("meeting sama client") && lowercasePrompt.includes("jumat")) {
    return JSON.stringify({
      intentType: "CREATE_EVENT",
      confidence: 0.9,
      entities: {
        title: "Meeting sama client",
        dateText: "Jumat tanggal 14",
        timeText: "jam 8 malam",
        category: "MEETING"
      },
      missingFields: [],
      needsClarification: false
    });
  }

  if (lowercasePrompt.includes("besok") && lowercasePrompt.includes("kuliah")) {
    return JSON.stringify({
      intentType: "CREATE_EVENT",
      confidence: 0.9,
      entities: {
        title: "Kuliah",
        dateText: "Besok",
        timeText: "jam 10 pagi",
        category: "ACADEMIC"
      },
      missingFields: [],
      needsClarification: false
    });
  }

  if (lowercasePrompt.includes("deadline laporan")) {
    return JSON.stringify({
      intentType: "CREATE_DEADLINE",
      confidence: 0.9,
      entities: {
        title: "Laporan magang",
        dateText: "Tanggal 20",
        timeText: null,
        category: "ACADEMIC"
      },
      missingFields: [],
      needsClarification: false
    });
  }
  
  if (lowercasePrompt.includes("kerjain tugas web")) {
    return JSON.stringify({
      intentType: "CREATE_TASK",
      confidence: 0.9,
      entities: {
        title: "Tugas web",
        dateText: "Besok",
        timeText: null,
        category: "ACADEMIC"
      },
      missingFields: [],
      needsClarification: false
    });
  }

  // Fallback for parser step when Mock is used for Extractor step too
  if (lowercasePrompt.includes("extract")) {
    // Determine type from prompt payload to mock extractor
     if (lowercasePrompt.includes("event")) {
         return JSON.stringify({
          entityType: "FIXED_EVENT",
          title: "Mock Event",
          date: "2026-06-14",
          startTime: "20:00",
          confidence: 0.9,
          missingFields: []
        });
     }
     return JSON.stringify({
        entityType: "TASK",
        title: "Mock Task",
        confidence: 0.9,
        missingFields: []
      });
  }

  return JSON.stringify({
    intentType: "UNKNOWN",
    confidence: 1.0,
    entities: {},
    missingFields: [],
    needsClarification: true
  });
}