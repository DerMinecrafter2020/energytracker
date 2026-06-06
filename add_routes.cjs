const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const s3Import = `import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';\nimport { exec } from 'child_process';\nimport util from 'util';\nconst execAsync = util.promisify(exec);\n`;

if (!content.includes('@aws-sdk/client-s3')) {
  content = content.replace(/import express from 'express';/, s3Import + "import express from 'express';");
}

const adminRoutesCode = `
// ── Admin S3 Backup Route ─────────────────────────────────────────────────────
app.post('/api/admin/backup/s3', requireAdmin, async (req, res) => {
  try {
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION || 'eu-central-1';
    
    if (!bucket) {
      return res.status(400).json({ error: 'S3 Bucket ist nicht konfiguriert (AWS_S3_BUCKET).' });
    }

    const s3Client = new S3Client({ region });
    const backupData = JSON.stringify(dbState, null, 2);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const key = \`backup-\${dateStr}.json\`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: backupData,
      ContentType: 'application/json',
    });

    await s3Client.send(command);
    res.json({ success: true, message: \`Backup erfolgreich hochgeladen: \${key}\` });
  } catch (err) {
    console.error('S3 Backup Error:', err);
    res.status(500).json({ error: 'Fehler beim S3 Backup: ' + err.message });
  }
});

// ── Admin Update Route ────────────────────────────────────────────────────────
app.post('/api/admin/update', requireAdmin, async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, 'deploy.sh');
    if (fs.existsSync(scriptPath)) {
      // Execute the deploy.sh script
      const { stdout, stderr } = await execAsync('bash ' + scriptPath);
      res.json({ success: true, message: 'Update gestartet. Log: ' + stdout });
    } else {
      // Mock update if script doesn't exist
      res.json({ success: true, message: 'Mock-Update erfolgreich (deploy.sh nicht gefunden).' });
    }
  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({ error: 'Fehler beim Update: ' + err.message });
  }
});

`;

if (!content.includes('/api/admin/backup/s3')) {
  // Inject before user management routes
  content = content.replace(/\/\/ ── User Management Routes ────────────────────────────────────────────────────/, adminRoutesCode + '\n// ── User Management Routes ────────────────────────────────────────────────────');
}

fs.writeFileSync('server.js', content);
console.log('Routes added successfully.');
