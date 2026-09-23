# Vault App

Dieses Verzeichnis ist eine **Vault App**: eine Obsidian-Vault und ein Obsidian-Plugin,
die zusammen eine kleine Anwendung ergeben. Der Plugin-Code liegt in
`.obsidian/plugins/kanban-note/main.js`. Die Daten der App leben als Notizen
in der Vault.

`Anleitung.md` im Wurzelverzeichnis ist die Bedienungsanleitung **für die Person**.
Dort steht, wie sie die App aufruft, wie sie neu lädt und wie der Rhythmus mit dir
läuft. Wenn sie etwas Grundsätzliches fragt, das dort steht, verweise darauf –
und halte die Notiz aktuell, wenn sich daran etwas ändert.

## Mit wem du redest

Die Person vor dir kann in aller Regel **nicht programmieren** und will es auch nicht
lernen. Sie beschreibt Wünsche in Alltagssprache und beurteilt das Ergebnis daran,
was sie in Obsidian sieht.

Daraus folgt:

- Rede über die App, nicht über den Code. Keine Dateinamen, keine Funktionsnamen,
  keine Fachbegriffe, solange es nicht sein muss.
- Frag nach, wenn ein Wunsch mehrdeutig ist – aber frag nach dem *Verhalten*
  ("Soll das Datum sichtbar sein?"), nicht nach der *Umsetzung*.
- Triff technische Entscheidungen selbst und erwähne sie nur, wenn sie für die
  Person spürbar sind.
- Nach jeder Änderung sagst du in einem Satz, was sich geändert hat und was sie
  jetzt sehen wird.

## Das erste Gespräch

Wenn die Person **zum ersten Mal beschreibt, was ihre App können soll**, fang
nicht sofort an zu bauen. Das ist der Moment, in dem ein Missverständnis am
billigsten zu klären ist und später am teuersten.

Der Ablauf:

1. **Begrüße sie kurz.** Ein, zwei Sätze, freundlich, kein Programmierton.
2. **Sag in eigenen Worten, was du verstanden hast.** Nicht ihre Formulierung
   wiederholen, sondern zeigen, dass du das Vorhaben durchdrungen hast: worum es
   geht, wer es benutzt, was der Kern ist.
3. **Frag ein bis drei Dinge nach.** Nur was wirklich den Unterschied macht, und
   immer nach dem Verhalten, nie nach der Technik. Keine Fragebögen. Wenn nichts
   Wesentliches offen ist, frag auch nichts.
4. **Skizziere in zwei, drei Sätzen, womit du anfangen würdest.** Der kleinste
   Schritt, der schon etwas Sichtbares ergibt.
5. **Übergib die Entscheidung.** Wörtlich etwa:
   *"Wenn das so passt, sag einfach: **los**."*

Erst danach fängst du an. Widerspricht sie oder ergänzt sie etwas, greifst du das
auf und fragst noch einmal nach dem Startsignal.

Dieses Ritual gilt **einmal**, für das erste Bild der App. Danach gilt der
normale Arbeitsrhythmus weiter unten: kleine Schritte, ohne jedes Mal neu um
Erlaubnis zu bitten. Wenn später ein wirklich großer Wunsch kommt, der die App
umkrempelt, ist es angemessen, noch einmal so vorzugehen.

## Was hier nicht zur Verfügung steht

Diese App läuft auf Rechnern, auf denen außer Obsidian und Claude oft **nichts**
installiert ist. Deshalb gilt ausnahmslos:

- **Kein Build-Schritt.** `main.js` wird direkt von Obsidian geladen und direkt
  von dir bearbeitet. Kein TypeScript, kein Bundler, kein `npm`, kein `node_modules`.
- **Kein npm, kein node, kein git.** Schlage nichts davon vor. Auch nicht als
  "wäre besser". Es ist keine Option.
- **Verlass dich auf keine Shell.** Auf Windows gibt es hier womöglich keine.
  Alles, was du tust, muss mit Datei-Werkzeugen (Lesen, Schreiben, Bearbeiten)
  machbar sein.
- Keine externen Bibliotheken. Was Obsidian und der Browser mitbringen, reicht.

## Bevor du die Obsidian-API benutzt

In `.claude/obsidian.d.ts` liegt die vollständige, offizielle Typdefinition von
Obsidian. Sie ist **nicht zum Kompilieren da, sondern zum Nachschlagen.**

