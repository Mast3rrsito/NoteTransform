import { writeUncompressed } from "https://cdn.jsdelivr.net/npm/prismarine-nbt@2.0.0/dist/index.min.js";

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const downloadSchemBtn = document.getElementById('downloadSchemBtn');
const resultBody = document.getElementById('resultBody');

let midiFile = null;
let lastExportData = null;

dropZone.addEventListener('click', ()=>fileInput.click());
dropZone.addEventListener('dragover', e=>{ e.preventDefault(); dropZone.classList.add('hover'); });
dropZone.addEventListener('dragleave', e=>{ e.preventDefault(); dropZone.classList.remove('hover'); });
dropZone.addEventListener('drop', e=>{
  e.preventDefault(); dropZone.classList.remove('hover');
  if(e.dataTransfer.files.length){ midiFile = e.dataTransfer.files[0]; dropZone.textContent = `Loaded: ${midiFile.name}`; }
});
fileInput.addEventListener('change', e=>{ if(e.target.files.length){ midiFile = e.target.files[0]; dropZone.textContent = `Loaded: ${midiFile.name}`; } });

// Instrument & percussion mapping
const gmProgramMap = { 1:{block:"minecraft:gold_block"}, 2:{block:"minecraft:clay"}, 25:{block:"minecraft:emerald_block"}, 33:{block:"minecraft:stone"} };
const percussionMap = { 35:{block:"minecraft:stone"}, 38:{block:"minecraft:gravel"}, 42:{block:"minecraft:clay"} };

function clampNote(n){ return Math.max(0,Math.min(24,n)); }
function secondsToMcTicks(s){ return Math.round(s*20); }
function pickTopNotes(notes, max=3){ return notes.sort((a,b)=>b.velocity-a.velocity).slice(0,max); }

processBtn.addEventListener('click', async ()=>{
  if(!midiFile){ alert("Carga un MIDI primero"); return; }
  resultBody.innerHTML = "";
  const buffer = await midiFile.arrayBuffer();
  const midi = new Midi(buffer);

  const tickMap = new Map();

  midi.tracks.forEach(track=>{
    const prog = track.instrument?.number+1||1;
    const isPerc = !!track.isPercussion || track.channel===9;
    track.notes.forEach(note=>{
      const mcTick = secondsToMcTicks(note.time);
      let mapped = null;
      if(isPerc || (note.midi>=35 && note.midi<=81 && track.channel===9)){
        mapped = percussionMap[note.midi] || {block:"minecraft:stone", note:12};
      } else {
        const info = gmProgramMap[prog] || {block:"minecraft:gold_block"};
        mapped = {block:info.block, note:clampNote(note.midi-60+12)};
      }
      if(!tickMap.has(mcTick)) tickMap.set(mcTick, []);
      tickMap.get(mcTick).push({block:mapped.block, note:mapped.note, velocity:note.velocity});
    });
  });

  const ticks = Array.from(tickMap.keys()).sort((a,b)=>a-b);
  lastExportData = [];
  ticks.forEach((t,i)=>{
    const notes = pickTopNotes(tickMap.get(t),3);
    const nextTick = (i<ticks.length-1)?ticks[i+1]:t;
    const delta = nextTick - t;
    lastExportData.push({tick:t, delta, notes});
  });

  // Render table
  resultBody.innerHTML="";
  lastExportData.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.tick}</td><td>${r.delta}</td><td>${r.notes.map(n=>`${n.block}(${n.note})`).join(", ")}</td>`;
    resultBody.appendChild(tr);
  });

  downloadJsonBtn.style.display="inline-block";
  downloadSchemBtn.style.display="inline-block";
});

// Descargar JSON
downloadJsonBtn.addEventListener('click', ()=>{
  if(!lastExportData){ alert("Procesa el MIDI primero"); return; }
  const blob = new Blob([JSON.stringify(lastExportData,null,2)],{type:"application/json"});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=(midiFile?.name?.replace(/\.mid$/i,'')||'noteblocks')+".json";
  document.body.appendChild(a); a.click(); a.remove();
});

// Genera .schem
downloadSchemBtn.addEventListener('click', ()=>{
  if(!lastExportData){ alert("Procesa el MIDI primero"); return; }
  const ticks = lastExportData;
  const Width = Math.max(...ticks.map(t=>t.tick))+1;
  const Height = 4;
  const Length = 1;
  const Palette = {"minecraft:air":0,"minecraft:note_block":1};
  let nextId=2;
  const Blocks=[];

  ticks.forEach(r=>{
    r.notes.forEach((n,i)=>{
      if(Palette[n.block]==null) Palette[n.block]=nextId++;
      Blocks.push({Name:n.block, Pos:[r.tick,i,0], States:{}});
      Blocks.push({Name:"minecraft:note_block", Pos:[r.tick,1+i,0], States:{note:String(n.note)}});
    });
  });

  const nbt = {
    type:"compound",
    name:"",
    value:{
      Width:{type:"short",value:Width},
      Height:{type:"short",value:Height},
      Length:{type:"short",value:Length},
      Palette:{type:"compound",value:Object.fromEntries(Object.entries(Palette).map(([k,v])=>[k,{type:"int",value:v}]))},
      Blocks:{type:"list",value:{type:"compound",value:Blocks.map(b=>({Name:{type:"string",value:b.Name},Pos:{type:"list",value:b.Pos.map(p=>({type:"int",value:p}))},States:{type:"compound",value:{}}}))}}
    }
  };

  const buffer = writeUncompressed(nbt);
  const blob = new Blob([buffer],{type:"application/octet-stream"});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=(midiFile?.name?.replace(/\.mid$/i,'')||'noteblocks')+".schem";
  document.body.appendChild(a); a.click(); a.remove();
});
