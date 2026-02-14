import { Midi } from "https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.27/build/Midi.js";
import { writeUncompressed } from "https://cdn.jsdelivr.net/npm/prismarine-nbt@2.0.0/dist/index.min.js";

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const downloadSchemBtn = document.getElementById('downloadSchemBtn');
const resultBody = document.getElementById('resultBody');
const infoBPM = document.getElementById('infoBPM');

let midiFile = null;
let lastExportData = null;

// Drag & Drop
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

// ---- Map instruments / percussion to blocks
const gmProgramMap = {
  1: { name: "Harp", block: "minecraft:gold_block", octave: 0 },
  2: { name: "Pling", block: "minecraft:clay", octave: 0 },
  3: { name: "Pling", block: "minecraft:clay", octave: 0 },
  4: { name: "Pling", block: "minecraft:clay", octave: 0 },
  5: { name: "Harp", block: "minecraft:gold_block", octave: 0 },
  25: { name: "Guitar", block: "minecraft:emerald_block", octave: 1 },
  26: { name: "Guitar", block: "minecraft:emerald_block", octave: 1 },
  33: { name: "Bass", block: "minecraft:stone", octave: 2 },
  41: { name: "Flute", block: "minecraft:bone_block", octave: -1 },
  47: { name: "Harp", block: "minecraft:gold_block", octave: 0 },
  74: { name: "Flute", block: "minecraft:bone_block", octave: -1 },
  10: { name: "Bells", block: "minecraft:glowstone", octave:-2 },
  14: { name: "Xylophone", block: "minecraft:iron_block", octave:-2 },
  106:{ name:"Banjo", block:"minecraft:clay", octave:0 },
  81: { name:"Bit", block:"minecraft:redstone_block", octave:0 },
};

const percussionMap = {
  35: { block: "minecraft:stone", noteVal: 4 },
  36: { block: "minecraft:stone", noteVal: 8 },
  38: { block: "minecraft:gravel", noteVal: 15 },
  42: { block: "minecraft:clay", noteVal: 21 },
  46: { block: "minecraft:gravel", noteVal: 22 },
  59: { block: "minecraft:gravel", noteVal: 24 }
};

function clampNote(n){ return Math.max(0, Math.min(24,n)); }
function secondsToMcTicks(s){ return Math.round(s*20); }
function pickTopNotes(notes,maxCount=3){ return notes.sort((a,b)=>b.velocity - a.velocity).slice(0,maxCount); }

// ---- Process MIDI
async function processMidi(){
  if(!midiFile){ alert("Load a MIDI file first"); return; }

  resultBody.innerHTML="";
  infoBPM.textContent="";

  const buffer = await midiFile.arrayBuffer();
  const midi = new Midi(buffer);

  const defaultBpm = (midi.header?.tempos?.length>0) ? midi.header.tempos[0].bpm : 120;
  infoBPM.textContent = `Reference BPM: ${Math.round(defaultBpm)}`;

  const tickMap = new Map();

  midi.tracks.forEach(track=>{
    const programNumber = (track.instrument?.number!=null) ? track.instrument.number+1 : null;
    const isPercussion = track.isPercussion;

    track.notes.forEach(note=>{
      const mcTick = secondsToMcTicks(note.time);
      const midiPitch = note.midi;
      const velocity = note.velocity||0.8;

      let mapped = null;
      if(isPercussion || (note.midi>=35 && note.midi<=81 && track.channel===9)){
        mapped = percussionMap[midiPitch] || { block:"minecraft:stone", note:12, name:"Percussion" };
        mapped.note = clampNote(mapped.noteVal??12);
      } else {
        const gm = programNumber||1;
        const info = gmProgramMap[gm] || { name:"Harp", block:"minecraft:gold_block", octave:0 };
        let mcNote = clampNote(Math.round(note.midi-60 + 12 + (info.octave||0)*12));
        mapped = { block: info.block, note: mcNote, name: info.name };
      }

      const entry = { tick:mcTick, midi:midiPitch, velocity, instrumentName:mapped.name||mapped.block, block:mapped.block, note:mapped.note };

      if(!tickMap.has(mcTick)) tickMap.set(mcTick,[]);
      tickMap.get(mcTick).push(entry);
    });
  });

  const ticksSorted = Array.from(tickMap.keys()).sort((a,b)=>a-b);
  const rows = ticksSorted.map(tick=>({ tick, notes: pickTopNotes(tickMap.get(tick),3) }));

  const tableRows = rows.map((r,idx)=>{
    const nextTick = (idx<rows.length-1) ? rows[idx+1].tick : r.tick;
    const delta = nextTick - r.tick;
    return { tick:r.tick, delta, notes:r.notes };
  });

  resultBody.innerHTML="";
  tableRows.forEach(row=>{
    const tr = document.createElement('tr');
    const tdTick = document.createElement('td'); tdTick.textContent=row.tick;
    const tdDelta= document.createElement('td'); tdDelta.textContent=row.delta;
    const tdNotes= document.createElement('td'); tdNotes.textContent=row.notes.map(n=>`${n.instrumentName}(${n.note})`).join(', ');
    tr.appendChild(tdTick); tr.appendChild(tdDelta); tr.appendChild(tdNotes);
    resultBody.appendChild(tr);
  });

  lastExportData = {
    meta:{ sourceFile:midiFile.name, generatedAt:new Date().toISOString(), referenceBPM:defaultBpm, mcTicksPerSecond:20 },
    layout:{ maxNotesPerTick:3, baseY:0 },
    ticks: tableRows.map(r=>({ tick:r.tick, delta:r.delta, notes:r.notes.map((n,i)=>({ index:i, block:n.block, instrumentName:n.instrumentName, note:n.note, midi:n.midi, velocity:n.velocity })) }))
  };

  downloadJsonBtn.style.display="inline-block";
  downloadSchemBtn.style.display="inline-block";
}

