const axios = require("axios");

class HttpNotifyHandler {
  /**
   * This method should check if a type property is present
   * inside the payload and invoke the correct handler.
   * @param { JSON } payload the payload passed through postgres
   * @returns {Promise<any>} .
   */
  async dispatch(payload) {
    if (!payload.method || !payload.url) {
      throw new Error("Incoming payload does not meet schema")
    }

    const acceptedMethods = ["GET", "POST", "PUT", "DELETE"];
    if (!acceptedMethods.includes(payload.method)) {
      throw new Error("Unsuported http method!");
    }

    try {
      const requestConfig = {
        method: payload.method,
        url: payload.url,
        headers: payload.headers ?? {}
      }

      if (payload.method !== "GET") {
        // `data` is the data to be sent as the request body
        // Only applicable for request methods 'PUT', 'POST', 'DELETE', and 'PATCH'
        // When no `transformRequest` is set, must be of one of the following types:
        // - string, plain object, ArrayBuffer, ArrayBufferView, URLSearchParams
        // - Browser only: FormData, File, Blob
        // - Node only: Stream, Buffer
        requestConfig.data = payload.body;
      } else {
        // `params` are the URL parameters to be sent with the request
        // Must be a plain object or a URLSearchParams object
        // NOTE: params that are null or undefined are not rendered in the URL.
        request.params = payload.params ?? {};
      }

      const response = await axios(requestConfig);

      console.log(response.data);
    } catch (error) {
      if (error.response) {
        throw new Error(`Response falls out of the range 2xx: ${JSON.stringify({ data: error.response.data, status: error.response.status })}`);
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        throw new Error(`The request was made but no response was received ${JSON.stringify(error.request)}`);
      } else {
        throw new Error(`Something happened in setting up the request that triggered an Error: ${error.message}`);
      }
    }
  }
}

module.exports = new HttpNotifyHandler();