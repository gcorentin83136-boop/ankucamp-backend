// scripts/kill-port.js
// Tue le process qui occupe le port 3001 s'il existe (Windows-friendly)

const { execSync } = require("child_process");

const PORT = process.env.PORT || 3001;

try {
  const output = execSync(
    `powershell -Command "(Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue).OwningProcess"`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
  ).trim();

  if (output && !isNaN(Number(output))) {
    console.log(`🔪 Port ${PORT} occupé par PID ${output}, on le tue...`);
    execSync(`powershell -Command "Stop-Process -Id ${output} -Force"`, {
      stdio: "ignore",
    });
    console.log(`✅ PID ${output} tué`);
  } else {
    console.log(`ℹ️  Port ${PORT} libre`);
  }
} catch {
  console.log(`ℹ️  Port ${PORT} libre`);
}