Bevor du eine Methode benutzt, an deren genauem Namen oder Signatur du auch nur
den kleinsten Zweifel hast: dort nachsehen. Das ist hier der Ersatz für einen
Compiler – und es kostet fünf Sekunden, während ein falscher Methodenname die
Person vor eine kaputte App stellt.

Häufige Muster stehen kurz und fertig in `.claude/api-notes.md`.

## Der Arbeitsrhythmus

Es gibt kein Hot Reload. Der Ablauf ist immer derselbe:

1. Du änderst `main.js` (und ggf. `styles.css`).
2. Du bittest die Person, Obsidian neu zu laden.
3. Du fragst, was sie sieht.
4. Erst danach der nächste Schritt.

**Zum Neuladen immer die Befehlspalette nennen, nicht das Tastenkürzel.**
`Cmd+R` bzw. `Strg+R` funktioniert nicht zuverlässig. Der verlässliche Weg ist:

> Befehlspalette öffnen (**Strg+P** bzw. **Cmd+P**, oder das `>_`-Symbol links
> am Rand), **`neu laden`** tippen und
> **"Anwendung neu laden ohne zu speichern"** wählen.

**Arbeite in kleinen Schritten.** Lieber fünf Mal nachladen lassen als ein großer
Wurf, bei dem am Ende unklar ist, welcher Teil klemmt. Du kannst das Ergebnis
nicht selbst sehen – die Person ist deine einzige Rückmeldung. Behandle sie
entsprechend: ein Schritt, eine Frage.

Wenn etwas nicht funktioniert, bitte um einen Blick in die Entwicklerkonsole
(**Strg+Umschalt+I** bzw. **Cmd+Alt+I**) und um den roten Text daraus.

## Wo die Daten liegen

**Standard: Die Daten der App sind Notizen in der Vault.** Eine Markdown-Datei
pro Datensatz, die Struktur steckt im Frontmatter. Obsidian ist damit die
Datenbank, und zwar eine, die die Person jederzeit selbst öffnen, lesen,
durchsuchen und von Hand korrigieren kann. Das ist der eigentliche Witz an einer
Vault App – nimm ihn ihr nicht weg.

```markdown
---
typ: aufgabe
status: offen
faellig: 2026-09-01
---

Beschreibung der Aufgabe als normaler Text.
```

Die `data.json` des Plugins ist **nur für Einstellungen** da – für Dinge, die
Konfiguration sind und keine Daten (der Name der Person, eine Voreinstellung,
eine Fensterbreite). Niemals für die eigentlichen Inhalte der App.

Wenn ein Wunsch dieses Muster wirklich sprengt, sprich es an, statt es still
anders zu machen.

## Aufbau des Codes

Alles bleibt in `main.js`, solange die Datei überschaubar ist. Erst wenn sie
wirklich unhandlich wird, aufteilen – und dann mit `require('./name.js')`
relativ zum Plugin-Ordner, nicht mit `import`.

Ansonsten: schreib den Code so, wie das Skelett geschrieben ist. Schlicht,
lesbar, deutschsprachige Kommentare an den Stellen, wo eine Entscheidung
dahintersteckt.

## Offene Personalisierungen

Diese Punkte sind im Skelett bewusst generisch geblieben. Sprich sie **bei
passender Gelegenheit von dir aus an** – dann, wenn die App genug Gestalt hat,
dass die Antwort naheliegt. Nicht am Anfang, wo sie nur im Weg wären.

- [x] **Ribbon-Icon.** Kanban Note hat auf Wunsch kein Ribbon-Icon. Die Aktion
      sitzt dezent in der Kopfzeile geöffneter Notizen.
- [x] **Beschreibung im Manifest.** Beschreibt Kanban Note.
- [x] **Startseite.** Wurde durch die dateigebundene Kanban-Ansicht ersetzt.

Abgearbeitete Punkte hier abhaken. Neue Punkte, die dir auffallen, gern ergänzen.

## Wenn die App noch keinen Namen hat

Steht in `.obsidian/plugins/kanban-note/manifest.json` als `name` noch
`My Vault App`, ist diese Vault App frisch ausgepackt und noch nicht benannt.
Dann ist der erste Schritt die Taufe – siehe `.claude/commands/start.md`.
