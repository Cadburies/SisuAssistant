export type LatLon = { lat: number; lon: number };

/** Signal K `resources/notes` record shape (name/description/position/url/mimeType). */
export type Note = {
  id: string;
  name: string;
  description?: string;
  position: { latitude: number; longitude: number };
  /** Optional "open in NFL/Navily" outbound link. */
  url?: string;
  mimeType?: string;
};

export type NoteDraft = {
  name: string;
  description: string;
  url: string;
};
