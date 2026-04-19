const { defineConfig } = require("vite");
const { readdirSync } = require("node:fs");
const { resolve } = require("node:path");

const htmlFiles = readdirSync(__dirname).filter((fileName) => fileName.endsWith(".html"));

const input = Object.fromEntries(
    htmlFiles.map((fileName) => [fileName.replace(/\.html$/i, ""), resolve(__dirname, fileName)])
);

module.exports = defineConfig({
    server: {
        proxy: {
            "/epg/mx1.xml.gz": {
                target: "https://epgshare01.online",
                changeOrigin: true,
                rewrite: () => "/epgshare01/epg_ripper_MX1.xml.gz"
            },
            "/epg/ar.xml": {
                target: "https://iptv-epg.org",
                changeOrigin: true,
                rewrite: () => "/files/epg-ar.xml"
            },
            "/stream/amz": {
                target: "https://live-pv-ta.amazon.fastly-edge.com",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/stream\/amz/, "")
            },
            "/stream/hbo": {
                target: "http://8.243.126.131:8000",
                changeOrigin: true,
                rewrite: () => "/play/a0f4/index.m3u8"
            }
        }
    },
    build: {
        rollupOptions: {
            input
        }
    }
});
