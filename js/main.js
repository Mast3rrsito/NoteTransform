import { midiToTicks } from './midiProcessor.js';
import { downloadJson, downloadSchem } from './schemGenerator.js';

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const downloadSchemBtn = document.getElementById('downloadSchemBtn');
const resultBody = document.getElementById('resultBody');

let midiFile = null;
let ticksData = null;

dropZone.addEventListener('click', ()=>fileInput.click());
dropZone.addEventListener('dragover', e=>{ e.preventDefault(); dropZone.classList.add('hover'); });
dropZone.addEventListener('dragleave', e=>{ e.preventDefault(); dropZone.classList.remove('hover'); });
dropZone.addEventListener('drop', e=>{
  e.preventDefault(); dropZone.classList.remove('hover');
  if(e.dataTransfer.files.length){ midiFile = e.dataTransfer.files[0]; dropZone.textContent = `Loaded: ${midiFile.name}`; }
});
fileInput.addEventListener('change', e=>{ if(e.target.files.length){ midiFile = e.target.files[0]; dropZone.textContent = `Loaded: ${midiFile.name}`; } });

processBtn.addEventListener('click', async ()=>{
  if(!midiFile){ alert("Carga un MIDI primero"); return; }
  const buffer = await midiFile.arrayBuffer();
  ticksData = await midiToTicks(buffer);

  // render tabla
  resultBody.innerHTML="";
  ticksData.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.tick}</td><td>${r.delta}</td><td>${r.notes.map(n=>`${n.block}(${n.note}) ${n.musical}`).join(", ")}</td>`;
    resultBody.appendChild(tr);
  });

  downloadJsonBtn.style.display="inline-block";
  downloadSchemBtn.style.display="inline-block";
});

downloadJsonBtn.addEventListener('click', ()=>{
  if(!ticksData) return alert("Procesa un MIDI primero");
  downloadJson(ticksData, (midiFile?.name?.replace(/\.mid$/i,'')||'noteblocks')+".json");
});

downloadSchemBtn.addEventListener('click', ()=>{
  if(!ticksData) return alert("Procesa un MIDI primero");
  downloadSchem(ticksData, (midiFile?.name?.replace(/\.mid$/i,'')||'noteblocks')+".schem");
});
