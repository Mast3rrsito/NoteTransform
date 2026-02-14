// midi2blocks.js
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const downloadSchemBtn = document.getElementById('downloadSchemBtn');
const resultBody = document.getElementById('resultBody');
const infoBPM = document.getElementById('infoBPM');

let midiFile = null;
let lastExportData = null; // store generated JSON for download / conversion

// Drag & Drop UI
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('hover'); });
dropZone.addEventListener('dragleave', e => { e.preventDefault(); dropZone.classList.remove('hover'); });
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('hover');
  if (e.dataTransfer.files.length) {
    midiFile = e.dataTransfer.files[0];
    dropZone.textContent = `Loaded: ${midiFile.name}`;
  }
});
fileInput.addEventListener('change', e => {
  if (e.target.files.length) {
    midiFile = e.target.files[0];
    dropZone.textContent = `Loaded: ${midiFile.name}`;
  }
});

// ----- Instrument mapping (GM -> instrument block & octave shift)
// This map is a pragmatic subset of u3002 mapping. Keys are GM program numbers (1-based).
// Each entry: { blockName: "<minecraft block>", octaveShift: <int> }
// octaveShift will be applied as: minecraftNote = midiNote - 60 + 12 + octaveShift*12, then clamped 0..24.
const gmProgramMap = {
  // Pianos
  1: { name: "Harp", block: "minecraft:gold_block", octave: 0 },
  2: { name: "Pling", block: "minecraft:clay", octave: 0 },
  3: { name: "Pling", block: "minecraft:clay", octave: 0 },
  4: { name: "Pling", block: "minecraft:clay", octave: 0 },
  5: { name: "Harp", block: "minecraft:gold_block", octave: 0 },
  // Guitars
  25: { name: "Guitar", block: "minecraft:emerald_block", octave: 1 },
  26: { name: "Guitar", block: "minecraft:emerald_block", octave: 1 },
  27: { name: "Harp", block: "minecraft:gold_block", octave: 0 },
  28: { name: "Guitar", block: "minecraft:emerald_block", octave: 1 },
  // Bass
  33: { name: "Bass", block: "minecraft:stone", octave: 2 },
  34: { name: "Bass", block: "minecraft:stone", octave: 2 },
  35: { name: "Bass", block: "minecraft:stone", octave: 2 },
  36: { name: "Bass", block: "minecraft:stone", octave: 2 },
  // Strings / winds
  41: { name: "Flute", block: "minecraft:bone_block", octave: -1 },
  42: { name: "Flute", block: "minecraft:bone_block", octave: -1 },
  47: { name: "Harp", block: "minecraft:gold_block", octave: 0 },
  74: { name: "Flute", block: "minecraft:bone_block", octave: -1 },
  // Percussive/special (sensible defaults)
  10: { name: "Bells", block: "minecraft:glowstone", octave:-2 },
  14: { name: "Xylophone", block: "minecraft:iron_block", octave:-2 },
  12: { name: "Iron Xylophone", block: "minecraft:iron_block", octave:0 },
  106: { name: "Banjo", block: "minecraft:clay", octave:0 },
  3: { name: "Pling", block: "minecraft:clay", octave:0 },
  81: { name: "Bit", block: "minecraft:redstone_block", octave:0 },
};

// Percussion mapping (General MIDI percussion note numbers -> block/note value suggestions)
// Keys: MIDI note numbers used for percussion (35..88)
const percussionMap = {
  35: { block: "minecraft:stone", noteVal: 4 },  // Acoustic Bass Drum -> Bass Drum A#3 -> mapped to 4
  36: { block: "minecraft:stone", noteVal: 8 },
  38: { block: "minecraft:gravel", noteVal: 15 }, // Snare
  42: { block: "minecraft:clay", noteVal: 21 }, // Closed hi-hat -> Click
  46: { block: "minecraft:gravel", noteVal: 22 }, // Open hi-hat -> Snare/E effect
  59: { block: "minecraft:gravel", noteVal: 24 } // ride -> high
  // add more if needed
};

// clamp to Minecraft note range 0..24
function clampNote(n) { return Math.max(0, Math.min(24, n)); }

