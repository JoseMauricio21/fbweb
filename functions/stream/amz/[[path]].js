const AMAZON_ORIGIN = "https://live-pv-ta.amazon.fastly-edge.com";
const PROXY_PREFIX = "/stream/amz/";

function buildHeaders(contentType) {
    const headers = new Headers();
    headers.set("content-type", contentType || "application/octet-stream");
    headers.set("cache-control", "public, max-age=20");
    headers.set("access-control-allow-origin", "*");
    headers.set("access-control-allow-methods", "GET, OPTIONS");
    headers.set("access-control-allow-headers", "*");
    return headers;
}

function isValidUpstreamPath(pathname) {
    if (!pathname || pathname.includes("..")) {
        return false;
    }

    return pathname.startsWith("iad-nitro/live/clients/dash/enc/");
}

export async function onRequest(context) {
    if (context.request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: buildHeaders("text/plain; charset=utf-8")
        });
    }

    if (context.request.method !== "GET") {
        return new Response("Method Not Allowed", {
            status: 405,
            headers: buildHeaders("text/plain; charset=utf-8")
        });
    }

    const requestUrl = new URL(context.request.url);
    if (!requestUrl.pathname.startsWith(PROXY_PREFIX)) {
        return new Response("Not Found", {
            status: 404,
            headers: buildHeaders("text/plain; charset=utf-8")
        });
    }

    const upstreamPath = requestUrl.pathname.slice(PROXY_PREFIX.length);
    if (!isValidUpstreamPath(upstreamPath)) {
        return new Response("Blocked upstream path", {
            status: 403,
            headers: buildHeaders("text/plain; charset=utf-8")
        });
    }

    const upstreamUrl = `${AMAZON_ORIGIN}/${upstreamPath}${requestUrl.search || ""}`;

    const upstreamHeaders = new Headers();
    const rangeHeader = context.request.headers.get("range");
    if (rangeHeader) {
        upstreamHeaders.set("range", rangeHeader);
    }

    const userAgent = context.request.headers.get("user-agent");
    if (userAgent) {
        upstreamHeaders.set("user-agent", userAgent);
    }

    const upstreamResponse = await fetch(upstreamUrl, {
        headers: upstreamHeaders
    });

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
        return new Response(`Upstream error: ${upstreamResponse.status}`, {
            status: 502,
            headers: buildHeaders("text/plain; charset=utf-8")
        });
    }

    const responseHeaders = buildHeaders(upstreamResponse.headers.get("content-type"));
    const contentLength = upstreamResponse.headers.get("content-length");
    const contentRange = upstreamResponse.headers.get("content-range");
    const acceptRanges = upstreamResponse.headers.get("accept-ranges");

    if (contentLength) {
        responseHeaders.set("content-length", contentLength);
    }

    if (contentRange) {
        responseHeaders.set("content-range", contentRange);
    }

    if (acceptRanges) {
        responseHeaders.set("accept-ranges", acceptRanges);
    }

    return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders
    });
}
