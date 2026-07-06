const TOKEN_KEY = 'qas_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...options, headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the server — check your connection and try again.')
  }

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    clearToken()
    window.location.assign('/login')
    throw new ApiError(401, 'Session expired')
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') detail = body.detail
      else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
        detail = body.detail
          .map((d: { loc?: (string | number)[]; msg: string }) =>
            `${(d.loc ?? []).slice(1).join('.')}: ${d.msg}`)
          .join('; ')
      }
    } catch {
      // keep default message
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: unknown) =>
    request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
  upload: (path: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request(path, { method: 'POST', body: form })
  },
  /** Fetch a protected file and trigger a browser download. */
  download: async (path: string, filename: string) => {
    const headers = new Headers()
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const res = await fetch(`/api${path}`, { headers })
    if (!res.ok) throw new ApiError(res.status, 'Download failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
}
