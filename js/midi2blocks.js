const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const output = document.getElementById('output');

let midiFile = null;

// Drag & Drop
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.style.borderColor = '#00f';
});
dropZone.addEventListener('dragleave', e => {
  e.preventDefault();
  dropZone.style.borderColor = '#888';
});
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.style.borderColor = '#888';
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

// Mapping MIDI instrument → Minecraft Note Block
const instrumentMap = {
  0: { block: "Harp", octave: 0 },
  1: { block: "Bass", octave: 2 },
  2: { block: "Bass Drum", octave: 0 },
  3: { block: "Snare Drum", octave: 0 },
  4: { block: "Click", octave: 0 },
  5: { block: "Guitar", octave: 1 },
  6: { block: "Flute", octave: -1 },
  7: { block: "Bells", octave: -2 },
  8: { block: "Chimes", octave: -2 },
  9: { block: "Xylophone", octave: -2 },
  10: { block: "Iron Xylophone", octave: 0 },
  11: { block: "Cow Bell", octave: -1 },
  12: { block: "Didgeridoo", octave: 2 },
  13: { block: "Bit", octave: 0 },
  14: { block: "Banjo", octave: 0 },
  15: { block: "Pling", octave: 0 }
  // Agrega más según tu tabla completa si quieres
};

// Convert seconds → Minecraft ticks (20 ticks/sec)
function secondsToTicks(sec) {
  return Math.round(sec / 0.05);
}

// Map MIDI note → Minecraft note with octave shift
function mapNote(midiNote, instrument) {
  const map = instrumentMap[instrument] || { block: "Harp", octave: 0 };
  const noteNumber = midiNote + map.octave * 12;
  return { block: map.block, note: noteNumber };
}

// Process MIDI
async function processMidi() {
  if(!midiFile) {
    alert("Please select or drop a MIDI file first!");
    return;
  }

  const arrayBuffer = await midiFile.arrayBuffer();
  const midi = new Midi(arrayBuffer);
  const result = [];

  midi.tracks.forEach(track => {
    track.notes.forEach(note => {
      const ticks = secondsToTicks(note.time);
      const mapped = mapNote(note.midi, note.instrument);
      result.push({ ticks, block: mapped.block, note: mapped.note });
    });
  });

  output.textContent = JSON.stringify(result, null, 2);
}

processBtn.addEventListener('click', processMidi);
