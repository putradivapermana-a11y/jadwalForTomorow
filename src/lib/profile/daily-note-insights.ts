import { z } from "zod";
import { askAIWithValidationMetadata } from "../ai/model-router";

export const DailyNoteInsightSchema = z.object({
  highlights: z.array(z.string()).default([]),
  struggles: z.array(z.string()).default([]),
  learnedAboutUser: z.array(z.string()).default([]),
  suggestedProfileUpdates: z.array(
    z.object({
      field: z.string(),
      suggestion: z.string()
    })
  ).default([])
});

export type DailyNoteInsight = z.infer<typeof DailyNoteInsightSchema>;

export async function extractDailyNoteInsights(rawText: string) {
  const systemPrompt = `
Kamu adalah asisten AI produktivitas. Tugasmu mengekstrak insight dari catatan harian (daily note) pengguna.
Kamu harus mencari pola terkait jam produktif, kendala, atau hal baru yang bisa dipelajari tentang user.
Jawab SELALU dalam bahasa Indonesia.

Aturan field:
- highlights: Hal-hal baik atau fokus yang berhasil hari ini. (array string)
- struggles: Kendala atau keluhan hari ini. (array string)
- learnedAboutUser: Fakta atau pola baru tentang kebiasaan, preferensi, atau kondisi fisik user. (array string)
- suggestedProfileUpdates: Rekomendasi perubahan profil jadwal (contoh: "productiveHours", "lowEnergyHours", "sleepPreference", "lifeConstraints"). Berikan format field dan saran perubahan. (array obyek { field, suggestion })

Jika teks terlalu singkat atau tidak ada insight yang jelas, biarkan array kosong.
`;

  const userPrompt = `Catatan harian:
"${rawText}"

Ekstrak insight sesuai skema JSON.`;

  try {
    const result = await askAIWithValidationMetadata({
      modelType: "fast",
      systemPrompt,
      userPrompt,
      schema: DailyNoteInsightSchema
    });

    return result;
  } catch (error) {
    console.error("Failed to extract daily note insights:", error);
    return {
      data: null,
      metadata: {
        requestedTier: "fast",
        modelUsed: "",
        providerUsed: "",
        fallbackUsed: false,
        fallbackReason: null,
        validationPassed: false,
        paidFallbackUsed: false
      }
    };
  }
}