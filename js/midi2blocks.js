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

fileInput.addEventListener('change', e => {
  midiFile = e.target.files[0];
  dropZone.textContent = `File ready: ${midiFile.name}`;
});

// --- GM to Minecraft Note Block Mapping (simplificado, pero puedes expandirlo con toda la tabla de u3002)
const gmToNoteBlock = {
  // Piano
  1: { block:"Harp", baseNote:0 }, 2:{block:"Pling", baseNote:15}, 3:{block:"Pling", baseNote:15},
  5: { block:"Harp", baseNote:0 }, 6:{block:"Harp", baseNote:0}, 
  // Strings
  41:{block:"Flute", baseNote:6-1*12}, 42:{block:"Flute", baseNote:6-1*12}, 46:{block:"Harp", baseNote:1*12},
  47:{block:"Harp", baseNote:0},
  // Percussion GM
  35:{block:"Bass Drum", note:4},36:{block:"Bass Drum", note:8},38:{block:"Snare Drum", note:15},42:{block:"Click", note:21},
  46:{block:"Snare Drum", note:22}, 59:{block:"Snare Drum", note:24}
};

// Limit Minecraft NoteBlock numbers between 0-24
function clampNote(n){ return Math.max(0, Math.min(24, n)); }

// Convert seconds → Minecraft ticks
function secondsToTicks(seconds, bpm){
  // Minecraft has 20 ticks per second
  return Math.round(seconds * 20);
}

// Map a MIDI note to Minecraft note block
function mapMidiNote(note, gm, isPercussion=false){
  const mapping = gmToNoteBlock[gm];
  if(!mapping) return { block:"Harp", note:12 };
  if(isPercussion) return { block:mapping.block, note:mapping.note };
  const finalNote = clampNote(note + (mapping.baseNote || 0));
  return { block: mapping.block, note:finalNote };
}

// Process MIDI
async function processMidi(){
  if(!midiFile){ alert("Select a MIDI file first!"); return; }

  const arrayBuffer = await midiFile.arrayBuffer();
  const midi = new Midi(arrayBuffer);

  const bpm = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120;
  const ticksMap = {};

  midi.tracks.forEach(track=>{
    track.notes.forEach(note=>{
      const tick = secondsToTicks(note.time, bpm);
      const isPercussion = note.midi>=35 && note.midi<=81; // basic perc check
      const mapped = mapMidiNote(note.midi, note.instrument, isPercussion);
      if(!ticksMap[tick]) ticksMap[tick]=[];
      if(ticksMap[tick].length<3) ticksMap[tick].push(mapped);
    });
  });

  // Sort ticks and render table
  const sortedTicks = Object.keys(ticksMap).sort((a,b)=>a-b);
  let html=`<table><tr><th>Tick</th><th>Notes</th></tr>`;
  sortedTicks.forEach(tick=>{
    const notesStr = ticksMap[tick].map(n=>`${n.block} (${n.note})`).join(", ");
    html+=`<tr><td>${tick}</td><td>${notesStr}</td></tr>`;
  });
  html+=`</table>`;
  output.innerHTML = html;
}

processBtn.addEventListener('click', processMidi);
