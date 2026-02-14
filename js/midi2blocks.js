const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const output = document.getElementById('output');

let midiFile = null;

// Drag & Drop
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('hover'); });
dropZone.addEventListener('dragleave', e => { e.preventDefault(); dropZone.classList.remove('hover'); });
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('hover');
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

// GM Instrument → Minecraft Note Block (simplificado)
const gmToNoteblock = {
  0: { block: "Harp", octave: 0 },
  1: { block: "Pling", octave: 0 },
  33: { block: "Bass", octave: 2 },
  35: { block: "Bass Drum", octave: 0 },
  38: { block: "Snare Drum", octave: 0 },
  42: { block: "Click", octave: 0 },
  74: { block: "Flute", octave: -1 },
  10: { block: "Bells", octave: -2 },
  113:{ block: "Chimes", octave: -2 },
  14: { block: "Xylophone", octave: -2 },
  12: { block: "Iron Xylophone", octave: 0 },
  106:{ block: "Banjo", octave: 0 },
  81: { block: "Pling", octave: 0 }
};

// Seconds → Minecraft ticks
function secondsToTicks(sec) { return Math.round(sec / 0.05); }

// Map MIDI note → Minecraft note 0-24
function mapNote(midiNote, gmInstrument) {
  const map = gmToNoteblock[gmInstrument] || { block: "Harp", octave: 0 };
  let noteNumber = midiNote + map.octave * 12;
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
      if(ticksMap[tick].length < 3) ticksMap[tick].push(mapped);
    });
  });

  // Crear tabla HTML
  const tickKeys = Object.keys(ticksMap).sort((a,b)=>a-b);
  let html = `<table><tr><th>Tick</th><th>Notes</th></tr>`;
  tickKeys.forEach(tick => {
    const notesStr = ticksMap[tick].map(n => `${n.block} (${n.note})`).join(", ");
    html += `<tr><td>${tick}</td><td>${notesStr}</td></tr>`;
  });
  html += `</table>`;
  output.innerHTML = html;
}

processBtn.addEventListener('click', processMidi);
