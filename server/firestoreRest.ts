import crypto from 'node:crypto';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const BASE_DOC_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;
const API_KEY = firebaseConfig.apiKey;

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

function toFsValue(val: unknown): FsValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((v) => toFsValue(v)) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FsValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) fields[k] = toFsValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFsValue(val: FsValue | undefined): unknown {
  if (!val) return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map((v) => fromFsValue(v));
  }
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      out[k] = fromFsValue(v);
    }
    return out;
  }
  return null;
}

function toFsFields(obj: Record<string, unknown>): Record<string, FsValue> {
  const fields: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFsValue(v);
  }
  return fields;
}

function fromFsDoc(doc: { name?: string; fields?: Record<string, FsValue> }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    out[k] = fromFsValue(v);
  }
  if (!out.id && doc.name) {
    const parts = doc.name.split('/');
    out.id = parts[parts.length - 1];
  }
  return out;
}

function makeHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function newDocId(): string {
  return `${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
}

export async function fsGetDoc<T = Record<string, unknown>>(
  collection: string,
  id: string,
  token?: string
): Promise<{ exists: boolean; id: string; data: T | null }> {
  const url = `${BASE_DOC_URL}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}?key=${API_KEY}`;
  const resp = await fetch(url, { headers: makeHeaders(token) });
  if (resp.status === 404) {
    return { exists: false, id, data: null };
  }
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(body?.error?.message || `Firestore GET ${collection}/${id} failed (${resp.status})`);
  }
  return { exists: true, id, data: fromFsDoc(body) as T };
}

export async function fsSetDoc<T extends Record<string, unknown>>(
  collection: string,
  id: string,
  data: T,
  token?: string
): Promise<T> {
  const url = `${BASE_DOC_URL}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}?key=${API_KEY}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: makeHeaders(token),
    body: JSON.stringify({ fields: toFsFields(data) }),
  });
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(body?.error?.message || `Firestore SET ${collection}/${id} failed (${resp.status})`);
  }
  return fromFsDoc(body) as T;
}

export async function fsUpdateDoc(
  collection: string,
  id: string,
  partial: Record<string, unknown>,
  token?: string
): Promise<void> {
  const keys = Object.keys(partial).filter((k) => partial[k] !== undefined);
  if (keys.length === 0) return;
  const masks = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `${BASE_DOC_URL}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}?${masks}&key=${API_KEY}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: makeHeaders(token),
    body: JSON.stringify({ fields: toFsFields(partial) }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Firestore UPDATE ${collection}/${id} failed (${resp.status})`);
  }
}

export async function fsDeleteDoc(collection: string, id: string, token?: string): Promise<void> {
  const url = `${BASE_DOC_URL}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}?key=${API_KEY}`;
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: makeHeaders(token),
  });
  if (!resp.ok && resp.status !== 404) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Firestore DELETE ${collection}/${id} failed (${resp.status})`);
  }
}

export interface FsWhereFilter {
  field: string;
  op: 'EQUAL' | 'NOT_EQUAL' | 'LESS_THAN' | 'GREATER_THAN' | 'ARRAY_CONTAINS';
  value: unknown;
}

export async function fsQuery<T = Record<string, unknown>>(
  collection: string,
  options: {
    filters?: FsWhereFilter[];
    limit?: number;
    token?: string;
  } = {}
): Promise<T[]> {
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: collection }],
  };

  if (options.filters && options.filters.length > 0) {
    const fieldFilters = options.filters.map((f) => ({
      fieldFilter: {
        field: { fieldPath: f.field },
        op: f.op,
        value: toFsValue(f.value),
      },
    }));
    structuredQuery.where =
      fieldFilters.length === 1
        ? fieldFilters[0]
        : { compositeFilter: { op: 'AND', filters: fieldFilters } };
  }

  if (options.limit) {
    structuredQuery.limit = options.limit;
  }

  const url = `${BASE_DOC_URL}:runQuery?key=${API_KEY}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: makeHeaders(options.token),
    body: JSON.stringify({ structuredQuery }),
  });
  const body = await resp.json();
  if (!resp.ok) {
    const errMsg = Array.isArray(body) ? body[0]?.error?.message : body?.error?.message;
    throw new Error(errMsg || `Firestore QUERY ${collection} failed (${resp.status})`);
  }
  if (!Array.isArray(body)) return [];
  return body
    .filter((entry) => entry && entry.document)
    .map((entry) => fromFsDoc(entry.document) as T);
}