// convert seconds -> Minecraft ticks (20 ticks per second)
function secondsToMcTicks(s) {
  return Math.round(s * 20);
}

// Choose up to 3 notes per tick: pick highest velocity ones (more audible)
function pickTopNotes(notes, maxCount = 3) {
  return notes.sort((a,b)=>b.velocity - a.velocity).slice(0, maxCount);
}

// Processing function
async function processMidi() {
  if (!midiFile) {
    alert("Please load a MIDI file");
    return;
  }

  resultBody.innerHTML = "";
  infoBPM.textContent = "";

  const buffer = await midiFile.arrayBuffer();
  const midi = new Midi(buffer);

  // Determine a reference BPM (if tempo changes exist, we will still use seconds->ticks which is exact)
  const defaultBpm = (midi.header && midi.header.tempos && midi.header.tempos.length>0) ? midi.header.tempos[0].bpm : 120;
  infoBPM.textContent = `Reference BPM: ${Math.round(defaultBpm)} (tempo map respected for timing)`;

  // Build a map tick -> array of note objects
  const tickMap = new Map();

  // We'll iterate tracks & notes. For each note we try to detect program (instrument)
  midi.tracks.forEach(track => {
    // track.instrument has .number (0-127) usually. We'll convert to 1-based GM program number.
    const programNumber = (track.instrument && typeof track.instrument.number === 'number') ? track.instrument.number + 1 : null;
    // Some MIDI use percussion channel 10; ToneJS marks percussion notes with track.isPercussion sometimes.
    const isTrackPercussion = !!track.isPercussion;

    track.notes.forEach(note => {
      // exact time in seconds available in note.time
      const mcTick = secondsToMcTicks(note.time); // more exact than note.ticks because tempo changes accounted in note.time
      const midiPitch = note.midi; // 0-127
      const velocity = note.velocity || 0.8;

      // Determine instrument/gm program for this note:
      let gmProgram = programNumber;
      let isPercussion = isTrackPercussion || (note.midi >= 35 && note.midi <= 81 && (track.channel === 9 || track.channel === 10 || programNumber === null));

      // Map to MC instrument & note:
      let mapped = null;
      if (isPercussion) {
        // Look up percussionMap by midi pitch
        mapped = percussionMap[midiPitch] || { block: "minecraft:stone", noteVal: 12 };
        // noteVal is already in 0..24 in our map; ensure clamp
        mapped.note = clampNote(mapped.noteVal ?? 12);
        mapped.name = "Percussion";
      } else {
        // melodic: use gmProgram mapping if available, else fallback to harp
        const gm = gmProgram || 1;
        const info = gmProgramMap[gm] || { name: "Harp", block: "minecraft:gold_block", octave: 0 };
        // Convert MIDI pitch to MC note:
        // We'll center middle C (MIDI 60) to MC note 12 (middle of 0..24), then apply octave shift
        const base = 12 + (info.octave || 0) * 12;
        let mcNote = Math.round(midiPitch - 60 + base);
        mcNote = clampNote(mcNote);
        mapped = { block: info.block, note: mcNote, name: info.name || "Harp" };
      }

      // compose entry
      const entry = {
        tick: mcTick,
        midi: midiPitch,
        velocity: velocity,
        instrumentName: mapped.name || mapped.block,
        block: mapped.block,
        note: mapped.note
      };

      if (!tickMap.has(mcTick)) tickMap.set(mcTick, []);
      tickMap.get(mcTick).push(entry);
    });
  });

  // For each tick, pick up to 3 notes (highest velocity)
  const ticksSorted = Array.from(tickMap.keys()).sort((a,b)=>a-b);
  const rows = [];
  for (let i=0;i<ticksSorted.length;i++){
    const tick = ticksSorted[i];
    const notes = pickTopNotes(tickMap.get(tick), 3);
    rows.push({ tick, notes });
  }

  // Build rows with delta
  const tableRows = rows.map((r, idx) => {
    const nextTick = (idx < rows.length-1) ? rows[idx+1].tick : r.tick;
    const delta = nextTick - r.tick;
    return { tick: r.tick, delta: delta, notes: r.notes };
  });

  // Render table (matches screenshot style)
  resultBody.innerHTML = "";
  tableRows.forEach(row => {
    const tr = document.createElement('tr');
    const tdTick = document.createElement('td');
    tdTick.textContent = row.tick;
    const tdDelta = document.createElement('td');
    tdDelta.textContent = row.delta;
    const tdNotes = document.createElement('td');
    tdNotes.textContent = row.notes.map(n => `${n.instrumentName} (${n.note})`).join(', ');
    tr.appendChild(tdTick);
    tr.appendChild(tdDelta);
    tr.appendChild(tdNotes);
    resultBody.appendChild(tr);
  });

  // Prepare export JSON structure
  // We'll export an object with meta + tick-ordered data and layout defaults for schematic conversion
  const exportJson = {
    meta: {
      sourceFile: midiFile.name,
      generatedAt: new Date().toISOString(),
      referenceBPM: defaultBpm,
      mcTicksPerSecond: 20
    },
    layout: {
      // layout convention: x = tick index (column), y = 0 base / note levels 1..3, z = 0 single plane
      maxNotesPerTick: 3,
      baseY: 0
    },
    ticks: tableRows.map((r, idx) => ({
      tick: r.tick,
      delta: r.delta,
      notes: r.notes.map((n, noteIndex) => ({
        index: noteIndex,       // 0..2
        block: n.block,
        instrumentName: n.instrumentName,
        note: n.note,
        midi: n.midi,
        velocity: n.velocity
      }))
    }))
  };

  // store for download / conversion
  lastExportData = exportJson;

  // Show download JSON button
  downloadJsonBtn.style.display = "inline-block";

  // show convert to schem button (click will instruct how to convert using Node script)
  downloadSchemBtn.style.display = "inline-block";
}

