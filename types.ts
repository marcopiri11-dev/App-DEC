
export enum Grade {
  GOOD = 'GOOD',       // Green - Automatismo
  WARNING = 'WARNING', // Yellow - Competenza Cosciente
  CRITICAL = 'CRITICAL', // Red - Incompetenza Incosciente
  UNSET = 'UNSET'
}

export interface PathPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface ErrorEvent {
  id: string;
  location: PathPoint;
  note: string;
  audioBlob?: Blob;
  audioUrl?: string;
  timestamp: number;
}

export interface Student {
  id: string;
  name: string;
  phoneNumber?: string; // Numero per WhatsApp
  licenseType: 'B' | 'A' | 'C';
  totalHours: number;
  avatarUrl: string;
}

export interface EvaluationItem {
  id: string;
  label: string;
}

export interface EvaluationCategory {
  id: string;
  title: string;
  items: EvaluationItem[];
}

export interface EvaluationResult {
  studentId: string;
  date: string;
  scores: Record<string, Grade>; 
  feedback?: string;
  path?: PathPoint[];
  errors?: ErrorEvent[];
}

export const EVALUATION_CATEGORIES: EvaluationCategory[] = [
  {
    id: 'w1_posture',
    title: 'Postura Guida',
    items: [
      { id: 'seat', label: 'Sedile' },
      { id: 'backrest', label: 'Schienale' },
      { id: 'headrest', label: 'Poggiatesta' },
      { id: 'mirrors', label: 'Specchietti' },
      { id: 'seatbelts', label: 'Cinture' },
    ]
  },
  {
    id: 'w1_gaze_steering',
    title: 'Sguardo e Volante',
    items: [
      { id: 'anticipate_pull', label: 'Anticipa tira' },
      { id: 'ant_pull_incr_rel', label: 'Ant tira incr ril' },
      { id: 'curve', label: 'Curva' },
      { id: 'reverse', label: 'Retromarcia' },
      { id: 'lane_change', label: 'Cambi corsia' },
      { id: 'turn_right', label: 'Svolta dx' },
      { id: 'turn_left', label: 'Svolta sx' },
      { id: 'roundabout', label: 'Rotatoria' },
      { id: 'highway', label: 'Autostrada' },
      { id: 'w1_signs_1', label: 'Lettura Segnaletica' },
    ]
  },
  {
    id: 'w1_pedals',
    title: 'Freno e Acceleratore',
    items: [
      { id: 'brake_descend', label: 'Freno: Modulare in discesa' },
      { id: 'brake_50_10', label: 'Freno: 50/10' },
      { id: 'brake_70_30', label: 'Freno: 70/30' },
      { id: 'acc_static', label: 'ACC: Modulazione statica' },
      { id: 'acc_30_70', label: 'ACC: 30/70' },
    ]
  },
  {
    id: 'w2_gears',
    title: 'Cambio',
    items: [
      { id: 'gear_343', label: '3-4-3' },
      { id: 'gear_121', label: '1-2-1' },
      { id: 'gear_232', label: '2-3-2' },
      { id: 'gear_454', label: '4-5-4' },
      { id: 'gear_seq_up', label: '1-2-3-4-5' },
      { id: 'gear_seq_down', label: '5-4-3-2-1' },
      { id: 'gear_flat', label: 'Pianura' },
      { id: 'gear_uphill', label: 'Salita' },
      { id: 'gear_downhill', label: 'Discesa' },
    ]
  },
  {
    id: 'w2_clutch',
    title: 'Frizione',
    items: [
      { id: 'clutch_engage', label: 'Innesto' },
      { id: 'clutch_start_bal', label: 'Part. Salita-equilibrio' },
      { id: 'clutch_start_fm', label: 'Part. Sal. F.m.' },
      { id: 'clutch_maneuver', label: 'Manovra' },
    ]
  },
  {
    id: 'month2',
    title: 'Tutti i comandi',
    items: [
      { id: 'm2_lane_change', label: 'Cambi corsia' },
      { id: 'm2_sv_dx', label: 'SV DX' },
      { id: 'm2_sv_sx', label: 'SV SX' },
      { id: 'm2_rotatories', label: 'Rotatorie' },
      { id: 'm2_highway', label: 'Autostrada' },
      { id: 'm2_park_pettine_dx', label: 'Parcheggio a pettine dx' },
      { id: 'm2_park_pettine_sx', label: 'Parcheggio a pettine sx' },
      { id: 'm2_reverse_straight', label: 'Retromarcia dritta' },
      { id: 'm2_u_turn', label: 'Inversione a U' },
      { id: 'm2_park_line_dx', label: 'Parcheggio in linea dx' },
      { id: 'm2_park_line_sx', label: 'Parcheggio in linea sx' },
      { id: 'm2_signs', label: 'Lettura Segnaletica' },
    ]
  },
  {
    id: 'exam_zones',
    title: 'Zone Esame',
    items: [
      { id: 'zone_staglieno', label: 'Staglieno-Marassi-Molassana' },
      { id: 'zone_bolza', label: 'Bolzaneto' },
      { id: 'zone_sampi', label: 'Sampierdarena' },
      { id: 'zone_nervi', label: 'Nervi-Quarto' },
      { id: 'zone_sestri_erzelli', label: 'Sestri P.-Erzelli' },
      { id: 'zone_recco', label: 'Recco' },
    ]
  }
];
