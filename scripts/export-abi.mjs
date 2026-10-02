import fs from "fs";
import path from "path";

const names = ["CheckInEvents", "CheckInTickets", "CheckInRewards"];
const outDir = path.join("src", "contracts", "abi");
fs.mkdirSync(outDir, { recursive: true });

for (const name of names) {
  const artifactPath = path.join("artifacts", "contracts", `${name}.sol`, `${name}.json`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(artifact.abi, null, 2));
  console.log(`Exported ${name} ABI`);
}
