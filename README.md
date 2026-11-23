# HF VoltCheck

Ankaufsprüfung für E-Autos von **HF E-Autos**.

- **Mechaniker** prüft das Auto auf dem Handy: geführte Checkliste, Fotos, Lackschichtdicke, Reifen, Batterie (SoH), Probefahrt, Verkäuferdaten, Unterschrift.
- **Admin** sieht jedes eingereichte Auto als **Lead**: Fotos, Mängel mit Kosten, Empfehlung, Preise, Status (Neu → In Prüfung → Angebot → Gekauft / Abgelehnt), interne Notizen, Druck/PDF.

Stack: Next.js 16 (App Router), Supabase (Auth, Postgres mit Row Level Security, Storage), Tailwind CSS.

## Einrichtung

### 1. Datenbank anlegen

Die komplette Datenbank steht in [`supabase/migrations/20261120120000_init.sql`](supabase/migrations/20261120120000_init.sql)
(Tabellen, Sicherheitsregeln, privater Foto-Speicher). Einmalig ausführen, **eine** der beiden Varianten:

- **Supabase Dashboard** → SQL Editor → Inhalt der Datei einfügen → *Run*.
- **CLI**: `supabase db push --db-url "postgresql://postgres:PASSWORT@db.kpgffiuisdtyqjkljmlk.supabase.co:5432/postgres"`
  (Sonderzeichen im Passwort URL-kodieren, z. B. `!` → `%21`).

### 2. Umgebungsvariablen

`.env.local` (ist schon angelegt, nicht ins Git):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://kpgffiuisdtyqjkljmlk.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...     # Supabase → Project Settings → API Keys → Secret keys
```

Der Secret Key bleibt auf dem Server. Er wird nur für die Team-Verwaltung gebraucht (Zugänge anlegen, löschen, Passwort setzen).

### 3. Ersten Admin anlegen

```bash
npm run create-admin -- deine@email.de "SicheresPasswort" "Dein Name"
```

Danach im Browser anmelden und unter **Team** den Zugang für den Mechaniker anlegen.

Alternative ohne Secret Key: In Supabase unter *Authentication → Users → Add user* einen Benutzer anlegen
(„Auto Confirm User“ aktivieren) und im SQL Editor ausführen:

```sql
update public.profiles set role = 'admin' where email = 'deine@email.de';
```

### 4. Empfohlene Supabase-Einstellung

*Authentication → Sign In / Providers → „Allow new users to sign up“* **ausschalten**. Zugänge legt nur der Admin an.
(Selbst registrierte Konten hätten ohnehin keine Rolle und damit keinen Zugriff.)

### 5. Starten

```bash
npm install
npm run dev        # http://localhost:3000
```

Auf dem Handy testen: Handy und Mac im selben WLAN, dann `http://<IP-des-Macs>:3000` öffnen.
Für den echten Einsatz auf Vercel deployen und die drei Umgebungsvariablen dort eintragen.
Auf dem Handy über *Teilen → Zum Home-Bildschirm* wie eine App installieren.

## Wie es funktioniert

| Bereich | Pfad | Wer |
| --- | --- | --- |
| Anmelden | `/login` | alle |
| Meine Prüfungen, neue Prüfung | `/inspections` | Mechaniker, Admin |
| Prüfformular | `/inspections/[id]` | Mechaniker (eigene Entwürfe) |
| Leads | `/admin` | Admin |
| Lead-Details, Status, Angebot | `/admin/leads/[id]` | Admin |
| Team | `/admin/team` | Admin |

- **Checkliste ändern:** alle Abschnitte und Prüfpunkte stehen in [`src/lib/checklist.ts`](src/lib/checklist.ts).
  Punkt hinzufügen = eine Zeile. Antworten werden in `leads.data` (JSON) gespeichert, wichtige Werte zusätzlich in eigenen Spalten.
- **Automatisches Speichern:** jede Eingabe wird nach ~1 s gespeichert und zusätzlich auf dem Handy gesichert.
  Ohne Netz zeigt das Formular „Offline – lokal gesichert“ und speichert, sobald wieder Empfang da ist.
- **Fotos** werden auf dem Handy verkleinert (max. 1920 px + Vorschaubild) und im privaten Bucket `lead-photos` gespeichert.
  Angezeigt werden sie nur über zeitlich begrenzte Links.
- **Einreichen** ist erst möglich, wenn Pflichtangaben und Pflichtfotos da sind. Danach ist die Prüfung für den Mechaniker gesperrt.
  Der Admin kann sie über den Status „Entwurf“ zur Überarbeitung zurückgeben.
- **Rückmeldung an den Mechaniker:** Beim Zurückgeben (Status „Entwurf“) kann der Admin eine Nachricht schreiben.
  Sie erscheint oben im Formular des Mechanikers; in seiner Liste steht das Auto als „Zur Überarbeitung“.
- **Fahrzeug schon mal geprüft?** Hat ein anderer Lead dieselbe FIN oder dasselbe Kennzeichen, zeigt die Lead-Seite
  die früheren Prüfungen samt km-Stand (Warnung, wenn der km-Stand damals höher war).
- **Übersicht & Export:** Die Leads-Seite zeigt Kennzahlen, aktualisiert sich alle 30 Sekunden und exportiert die
  aktuelle Ansicht als CSV für Excel.
- **Fotos ohne Netz:** Fotos bleiben auf dem Handy gespeichert, bis sie hochgeladen sind – auch nach Neuladen der Seite.
  Einreichen ist gesperrt, solange ein Foto noch nicht hochgeladen ist.
- **Sicherheit** (in der Datenbank erzwungen): Mechaniker sehen nur ihre eigenen Prüfungen und können Admin-Felder
  (Angebot, Kaufpreis, Notizen) nicht ändern. Rollen kann man sich nicht selbst geben.

## Logo

Quelldateien in [`branding/`](branding/), Web-Icons in `public/brand/`.
