# Obsidian-API: die Muster, die man hier ständig braucht

Alle Signaturen unten sind gegen `.claude/obsidian.d.ts` geprüft. Was hier
**nicht** steht, dort nachschlagen, bevor du es benutzt.

Alles ist CommonJS – `require('obsidian')`, kein `import`.

```js
const { Plugin, ItemView, Modal, Notice, Setting, PluginSettingTab,
        TFile, TFolder, FileSystemAdapter, Platform, setIcon } = require('obsidian');
```

## Notizen als Datenspeicher

Eine Notiz pro Datensatz, Struktur im Frontmatter. Das ist hier der Normalfall.

```js
// Anlegen
const file = await this.app.vault.create('Aufgaben/Einkaufen.md',
  '---\ntyp: aufgabe\nstatus: offen\n---\n\nMilch kaufen\n');

// Ordner anlegen (wirft, wenn er schon existiert - vorher prüfen)
if (!this.app.vault.getAbstractFileByPath('Aufgaben')) {
  await this.app.vault.createFolder('Aufgaben');
}

// Lesen (cachedRead ist der schnelle Weg, wenn nur gelesen wird)
const text = await this.app.vault.cachedRead(file);

// Ganze Datei überschreiben
await this.app.vault.modify(file, neuerText);

// Eine Datei holen
const file = this.app.vault.getAbstractFileByPath('Aufgaben/Einkaufen.md');
if (file instanceof TFile) { /* ... */ }
```

## Frontmatter lesen und schreiben

Frontmatter **nie** von Hand aus dem Text parsen oder zusammenbauen.

```js
// Schreiben / ändern - Obsidian kümmert sich um das YAML
await this.app.fileManager.processFrontMatter(file, (fm) => {
  fm.status = 'erledigt';
  fm.erledigt_am = '2026-08-26';
  delete fm.faellig;
});

// Lesen - kommt aus dem Cache, kein Dateizugriff nötig
const cache = this.app.metadataCache.getFileCache(file);
const status = cache?.frontmatter?.status;
```

## Alle Datensätze eines Typs finden

```js
const aufgaben = this.app.vault.getMarkdownFiles().filter((file) => {
  const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
  return fm?.typ === 'aufgabe';
});
```

## Eine Ansicht

Der `VIEW_TYPE` ist ein frei gewählter, eindeutiger String.

```js
// in onload()
this.registerView(VIEW_TYPE, (leaf) => new MeineAnsicht(leaf, this));

// öffnen: als Tab im Hauptbereich
async activateView() {
  const workspace = this.app.workspace;
  const offen = workspace.getLeavesOfType(VIEW_TYPE);
  if (offen.length > 0) { workspace.revealLeaf(offen[0]); return; }
  const leaf = workspace.getLeaf('tab');           // 'split' / 'window' gehen auch
  await leaf.setViewState({ type: VIEW_TYPE, active: true });
  workspace.revealLeaf(leaf);
}
```

Eine `ItemView` braucht `getViewType()`, `getDisplayText()`, optional `getIcon()`,
und baut ihren Inhalt in `this.contentEl` auf (`onOpen()`).

## Oberfläche bauen

Obsidians DOM-Helfer statt `document.createElement` – kürzer und sicherer:

```js
const div  = container.createDiv({ cls: 'meine-klasse' });
const h    = div.createEl('h2', { text: 'Überschrift' });
const inp  = div.createEl('input', { attr: { type: 'text', placeholder: '...' } });
const btn  = div.createEl('button', { cls: 'mod-cta', text: 'Speichern' });
container.empty();                    // alles leeren vor dem Neuzeichnen
setIcon(element, 'check');            // Lucide-Icon in ein Element setzen
```

Für Styles immer Obsidians CSS-Variablen benutzen (`var(--text-muted)`,
`var(--background-secondary)`, `var(--interactive-accent)`), damit helles und
dunkles Theme automatisch funktionieren. Nie feste Farben.

## Einstellungen

```js
// im Plugin
async loadSettings() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}
async saveSettings() { await this.saveData(this.settings); }

// Settings-Tab
class MeinSettingTab extends PluginSettingTab {
  display() {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName('Bezeichnung')
      .setDesc('Erklärung')
      .addText((t) => t.setValue(this.plugin.settings.wert)
        .onChange(async (v) => { this.plugin.settings.wert = v; await this.plugin.saveSettings(); }));
  }
}
```

`addToggle`, `addDropdown`, `addSlider`, `addButton`, `addTextArea` gibt es
genauso – Signaturen in der `d.ts`.

## Kleinkram

```js
new Notice('Gespeichert.');                  // kurze Einblendung
new Notice('Text', 10000);                   // mit Dauer in ms

this.addCommand({ id: 'tu-was', name: 'Tu was', callback: () => {...} });
this.addRibbonIcon('sparkles', 'Tooltip', () => {...});

Platform.isMacOS                             // für Tastenkürzel im Text
```

## Aufräumen

Alles, was länger lebt als ein Klick, über die `register*`-Methoden anmelden –
dann räumt Obsidian beim Entladen von selbst auf:

```js
this.registerEvent(this.app.vault.on('modify', (file) => {...}));
this.registerDomEvent(window, 'resize', () => {...});
this.registerInterval(window.setInterval(() => {...}, 1000));
```

In `onunload()` **keine** Views mit `detachLeavesOfType` wegräumen – das ist
laut Obsidian-Richtlinie unerwünscht und kostet die Person ihr Layout.
