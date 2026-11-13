import { auth } from './firebase';

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const headers = new Headers(options.headers || {});
  if (authHeaders.Authorization && !headers.has('Authorization')) {
    headers.set('Authorization', authHeaders.Authorization);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof data === 'object' && data && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${response.status})`;
    const err = new Error(message) as Error & { status?: number; payload?: unknown };
    err.status = response.status;
    err.payload = data;
    throw err;
  }

  return data as T;
}

export function uploadFormWithProgress<T = unknown>(
  path: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const authHeaders = await getAuthHeaders();
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    if (authHeaders.Authorization) {
      xhr.setRequestHeader('Authorization', authHeaders.Authorization);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parsed as T);
        } else {
          reject(new Error(parsed.error || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during file upload.'));
    xhr.send(formData);
  });
}

export async function downloadAuthenticatedBlob(path: string, filename: string) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`/api${path}`, {
    headers: authHeaders,
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Unable to download file.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
