const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function getAuthHeaders(isMultipart = false) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function handleResponse(response) {
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth-expired'));
  }

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMsg = errorData.detail || errorData.message || errorMsg;
    } catch {
      errorMsg = response.statusText || errorMsg;
    }
    throw new Error(errorMsg);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  // Authentication
  async login(email, password) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(res);
  },

  async register(email, password, full_name, role = 'user') {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name, role })
    });
    return handleResponse(res);
  },

  async getMe() {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // Document Management
  async listDocuments() {
    const res = await fetch(`${BASE_URL}/api/documents/`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async checkDuplicateDocument(formData) {
    const res = await fetch(`${BASE_URL}/api/documents/check-duplicate`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: formData
    });
    return handleResponse(res);
  },

  async uploadDocument(formData) {
    const res = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: formData
    });
    return handleResponse(res);
  },

  async uploadBatchDocuments(formData) {
    const res = await fetch(`${BASE_URL}/api/documents/upload-batch`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: formData
    });
    return handleResponse(res);
  },

  async deleteDocument(id) {
    const res = await fetch(`${BASE_URL}/api/documents/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async reindexDocument(id) {
    const res = await fetch(`${BASE_URL}/api/documents/${id}/reindex`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async updateDocument(id, title) {
    const res = await fetch(`${BASE_URL}/api/documents/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title })
    });
    return handleResponse(res);
  },

  async getDocumentChunks(id) {
    const res = await fetch(`${BASE_URL}/api/documents/${id}/chunks`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getDocumentPipeline(id) {
    const res = await fetch(`${BASE_URL}/api/documents/${id}/pipeline`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },


  // Chat & Grounded Q&A
  async queryChat(query, top_k = 5, threshold = null) {
    const res = await fetch(`${BASE_URL}/api/chat/query`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ query, top_k, threshold })
    });
    return handleResponse(res);
  },

  async getChatHistory(limit = 30) {
    const res = await fetch(`${BASE_URL}/api/chat/history?limit=${limit}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async clearChatHistory() {
    const res = await fetch(`${BASE_URL}/api/chat/history`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getSystemStats() {
    const res = await fetch(`${BASE_URL}/api/chat/stats`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // Document Download
  async downloadDocument(id, filename) {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/api/documents/${id}/download`, { headers });

    if (!res.ok) {
      let errDetail = 'Failed to download document.';
      try {
        const errJson = await res.json();
        if (errJson.detail) errDetail = errJson.detail;
      } catch {}
      throw new Error(errDetail);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename || `document_${id}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  // Report Export
  async downloadReport(chatId, format = 'markdown') {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/api/chat/report/${chatId}?format=${format}`, {
      headers
    });

    if (!res.ok) {
      let errDetail = 'Failed to generate audit report.';
      try {
        const errJson = await res.json();
        if (errJson.detail) errDetail = errJson.detail;
      } catch {}
      throw new Error(errDetail);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `verification_report_${chatId}.${format === 'pdf' ? 'pdf' : 'md'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }
};
