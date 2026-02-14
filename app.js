const downloadBtn = document.getElementById("downloadBtn");
const midiInput = document.getElementById("midiFile");

// Mapea instrumentos a bloques base en Minecraft
const instrumentToBlock = {
  "Harp": "minecraft:gold_block",
  "Bass": "minecraft:stone",
  "Snare": "minecraft:gravel",
  "Pling": "minecraft:clay",
  "Flute": "minecraft:bone_block",
  "Guitar": "minecraft:emerald_block",
  "Cow Bell": "minecraft:soul_sand",
  "Chimes": "minecraft:glowstone",
  "Xylophone": "minecraft:iron_block",
  "Bit": "minecraft:redstone_block"
};

downloadBtn.addEventListener("click", async () => {
  if (!midiInput.files.length) {
    alert("Please select a MIDI file first!");
    return;
  }

  const file = midiInput.files[0];
  const arrayBuffer = await file.arrayBuffer();
  const midi = new Midi(arrayBuffer);

  // Generamos un esquema sencillo de Schematic
  const sizeX = 100; // Ajusta según el número de ticks
  const sizeY = 4;   // Base + hasta 3 notas
  const sizeZ = 1;

  const schematic = {
    Width: sizeX,
    Height: sizeY,
    Length: sizeZ,
    Palette: { "minecraft:air": 0 },
    Blocks: []
  };

  let blockIndex = 1;

  // Convertimos cada nota del MIDI a note_blocks
  midi.tracks.forEach(track => {
    track.notes.forEach(note => {
      const tick = Math.floor(note.ticks); 
      const instrument = note.name || "Harp"; // fallback
      const mcBlock = instrumentToBlock[instrument] || "minecraft:gold_block";
      // Base
      schematic.Palette[mcBlock] = blockIndex++;
      schematic.Blocks.push({
        Name: mcBlock,
        Pos: [tick,0,0]
      });
      // Note block encima
      schematic.Palette["minecraft:note_block"] = blockIndex++;
      schematic.Blocks.push({
        Name: "minecraft:note_block",
        Pos: [tick,1,0],
        States: { note: String(Math.min(24, Math.floor(note.midi - 60))) } // Ajuste 0-24
      });
    });
  });

  // Convertimos a NBT
  const nbtData = {
    type: "compound",
    name: "",
    value: {
      Width: { type: "short", value: schematic.Width },
      Height: { type: "short", value: schematic.Height },
      Length: { type: "short", value: schematic.Length },
      Palette: {
        type: "compound",
        value: Object.fromEntries(
          Object.entries(schematic.Palette).map(([k,v]) => [k, { type:"int", value:v }])
        )
      },
      Blocks: {
        type: "list",
        value: {
          type: "compound",
          value: schematic.Blocks.map(b => ({
            Name: { type:"string", value: b.Name },
            Pos: {
              type:"list",
              value: b.Pos.map(p => ({ type:"int", value:p }))
            },
            States: b.States ? { type:"compound", value: Object.fromEntries(
              Object.entries(b.States).map(([k,v]) => [k, {type:"string", value:v}])
            )} : { type:"compound", value:{} }
          }))
        }
      }
    }
  };

  const buffer = prismarineNbt.writeUncompressed(nbtData);
  const blob = new Blob([buffer], { type: "application/octet-stream" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "notetrasform.schem";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
