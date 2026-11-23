/**
 * The complete inspection checklist.
 *
 * Every section and field of the mechanic's form is defined here. To add a check,
 * add a field to a section. Answers are stored in `leads.data[field.key]`; fields with
 * a `column` are also copied into that column of the `leads` table (used for lists and filters).
 */

export type DriveType = "bev" | "phev" | "hev" | "ice";
export type CheckStatus = "ok" | "minor" | "major" | "na";

export interface CheckValue {
  status?: CheckStatus;
  note?: string;
  cost?: string;
  /** measurements, e.g. paint thickness or tread depth */
  m?: Record<string, string>;
}

export type InspectionData = Record<string, unknown>;

export type LeadColumn =
  | "vin"
  | "plate"
  | "make"
  | "model"
  | "variant"
  | "drive_type"
  | "first_registration"
  | "mileage"
  | "power_kw"
  | "color"
  | "battery_capacity_kwh"
  | "soh_percent"
  | "range_km"
  | "battery_ownership"
  | "seller_name"
  | "seller_phone"
  | "seller_email"
  | "seller_type"
  | "asking_price"
  | "grade"
  | "recommendation"
  | "suggested_price"
  | "mechanic_notes"
  | "gdpr_consent"
  | "signature_path";

type Condition = (data: InspectionData) => boolean;

export interface Option {
  value: string;
  label: string;
}

export interface Measure {
  key: string;
  label: string;
  placeholder?: string;
  decimal?: boolean;
}

interface BaseField {
  key: string;
  label: string;
  hint?: string;
  showIf?: Condition;
  /** blocks submission when empty */
  required?: boolean;
  /** message shown when a required field is empty (default: "<label> fehlt") */
  requiredMessage?: string;
  column?: LeadColumn;
}

export type Field =
  | (BaseField & {
      type: "text";
      placeholder?: string;
      uppercase?: boolean;
      inputMode?: "text" | "tel" | "email";
      suggestions?: string[];
    })
  | (BaseField & { type: "number"; unit?: string; decimal?: boolean; placeholder?: string })
  | (BaseField & { type: "textarea"; placeholder?: string })
  | (BaseField & { type: "month" })
  | (BaseField & { type: "select"; options: Option[] })
  | (BaseField & { type: "multi"; options: Option[] })
  | (BaseField & { type: "boolean" })
  | (BaseField & { type: "check"; measures?: Measure[] })
  | (BaseField & { type: "photo" })
  | (BaseField & { type: "signature" })
  | (BaseField & { type: "heading" });

