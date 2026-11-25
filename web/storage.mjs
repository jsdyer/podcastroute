import {STORAGE_KEY,emptyWorkspace,validateWorkspace,serializedWorkspace} from './model.mjs';

export const SAVE_MODE_KEY='coolcode:podcastroute:save-mode:v1';
const revision=raw=>{try{return JSON.parse(raw)?._deviceRevision||null;}catch{return null;}};
const newRevision=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;

// Keep provider responses and user work in the existing validated workspace format.
// A changed device copy is a conflict, not permission to overwrite another tab.
export class WorkspaceStore {
  constructor(storage){
    this.storage=storage;
    this.enabled=true;
    this.baseline=null;
    this.revision=null;
    this.snapshot=serializedWorkspace(emptyWorkspace());
    this.state='ready';
  }
  read(){
    let raw;
    try{
      this.enabled=this.storage.getItem(SAVE_MODE_KEY)!=='tab';
      raw=this.storage.getItem(STORAGE_KEY);
    }catch{this.state='unavailable';return emptyWorkspace();}
    try{
      const workspace=raw?validateWorkspace(JSON.parse(raw)):emptyWorkspace();
      this.baseline=raw;
      this.revision=revision(raw);
      this.snapshot=serializedWorkspace(workspace);
      this.state=this.enabled?(raw?'saved':'ready'):'tab';
      return workspace;
    }catch{this.state='invalid';return emptyWorkspace();}
  }
  save(workspace,{replace=false}={}){
    const serialized=serializedWorkspace(workspace);
    if(!this.enabled){this.state='tab';return false;}
    if(!replace&&['conflict','invalid'].includes(this.state))return false;
    try{
      const latest=this.storage.getItem(STORAGE_KEY);
      if(!replace&&latest!==this.baseline){this.state='conflict';return false;}
      if(latest!==null&&serialized===this.snapshot&&latest===this.baseline){this.state='saved';return true;}
      const record=JSON.stringify({...JSON.parse(serialized),_deviceRevision:newRevision(),_previousDeviceRevision:revision(latest)});
      this.storage.setItem(STORAGE_KEY,record);
      this.baseline=record;
      this.revision=revision(record);
      this.snapshot=serialized;
      this.state='saved';
      return true;
    }catch{this.state='unavailable';return false;}
  }
  setEnabled(enabled){
    try{
      // Turning saving off deliberately removes the remembered workspace.
      if(!enabled)this.storage.removeItem(STORAGE_KEY);
      this.storage.setItem(SAVE_MODE_KEY,enabled?'device':'tab');
      this.enabled=enabled;
      if(!enabled){this.baseline=null;this.revision=null;}
      this.state=enabled?'ready':'tab';
      return true;
    }catch{
      this.enabled=enabled;
      this.state='unavailable';
      return false;
    }
  }
  observe(raw,workspace){
    if(!this.enabled||raw===this.baseline)return null;
    try{if(this.storage.getItem(STORAGE_KEY)!==raw)return null;}catch{this.state='unavailable';return null;}
    // A concurrent writer based on an older revision must not silently erase this tab.
    if(raw&&this.revision){
      try{if(JSON.parse(raw)._previousDeviceRevision!==this.revision){this.state='conflict';return null;}}catch{this.state='invalid';return null;}
    }
    if(serializedWorkspace(workspace)!==this.snapshot){this.state='conflict';return null;}
    try{
      const next=raw?validateWorkspace(JSON.parse(raw)):emptyWorkspace();
      this.baseline=raw;
      this.revision=revision(raw);
      this.snapshot=serializedWorkspace(next);
      this.state=raw?'saved':'ready';
      return next;
    }catch{this.state='invalid';return null;}
  }
  clear(){
    try{
      this.storage.removeItem(STORAGE_KEY);
      this.baseline=null;
      this.revision=null;
      this.snapshot=serializedWorkspace(emptyWorkspace());
      this.state=this.enabled?'ready':'tab';
      return true;
    }catch{this.state='unavailable';return false;}
  }
}