// ---- Hook buttons
processBtn.addEventListener('click', ()=>{ processBtn.disabled=true; processMidi().finally(()=>processBtn.disabled=false); });

downloadJsonBtn.addEventListener('click', ()=>{
  if(!lastExportData) return alert("Process MIDI first");
  const blob = new Blob([JSON.stringify(lastExportData,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download = (midiFile?.name?.replace(/\.mid$/i,'')||'notetrasform')+'.noteblocks.json';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

downloadSchemBtn.addEventListener('click', async ()=>{
  if(!lastExportData) return alert("Process MIDI first");

  const ticks = lastExportData.ticks;
  const maxTick = ticks[ticks.length-1]?.tick||0;

  const Width = maxTick+1;
  const Height = lastExportData.layout.baseY+4; // base + 3 notes
  const Length = 1;

  const Palette = { "minecraft:air":0, "minecraft:note_block":1 };
  let blockIndex = 2;
  const Blocks=[];

  for(let i=0;i<ticks.length;i++){
    const row = ticks[i];
    for(let n of row.notes){
      const key = n.block;
      if(Palette[key]==null) Palette[key]=blockIndex++;
      Blocks.push({
        Name:"minecraft:note_block",
        Pos:[row.tick, 1+n.index, 0],
        States:{ note:String(n.note) }
      });
      Blocks.push({ Name:n.block, Pos:[row.tick, n.index, 0], States:{} });
    }
    infoBPM.textContent = `Generating schematic... tick ${i+1}/${ticks.length}`;
    await new Promise(r=>setTimeout(r,0)); // yield to update UI
  }

  const nbtData = {
    type:"compound",
    name:"",
    value:{
      Width:{type:"short",value:Width},
      Height:{type:"short",value:Height},
      Length:{type:"short",value:Length},
      Palette:{
        type:"compound",
        value:Object.fromEntries(Object.entries(Palette).map(([k,v])=>[k,{type:"int",value:v}]))
      },
      Blocks:{
        type:"list",
        value:{type:"compound", value:Blocks.map(b=>({
          Name:{type:"string",value:b.Name},
          Pos:{type:"list", value:b.Pos.map(p=>({type:"int",value:p}))},
          States:{type:"compound",value:Object.fromEntries(Object.entries(b.States||{}).map(([k,v])=>[k,{type:"string",value:v}]))}
        }))}
      }
    }
  };

  const buffer = writeUncompressed(nbtData);
  const blob = new Blob([buffer],{type:"application/octet-stream"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download = (midiFile?.name?.replace(/\.mid$/i,'')||'notetrasform')+'.schem';
  document.body.appendChild(a); a.click(); a.remove(); URL.revoke
