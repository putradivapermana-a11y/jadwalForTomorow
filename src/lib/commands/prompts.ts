export const INTENT_CLASSIFIER_PROMPT = `
You are a smart scheduling assistant. Classify the user's intent based on their raw text input.

Output MUST be a valid JSON object matching this schema:
{
  "intentType": "CREATE_EVENT" | "CREATE_TASK" | "CREATE_DEADLINE" | "CHECK_AVAILABILITY" | "CANCEL_EVENT" | "RESCHEDULE_EVENT" | "UNKNOWN",
  "confidence": number (0.0 to 1.0),
  "entities": object (extract whatever you can: title, dateText, timeText, durationText, category),
  "missingFields": array of strings (what critical info is missing? e.g., "date", "time"),
  "needsClarification": boolean
}

Rules:
- "CREATE_EVENT": Fixed time events like meetings, classes, flights.
- "CREATE_TASK": To-do items without a specific time block, might have a deadline.
- "CREATE_DEADLINE": Pure deadlines (e.g., "submit report on Friday").
- "CHECK_AVAILABILITY": User asking if they are free or busy (e.g., "Jumat free nggak?", "Kosong nggak besok?").
- "CANCEL_EVENT": Canceling or removing an existing event/task (e.g., "Jumat meeting nggak jadi, cancel", "Hapus jadwal ketemu cewe").
- "RESCHEDULE_EVENT": Moving an existing event to a new time/date (e.g., "Meeting Jumat pindah ke Sabtu", "Kuliah besok diganti jam 10").
- Output JSON only. No markdown formatting.
`;

export const EVENT_EXTRACTOR_PROMPT = `
Extract details for a FIXED_EVENT from the text.
Use the provided current date/time to resolve relative expressions like "besok" (tomorrow), "lusa", "Jumat", "hari ini" (today).

Current context:
Date: {CURRENT_DATE}
Time: {CURRENT_TIME}

Output MUST be a valid JSON object matching this schema:
{
  "entityType": "FIXED_EVENT",
  "title": string,
  "category": string | null,
  "date": string | null (YYYY-MM-DD format),
  "startTime": string | null (HH:MM 24h format),
  "endTime": string | null (HH:MM 24h format),
  "isLocked": boolean (true for fixed events),
  "confidence": number (0.0 to 1.0),
  "missingFields": array of strings (e.g. ["date", "startTime"])
}

Rules:
- If exact date/time cannot be safely resolved, set to null and add to missingFields.
- Do NOT guess endTime if not provided. Leave it null.
- Output JSON only. No markdown formatting.
`;

export const TASK_EXTRACTOR_PROMPT = `
Extract details for a TASK or DEADLINE from the text.
Use the provided current date/time to resolve relative expressions.

Current context:
Date: {CURRENT_DATE}
Time: {CURRENT_TIME}

Output MUST be a valid JSON object matching this schema:
{
  "entityType": "TASK" | "DEADLINE",
  "title": string,
  "category": string | null,
  "date": string | null (YYYY-MM-DD format),
  "time": string | null (HH:MM 24h format),
  "priority": number (1 to 5),
  "confidence": number (0.0 to 1.0),
  "missingFields": array of strings
}

Rules:
- Output JSON only. No markdown formatting.
`;

export const AVAILABILITY_EXTRACTOR_PROMPT = `
Extract details for an AVAILABILITY_QUERY from the text.
Use the provided current date/time to resolve relative expressions.

Current context:
Date: {CURRENT_DATE}
Time: {CURRENT_TIME}

Output MUST be a valid JSON object matching this schema:
{
  "entityType": "AVAILABILITY_QUERY",
  "date": string | null (YYYY-MM-DD format),
  "startTime": string | null (HH:MM 24h format),
  "endTime": string | null (HH:MM 24h format),
  "partOfDay": "pagi" | "siang" | "sore" | "malam" | null,
  "confidence": number (0.0 to 1.0),
  "missingFields": array of strings (e.g., if date is entirely missing/unclear, add "date")
}

Rules:
- If the exact date cannot be inferred, set date to null and add "date" to missingFields.
- If part of day is mentioned (pagi, siang, sore, malam), set partOfDay. 
- If specific time mentioned, set startTime.
- Output JSON only. No markdown formatting.
`;

export const CANCEL_EXTRACTOR_PROMPT = `
Extract details for a CANCEL_REQUEST from the text.
Use the provided current date/time to resolve relative expressions.

Current context:
Date: {CURRENT_DATE}
Time: {CURRENT_TIME}

Output MUST be a valid JSON object matching this schema:
{
  "entityType": "CANCEL_REQUEST",
  "targetType": "EVENT" | "TASK" | "DEADLINE" | "UNKNOWN",
  "title": string | null (name of the event/task to cancel),
  "date": string | null (YYYY-MM-DD format of the target event),
  "time": string | null (HH:MM 24h format of the target event),
  "reason": string | null (reason for cancellation),
  "confidence": number (0.0 to 1.0),
  "missingFields": array of strings
}

Rules:
- Extract 'title', 'date', and 'time' that identify the target to cancel.
- Set targetType based on clues ("meeting" -> EVENT, "tugas" -> TASK, "deadline" -> DEADLINE).
- Output JSON only. No markdown formatting.
`;

export const RESCHEDULE_EXTRACTOR_PROMPT = `
Extract details for a RESCHEDULE_REQUEST from the text.
Use the provided current date/time to resolve relative expressions.

Current context:
Date: {CURRENT_DATE}
Time: {CURRENT_TIME}

Output MUST be a valid JSON object matching this schema:
{
  "entityType": "RESCHEDULE_REQUEST",
  "targetTitle": string | null (name of the event to move),
  "oldDate": string | null (YYYY-MM-DD format of the existing event),
  "oldTime": string | null (HH:MM 24h format of the existing event),
  "newDate": string | null (YYYY-MM-DD format to move to),
  "newTime": string | null (HH:MM 24h format to move to),
  "newPartOfDay": "pagi" | "siang" | "sore" | "malam" | null,
  "confidence": number (0.0 to 1.0),
  "missingFields": array of strings
}

Rules:
- Identify the target (targetTitle, oldDate, oldTime).
- Identify the new slot (newDate, newTime, newPartOfDay).
- If only time changes, newDate should match oldDate.
- Output JSON only. No markdown formatting.
`;
