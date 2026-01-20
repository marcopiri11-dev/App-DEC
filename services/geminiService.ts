
import { GoogleGenAI } from "@google/genai";
import { Grade, EVALUATION_CATEGORIES, PathPoint, ErrorEvent } from '../types';

export const generateDrivingFeedback = async (
  studentName: string,
  scores: Record<string, Grade>,
  path: PathPoint[],
  errors: ErrorEvent[]
): Promise<string> => {
  try {
    if (!process.env.API_KEY) {
      console.warn("API Key mancante");
      return "Configurazione incompleta: chiave API mancante.";
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let scoreSummary = "";
    EVALUATION_CATEGORIES.forEach(category => {
      category.items.forEach(item => {
        const grade = scores[item.id];
        if (grade && grade !== Grade.UNSET) {
          let gradeText = "";
          if (grade === Grade.GOOD) gradeText = "OTTIMO (Verde - Automatismo)";
          else if (grade === Grade.WARNING) gradeText = "DA MIGLIORARE (Giallo - Competenza Cosciente)";
          else if (grade === Grade.CRITICAL) gradeText = "INSUFFICIENTE (Rosso - Incompetenza Incosciente)";
          scoreSummary += `- ${category.title} > ${item.label}: ${gradeText}\n`;
        }
      });
    });

    const errorNotes = errors.map(e => `- ${e.note}`).join('\n');
    const pathDescription = path.length > 0 
      ? `L'allievo ha guidato per circa ${(path.length * 0.05).toFixed(1)} km.` 
      : "Dati geografici non disponibili.";

    const prompt = `
      RUOLO: Sei il tutor di guida evoluta "Metodo DEC".
      ALLIEVO: ${studentName}.
      
      DATI SESSIONE:
      ${scoreSummary}
      NOTE DI ERRORE: ${errorNotes || "Nessun errore grave rilevato"}
      INFO PERCORSO: ${pathDescription}

      OBIETTIVO:
      Scrivi un feedback tecnico ma motivante. Usa un tono professionale da "Elite Coach".
      Evidenzia i punti di forza e indica esattamente su quali "automatismi" (Verdi) deve ancora lavorare.
      Se ci sono errori rossi, spiega come evitarli con calma e autorità.

      REGOLE:
      1. Sii sintetico (max 120 parole).
      2. Usa solo l'Italiano.
      3. Non usare liste puntate nel feedback finale, scrivi un paragrafo fluido.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        topP: 0.9,
      }
    });

    const text = response.text;
    if (!text) throw new Error("Risposta vuota dall'IA");
    
    return text.trim();
  } catch (error: any) {
    console.error("AI Logic Error:", error);
    // Fallback amichevole se l'IA fallisce (es. quota superata o rete instabile)
    return "Ottima sessione di guida! L'allievo ha dimostrato impegno. Continua a lavorare sulla precisione dei comandi e sulla lettura della strada per perfezionare gli automatismi.";
  }
};
