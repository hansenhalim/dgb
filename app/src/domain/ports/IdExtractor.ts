export type ExtractedIdType = "ktp" | "sim_old" | "sim_new" | string;

export type ExtractedId = {
  type: ExtractedIdType;
  nik?: string;
  nomorSim?: string;
  nama?: string;
};

export interface IdExtractor {
  /** Send the captured ID photo to OCR and return the extracted fields. */
  extract(imageUri: string): Promise<ExtractedId>;
}
