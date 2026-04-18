const fs = require('fs');
const { glob } = require('glob');

const replacements = [
  // Capital versions first
  ['Aendern', 'Ändern'],
  ['Aender', 'Änder'],
  ['Loeschen', 'Löschen'],
  ['Loesche', 'Lösche'],
  ['Geloescht', 'Gelöscht'],
  ['Zurueck', 'Zurück'],
  ['Rueckgaengig', 'Rückgängig'],
  ['Fuer ', 'Für '],
  ['Ueber ', 'Über '],
  ['Waehlen', 'Wählen'],
  ['Waehl', 'Wähl'],
  ['Beitraege', 'Beiträge'],
  ['Beitraeg', 'Beiträg'],
  ['Moeglich', 'Möglich'],
  ['Ungueltig', 'Ungültig'],
  ['Waehrend', 'Während'],
  ['Bestaetig', 'Bestätig'],
  ['Verfuegbar', 'Verfügbar'],
  ['Naechst', 'Nächst'],
  ['Groesse', 'Größe'],
  ['Grosse', 'Große'],
  ['Kaefig', 'Käfig'],
  ['Faehre', 'Fähre'],
  ['Fuehrung', 'Führung'],
  ['Oeffnen', 'Öffnen'],
  ['Spaeter', 'Später'],
  ['Muessen', 'Müssen'],
  ['Koennen', 'Können'],
  ['Koennte', 'Könnte'],
  ['Duerfen', 'Dürfen'],
  ['Haeufig', 'Häufig'],
  ['Aeltere', 'Ältere'],
  ['Unterstuetzt', 'Unterstützt'],
  ['Uebertragen', 'Übertragen'],
  ['Ausgewaehlt', 'Ausgewählt'],
  ['Gespraech', 'Gespräch'],
  ['Gefuehl', 'Gefühl'],
  ['Fuehl', 'Fühl'],
  ['Hoere', 'Höre'],
  ['Hoert', 'Hört'],
  ['Fuer', 'Für'],
  ['Ueber', 'Über'],
  ['Erklaer', 'Erklär'],

  // Lowercase
  ['aendern', 'ändern'],
  ['aender', 'änder'],
  ['loeschen', 'löschen'],
  ['loesche', 'lösche'],
  ['geloescht', 'gelöscht'],
  ['zurueck', 'zurück'],
  ['rueckgaengig', 'rückgängig'],
  [' fuer ', ' für '],
  [' ueber ', ' über '],
  ['waehlen', 'wählen'],
  ['waehl', 'wähl'],
  ['beitraege', 'beiträge'],
  ['beitraeg', 'beiträg'],
  ['moeglich', 'möglich'],
  ['ungueltig', 'ungültig'],
  ['waehrend', 'während'],
  ['bestaetig', 'bestätig'],
  ['verfuegbar', 'verfügbar'],
  ['naechst', 'nächst'],
  ['groesse', 'größe'],
  ['grosse', 'große'],
  ['kaefig', 'käfig'],
  ['faehre', 'fähre'],
  ['fuehrung', 'führung'],
  ['oeffnen', 'öffnen'],
  ['spaeter', 'später'],
  ['muessen', 'müssen'],
  ['muesste', 'müsste'],
  ['koennen', 'können'],
  ['koennte', 'könnte'],
  ['duerfen', 'dürfen'],
  ['haeufig', 'häufig'],
  ['aeltere', 'ältere'],
  ['unterstuetzt', 'unterstützt'],
  ['uebertragen', 'übertragen'],
  ['ausgewaehlt', 'ausgewählt'],
  ['gespraech', 'gespräch'],
  ['gefuehl', 'gefühl'],
  ['fuehl', 'fühl'],
  ['hoere', 'höre'],
  ['hoert', 'hört'],
  ['fuer', 'für'],
  ['ueber', 'über'],
  ['erklaer', 'erklär'],
  ['taeglich', 'täglich'],
  ['anzeigung', 'anzeigung'],
  ['angemeldet', 'angemeldet'],
  ['Teilnehmer', 'Teilnehmer'],
  ['Abschnitt', 'Abschnitt'],
  ['muede', 'müde'],
  ['Muede', 'Müde'],
  ['benoetig', 'benötig'],
  ['Benoetig', 'Benötig'],
  ['erhoehung', 'erhöhung'],
  ['Erhoehung', 'Erhöhung'],
  ['zugriff', 'zugriff'],
  ['laenge', 'länge'],
  ['Laenge', 'Länge'],
  ['laenger', 'länger'],
  ['Laenger', 'Länger'],
  ['nuetz', 'nütz'],
  ['Nuetz', 'Nütz'],
  ['muesste', 'müsste'],
  ['Muesste', 'Müsste'],
  ['staendig', 'ständig'],
  ['Staendig', 'Ständig'],
  ['buendel', 'bündel'],
  ['Buendel', 'Bündel'],
  ['gehoert', 'gehört'],
  ['Gehoert', 'Gehört'],
  ['stoer', 'stör'],
  ['Stoer', 'Stör'],
  ['foer', 'för'],
  ['Foer', 'För'],
  ['veroeffent', 'veröffent'],
  ['Veroeffent', 'Veröffent'],
];

async function main() {
  const files = await glob('src/**/*.{ts,tsx}', { nodir: true });
  let totalChanges = 0;
  const changedFiles = [];

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let localChanges = 0;
    replacements.forEach(([from, to]) => {
      if (from === to) return;
      let idx = 0;
      while ((idx = content.indexOf(from, idx)) !== -1) {
        content = content.substring(0, idx) + to + content.substring(idx + from.length);
        idx += to.length;
        localChanges++;
      }
    });
    if (localChanges > 0) {
      fs.writeFileSync(file, content, 'utf8');
      changedFiles.push({ file, changes: localChanges });
      totalChanges += localChanges;
    }
  }

  console.log('Total changes:', totalChanges);
  console.log('Files changed:', changedFiles.length);
  changedFiles.forEach(c => console.log('  ' + c.changes + ' ' + c.file));
}

main();
