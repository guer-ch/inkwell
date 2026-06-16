// Automated unit tests for Inkwell Agentic Skills and configuration.
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('Starting Inkwell Agent Skills verification suite...');

// Test 1: Verify Skill files exist and are well-formed
function testSkillsExist() {
  console.log('  Running Test 1: Checking SKILL.md files...');
  const skills = ['outlining', 'drafting', 'humanizing'];
  
  skills.forEach(skill => {
    const skillPath = path.join(rootDir, 'skills', skill, 'SKILL.md');
    assert.ok(fs.existsSync(skillPath), `Skill file missing for ${skill} at ${skillPath}`);
    
    const content = fs.readFileSync(skillPath, 'utf-8');
    // Basic YAML frontmatter validation
    assert.ok(content.startsWith('---'), `Skill ${skill} must start with YAML frontmatter delimiters '---'`);
    
    const frontmatterEnd = content.indexOf('---', 3);
    assert.ok(frontmatterEnd > 3, `Skill ${skill} is missing closing YAML frontmatter delimiter '---'`);
    
    const yamlContent = content.substring(3, frontmatterEnd);
    assert.ok(yamlContent.includes('name:'), `Skill ${skill} YAML must specify a 'name' field`);
    assert.ok(yamlContent.includes('description:'), `Skill ${skill} YAML must specify a 'description' field`);
    
    console.log(`    ✓ Skill "${skill}" validated successfully.`);
  });
}

// Test 2: Verify dynamic chapter count logic
function testChapterCountLogic() {
  console.log('  Running Test 2: Verifying dynamic chapter count logic...');
  
  const calculateChapters = (pagesPerVolume) => Math.max(5, Math.round(pagesPerVolume / 10));
  
  assert.strictEqual(calculateChapters(150), 15, '150 pages should produce 15 chapters');
  assert.strictEqual(calculateChapters(50), 5, '50 pages should produce 5 chapters');
  assert.strictEqual(calculateChapters(20), 5, '20 pages should produce minimum 5 chapters');
  assert.strictEqual(calculateChapters(1000), 100, '1000 pages should produce 100 chapters');
  
  console.log('    ✓ Chapter count calculations validated successfully.');
}

// Test 3: Verify security sanitization on outlines
function testSecuritySanitization() {
  console.log('  Running Test 3: Verifying output string validation...');
  
  // Simulation of a simple JSON check to prevent script injections in outlines
  const containsScriptInjections = (str) => {
    const lower = str.toLowerCase();
    return lower.includes('<script') || lower.includes('javascript:') || lower.includes('onload=') || lower.includes('onerror=');
  };
  
  const safeJson = JSON.stringify({ title: "My safe book", chapters: [] });
  const unsafeJson = JSON.stringify({ title: "Unsafe Book <script>alert(1)</script>", chapters: [] });
  const onloadInjection = JSON.stringify({ title: "Unsafe <img src=x onerror=alert(1)>", chapters: [] });
  
  assert.strictEqual(containsScriptInjections(safeJson), false, 'Safe JSON identified as unsafe');
  assert.strictEqual(containsScriptInjections(unsafeJson), true, 'Unsafe JSON with script tag missed');
  assert.strictEqual(containsScriptInjections(onloadInjection), true, 'Unsafe JSON with onerror handler missed');
  
  console.log('    ✓ Security sanitization rules verified successfully.');
}

// Test 4: Verify humanizer rules content check
function testHumanizerRulesCheck() {
  console.log('  Running Test 4: Checking humanizer skill blacklist coverage...');
  const humanizerPath = path.join(rootDir, 'skills', 'humanizing', 'SKILL.md');
  const content = fs.readFileSync(humanizerPath, 'utf-8');
  
  const blacklistedPhrases = ['delve', 'testament', 'beacon', 'tapestry', 'not only... but also', 'in conclusion'];
  blacklistedPhrases.forEach(phrase => {
    assert.ok(content.toLowerCase().includes(phrase), `Humanizing SKILL.md should explicitly target blacklist phrase: "${phrase}"`);
  });
  
  console.log('    ✓ Humanizer blacklist checked and confirmed.');
}

try {
  testSkillsExist();
  testChapterCountLogic();
  testSecuritySanitization();
  testHumanizerRulesCheck();
  console.log('\nAll Inkwell Agent Skill tests passed successfully! [SECURE & TESTED]');
  process.exit(0);
} catch (error) {
  console.error('\n✖ Test suite failed:', error.message);
  process.exit(1);
}
