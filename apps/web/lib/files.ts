function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("incforstartup-demo-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveFiles(files: { id: string; file: File }[]) {
  if (!files.length) return;
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      files.forEach((f) => tx.objectStore("files").put(f.file, f.id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function downloadFile(id: string, name: string) {
  const db = await database();
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const request = db.transaction("files").objectStore("files").get(id);
      request.onsuccess = () =>
        request.result
          ? resolve(request.result)
          : reject(new Error("No es troba el fitxer en aquest navegador."));
      request.onerror = () => reject(request.error);
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } finally {
    db.close();
  }
}
