# Sturmstadt

Ein kleines 3D-Kampf-und-Bau-Spiel für den Browser. Du landest mit dem Gleiter
über einer Stadt, suchst Waffen in Kisten, baust Wände und Rampen und kämpfst
gegen Bots. Nach einer Minute kommt der Sturm und der sichere Bereich wird
immer kleiner. Wer zuletzt übrig ist, gewinnt.

## Starten

`index.html` doppelt anklicken, dann öffnet sich das Spiel im Browser.
Es läuft ohne Internet (three.js liegt in `lib/`). Nur die Schriftarten
kommen aus dem Internet; ohne Netz werden Ersatzschriften benutzt.

Alternativ mit einem kleinen Server:

```bash
npx serve .
```

## Was drin ist

- **Stadt** mit 10 Gebäuden, Straßen mit Mittellinien und Zebrastreifen,
  einer **Kirche** mit Turm, Glocke, Bänken und Altar
- **Ampeln**, die wirklich umschalten (rot, gelb, grün), **Mülltonnen** in
  Schwarz, Blau, Gelb, Braun und Grün, Laternen, Bänke und geparkte Autos
- **Kisten** überall auf der Karte: geben Waffen, Munition, Heilung und Baumaterial
- **Waffen**: Pistole, Maschinenpistole, Sturmgewehr, Schrotflinte,
  Scharfschützengewehr, Raketenwerfer, jeweils in 5 Seltenheiten
  (grau, grün, blau, lila, gold)
- **Heilung**: Verband, Medikit, Schildtrank, Mini-Schild
- **Spitzhacke**: Bäume (Holz), Steine (Stein) und Gebäude, Autos,
  Mülltonnen, Ampeln (Stein oder Metall) abbauen
- **Bauen**: Wand, Boden und Rampe aus Holz, Stein oder Metall
- **Sturm-Zone** in 5 Phasen, draußen verlierst du Leben
- **Bots**, die Kisten plündern, kämpfen, sich einmauern und vor dem Sturm fliehen
- **Anzeige**: Leben und Schild unten links, Inventar mit Spitzhacke und 6 Plätzen
  unten rechts, Minikarte oben rechts

## Steuerung

| Taste | Aktion |
| --- | --- |
| W A S D | Laufen |
| Shift | Sprinten |
| Leertaste | Springen |
| Maus | Umsehen |
| Linksklick | Schießen, Abbauen, Bauen, Heilen |
| Rechtsklick | Zielen |
| 1 | Spitzhacke |
| 2 bis 7, Mausrad | Inventar-Platz wählen |
| E | Kiste öffnen, Gegenstand aufheben |
| R | Nachladen |
| Q / X / C | Wand / Boden / Rampe bauen |
| T | Baumaterial wechseln (Holz, Stein, Metall) |
| G | Gegenstand fallen lassen |
| M | Große Karte |
| Esc | Maus freigeben (Pause) |

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.html` | Seite, Anzeige und Menü |
| `css/style.css` | Aussehen der Anzeige |
| `js/util.js` | Zufall, Texturen, Geometrie, Sound |
| `js/physics.js` | Kollisionen, Rampen, Schuss-Strahlen, zerstörbare Teile |
| `js/effects.js` | Splitter, Leuchtspuren, Explosionen, Schadenszahlen |
| `js/items.js` | Waffen, Heilung, Munition, Kisten, Boden-Beute |
| `js/buildings.js` | Häuser und Kirche aus abbaubaren Teilen |
| `js/world.js` | Karte, Straßen, Ampeln, Mülltonnen, Autos, Bäume, Steine |
| `js/build.js` | Bauen (Wand, Boden, Rampe) |
| `js/combat.js` | Schießen, Treffer, Raketen |
| `js/player.js` | Spieler, Inventar, Spitzhacke |
| `js/bots.js` | Gegner-KI |
| `js/zone.js` | Der Sturm |
| `js/ui.js` | Lebensbalken, Inventar, Minikarte, Meldungen |
| `js/game.js` | Spielablauf und Hauptschleife |

Mit three.js (MIT-Lizenz, siehe `lib/THREE_LICENSE.txt`).
