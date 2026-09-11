# Kanban Note verwenden

Kanban Note verwandelt einen Teil einer normalen Notiz in ein Kanban-Board. Alle Karten bleiben als lesbarer Markdown-Text in derselben Notiz gespeichert.

## Eine Notiz zum Board machen

Öffne eine beliebige Notiz. Oben rechts in der Notiz findest du ein dezentes Symbol mit drei Spalten. Ein Klick darauf ergänzt automatisch die benötigte Eigenschaft und den Abschnitt `# Kanban Note`.

Die Notiz öffnet sich danach als Board. Bereits vorhandener Text bleibt unverändert erhalten.

## Karten verwalten

- Mit dem **+** in der Kopfzeile einer Spalte legst du dort eine Karte an.
- Ein Klick auf eine Karte öffnet ihre Angaben zum Bearbeiten.
- Ziehe eine Karte an die gewünschte Stelle. Eine farbige Linie zeigt dir, wo sie abgelegt wird. So kannst du Karten innerhalb einer Spalte sortieren oder zugleich in eine andere Spalte verschieben.
- Mit dem Chevron in der Kopfzeile kannst du jede Spalte einzeln ein- und ausklappen. Kanban Note merkt sich den Zustand für diese Notiz.
- Oben rechts verkleinerst oder vergrößerst du das Board mit **−** und **+**. Auch dieser Zoom wird für die Notiz gespeichert.
- Über dem Board kannst du Karten nach Titel, Owner und Notiztext durchsuchen. Mit dem **×** leerst du die Suche; über die Tag-Chips daneben schränkst du das Board auf einen Tag ein.
- Über das Dokument-Symbol oben rechts wechselst du zur vollständigen Markdown-Ansicht.
- In der Markdown-Ansicht bringt dich das Symbol mit den drei Spalten wieder zum Board.

Die Spalten heißen **Backlog**, **Committed**, **Started**, **Blocked**, **Done** und **Aborted**. Dabei bilden **Started** und **Blocked** die Gruppe *In Process*; **Done** und **Aborted** bilden die Gruppe *Finished*.

## Aufbau der Notiz

Eine Kanban-Notiz trägt am Anfang diese Eigenschaft:

```yaml
---
kanban_note_view: kanban
---
```

Nur der Abschnitt unter `# Kanban Note` gehört zum Board. Die nächste Überschrift der ersten Ebene beendet diesen Abschnitt. Davor und danach kann beliebiger anderer Inhalt stehen.

Jede Kartenüberschrift beginnt mit `##`. Direkt darunter stehen ihre Angaben in einem `kanban-card`-Block; danach folgt die Kartennotiz als normales Markdown.

````markdown
# Kanban Note

## Angebot erstellen

```kanban-card
status: Started
deadline: "2026-09-20"
reminder: "2026-09-18"
owner: "Ralf"
tags:
  - "kunde"
  - "angebot"
```

Hier steht die Notiz zur Karte.
````

## Änderungen neu laden

Wenn Claude das Plugin verändert hat, öffne die Befehlspalette (**Strg+P** beziehungsweise **Cmd+P**, oder über das `>_`-Symbol links), tippe **`neu laden`** und wähle **„Anwendung neu laden ohne zu speichern“**.

Wenn etwas nicht funktioniert, öffne die Entwicklerkonsole mit **Strg+Umschalt+I** beziehungsweise **Cmd+Alt+I** und kopiere den roten Text für Claude.
