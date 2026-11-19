// C:\ANKU\backend\clean-stories.js
const { db } = require('./dist/core/db'); // Ou le chemin vers ton fichier db
const { stories } = require('./dist/core/db/schema');
const { like } = require('drizzle-orm');

async function cleanStories() {
  try {
    const result = await db.delete(stories).where(like(stories.media_url, 'blob:%'));
    console.log('✅ Stories avec blob: supprimées avec succès !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la suppression :', error);
    process.exit(1);
  }
}

cleanStories();