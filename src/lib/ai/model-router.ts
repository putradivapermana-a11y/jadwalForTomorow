import { z } from "zod";

export interface AIRequestOptions {
  modelType?: 'fast' | 'fast_backup' | 'worker' | 'review' | 'critical';
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: 'json_object' | 'text';
}

export interface AIValidationOptions<T> {
  modelType: 'fast' | 'worker';
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  isDailyPlan?: boolean;
}

export interface AIMetadata {
  requestedTier: string;
  modelUsed: string;
  providerUsed: string;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  validationPassed: boolean;
  paidFallbackUsed: boolean;
}

export interface AIValidationResult<T> {
  data: T | null;
  metadata: AIMetadata;
}

export async function askAIWithValidation<T>(options: AIValidationOptions<T>): Promise<T | null> {
  const res = await askAIWithValidationMetadata(options);
  return res.data;
}

export async function askAIWithValidationMetadata<T>(options: AIValidationOptions<T>): Promise<AIValidationResult<T>> {
  let attemptCount = 0;
  
  const provider = process.env.AI_PROVIDER || 'mock';
  const meta: AIMetadata = {
    requestedTier: options.modelType,
    modelUsed: '',
    providerUsed: provider,
    fallbackUsed: false,
    fallbackReason: null,
    validationPassed: false,
    paidFallbackUsed: false
  };
  
  // 1. Primary Try
  let result = await tryExtract(options.modelType, options);
  if (result.success) {
    meta.modelUsed = getModelConfig(options.modelType);
    meta.validationPassed = true;
    console.info("[AI_CALL]", meta);
    return { data: result.data, metadata: meta };
  }
  attemptCount++;

  // 2. Backup / repair
  const backupModel = options.modelType === 'fast' ? 'fast_backup' : 'worker';
  result = await tryExtract(backupModel, options);
  if (result.success) {
    meta.modelUsed = getModelConfig(backupModel);
    meta.validationPassed = true;
    meta.fallbackUsed = true;
    meta.fallbackReason = `validation_failed_on_${options.modelType}`;
    console.info("[AI_CALL]", meta);
    return { data: result.data, metadata: meta };
  }
  attemptCount++;

  // 3. Critical fallback policy check
  const allowPaid = process.env.AI_ALLOW_PAID_FALLBACK === 'true';
  const paidOnlyFor = (process.env.AI_PAID_ONLY_FOR || '').split(',').map(s => s.trim());
  
  const explicitAcc = options.userPrompt.toLowerCase().includes("high accuracy") || options.userPrompt.toLowerCase().includes("penting");
  const isAmbiguousPlan = options.isDailyPlan && attemptCount >= 2;
  
  let shouldCallCritical = false;
  if (allowPaid) {
    if (isAmbiguousPlan || explicitAcc || attemptCount >= 2) {
      if (paidOnlyFor.includes('critical') || paidOnlyFor.includes('daily_plan') || paidOnlyFor.includes('repair')) {
        shouldCallCritical = true;
      }
      // If AI_PAID_ONLY_FOR is empty/not strict, we might allow it anyway
      if (paidOnlyFor.length === 0 || paidOnlyFor[0] === "") {
        shouldCallCritical = true;
      }
    }
  }

  if (shouldCallCritical) {
    result = await tryExtract('critical', options);
    if (result.success) {
      meta.modelUsed = getModelConfig('critical');
      meta.validationPassed = true;
      meta.fallbackUsed = true;
      meta.fallbackReason = "ambiguous_or_repeated_failure";
      meta.paidFallbackUsed = true;
      console.info("[AI_CALL]", meta);
      return { data: result.data, metadata: meta };
    }
  }

  meta.modelUsed = getModelConfig(shouldCallCritical ? 'critical' : backupModel);
  meta.fallbackUsed = attemptCount > 0;
  meta.fallbackReason = "all_attempts_failed";
  console.info("[AI_CALL]", meta);
  return { data: null, metadata: meta };
}

async function tryExtract<T>(
  modelType: AIRequestOptions['modelType'], 
  options: AIValidationOptions<T>
): Promise<{success: true, data: T} | {success: false, error: unknown}> {
  const responseText = await askAI({
    modelType,
    systemPrompt: options.systemPrompt,
    userPrompt: options.userPrompt,
    responseFormat: 'json_object'
  });

  if (!responseText) return { success: false, error: "Empty response" };

  try {
    const parsed = JSON.parse(responseText);
    const data = options.schema.parse(parsed);
    return { success: true, data };
  } catch (err) {
    console.error(`Validation failed for model ${modelType}:`, err);
    return { success: false, error: err };
  }
}

export async function askAI(options: AIRequestOptions): Promise<string | null> {
  const provider = process.env.AI_PROVIDER;
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;

  // Simple fallback/mock if no real provider configured
  if (!provider || !apiKey || provider === 'mock') {
    return mockAI(options.userPrompt);
  }

  const modelType = options.modelType || 'fast';
  
  if (modelType === 'critical' && process.env.AI_ALLOW_PAID_FALLBACK !== 'true') {
     console.warn("CRITICAL model requested but AI_ALLOW_PAID_FALLBACK is false. Aborting AI request.");
     return null;
  }

  const model = getModelConfig(modelType);

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
          stream: false
        }),
      });

      const text = await response.text();

      if (!response.ok) {
        console.error(`AI Provider error: ${response.status} ${response.statusText}`);
        console.error(text);
        return null;
      }

      try {
        const data = JSON.parse(text);
        return data.choices?.[0]?.message?.content || null;
      } catch {
        console.error("AI Provider returned invalid JSON:", text);
        return null;
      }
    }
  } catch (error) {
    console.error("Failed to connect to AI provider:", error);
    return null;
  }
}

function getModelConfig(type: AIRequestOptions['modelType']) {
  switch (type) {
    case 'fast': return process.env.AI_MODEL_FAST || 'gpt-3.5-turbo';
    case 'fast_backup': return process.env.AI_MODEL_FAST_BACKUP || process.env.AI_MODEL_FAST || 'gpt-3.5-turbo';
    case 'worker': return process.env.AI_MODEL_WORKER || 'gpt-4o-mini';
    case 'review': return process.env.AI_MODEL_REVIEW || 'gpt-4o';
    case 'critical': return process.env.AI_MODEL_CRITICAL || 'gpt-4';
    default: return process.env.AI_MODEL_FAST || 'gpt-3.5-turbo';
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