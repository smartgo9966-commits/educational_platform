const CLOUD_NAME    = 'dt4amggpt';
const UPLOAD_PRESET = 'bqkdglbm';
const UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

// Upload a File object with optional progress callback → { downloadURL, publicId }
export async function uploadFile(file, { onProgress } = {}) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', UPLOAD_URL);
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status === 200) {
          resolve({ downloadURL: res.secure_url, publicId: res.public_id });
        } else {
          reject(new Error(res.error?.message || 'Upload failed'));
        }
      } catch { reject(new Error('Invalid upload response')); }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(fd);
  });
}

// Upload a Blob (e.g. canvas snapshot) → { downloadURL, publicId }
export async function uploadBlob(blob, filename = 'snapshot.png') {
  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('upload_preset', UPLOAD_PRESET);

  const res  = await fetch(UPLOAD_URL, { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
  return { downloadURL: data.secure_url, publicId: data.public_id };
}

// Cloudinary deletion requires a server-side signature — files stay on Cloudinary
// but are removed from Firestore, so they disappear from the app.
export async function deleteFile(_publicId) {}
