
import { GoogleGenAI } from "@google/genai";
import { Grade, EVALUATION_CATEGORIES, PathPoint, ErrorEvent } from '../types';

export const generateDrivingFeedback = async (
  studentName: string,
  scores: Record<string, Grade>,
  path: PathPoint[],
  errors: ErrorEvent[]
): Promise<string> => {
  try {
    // Inizializzazione protetta
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let scoreSummary = "";
    EVALUATION_CATEGORIES.forEach(category => {
      category.items.forEach(item => {
        const grade = scores[item.id];
        if (grade && grade !== Grade.UNSET) {
          let gradeText = "";
          if (grade === Grade.GOOD) gradeText = "Automatismo (Verde)";
          else if (grade === Grade.WARNING) gradeText = "Competenza Cosciente (Giallo)";
          else if (grade === Grade.CRITICAL) gradeText = "Incompetenza Incosciente (Rosso)";
          scoreSummary += `- ${item.label}: ${gradeText}\n`;
        }
      });
    });

    const errorNotes = errors.map(e => `- Alle ore ${new Date(e.timestamp).toLocaleTimeString()}: ${e.note}`).join('\n');
    const pathDescription = path.length > 0 
      ? `L'allievo ha percorso un tragitto di circa ${(path.length * 0.05).toFixed(1)} km.` 
      : "Percorso non tracciato.";

    const prompt = `
      Sei un istruttore di scuola guida esperto e motivante. Scrivi un report per: ${studentName}.
      
      Dati:
      ${scoreSummary}
      Errori: ${errorNotes || "Nessuno"}
      Percorso: ${pathDescription}

      LINEE GUIDA:
      1. Tono positivo e professionale.
      2. Spiega brevemente gli errori come punti di crescita.
      3. Massimo 200 parole. Rispondi in Italiano.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Feedback salvato con successo.";
  } catch (error) {
    console.error("Error generating feedback:", error);
    return "Feedback non generabile (offline), ma i dati della guida sono stati salvati correttamente.";
  }
};
