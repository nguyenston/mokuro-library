/**
 * It's the same as RequestInit, but 'body' can be 'any'
 * We will convert 'body' into a valid type inside of apiFetch.
 */
interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: any;
}

/**
 * A simple wrapper for fetch to interact with our backend API.
 * This automatically handles JSON serialization, error handling,
 * and uses relative paths that work with our Vite proxy.
 */
export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  // Set default headers
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // Stringify the body if it's an object and method is not GET
  // GET request doesn't have a body by specification
  let body: BodyInit | null | undefined = options.body;
  if (
    options.body &&
    typeof options.body === 'object' &&
    options.method !== 'GET'
  ) {
    body = JSON.stringify(options.body);
  }

  const response = await fetch(path, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
    body,
  });

  // If not OK, try to parse error message from backend
  if (!response.ok) {
    try {
      const errorData = await response.json();
      throw new Error(errorData.message || 'An unknown API error occurred.');
    } catch (e) {
      throw new Error(
        (e as Error).message || `HTTP error! Status: ${response.status}`
      );
    }
  }

  // Handle successful but empty responses (e.g., 200 OK from /logout)
  // If OK but not JSON, return the response object itself (e.g., for file streams)
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return response;
  }

  // If we get here, it's a successful JSON response
  return response.json();
}
