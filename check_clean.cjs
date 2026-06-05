
const fs = require("fs");
for(let i=0; i<9; i++) {
  const content = fs.readFileSync("AdminPanel_git_" + i + ".jsx", "utf8");
  if (!content.includes("const { t } = useTranslation();") || content.indexOf("const { t } = useTranslation();") === content.lastIndexOf("const { t } = useTranslation();")) {
     console.log("File " + i + " has clean hooks? length=" + content.length);
  }
}

