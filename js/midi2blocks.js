export function midiToTicks(midiBuffer) {
  return new Promise((resolve)=>{
    const midi = new Midi(midiBuffer);
    const tickMap = new Map();

    midi.tracks.forEach(track=>{
      const prog = track.instrument?.number+1||1;
      const isPerc = !!track.isPercussion || track.channel===9;

      track.notes.forEach(note=>{
        const tick = Math.round(note.time*20); // 20 ticks/segundo
        const velocity = note.velocity || 0.8;

        let block = "minecraft:gold_block";
        if(isPerc){ // Percusión simple
          if(note.midi===35) block="minecraft:stone";
          else if(note.midi===38) block="minecraft:gravel";
          else if(note.midi===42) block="minecraft:clay";
        } else { // GM program map simple
          if(prog===25) block="minecraft:emerald_block";
          else if(prog===33) block="minecraft:stone";
          else if(prog===2) block="minecraft:clay";
        }

        const noteMusical = midiNoteToName(note.midi);

        if(!tickMap.has(tick)) tickMap.set(tick, []);
        tickMap.get(tick).push({block, note:clampNote(note.midi-60+12), velocity, musical: noteMusical});
      });
    });

    const ticksSorted = Array.from(tickMap.keys()).sort((a,b)=>a-b);
    const rows = ticksSorted.map((t,i)=>{
      const notes = tickMap.get(t).sort((a,b)=>b.velocity-a.velocity).slice(0,3);
      const delta = (i<ticksSorted.length-1)?ticksSorted[i+1]-t:0;
      return {tick:t, delta, notes};
    });

    resolve(rows);
  });
}

function clampNote(n){ return Math.max(0,Math.min(24,n)); }
function midiNoteToName(midi){
  const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const octave = Math.floor(midi/12)-1;
  return names[midi%12]+octave;
}
