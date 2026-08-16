const DB_NAME='xfactor-os-assets';
const STORE='blobs';
const VERSION=1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error ?? new Error('Asset database failed to open.'));
  });
}

export async function putAssetBlob(key:string, blob:Blob):Promise<void>{
  const db=await openDb();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(blob,key);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error ?? new Error('Asset write failed.'));
  });
  db.close();
}

export async function getAssetBlob(key:string):Promise<Blob|null>{
  const db=await openDb();
  const blob=await new Promise<Blob|null>((resolve,reject)=>{
    const request=db.transaction(STORE,'readonly').objectStore(STORE).get(key);
    request.onsuccess=()=>resolve(request.result instanceof Blob ? request.result : null);
    request.onerror=()=>reject(request.error ?? new Error('Asset read failed.'));
  });
  db.close();
  return blob;
}

export async function deleteAssetBlob(key:string):Promise<void>{
  const db=await openDb();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error ?? new Error('Asset deletion failed.'));
  });
  db.close();
}

export function kindFromFile(file:File): 'image'|'audio'|'video'|'document'|'code'|'other' {
  if(file.type.startsWith('image/')) return 'image';
  if(file.type.startsWith('audio/')) return 'audio';
  if(file.type.startsWith('video/')) return 'video';
  if(/javascript|json|xml|css|html|typescript/.test(file.type) || /\.(js|jsx|ts|tsx|css|html|json|md|py|rb|go|rs|java|kt|swift)$/i.test(file.name)) return 'code';
  if(file.type || /\.(pdf|docx?|txt|rtf|csv|xlsx?|pptx?)$/i.test(file.name)) return 'document';
  return 'other';
}
