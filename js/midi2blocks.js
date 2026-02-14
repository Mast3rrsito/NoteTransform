const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const processBtn = document.getElementById("processBtn");
const output = document.getElementById("output");

let midiFile = null;

// Drag & Drop
dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("hover");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("hover"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("hover");
  if(e.dataTransfer.files.length) {
    midiFile = e.dataTransfer.files[0];
    dropZone.textContent = `Loaded: ${midiFile.name}`;
  }
});

// File input
fileInput.addEventListener("change", () => {
  if(fileInput.files.length) {
    midiFile = fileInput.files[0];
    dropZone.textContent = `Loaded: ${midiFile.name}`;
  }
});

// Mapping instruments to note block base blocks
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

processBtn.addEventListener("click", async () => {
  if(!midiFile) return alert("Please load a MIDI file first!");

  const arrayBuffer = await midiFile.arrayBuffer();
  const midi = new Midi(arrayBuffer);

  // Prepare schematic data
  let sizeX = 0;
  midi.tracks.forEach(track => track.notes.forEach(n => {
    if(n.ticks > sizeX) sizeX = Math.ceil(n.ticks);
  }));
  sizeX += 10; // extra padding
  const sizeY = 4; // base + up to 3 notes
  const sizeZ = 1;

  const schematic = {
    Width: sizeX,
    Height: sizeY,
    Length: sizeZ,
    Palette: { "minecraft:air": 0, "minecraft:note_block": 1 },
    Blocks: []
  };

  let blockIndex = 2;

  // Track current Y per tick for stacking up to 3 notes
  const tickYMap = {};

  midi.tracks.forEach(track => {
    track.notes.forEach(note => {
      const tick = Math.floor(note.ticks);
      const instrument = note.name || "Harp";
      const mcBlock = instrumentToBlock[instrument] || "minecraft:gold_block";

      if(!tickYMap[tick]) tickYMap[tick] = 0;
      const y = tickYMap[tick];
      tickYMap[tick] = (tickYMap[tick] + 1) % 3; // max 3 notes per tick

      if(!schematic.Palette[mcBlock]) schematic.Palette[mcBlock] = blockIndex++;

      schematic.Blocks.push({
        Name: mcBlock,
        Pos: [tick, 0, 0]
      });

      schematic.Blocks.push({
        Name: "minecraft:note_block",
        Pos: [tick, y + 1, 0],
        States: { note: String(Math.min(24, Math.floor(note.midi - 60))) }
      });
    });
  });

  // Display output
  output.innerHTML = `<pre>${JSON.stringify(
    midi.tracks.flatMap(track => track.notes.map(n => ({
      ticks: Math.floor(n.ticks),
      instrument: n.name,
      note: Math.min(24, Math.floor(n.midi - 60))
    }))), null, 2)}</pre>`;

  // Add Download Button
  let downloadBtn = document.getElementById("downloadSchemBtn");
  if(!downloadBtn) {
    downloadBtn = document.createElement("button");
    downloadBtn.id = "downloadSchemBtn";
    downloadBtn.textContent = "Download Schematic (.schem)";
    downloadBtn.style.marginTop = "1rem";
    processBtn.after(downloadBtn);

    downloadBtn.addEventListener("click", () => {
      const nbtData = {
        type: "compound",
        name: "",
        value: {
          Width: { type:"short", value: schematic.Width },
          Height: { type:"short", value: schematic.Height },
          Length: { type:"short", value: schematic.Length },
          Palette: { type:"compound", value: Object.fromEntries(
            Object.entries(schematic.Palette).map(([k,v]) => [k, {type:"int", value:v}])
          )},
          Blocks: { type:"list", value: {
            type:"compound",
            value: schematic.Blocks.map(b => ({
              Name: { type:"string", value: b.Name },
              Pos: { type:"list", value: b.Pos.map(p => ({ type:"int", value:p })) },
              States: b.States ? { type:"compound", value: Object.fromEntries(
                Object.entries(b.States).map(([k,v]) => [k, {type:"string", value:v}])
              )} : { type:"compound", value:{} }
            }))
          }}
        }
      };

      const buffer = prismarineNbt.writeUncompressed(nbtData);
      const blob = new Blob([buffer], { type:"application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "notetrasform.schem";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
});
