
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

let count = 0;
walk(".git/objects", (filePath) => {
    if (filePath.includes("pack") || filePath.includes("info")) return;
    try {
        const compressed = fs.readFileSync(filePath);
        const decompressed = zlib.inflateSync(compressed).toString("utf8");
        if (decompressed.includes("const AdminPanel =") && decompressed.includes("export default AdminPanel;")) {
            const nullIdx = decompressed.indexOf("\0");
            const content = decompressed.substring(nullIdx + 1);
            fs.writeFileSync("AdminPanel_git_" + count + ".jsx", content, "utf8");
            console.log("Saved AdminPanel_git_" + count + ".jsx, length: " + content.length);
            count++;
        }
    } catch(e) {}
});

