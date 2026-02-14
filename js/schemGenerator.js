// js/schemGenerator.js
import { writeUncompressed } from "https://cdn.jsdelivr.net/npm/prismarine-nbt@2.0.0/dist/index.min.js";

export function downloadJson(rows, filename = "noteblocks.json") {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadSchem(rows, filename = "noteblocks.schem", onProgress = null) {
  if (!rows || rows.length === 0) throw new Error("No rows to export");

  const maxTick = Math.max(...rows.map(r => r.tick));
  const Width = maxTick + 1;
  const Height = 4 + Math.max(...rows.map(r => Math.max(...r.notes.map(n => n.index), 0)), 0); // base + stacked notes
  const Length = 1;

  // Palette: name -> id
  const Palette = { "minecraft:air": 0, "minecraft:note_block": 1 };
  let nextPaletteId = 2;
  const Blocks = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    // for each note in the row, place support block and note_block above it
    for (const n of r.notes) {
      if (Palette[n.block] == null) Palette[n.block] = nextPaletteId++;
      // supporting block (under the note block) at y = n.index (or base 0)
      Blocks.push({
        Name: n.block,
        Pos: [r.tick, n.index, 0],
        States: {}
      });
      // note_block above at y = n.index + 1
      Blocks.push({
        Name: "minecraft:note_block",
        Pos: [r.tick, n.index + 1, 0],
        States: { note: String(n.note) } // string value is acceptable; game will parse it
      });
    }

    if (onProgress) onProgress(i + 1, rows.length);
    // yield to UI thread so browser can update progress (avoid freeze)
    await new Promise(r => setTimeout(r, 0));
  }

  // Build NBT structure
  const nbt = {
    type: "compound",
    name: "",
    value: {
      Width: { type: "short", value: Width },
      Height: { type: "short", value: Height },
      Length: { type: "short", value: Length },
      Palette: {
        type: "compound",
        value: Object.fromEntries(Object.entries(Palette).map(([k, v]) => [k, { type: "int", value: v }]))
      },
      Blocks: {
        type: "list",
        value: {
          type: "compound",
          value: Blocks.map(b => ({
            Name: { type: "string", value: b.Name },
            Pos: { type: "list", value: b.Pos.map(p => ({ type: "int", value: p })) },
            States: {
              type: "compound",
              value: Object.fromEntries(Object.entries(b.States || {}).map(([k, v]) => [k, { type: "string", value: String(v) }]))
            }
          }))
        }
      }
    }
  };

  // write NBT (uncompressed) and offer download
  const buffer = writeUncompressed(nbt);
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
