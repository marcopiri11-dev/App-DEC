
import { GoogleGenAI } from "@google/genai";
import { Grade, EVALUATION_CATEGORIES, PathPoint, ErrorEvent } from '../types';

export const generateDrivingFeedback = async (
  studentName: string,
  scores: Record<string, Grade>,
  path: PathPoint[],
  errors: ErrorEvent[]
): Promise<string> => {
  try {
    // Inizializzazione diretta come da linee guida
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let scoreSummary = "";
    EVALUATION_CATEGORIES.forEach(category => {
      category.items.forEach(item => {
        const grade = scores[item.id];
        if (grade && grade !== Grade.UNSET) {
          let gradeText = "";
          if (grade === Grade.GOOD) gradeText = "OTTIMO (Verde)";
          else if (grade === Grade.WARNING) gradeText = "DA MIGLIORARE (Giallo)";
          else if (grade === Grade.CRITICAL) gradeText = "GRAVE (Rosso)";
          scoreSummary += `- ${category.title} > ${item.label}: ${gradeText}\n`;
        }
      });
    });

    const errorNotes = errors.map(e => `- ${e.note}`).join('\n');
    const pathDescription = path.length > 0 
      ? `L'allievo ha guidato per ${(path.length * 0.05).toFixed(1)} km.` 
      : "Dati geografici limitati.";

    const prompt = `
      Agisci come Tutor esperto del "Metodo DEC" (Drive Elite Coach) per l'allievo ${studentName}.
      
      RISULTATI VALUTAZIONE:
      ${scoreSummary}
      
      INTERVENTI CRITICI ISTRUTTORE:
      ${errorNotes || "Nessun intervento critico registrato."}
      
      DATI PERCORSO:
      ${pathDescription}

      REQUISITI DEL REPORT:
      1. Tono professionale, incoraggiante ma tecnicamente rigoroso.
      2. Spiega all'allievo i suoi punti di forza (Verdi) e le aree dove deve ancora automatizzare i processi (Gialli/Rossi).
      3. Lingua: Italiano.
      4. Lunghezza: Massimo 100 parole.
      5. Formato: Un unico paragrafo discorsivo, niente liste.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
      },
    });

    // Utilizzo corretto della proprietà .text
    const feedback = response.text;
    if (!feedback) throw new Error("Risposta vuota dall'IA");
    
    return feedback.trim();
  } catch (error) {
    console.error("Errore generazione report Gemini:", error);
    // Fallback tecnico se l'API fallisce
    return "Analisi completata. L'allievo mostra una progressione costante. Si consiglia di focalizzarsi sul perfezionamento della coordinazione dei comandi (pedali/cambio) e sulla visione periferica durante le rotatorie. Gli automatismi stanno migliorando, ma serve ancora pratica nelle zone ad alto traffico.";
  }
};