export interface Section {
  key: string;
  title: string;
  icon: string;
  intro?: string;
  showIf?: Condition;
  fields: Field[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const drive = (data: InspectionData) => data.drive_type as DriveType | undefined;
/** Battery-electric or plug-in hybrid, or not chosen yet (show EV checks by default). */
const hasHvBattery: Condition = (d) => !drive(d) || drive(d) === "bev" || drive(d) === "phev";
const hasEngine: Condition = (d) => drive(d) === "phev" || drive(d) === "hev" || drive(d) === "ice";
const isElectrified: Condition = (d) => drive(d) !== "ice";

const yesNo: Option[] = [
  { value: "yes", label: "Ja" },
  { value: "no", label: "Nein" },
];
const yesNoUnknown: Option[] = [...yesNo, { value: "unknown", label: "Unbekannt" }];

const check = (key: string, label: string, extra: Partial<Omit<BaseField, "key" | "label">> & { measures?: Measure[] } = {}): Field => ({
  type: "check",
  key,
  label,
  ...extra,
});

const photo = (key: string, label: string, extra: Partial<Omit<BaseField, "key" | "label">> = {}): Field => ({
  type: "photo",
  key,
  label,
  ...extra,
});

const paint: Measure[] = [{ key: "um", label: "µm", placeholder: "z. B. 120" }];
const tire: Measure[] = [
  { key: "mm", label: "Profil mm", placeholder: "6,5", decimal: true },
  { key: "dot", label: "DOT", placeholder: "2322" },
];

export const MAKES = [
  "Tesla", "Volkswagen", "Hyundai", "Kia", "Renault", "BMW", "Mercedes-Benz", "Audi", "Skoda",
  "Cupra", "Seat", "Opel", "Peugeot", "Citroën", "Fiat", "Nissan", "MG", "BYD", "Polestar", "Volvo",
  "Porsche", "smart", "Dacia", "Toyota", "Ford", "MINI", "Mazda", "Jaguar", "Lexus", "Honda", "Xpeng",
  "NIO", "Zeekr", "Lynk & Co", "Jeep", "DS",
];

// ---------------------------------------------------------------------------
// Sections (in the order the mechanic works through the car)
// ---------------------------------------------------------------------------

export const SECTIONS: Section[] = [
  {
    key: "fahrzeug",
    title: "Fahrzeug",
    icon: "car",
    intro: "Fahrzeugdaten aus dem Fahrzeugschein (Teil I) übernehmen.",
    fields: [
      { type: "select", key: "drive_type", label: "Antrieb", column: "drive_type", required: true, options: [
        { value: "bev", label: "Elektro (BEV)" },
        { value: "phev", label: "Plug-in-Hybrid" },
        { value: "hev", label: "Hybrid" },
        { value: "ice", label: "Verbrenner" },
      ] },
      { type: "text", key: "vin", label: "FIN (Fahrgestellnummer)", column: "vin", uppercase: true, placeholder: "17 Zeichen", hint: "FIN oder Kennzeichen ist Pflicht." },
      { type: "text", key: "plate", label: "Kennzeichen", column: "plate", uppercase: true, placeholder: "M-AB 1234" },
      photo("foto_fin", "Foto FIN (Typenschild oder Windschutzscheibe)", { required: true }),
      { type: "text", key: "make", label: "Marke", column: "make", suggestions: MAKES, required: true },
      { type: "text", key: "model", label: "Modell", column: "model", placeholder: "z. B. Model 3, ID.3, Ioniq 5", required: true },
      { type: "text", key: "variant", label: "Variante / Ausstattung", column: "variant", placeholder: "z. B. Long Range AWD" },
      { type: "month", key: "first_registration", label: "Erstzulassung", column: "first_registration" },
      { type: "number", key: "mileage", label: "Kilometerstand", unit: "km", column: "mileage", required: true },
      photo("foto_tacho", "Foto Kilometerstand", { required: true }),
      { type: "number", key: "power_kw", label: "Leistung", unit: "kW", column: "power_kw" },
      { type: "number", key: "battery_capacity_kwh", label: "Batteriekapazität", unit: "kWh", decimal: true, column: "battery_capacity_kwh", showIf: hasHvBattery },
      { type: "text", key: "color", label: "Farbe", column: "color" },
      { type: "number", key: "previous_owners", label: "Anzahl Halter" },
      { type: "month", key: "hu_due", label: "HU / TÜV gültig bis" },
      photo("foto_zb1", "Zulassungsbescheinigung Teil I", { required: true }),
      photo("foto_zb2", "Zulassungsbescheinigung Teil II"),
    ],
  },
  {
    key: "dokumente",
    title: "Dokumente & Historie",
    icon: "file",
    fields: [
      { type: "select", key: "zb2_status", label: "Teil II (Fahrzeugbrief)", options: [
        { value: "present", label: "Vorhanden" },
        { value: "bank", label: "Bei Bank (Finanzierung)" },
        { value: "missing", label: "Fehlt" },
      ] },
      { type: "select", key: "service_book", label: "Serviceheft", options: [
        { value: "complete", label: "Lückenlos" },
        { value: "partial", label: "Teilweise" },
        { value: "digital", label: "Digital" },
        { value: "missing", label: "Fehlt" },
      ] },
      { type: "month", key: "last_service", label: "Letzter Service" },
      { type: "number", key: "last_service_km", label: "km beim letzten Service", unit: "km" },
      { type: "select", key: "invoices", label: "Rechnungen vorhanden", options: yesNo },
      { type: "number", key: "keys_count", label: "Anzahl Schlüssel / Keycards" },
      photo("foto_schluessel", "Foto Schlüssel", { required: true }),
      { type: "select", key: "import", label: "Importfahrzeug", options: yesNoUnknown },
      { type: "select", key: "accident_status", label: "Unfallstatus laut Verkäufer", options: [
        { value: "none", label: "Unfallfrei" },
        { value: "known", label: "Unfall bekannt" },
        { value: "unknown", label: "Unbekannt" },
      ] },
      { type: "textarea", key: "known_damages", label: "Bekannte Schäden / Reparaturen", placeholder: "Was hat der Verkäufer angegeben?" },
      { type: "text", key: "timing_belt", label: "Zahnriemen / Steuerkette gewechselt", placeholder: "Datum und km", showIf: hasEngine },
    ],
  },
  {
    key: "batterie",
    title: "Hochvoltbatterie",
    icon: "battery",
    showIf: hasHvBattery,
    intro: "Die Batterie ist das teuerste Bauteil. SoH wenn möglich mit Messgerät (z. B. AVILOO) oder OBD prüfen.",
    fields: [
      { type: "number", key: "soh_percent", label: "Batterie-Gesundheit (SoH)", unit: "%", decimal: true, column: "soh_percent" },
      { type: "select", key: "soh_source", label: "SoH ermittelt mit", options: [
        { value: "aviloo", label: "AVILOO / Batterietest" },
        { value: "obd", label: "OBD-Tool" },
        { value: "oem", label: "Hersteller-Zertifikat" },
        { value: "car", label: "Bordcomputer" },
        { value: "none", label: "Nicht gemessen" },
      ] },
      photo("foto_soh", "Batterie-Zertifikat / Messergebnis"),
      { type: "number", key: "range_km", label: "Reichweite bei 100 %", unit: "km", column: "range_km" },
      { type: "number", key: "charge_level", label: "Aktueller Ladestand", unit: "%" },
      { type: "select", key: "battery_ownership", label: "Batterie", column: "battery_ownership", hint: "Bei älteren Renault ZOE / Kangoo oft Mietbatterie!", options: [
        { value: "owned", label: "Kaufbatterie" },
        { value: "rented", label: "Mietbatterie" },
        { value: "unknown", label: "Unbekannt" },
      ] },
      { type: "text", key: "battery_warranty", label: "Batteriegarantie bis", placeholder: "z. B. 03/2029 oder 160.000 km" },
      check("bat_housing", "Batteriegehäuse / Unterboden (Kratzer, Dellen, Aufsetzer)"),
      check("hv_cables", "HV-Leitungen (orange) und Stecker"),
      check("hv_warnings", "Keine HV- / Batterie-Warnmeldungen"),
      check("bat_cooling", "Batteriekühlung / Kühlmittelstand"),
      check("aux_battery", "12-V-Batterie"),
    ],
  },
  {
    key: "laden",
    title: "Laden",
    icon: "plug",
    showIf: hasHvBattery,
    fields: [
      check("charge_port", "Ladebuchse & Ladeklappe"),
      check("ac_charging", "AC-Laden getestet (Wallbox / Typ 2)", { measures: [{ key: "kw", label: "kW", decimal: true }] }),
      check("dc_charging", "DC-Schnellladen getestet", { measures: [{ key: "kw", label: "kW", decimal: true }], hint: "Wenn kein Schnelllader erreichbar: „nicht geprüft“." }),
      check("charge_lock", "Ladekabel-Verriegelung"),
      { type: "multi", key: "cables", label: "Ladekabel vorhanden", options: [
        { value: "type2", label: "Typ 2 (Mode 3)" },
        { value: "iccb", label: "Notladekabel Schuko" },
        { value: "cee", label: "CEE / Adapter" },
        { value: "type1", label: "Typ 1" },
        { value: "none", label: "Keins" },
      ] },
      photo("foto_kabel", "Foto Ladekabel"),
    ],
  },
  {
    key: "karosserie",
    title: "Karosserie & Lack",
    icon: "carfront",
    intro: "Lackschichtdicke je Teil messen. Werte deutlich über ca. 160 µm deuten auf Nachlackierung / Spachtel hin.",
    fields: [
      check("p_bumper_front", "Stoßfänger vorne", { measures: paint }),
      check("p_hood", "Motorhaube / Fronthaube", { measures: paint }),
      check("p_fender_fl", "Kotflügel vorne links", { measures: paint }),
      check("p_door_fl", "Tür vorne links", { measures: paint }),
      check("p_door_rl", "Tür hinten links", { measures: paint }),
      check("p_quarter_l", "Seitenwand hinten links", { measures: paint }),
      check("p_sill_l", "Schweller links", { measures: paint }),
      check("p_roof", "Dach", { measures: paint }),
      check("p_tailgate", "Heckklappe / Kofferraumdeckel", { measures: paint }),
      check("p_bumper_rear", "Stoßfänger hinten", { measures: paint }),
      check("p_quarter_r", "Seitenwand hinten rechts", { measures: paint }),
      check("p_door_rr", "Tür hinten rechts", { measures: paint }),
      check("p_door_fr", "Tür vorne rechts", { measures: paint }),
      check("p_fender_fr", "Kotflügel vorne rechts", { measures: paint }),
      check("p_sill_r", "Schweller rechts", { measures: paint }),
      check("p_mirrors", "Außenspiegel"),
      check("gaps", "Spaltmaße gleichmäßig"),
      check("rust", "Rost (Radläufe, Türunterkanten, Falze)"),
      check("windshield", "Frontscheibe (Steinschläge, Risse)"),
      check("windows", "Seiten- und Heckscheiben"),
      check("headlights", "Scheinwerfer (Risse, Feuchtigkeit)"),
      check("taillights", "Rückleuchten"),
    ],
  },
  {
    key: "raeder",
    title: "Räder & Reifen",
    icon: "wheel",
    fields: [
      check("tire_fl", "Rad vorne links", { measures: tire }),
      check("tire_fr", "Rad vorne rechts", { measures: tire }),
      check("tire_rl", "Rad hinten links", { measures: tire }),
      check("tire_rr", "Rad hinten rechts", { measures: tire }),
      { type: "text", key: "tire_size", label: "Reifengröße", placeholder: "z. B. 235/45 R18" },
      { type: "text", key: "tire_brand", label: "Reifenmarke" },
      { type: "select", key: "tire_season", label: "Reifenart", options: [
        { value: "summer", label: "Sommer" },
        { value: "winter", label: "Winter" },
        { value: "allseason", label: "Ganzjahr" },
      ] },
      { type: "select", key: "rim_type", label: "Felgen", options: [
        { value: "alloy", label: "Alu" },
        { value: "steel", label: "Stahl" },
      ] },
      { type: "select", key: "second_set", label: "Zweiter Radsatz", options: [
        { value: "none", label: "Nein" },
        { value: "summer", label: "Sommerräder" },
        { value: "winter", label: "Winterräder" },
        { value: "allseason", label: "Ganzjahresräder" },
      ] },
      { type: "select", key: "spare", label: "Ersatzrad / Pannenset", options: [
        { value: "spare", label: "Ersatzrad" },
        { value: "kit", label: "Pannenset" },
        { value: "none", label: "Nichts" },
      ] },
    ],
  },
  {
    key: "innenraum",
    title: "Innenraum & Elektrik",
    icon: "seat",
    fields: [
      photo("foto_warnings", "Kombiinstrument bei Fahrbereitschaft (Warnleuchten)", { required: true }),
      check("warning_lights", "Keine Warnleuchten aktiv"),
      check("seats", "Sitze (Verschleiß, Risse, Flecken)"),
      check("controls_wear", "Lenkrad & Bedienteile (Verschleiß passt zum km-Stand?)"),
      check("headliner", "Himmel, Teppiche, Verkleidungen"),
      check("smell", "Geruch (Rauch, Tiere, Feuchtigkeit)"),
      check("moisture", "Kein Wasser / keine Feuchtigkeit im Fußraum"),
      check("climate", "Klimaanlage kühlt"),
      check("heating", "Heizung / Wärmepumpe"),
      check("seat_heating", "Sitz- und Lenkradheizung"),
      check("infotainment", "Infotainment, Navi, Radio, Lautsprecher"),
      check("windows_el", "Fensterheber"),
      check("locking", "Zentralverriegelung / Schlüssel / Keycard"),
      check("mirrors_el", "Spiegel elektrisch / anklappen"),
      check("lights", "Beleuchtung komplett (innen & außen)"),
      check("parking", "Parksensoren / Kamera"),
      check("wipers", "Wischer & Waschanlage"),
      check("horn", "Hupe"),
      check("sunroof", "Schiebe- / Panoramadach"),
    ],
  },
  {
    key: "motorraum",
    title: "Vorderwagen / Motorraum",
    icon: "wrench",
    fields: [
      check("brake_fluid", "Bremsflüssigkeit (Stand & Alter)"),
      check("coolant_front", "Kühlmittel (Antrieb / Leistungselektronik)", { showIf: isElectrified }),
      check("front_compartment", "Frunk / Vorderwagen (Leitungen, Steckverbindungen)", { showIf: (d) => drive(d) === "bev" }),
      check("oil", "Ölstand & Ölzustand", { showIf: hasEngine }),
      check("oil_cap", "Öldeckel (Schlamm / Mayonnaise)", { showIf: hasEngine }),
      check("engine_coolant", "Motorkühlmittel (kein Öl im Wasser)", { showIf: hasEngine }),
      check("engine_leaks", "Undichtigkeiten Motor", { showIf: hasEngine }),
      check("belts", "Riemen & Schläuche", { showIf: hasEngine }),
      check("cold_start", "Kaltstart (Geräusche, Kettenrasseln, Rauch)", { showIf: hasEngine }),
      check("exhaust", "Abgasanlage / Rauchfarbe", { showIf: hasEngine }),
    ],
  },
  {
    key: "fahrwerk",
    title: "Fahrwerk & Unterboden",
    icon: "lift",
    intro: "Nur mit Hebebühne sinnvoll. Ohne Bühne: „nicht geprüft“ wählen.",
    fields: [
      check("underbody", "Unterboden (Rost, Aufsetzschäden)"),
      check("suspension", "Achsen, Querlenker, Buchsen"),
      check("shocks", "Stoßdämpfer & Federn"),
      check("cv_boots", "Antriebswellen / Achsmanschetten"),
      check("steering_gear", "Lenkung / Spurstangen"),
      check("brake_lines", "Bremsleitungen"),
      check("leaks", "Undichtigkeiten (Getriebe, Kühlmittel)"),
      photo("foto_underbody", "Foto Unterboden"),
    ],
  },
  {
    key: "bremsen",
    title: "Bremsen",
    icon: "disc",
    intro: "Bei E-Autos rosten die hinteren Scheiben oft, weil meist rekuperiert wird.",
    fields: [
      check("brake_discs_front", "Bremsscheiben vorne", { measures: [{ key: "mm", label: "mm", decimal: true }] }),
      check("brake_pads_front", "Bremsbeläge vorne", { measures: [{ key: "mm", label: "mm", decimal: true }] }),
      check("brake_discs_rear", "Bremsscheiben hinten", { measures: [{ key: "mm", label: "mm", decimal: true }] }),
      check("brake_pads_rear", "Bremsbeläge hinten", { measures: [{ key: "mm", label: "mm", decimal: true }] }),
      check("parking_brake", "Feststellbremse / EPB"),
    ],
  },
  {
    key: "probefahrt",
    title: "Probefahrt",
    icon: "gauge",
    fields: [
      { type: "number", key: "test_drive_km", label: "Gefahrene Strecke", unit: "km", decimal: true },
      check("acceleration", "Beschleunigung / Leistung"),
      check("recuperation", "Rekuperation", { showIf: isElectrified }),
      check("drive_noise", "Antriebsgeräusche (Summen, Klackern, Heulen)"),
      check("gearbox", "Getriebe / Kupplung / Schaltvorgänge", { showIf: hasEngine }),
      check("steering_drive", "Lenkung & Geradeauslauf"),
      check("braking", "Bremsverhalten (zieht nicht, kein Rubbeln)"),
      check("chassis_noise", "Fahrwerksgeräusche (Poltern, Knacken)"),
      check("assistants", "Assistenzsysteme / Tempomat"),
    ],
  },
  {
    key: "diagnose",
    title: "Diagnose & Software",
    icon: "cpu",
    fields: [
      { type: "textarea", key: "fault_codes", label: "Fehlercodes (Fehlerspeicher)", placeholder: "Codes und Beschreibung, oder „keine“" },
      photo("foto_diagnose", "Screenshot / Foto Diagnose"),
      { type: "select", key: "mileage_plausible", label: "km-Stand plausibel (Steuergeräte vs. Tacho)", options: [
        { value: "yes", label: "Plausibel" },
        { value: "no", label: "Abweichung" },
        { value: "unchecked", label: "Nicht geprüft" },
      ] },
      { type: "text", key: "software_version", label: "Softwarestand" },
      { type: "select", key: "app_unlinked", label: "Fahrzeug aus der App des Verkäufers entfernt", options: [
        { value: "yes", label: "Ja" },
        { value: "no", label: "Nein" },
        { value: "na", label: "Nicht relevant" },
      ] },
    ],
  },
  {
    key: "fotos",
    title: "Pflichtfotos",
    icon: "camera",
    intro: "Einheitliche Fotos für jedes Auto. Gut ausleuchten, ganzes Auto im Bild.",
    fields: [
      photo("foto_front_left", "Vorne links 45°", { required: true }),
      photo("foto_front_right", "Vorne rechts 45°", { required: true }),
      photo("foto_rear_left", "Hinten links 45°", { required: true }),
      photo("foto_rear_right", "Hinten rechts 45°", { required: true }),
      photo("foto_side_left", "Seite links", { required: true }),
      photo("foto_side_right", "Seite rechts", { required: true }),
      photo("foto_cockpit", "Cockpit", { required: true }),
      photo("foto_seats_front", "Vordersitze", { required: true }),
      photo("foto_seats_rear", "Rücksitze", { required: true }),
      photo("foto_trunk", "Kofferraum", { required: true }),
      photo("foto_frunk", "Frunk / Motorraum", { required: true }),
      photo("foto_charge_port", "Ladeanschluss", { showIf: hasHvBattery, required: true }),
      photo("foto_wheels", "Räder (alle vier)"),
      photo("foto_roof", "Dach"),
      photo("foto_more", "Weitere Fotos"),
    ],
  },
  {
    key: "verkaeufer",
    title: "Verkäufer & Preis",
    icon: "user",
    fields: [
      { type: "text", key: "seller_name", label: "Name", column: "seller_name", required: true, requiredMessage: "Name des Verkäufers fehlt" },
      { type: "text", key: "seller_phone", label: "Telefon", column: "seller_phone", inputMode: "tel", required: true, requiredMessage: "Telefon des Verkäufers fehlt" },
      { type: "text", key: "seller_email", label: "E-Mail", column: "seller_email", inputMode: "email" },
      { type: "select", key: "seller_type", label: "Verkäufer ist", column: "seller_type", options: [
        { value: "private", label: "Privat" },
        { value: "dealer", label: "Händler" },
      ] },
      { type: "text", key: "seller_address", label: "Adresse" },
      { type: "number", key: "asking_price", label: "Preisvorstellung", unit: "€", column: "asking_price" },
      { type: "select", key: "price_negotiable", label: "Verhandlungsbasis", options: yesNo },
    ],
  },
  {
    key: "abschluss",
    title: "Abschluss",
    icon: "flag",
    fields: [
      { type: "select", key: "grade", label: "Gesamtnote", column: "grade", options: [
        { value: "1", label: "1 · Sehr gut" },
        { value: "2", label: "2 · Gut" },
        { value: "3", label: "3 · Befriedigend" },
        { value: "4", label: "4 · Ausreichend" },
        { value: "5", label: "5 · Mangelhaft" },
      ] },
      { type: "select", key: "recommendation", label: "Empfehlung", column: "recommendation", required: true, requiredMessage: "Empfehlung (Kaufen / Nicht kaufen) fehlt", options: [
        { value: "buy", label: "Kaufen" },
        { value: "buy_with_discount", label: "Kaufen mit Abzug" },
        { value: "dont_buy", label: "Nicht kaufen" },
      ] },
      { type: "number", key: "suggested_price", label: "Empfohlener Ankaufspreis", unit: "€", column: "suggested_price" },
      { type: "textarea", key: "mechanic_notes", label: "Notizen des Mechanikers", column: "mechanic_notes" },
      { type: "heading", key: "h_declaration", label: "Selbstauskunft des Verkäufers", hint: "Mit dem Verkäufer durchgehen. Schützt bei falschen Angaben." },
      { type: "boolean", key: "decl_accident_free", label: "Das Fahrzeug ist unfallfrei." },
      { type: "boolean", key: "decl_mileage", label: "Der Kilometerstand ist korrekt." },
      { type: "boolean", key: "decl_no_finance", label: "Keine offene Finanzierung, keine Rechte Dritter." },
      { type: "textarea", key: "decl_defects", label: "Vom Verkäufer angegebene Mängel" },
      { type: "signature", key: "signature_path", label: "Unterschrift Verkäufer", column: "signature_path" },
      { type: "boolean", key: "gdpr_consent", label: "Der Verkäufer ist einverstanden, dass seine Daten zur Abwicklung des Ankaufs gespeichert werden (DSGVO).", column: "gdpr_consent", required: true, requiredMessage: "DSGVO-Einwilligung des Verkäufers fehlt" },
    ],
  },
];

export const COVER_PHOTO_KEY = "foto_front_left";

export const STATUS_OPTIONS: { value: CheckStatus; label: string; short: string }[] = [
  { value: "ok", label: "OK", short: "OK" },
  { value: "minor", label: "Leichter Mangel", short: "Mangel" },
  { value: "major", label: "Schwerer Mangel", short: "Defekt" },
  { value: "na", label: "Nicht geprüft", short: "n. g." },
];

const fieldIndex = new Map<string, { field: Field; section: Section }>();
for (const section of SECTIONS) {
  for (const field of section.fields) fieldIndex.set(field.key, { field, section });
}

export function findField(key: string) {
  return fieldIndex.get(key);
}

export function optionLabel(field: Field, value: unknown): string {
  if (field.type !== "select" && field.type !== "multi") return String(value ?? "");
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((v) => field.options.find((o) => o.value === v)?.label ?? String(v))
    .join(", ");
}
