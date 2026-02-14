// js/main.js
import { midiBufferToRows } from './midiProcessor.js';
import { downloadJson, downloadSchem } from './schemGenerator.js';

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const downloadSchemBtn = document.getElementById('downloadSchemBtn');
const resultBody = document.getElementById('resultBody');
const infoText = document.getElementById('infoText');
const infoBPM = document.getElementById('infoBPM');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

let midiFile = null;
let processedRows = null;

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('hover'); });
dropZone.addEventListener('dragleave', e => { e.preventDefault(); dropZone.classList.remove('hover'); });
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('hover');
  if (e.dataTransfer.files.length) { midiFile = e.dataTransfer.files[0]; dropZone.textContent = `Loaded: ${midiFile.name}`; }
});
fileInput.addEventListener('change', e => { if (e.target.files.length) { midiFile = e.target.files[0]; dropZone.textContent = `Loaded: ${midiFile.name}`; } });

processBtn.addEventListener('click', async () => {
  if (!midiFile) { alert('Carga un MIDI primero'); return; }
  processBtn.disabled = true;
  resultBody.innerHTML = '';
  infoText.textContent = 'Procesando MIDI...';
  console.log('Starting MIDI processing for', midiFile.name);
  try {
    const buffer = await midiFile.arrayBuffer();
    const { rows, meta } = await midiBufferToRows(buffer);
    processedRows = rows;
    // render table
    resultBody.innerHTML = '';
    for (const r of rows) {
      const tr = document.createElement('tr');
      const notesStr = r.notes.map(n => `${n.block} (${n.note}) ${n.musical || ''}`).join(', ');
      tr.innerHTML = `<td>${r.tick}</td><td>${r.delta}</td><td>${notesStr}</td>`;
      resultBody.appendChild(tr);
    }
    infoText.textContent = `Procesado: ${rows.length} ticks — tracks: ${meta.trackCount}`;
    if (meta.tempi && meta.tempi.length) infoBPM.textContent = `Referencia tempo encontrada.`;
    downloadJsonBtn.style.display = 'inline-block';
    downloadSchemBtn.style.display = 'inline-block';
    console.log('Processing done', rows.length, 'rows');
  } catch (err) {
    console.error('Error processing MIDI:', err);
    alert('Error procesando MIDI: ' + err.message);
    infoText.textContent = 'Error al procesar (mira consola)';
  } finally {
    processBtn.disabled = false;
  }
});

downloadJsonBtn.addEventListener('click', () => {
  if (!processedRows) return alert('Procesa un MIDI primero');
  downloadJson(processedRows, (midiFile?.name?.replace(/\.mid$/i,'') || 'noteblocks') + '.json');
});

downloadSchemBtn.addEventListener('click', async () => {
  if (!processedRows) return alert('Procesa un MIDI primero');
  progressWrap.style.display = 'inline-flex';
  progressBar.value = 0;
  progressBar.max = processedRows.length;
  progressText.textContent = `0 / ${processedRows.length}`;
  try {
    await downloadSchem(processedRows, (midiFile?.name?.replace(/\.mid$/i,'') || 'noteblocks') + '.schem', (done, total) => {
      progressBar.value = done;
      progressText.textContent = `${done} / ${total}`;
    });
    infoText.textContent = 'Schematic generado y descargado.';
  } catch (err) {
    console.error('Error generando schem:', err);
    alert('Error generando .schem: ' + err.message);
  } finally {
    progressWrap.style.display = 'none';
  }
});
