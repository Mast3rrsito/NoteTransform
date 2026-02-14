// js/midiProcessor.js
// Depende de que <script src="@tonejs/midi..."> haya cargado antes (global Midi)

export async function midiBufferToRows(arrayBuffer) {
  // arrayBuffer: ArrayBuffer del archivo MIDI
  // devuelve: Array de { tick, delta, notes: [{ block, note, velocity, musical }] }
  const midi = new Midi(arrayBuffer);

  // Mapa: tick (int) -> [noteEntry,...]
  const tickMap = new Map();

  midi.tracks.forEach(track => {
    const programNumber = (track.instrument && typeof track.instrument.number === 'number') ? track.instrument.number + 1 : 1;
    const isPercussion = !!track.isPercussion || track.channel === 9 || track.channel === 10;

    track.notes.forEach(n => {
      // convert seconds to Minecraft ticks (20 ticks/segundo) -> exacto respetando tempo map
      const tick = Math.round(n.time * 20);
      const velocity = n.velocity ?? 0.8;
      // map instrument -> support block
      let supportBlock = "minecraft:stone"; // default
      if (isPercussion) {
        supportBlock = percussionBlockForMidi(n.midi);
      } else {
        supportBlock = gmProgramToBlock(programNumber);
      }
      const mcNote = clamp( Math.round(n.midi - 60 + 12) , 0, 24); // center MIDI60 -> MC12
      const musical = midiNoteToName(n.midi);

      const entry = { block: supportBlock, note: mcNote, velocity, musical };

      if (!tickMap.has(tick)) tickMap.set(tick, []);
      tickMap.get(tick).push(entry);
    });
  });

  // Sort ticks and produce rows with delta & pick top up to 3 notes
  const ticks = Array.from(tickMap.keys()).sort((a,b)=>a-b);
  const rows = [];
  for (let i = 0; i < ticks.length; i++) {
    const t = ticks[i];
    const next = (i < ticks.length - 1) ? ticks[i+1] : t;
    const rawNotes = tickMap.get(t) || [];
    // pick top 3 by velocity (loudest)
    rawNotes.sort((a,b)=>b.velocity - a.velocity);
    const notes = rawNotes.slice(0,3).map((n, index) => ({ index, ...n }));
    rows.push({ tick: t, delta: next - t, notes });
  }

  return { rows, meta: { trackCount: midi.tracks.length, tempi: midi.header?.tempos || [] } };
}


// -------- helpers
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

function gmProgramToBlock(programNumber){
  // Map GM programs (1-based) to sensible support blocks.
  // Expand as needed.
  if (!programNumber) programNumber = 1;
  if (programNumber >= 25 && programNumber <= 32) return "minecraft:emerald_block"; // guitars
  if (programNumber >= 33 && programNumber <= 40) return "minecraft:stone"; // basses
  if (programNumber >= 1 && programNumber <= 8) return "minecraft:gold_block"; // pianos/harp
  if (programNumber === 10 || programNumber === 11) return "minecraft:glowstone";
  if (programNumber === 14) return "minecraft:iron_block";
  // default
  return "minecraft:clay";
}

function percussionBlockForMidi(midi){
  // basic mapping for General MIDI percussion notes
  if (midi === 35 || midi === 36) return "minecraft:stone";
  if (midi === 38 || midi === 40) return "minecraft:gravel";
  if (midi === 42 || midi === 44) return "minecraft:clay";
  if (midi === 49) return "minecraft:glowstone";
  return "minecraft:stone";
}

function midiNoteToName(m){
  const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const octave = Math.floor(m/12) - 1;
  return `${names[m % 12]}${octave}`;
}
