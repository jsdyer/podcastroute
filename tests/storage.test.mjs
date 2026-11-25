import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkspaceStore,SAVE_MODE_KEY} from '../web/storage.mjs';
import {STORAGE_KEY,emptyWorkspace,normalizeFeed,normalizeEpisode,serializedWorkspace} from '../web/model.mjs';
function memory(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map};}
const feed=normalizeFeed({id:42,title:'Curiosity',url:'https://example.org/feed'});
const episode=normalizeEpisode({id:8,title:'A lesson',enclosureUrl:'https://example.org/audio.mp3'},feed);
function following(){return {...emptyWorkspace(),subscriptions:[feed]};}

test('new visitors automatically save follows, queue, notes and positions and restore on reload',()=>{
 const storage=memory(),store=new WorkspaceStore(storage);assert.deepEqual(store.read(),emptyWorkspace());assert.equal(store.enabled,true);
 const work={...following(),queue:[episode],notes:{8:'My note'},progress:{8:123}};
 assert.equal(store.save(work),true);assert.equal(store.state,'saved');
 const reloaded=new WorkspaceStore(storage);assert.deepEqual(reloaded.read(),work);assert.equal(reloaded.state,'saved');
 work.subscriptions=[];assert.equal(reloaded.save(work),true);assert.equal(new WorkspaceStore(storage).read().subscriptions.length,0);
});
test('existing v1 opt-in saved workspaces migrate without losing data',()=>{
 const storage=memory();storage.setItem(STORAGE_KEY,serializedWorkspace(following()));const store=new WorkspaceStore(storage);
 assert.deepEqual(store.read(),following());assert.equal(store.enabled,true);assert.equal(store.state,'saved');
});
test('tab-only choice removes remembered data and survives reload until enabled',()=>{
 const storage=memory(),store=new WorkspaceStore(storage);store.read();store.save(following());assert.equal(store.setEnabled(false),true);
 assert.equal(storage.getItem(STORAGE_KEY),null);assert.equal(storage.getItem(SAVE_MODE_KEY),'tab');assert.equal(store.save(following()),false);
 const reload=new WorkspaceStore(storage);assert.deepEqual(reload.read(),emptyWorkspace());assert.equal(reload.enabled,false);assert.equal(reload.state,'tab');
 assert.equal(reload.setEnabled(true),true);assert.equal(reload.save(following()),true);assert.equal(new WorkspaceStore(storage).read().subscriptions.length,1);
});
test('storage failures are visible and never reported as saved',()=>{
 const storage=memory(),store=new WorkspaceStore(storage);store.read();storage.setItem=()=>{throw Error('QuotaExceededError');};
 assert.equal(store.save(following()),false);assert.equal(store.state,'unavailable');assert.equal(storage.getItem(STORAGE_KEY),null);
 const blocked=new WorkspaceStore({getItem(){throw Error('SecurityError');}});assert.deepEqual(blocked.read(),emptyWorkspace());assert.equal(blocked.state,'unavailable');
});
test('malformed saved data is preserved until explicit replacement',()=>{
 const storage=memory();storage.setItem(STORAGE_KEY,'{"bad":');const store=new WorkspaceStore(storage);assert.deepEqual(store.read(),emptyWorkspace());assert.equal(store.state,'invalid');
 assert.equal(store.save(following()),false);assert.equal(storage.getItem(STORAGE_KEY),'{"bad":');assert.equal(store.save(following(),{replace:true}),true);
 assert.equal(new WorkspaceStore(storage).read().subscriptions.length,1);
});
test('stored malicious content is validated without executable URLs or unknown fields',()=>{
 const storage=memory();const value={...following(),queue:[{...episode,audio:'javascript:alert(1)',link:'data:text/html,bad',title:'<img src=x onerror=alert(1)>Safe'}],privateExtra:'discard'};
 storage.setItem(STORAGE_KEY,JSON.stringify(value));const restored=new WorkspaceStore(storage).read();assert.equal(restored.queue[0].audio,'');assert.equal(restored.queue[0].link,'');assert.equal(restored.queue[0].title,'Safe');assert.equal(restored.privateExtra,undefined);
});
test('a stale write cannot silently replace another tab even before its storage event arrives',()=>{
 const storage=memory(),one=new WorkspaceStore(storage),two=new WorkspaceStore(storage);one.read();two.read();one.save(following());
 const local={...emptyWorkspace(),notes:{8:'Unsaved local note'}};assert.equal(two.save(local),false);assert.equal(two.state,'conflict');assert.deepEqual(new WorkspaceStore(storage).read(),following());
 assert.equal(two.save(local,{replace:true}),true);assert.deepEqual(new WorkspaceStore(storage).read(),local);
});
test('storage events update clean tabs and preserve dirty work as a visible conflict',()=>{
 const storage=memory(),store=new WorkspaceStore(storage);store.read();const remote=serializedWorkspace(following());
 storage.setItem(STORAGE_KEY,remote);assert.deepEqual(store.observe(remote,emptyWorkspace()),following());assert.equal(store.state,'saved');
 const dirty={...following(),notes:{8:'Keep me'}};storage.removeItem(STORAGE_KEY);assert.equal(store.observe(null,dirty),null);assert.equal(store.state,'conflict');assert.equal(dirty.notes[8],'Keep me');
});
test('clear removes the remembered copy while keeping automatic saving available',()=>{
 const storage=memory(),store=new WorkspaceStore(storage);store.read();store.save(following());assert.equal(store.clear(),true);
 assert.equal(storage.getItem(STORAGE_KEY),null);assert.equal(store.state,'ready');assert.equal(store.enabled,true);
 assert.equal(new WorkspaceStore(storage).read().subscriptions.length,0);
});

test('simultaneous writers retain their own copies and flag revision conflicts',()=>{
 const storage=memory(),store=new WorkspaceStore(storage);store.read();store.save(following());
 const competing=JSON.stringify({...emptyWorkspace(),notes:{8:'Other tab'},_deviceRevision:'competing',_previousDeviceRevision:null});
 storage.setItem(STORAGE_KEY,competing);
 assert.equal(store.observe(competing,following()),null);assert.equal(store.state,'conflict');
 assert.equal(following().subscriptions.length,1);
});
test('delayed storage events cannot replace a more recent saved copy',()=>{
 const storage=memory(),store=new WorkspaceStore(storage);store.read();store.save(following());const older=storage.getItem(STORAGE_KEY);
 const newer={...following(),notes:{8:'Newer note'}};store.save(newer);
 assert.equal(store.observe(older,newer),null);assert.equal(store.state,'saved');assert.deepEqual(new WorkspaceStore(storage).read(),newer);
});
