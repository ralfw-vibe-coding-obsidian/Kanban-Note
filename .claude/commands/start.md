---
description: Gibt dieser frisch ausgepackten Vault App ihren Namen und startet die Entwicklung
---

Diese Vault App ist gerade ausgepackt worden und hat noch keinen eigenen Namen.
Gib ihr einen und leg dann los.

Rede dabei durchgehend so, wie es in `CLAUDE.md` unter "Mit wem du redest" steht:
Die Person kann nicht programmieren und will darüber auch nichts hören.

## 1. Den Namen herausfinden

Sieh nach, wie das Verzeichnis heißt, in dem du arbeitest.

- Heißt es noch `kanban-note`, ist es das Plugin dieser Vault.
  Frag sie dann direkt: **"Wie soll deine App heißen?"**
- Heißt es anders, ist das der Name. Mach daraus eine schön geschriebene Fassung
  (aus `mein-kochbuch` wird `Mein Kochbuch`) und lass sie einmal bestätigen:
  **"Ich taufe die App »Mein Kochbuch« – passt das so?"**

Frag nur nach dem Namen. Nicht nach Beschreibung, Icon oder Features – das kommt
später und von selbst.

## 2. Die Taufe eintragen

In `.obsidian/plugins/kanban-note/manifest.json`:

- `name` auf den gewählten Namen setzen.
- `description` auf einen schlichten Satz setzen, solange noch nichts über die
  App bekannt ist (z.B. `"Eine Vault App."`). Der Punkt steht in `CLAUDE.md` auf
  der Liste der offenen Personalisierungen und wird später noch einmal angefasst.

`id`, Ordnername und `.obsidian/community-plugins.json` bleiben unverändert auf
`kanban-note`. Das ist Absicht: jede Vault App hat ihre eigene Vault, Kollisionen
gibt es nicht, und jede Umbenennung wäre nur eine zusätzliche Fehlerquelle.

Ersetze außerdem `README.md` im Wurzelverzeichnis durch eine kurze Notiz mit dem
neuen Namen als Überschrift und einem Satz, dass die App gerade entsteht.

## 3. Neu laden lassen

Bitte die Person, Obsidian neu zu laden – über die **Befehlspalette**
(**Strg+P** bzw. **Cmd+P**, oder das `>_`-Symbol links am Rand), dort
**`neu laden`** tippen und **"Anwendung neu laden ohne zu speichern"** wählen.

Nenne nicht `Strg+R`; das Kürzel greift nicht zuverlässig.

Sag ihr dazu, dass danach oben im Tab und links am Symbol der neue Name steht.

## 4. Loslegen

Frag dann: **"Und jetzt – was soll deine App können?"**

Was sie darauf antwortet, ist das **erste Gespräch** im Sinne von `CLAUDE.md`.
Fang also nicht sofort an zu bauen, sondern geh den dortigen Ablauf durch:
verstehen, zurückspiegeln, ein bis drei Dinge nachfragen, den ersten Schritt
skizzieren – und dann auf ihr "los" warten.
