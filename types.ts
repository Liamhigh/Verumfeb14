export enum OrdinalConfidence {
  VERY_HIGH = "VERY_HIGH",
  HIGH = "HIGH",
  MODERATE = "MODERATE",
  LOW = "LOW",
  INSUFFICIENT = "INSUFFICIENT"
}

export enum EvidenceType {
  PHOTO = "PHOTO",
  VIDEO = "VIDEO",
  DOCUMENT = "DOCUMENT",
  AUDIO = "AUDIO",
  TEXT = "TEXT"
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface CustodyEntry {
  timestamp: number;
  action: string; // "CAPTURED", "SEALED", "ANALYZED"
  actor: string;
  hash: string;
  location?: GeoLocation; // Added for Jurisdiction
  notes?: string;
}

export interface EvidenceArtifact {
  id: string;
  type: EvidenceType;
  content: File | Blob | string; // For text, it's string. For files, Blob/File.
  filename?: string;
  mimeType: string;
  timestamp: number;
  gpsCoordinates?: GeoLocation; // Exif data if available
  sessionLocation?: GeoLocation; // Where it was processed (Jurisdiction)
  deviceInfo: DeviceInfo;
  chainOfCustody: CustodyEntry[];
  cryptographicHash: string; // SHA-512
  previewUrl?: string;
}

export interface BrainFinding {
  brainName: string;
  description: string;
  confidence: OrdinalConfidence;
  anchors: string[]; // Hash references
}

export interface AnalysisResult {
  summary: string;
  findings: BrainFinding[];
  overallConfidence: OrdinalConfidence;
  recommendations: string[];
}