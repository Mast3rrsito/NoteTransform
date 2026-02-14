const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const output = document.getElementById('output');

let midiFile = null;

// Drag & Drop
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = '#00f'; });
dropZone.addEventListener('dragleave', e => { e.preventDefault(); dropZone.style.borderColor = '#888'; });
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.style.borderColor = '#888';
  if(e.dataTransfer.files.length > 0) {
    midiFile = e.dataTransfer.files[0];
    dropZone.textContent = `File ready: ${midiFile.name}`;
  }
});

// File input
fileInput.addEventListener('change', e => {
  midiFile = e.target.files[0];
  dropZone.textContent = `File ready: ${midiFile.name}`;
});

// --- Mapping GM Instrument to Minecraft Note Blocks (simplified, con octave shifts) ---
const gmToNoteblock = {
  // Piano
  0: { block: "Harp", octave: 0 },
  1: { block: "Pling", octave: 0 },
  2: { block: "Pling", octave: 0 },
  3: { block: "Pling", octave: 0 },
  4: { block: "Pling", octave: 0 },
  5: { block: "Pling", octave: 0 },
  // Bass
  33: { block: "Bass", octave: 2 },
  34: { block: "Bass", octave: 2 },
  35: { block: "Bass", octave: 2 },
  36: { block: "Bass", octave: 2 },
  // Percussion (only note keys in GM percussion map)
  35: { block: "Bass Drum", octave: 0 },
  36: { block: "Bass Drum", octave: 0 },
  38: { block: "Snare Drum", octave: 0 },
  42: { block: "Click", octave: 0 },
  // Flute
  74: { block: "Flute", octave: -1 },
  // Bells / Chimes
  10: { block: "Bells", octave: -2 },
  113:{ block: "Chimes", octave: -2 },
  14: { block: "Xylophone", octave: -2 },
  12: { block: "Iron Xylophone", octave: 0 },
  106:{ block: "Banjo", octave: 0 },
  81: { block: "Pling", octave: 0 },
  // Agregar más según tu tabla si quieres
};

// Convert seconds → Minecraft ticks (20 ticks/sec)
function secondsToTicks(sec) { return Math.round(sec / 0.05); }

// Map MIDI note → Minecraft note 0–24
function mapNote(midiNote, gmInstrument) {
  const map = gmToNoteblock[gmInstrument] || { block: "Harp", octave: 0 };
  let noteNumber = midiNote + map.octave * 12;
  // Ajustar al rango 0–24
  if(noteNumber < 0) noteNumber = 0;
  if(noteNumber > 24) noteNumber = 24;
  return { block: map.block, note: noteNumber };
}

// Process MIDI
async function processMidi() {
  if(!midiFile) { alert("Please select or drop a MIDI file first!"); return; }

  const arrayBuffer = await midiFile.arrayBuffer();
  const midi = new Midi(arrayBuffer);
  const ticksMap = {}; // { tickNumber: [ {block,note}, ... ] }

  midi.tracks.forEach(track => {
    track.notes.forEach(note => {
      const tick = secondsToTicks(note.time);
      const mapped = mapNote(note.midi, note.instrument);
      if(!ticksMap[tick]) ticksMap[tick] = [];
      // Solo permitir hasta 3 notas por tick
      if(ticksMap[tick].length < 3) ticksMap[tick].push(mapped);
    });
  });

  // Convertir a array ordenado
  const result = Object.keys(ticksMap).sort((a,b)=>a-b).map(tick => ({
    tick: Number(tick),
    notes: ticksMap[tick]
  }));

  output.textContent = JSON.stringify(result, null, 2);
}

processBtn.addEventListener('click', processMidi);
