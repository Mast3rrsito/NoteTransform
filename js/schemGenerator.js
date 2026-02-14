import { writeUncompressed } from "https://cdn.jsdelivr.net/npm/prismarine-nbt@2.0.0/dist/index.min.js";

export function downloadJson(ticks, filename="noteblocks.json"){
  const blob = new Blob([JSON.stringify(ticks,null,2)], {type:"application/json"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
// hola
export function downloadSchem(ticks, filename="noteblocks.schem"){
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
  const blob = new Blob([buffer], {type:"application/octet-stream"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
