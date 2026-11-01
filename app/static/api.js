let csrfToken = '';
export function setCsrf(token) { csrfToken = token || ''; }
export async function request(path, data) {
  const response = await fetch(path, data === undefined ? {} : {
    method: 'POST', headers: {'Content-Type': 'application/json', 'X-CSRF-Token':csrfToken}, body: JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || '暂时无法完成操作，请稍后重试。');
    error.status = response.status;
    throw error;
  }
  return body;
}