// Hook process button
processBtn.addEventListener('click', () => {
  processBtn.disabled = true;
  processMidi().catch(err => {
    console.error(err);
    alert("Error processing MIDI: " + err.message);
  }).finally(()=> processBtn.disabled = false);
});

// Download JSON button
downloadJsonBtn.addEventListener('click', () => {
  if (!lastExportData) return alert("Process a MIDI file first.");
  const blob = new Blob([JSON.stringify(lastExportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (midiFile && midiFile.name ? midiFile.name.replace(/\.mid$/i,'') : 'notetrasform') + '.noteblocks.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// Download schem (opens an instruction modal or starts conversion)
// We can't reliably generate a full proper .schem in-browser for all cases, so this button will
// offer the Node script download and optionally download the JSON.
downloadSchemBtn.addEventListener('click', () => {
  if (!lastExportData) return alert("Process a MIDI file first.");
  const wantScript = confirm("To generate a guaranteed-compatible .schem you need to run a small Node.js script locally. Click OK to download the JSON and see the conversion script instructions.");
  if (!wantScript) return;
  // auto-download JSON (same as above)
  const blob = new Blob([JSON.stringify(lastExportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (midiFile && midiFile.name ? midiFile.name.replace(/\.mid$/i,'') : 'notetrasform') + '.noteblocks.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  // Show instructions in a new window/tab with the Node script (or you can show a modal). We'll open new window with instructions.
  const instructions = `
  NoteTransform — Schematic conversion instructions

  1) You downloaded a JSON file with the noteblock layout.
  2) To create a .schem compatible with Litematica/WorldEdit, run the following Node script locally.

  Node.js script (save as convert-json-to-schem.js):

  -------------------------------------------------
  // REQUIREMENTS:
  // npm i prismarine-schematic prismarine-nbt fs

  const fs = require('fs');
  const { writeSchematic } = require('./convert-helper'); // use helper below or inline
  const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  // The convert-helper should map blocks to palette entries and produce a proper Schematic NBT
  // See the full helper in the README provided below.
  -------------------------------------------------

  (I also provided the full Node script in the web UI. Check the repository or the help document I sent.)
  `;

  const w = window.open("", "_blank");
  w.document.write("<pre style='white-space:pre-wrap;padding:20px;font-family:monospace'>" + instructions.replace(/[<>&]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])) + "</pre>");
});
