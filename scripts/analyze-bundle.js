import { readFileSync } from 'fs';
import { join } from 'path';

const analyzeBundle = () => {
  try {
    const distPath = join(process.cwd(), 'dist');
    const statsPath = join(distPath, 'stats.json');
    
    if (!require('fs').existsSync(statsPath)) {
      console.log('❌ Bundle analysis not found. Run `npm run build` first with stats enabled.');
      return;
    }

    const stats = JSON.parse(readFileSync(statsPath, 'utf8'));
    
    console.log('📊 Bundle Analysis Results:\n');
    
    // Analyze chunks
    const chunks = stats.chunks || [];
    console.log('📦 Chunks:');
    chunks.forEach(chunk => {
      const sizeKB = (chunk.size / 1024).toFixed(2);
      console.log(`  ${chunk.names.join(', ')}: ${sizeKB} KB`);
    });

    // Analyze assets
    const assets = stats.assets || [];
    const jsAssets = assets.filter(asset => asset.name.endsWith('.js'));
    const cssAssets = assets.filter(asset => asset.name.endsWith('.css'));
    
    console.log('\n📄 JavaScript Assets:');
    jsAssets.forEach(asset => {
      const sizeKB = (asset.size / 1024).toFixed(2);
      const gzippedKB = (asset.gzippedSize / 1024).toFixed(2);
      console.log(`  ${asset.name}: ${sizeKB} KB (gzipped: ${gzippedKB} KB)`);
    });

    console.log('\n🎨 CSS Assets:');
    cssAssets.forEach(asset => {
      const sizeKB = (asset.size / 1024).toFixed(2);
      console.log(`  ${asset.name}: ${sizeKB} KB`);
    });

    // Total size
    const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
    const totalSizeKB = (totalSize / 1024).toFixed(2);
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    
    console.log(`\n📈 Total Bundle Size: ${totalSizeKB} KB (${totalSizeMB} MB)`);
    
    // Recommendations
    console.log('\n💡 Optimization Recommendations:');
    
    const largeChunks = chunks.filter(chunk => chunk.size > 300 * 1024); // > 300KB
    if (largeChunks.length > 0) {
      console.log('  ⚠️  Consider splitting large chunks:');
      largeChunks.forEach(chunk => {
        const sizeKB = (chunk.size / 1024).toFixed(2);
        console.log(`    - ${chunk.names.join(', ')}: ${sizeKB} KB`);
      });
    }
    
    const totalJS = jsAssets.reduce((sum, asset) => sum + asset.size, 0);
    if (totalJS > 500 * 1024) { // > 500KB
      console.log('  ⚠️  JavaScript bundle is large. Consider:');
      console.log('    - Code splitting more aggressively');
      console.log('    - Tree shaking unused exports');
      console.log('    - Using dynamic imports for rarely used features');
    }
    
    if (cssAssets.length === 0) {
      console.log('  ✅ No CSS assets found (good for performance)');
    }

    console.log('\n🚀 Performance Tips:');
    console.log('  - Enable gzip compression on your server');
    console.log('  - Use CDN for static assets');
    console.log('  - Implement proper caching headers');
    console.log('  - Consider using HTTP/2 for multiplexing');
    
  } catch (error) {
    console.error('❌ Error analyzing bundle:', error.message);
  }
};

analyzeBundle();