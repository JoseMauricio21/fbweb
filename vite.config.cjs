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
            }
        }
    },
    build: {
        rollupOptions: {
            input
        }
    }
});
