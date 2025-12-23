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
    options.method !== 'GET' &&
    !(options.body instanceof FormData)
  ) {
    body = JSON.stringify(options.body);
  }

  // --- Conditionally build headers ---
  const finalHeaders: Record<string, string> = {
    ...defaultHeaders,
    ...(options.headers as Record<string, string>),
  };

  if (options.body instanceof FormData || options.method === 'DELETE') {
    // If body is FormData, delete the 'Content-Type' header
    // so the browser can set it automatically.
    delete finalHeaders['Content-Type'];
  }

  const response = await fetch(path, {
    ...options,
    headers: finalHeaders,
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

/**
 * Specialized upload function using XMLHttpRequest to support progress tracking.
 * fetch() does not support upload progress, so we must use XHR.
 */
export function apiUpload(
  path: string,
  formData: FormData,
  onProgress: (percent: number) => void,
  maxRetries = 2
): Promise<any> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const tryUpload = () => {
      attempts++;
      console.log(`Upload attempt ${attempts}/${maxRetries + 1}`);

      const xhr = new XMLHttpRequest();
      let hasStarted = false;

      // Short timeout to detect "stuck" requests that never start
      const stuckTimer = setTimeout(() => {
        console.log(`hasStarted: ${hasStarted}`)
        if (!hasStarted) {
          console.log('Request appears stuck, aborting...');
          xhr.abort();
          if (attempts <= maxRetries) {
            setTimeout(tryUpload, 200);
          } else {
            reject(new Error('Upload failed: request never started after retries'));
          }
        }
      }, 5000);

      xhr.open('POST', path);

      xhr.onreadystatechange = () => {
        // readyState 2 = HEADERS_RECEIVED (server has received the request)
        if (xhr.readyState >= 2 && !hasStarted) {
          hasStarted = true;
          clearTimeout(stuckTimer);
          console.log('Request started successfully');
        }
      };

      if (xhr.upload) {
        xhr.upload.onprogress = (event) => {
          hasStarted = true;
          clearTimeout(stuckTimer);
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      // Longer timeout for the actual upload (adjust based on your file sizes)
      xhr.timeout = 300000; // 5 minutes

      xhr.ontimeout = () => {
        clearTimeout(stuckTimer);
        if (attempts <= maxRetries) {
          console.log('Request timed out, retrying...');
          setTimeout(tryUpload, 200);
        } else {
          reject(new Error('Upload timed out after retries'));
        }
      };

      xhr.onload = () => {
        clearTimeout(stuckTimer);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            resolve(xhr.responseText);
          }
        } else {
          // Don't retry on server errors (4xx, 5xx) - only on stuck/timeout
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.message || 'Upload failed'));
          } catch (e) {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        clearTimeout(stuckTimer);
        if (attempts <= maxRetries) {
          console.log('Network error, retrying...');
          setTimeout(tryUpload, 200);
        } else {
          reject(new Error('Network error during upload'));
        }
      };

      xhr.send(formData);
    };

    tryUpload();
  });
}

/**
 * Triggers a browser download by navigating to the URL.
 */
export function triggerDownload(path: string) {
  window.location.assign(path);
}
